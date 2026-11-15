#!/usr/bin/env bash
# Microsoft Azure deployment for sars-pipeline (the site itself is a Cloudflare Worker). See backend/deploy/README.md.
#   backend/deploy/azure.sh sizes    VM sizes this subscription may create here (read-only)
#   backend/deploy/azure.sh vm       once: resource group, storage for results, a Linux VM with Docker
#   backend/deploy/azure.sh deploy   copy the committed code and backend/.env, build, (re)start
#   backend/deploy/azure.sh seed     copy data/selected, data/interim and data/processed to the VM
#   backend/deploy/azure.sh site     build the frontend against storage and the API, publish it to Cloudflare (changes the live site)
#   backend/deploy/azure.sh dns      print the DNS records for SARS_DOMAIN (read-only)
#   backend/deploy/azure.sh status   health, containers, disk, last copies to storage (read-only)
#   backend/deploy/azure.sh ssh      open a shell on the VM (logs: sudo docker logs -f sars-api-1)
set -euo pipefail

PREFIX="${AZ_PREFIX:?set AZ_PREFIX to a short lowercase name, e.g. borrenautas}"
RG="${AZ_RG:-sars}"
LOC="${AZ_LOCATION:-westus2}"  # near the NISAR data in AWS us-west-2 (Oregon)
VM=sars-vm
STORAGE="${PREFIX//-/}sars"  # storage account: 3 to 24 lowercase letters and digits, unique in Azure
DATA_URL="https://${STORAGE}.blob.core.windows.net/data/"  # browsers read results here
VM_HOST="${PREFIX}-sars.${LOC}.cloudapp.azure.com"  # the VM's own name: always there, used for SSH
# Public name of the API. With SARS_DOMAIN=<your domain>: api.<domain> (create the DNS record
# first: azure.sh dns). Caddy gets the certificate for this name.
HOST="${SARS_DOMAIN:+api.${SARS_DOMAIN}}"
HOST="${HOST:-$VM_HOST}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"  # repo root (uv workspace)
SSH=(ssh -o StrictHostKeyChecking=accept-new "azureuser@${VM_HOST}")
# 2 vCPU / 8 GB, cheapest first: one site run peaks at a few GB.
SIZES="Standard_B2s_v2 Standard_B2as_v2 Standard_B2ms Standard_D2as_v5 Standard_D2s_v5 Standard_D2s_v3"

allowed_sizes() {
  # Without --all the list holds only sizes this subscription may create in this region.
  local have
  have="$(az vm list-skus -l "$LOC" --resource-type virtualMachines --query "[].name" -o tsv | tr -d '\r')"
  for s in $SIZES; do grep -qx "$s" <<<"$have" && echo "$s"; done
  return 0
}

case "${1:-}" in
sizes)
  allowed_sizes
  ;;
vm)
  # sed, not head: head closes the pipe early and pipefail would stop the script without a word.
  SIZE="${AZ_VM_SIZE:-$(allowed_sizes | sed -n 1p)}"
  [ -n "$SIZE" ] || { echo "none of: $SIZES is allowed in $LOC; set AZ_VM_SIZE or AZ_LOCATION" >&2; exit 1; }
  echo "VM size: $SIZE"
  az group create -n "$RG" -l "$LOC" -o none
  # 64 GB disk: cached radar windows. Key-only login (no password). --nsg-rule NONE: no port is
  # open until the rules below. --assign-identity: the VM signs in to storage as itself.
  az vm create -g "$RG" -n "$VM" --image Ubuntu2404 --size "$SIZE" \
    --os-disk-size-gb 64 --admin-username azureuser --generate-ssh-keys --assign-identity \
    --public-ip-sku Standard --public-ip-address-dns-name "${PREFIX}-sars" \
    --nsg-rule NONE --custom-data "$ROOT/backend/deploy/cloud-init.yaml" -o none
  az vm open-port -g "$RG" -n "$VM" --port 80,443 --priority 900 -o none
  # SSH only from this machine's address (override: AZ_SSH_FROM=<ip or CIDR>).
  FROM="${AZ_SSH_FROM:-$(curl -fsS https://api.ipify.org)}"
  az network nsg rule create -g "$RG" --nsg-name "${VM}NSG" -n ssh --priority 1000 \
    --source-address-prefixes "$FROM" --destination-port-ranges 22 --protocol Tcp --access Allow -o none
  # Results (images, JSON) live in Blob Storage: anyone may read a file, nobody may list or write.
  az storage account create -g "$RG" -n "$STORAGE" -l "$LOC" --sku Standard_LRS --kind StorageV2 \
    --allow-blob-public-access true --min-tls-version TLS1_2 -o none
  az storage container-rm create -g "$RG" --storage-account "$STORAGE" -n data --public-access blob -o none
  # The site is on another domain, so browsers need CORS to read the files.
  KEY="$(az storage account keys list -g "$RG" -n "$STORAGE" --query "[0].value" -o tsv | tr -d '\r')"
  az storage cors add --account-name "$STORAGE" --account-key "$KEY" --services b \
    --methods GET HEAD OPTIONS --origins '*' --allowed-headers '*' --exposed-headers '*' --max-age 3600
  # Only the VM may write, as itself (managed identity): the key above is not stored anywhere.
  WHO="$(az vm show -g "$RG" -n "$VM" --query identity.principalId -o tsv | tr -d '\r')"
  SCOPE="$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv | tr -d '\r')"
  # MSYS_NO_PATHCONV: Git Bash would rewrite the scope ("/subscriptions/...") into a Windows path.
  MSYS_NO_PATHCONV=1 az role assignment create --assignee-object-id "$WHO" \
    --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope "$SCOPE" -o none
  echo "VM ${VM_HOST} created (SSH allowed from ${FROM}); results at ${DATA_URL}"
  echo "Docker installs in the first minutes; then: $0 deploy"
  ;;
deploy)
  [ -f "$ROOT/backend/.env" ] || { echo "backend/.env missing (ASF_EARTH_DATA_TOKEN, FIRMS_MAP_KEY)" >&2; exit 1; }
  "${SSH[@]}" 'cloud-init status --wait >/dev/null; rm -rf /opt/sars/src; mkdir -p /opt/sars/src'
  # Only committed files reach the VM (git archive): never data/ or stray local files.
  git -C "$ROOT" archive HEAD pyproject.toml uv.lock backend | "${SSH[@]}" 'tar -x -C /opt/sars/src'
  # Secrets go to /opt/sars/.env (owner-only), outside the image. The admin token for
  # POST /sites options is generated on the first deploy and kept afterwards.
  tr -d '\r' <"$ROOT/backend/.env" | grep -v '^SARS_ADMIN_TOKEN=' | "${SSH[@]}" '
    umask 077; cd /opt/sars
    tok="$(grep -s "^SARS_ADMIN_TOKEN=" .env || echo "SARS_ADMIN_TOKEN=$(openssl rand -hex 24)")"
    { cat; echo "$tok"; } > .env.new && mv .env.new .env'
  "${SSH[@]}" "cd /opt/sars/src && sudo SARS_HOST=${HOST} SARS_STORAGE=${STORAGE} \
    GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD) \
    docker compose -p sars -f backend/deploy/compose.yaml --project-directory . up -d --build --remove-orphans"
  echo "API: https://${HOST}  (the certificate takes about a minute on the first deploy)"
  echo "results: ${DATA_URL}manifest.json"
  echo "admin token: $0 ssh, then: grep SARS_ADMIN_TOKEN /opt/sars/.env"
  ;;
seed)
  # Same granules as local runs, the cached windows (so the VM does not stream them again)
  # and the processed outputs, so the API starts with data. The sync container (compose.yaml)
  # then copies the outputs to storage.
  # sites.json: the places looked up locally, so the VM knows them as cached.
  # Not live.geojson: the VM collects its own every few minutes; the local one is older.
  (cd "$ROOT/data" && tar -c --exclude=processed/live.geojson selected interim processed $(ls sites.json 2>/dev/null)) |
    "${SSH[@]}" 'sudo tar -x -C /opt/sars/data'
  ;;
ssh)
  "${SSH[@]}"
  ;;
status)
  curl -fsS -m 10 "https://${HOST}/health" && echo "  <- https://${HOST}/health"
  curl -fsS -m 10 -o /dev/null -w "manifest in storage: HTTP %{http_code}, %{size_download} bytes\n" "${DATA_URL}manifest.json" || true
  "${SSH[@]}" 'sudo docker ps --format "{{.Names}}\t{{.Status}}"; df -h /opt/sars/data | tail -n 1; free -m | sed -n 2,3p; sudo docker logs --tail 5 sars-sync-1 2>&1'
  ;;
site)
  # Run from a checkout that has frontend/ (main, testing or frontend), after `npx wrangler login`.
  # The site is the Cloudflare Worker named in frontend/wrangler.jsonc (static files only), not
  # Azure: the page stays up when the VM or the Azure credit is gone. Cloudflare also builds it
  # by itself from GitHub (Workers Builds); this is the by-hand way and replaces the live site.
  # Files come from storage, calls (lookup, push, history) from the API on the VM.
  (cd "$ROOT/frontend" && npm ci && VITE_DATA_BASE="$DATA_URL" VITE_API_BASE="https://${HOST}/" npm run build &&
    npx -y wrangler deploy)
  ;;
dns)
  DOMAIN="${SARS_DOMAIN:?set SARS_DOMAIN to your domain, e.g. example.org}"
  IP="$(az vm show -d -g "$RG" -n "$VM" --query publicIps -o tsv | tr -d '\r')"
  echo "In Cloudflare DNS for ${DOMAIN}:"
  echo "  A  api  ${IP}   proxy OFF (grey cloud, DNS only)"
  echo "  the site: Workers & Pages > the site's Worker > Settings > Domains & Routes > add ${DOMAIN}"
  echo "Then: SARS_DOMAIN=${DOMAIN} $0 deploy    (API moves to https://api.${DOMAIN})"
  echo "      SARS_DOMAIN=${DOMAIN} $0 site      (site built against the new API name)"
  ;;
*)
  sed -n '2,10p' "$0"
  exit 1
  ;;
esac
