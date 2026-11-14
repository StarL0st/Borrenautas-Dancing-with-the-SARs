#!/usr/bin/env bash
# Microsoft Azure deployment for sars-pipeline. See backend/deploy/README.md ("Azure").
#   backend/deploy/azure.sh vm       once: resource group and a Linux VM with Docker
#   backend/deploy/azure.sh deploy   copy the committed code and backend/.env, build, (re)start
#   backend/deploy/azure.sh seed     copy data/selected, data/interim and data/processed to the VM
#   backend/deploy/azure.sh site     build the frontend against the API and publish it (Static Web Apps)
#   backend/deploy/azure.sh ssh      open a shell on the VM (logs: sudo docker logs -f sars-api-1)
set -euo pipefail

PREFIX="${AZ_PREFIX:?set AZ_PREFIX to a short lowercase name, e.g. borrenautas}"
RG="${AZ_RG:-sars}"
LOC="${AZ_LOCATION:-westus2}"  # near the NISAR data in AWS us-west-2 (Oregon)
VM=sars-vm
SITE=sars-site
HOST="${PREFIX}-sars.${LOC}.cloudapp.azure.com"  # the VM's public name; Caddy gets its certificate
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"  # repo root (uv workspace)
SSH=(ssh -o StrictHostKeyChecking=accept-new "azureuser@${HOST}")

case "${1:-}" in
vm)
  az group create -n "$RG" -l "$LOC" -o none
  # 2 vCPU / 8 GB: one site run peaks at a few GB. 64 GB disk: cached radar windows.
  # Key-only login (no password). --nsg-rule NONE: no port is open until the rules below.
  az vm create -g "$RG" -n "$VM" --image Ubuntu2404 --size "${AZ_VM_SIZE:-Standard_B2ms}" \
    --os-disk-size-gb 64 --admin-username azureuser --generate-ssh-keys \
    --public-ip-sku Standard --public-ip-address-dns-name "${PREFIX}-sars" \
    --nsg-rule NONE --custom-data "$ROOT/backend/deploy/cloud-init.yaml" -o none
  az vm open-port -g "$RG" -n "$VM" --port 80,443 --priority 900 -o none
  # SSH only from this machine's address (override: AZ_SSH_FROM=<ip or CIDR>).
  FROM="${AZ_SSH_FROM:-$(curl -fsS https://api.ipify.org)}"
  az network nsg rule create -g "$RG" --nsg-name "${VM}NSG" -n ssh --priority 1000 \
    --source-address-prefixes "$FROM" --destination-port-ranges 22 --protocol Tcp --access Allow -o none
  echo "VM ${HOST} created (SSH allowed from ${FROM}). Docker installs in the first minutes; then: $0 deploy"
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
  "${SSH[@]}" "cd /opt/sars/src && sudo SARS_HOST=${HOST} GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD) \
    docker compose -p sars -f backend/deploy/compose.yaml --project-directory . up -d --build"
  echo "https://${HOST}  (the certificate takes about a minute on the first deploy)"
  echo "admin token: $0 ssh, then: grep SARS_ADMIN_TOKEN /opt/sars/.env"
  ;;
seed)
  # Same granules as local runs, the cached windows (so the VM does not stream them again)
  # and the processed outputs, so the API starts with data.
  tar -c -C "$ROOT/data" selected interim processed | "${SSH[@]}" 'sudo tar -x -C /opt/sars/data'
  ;;
ssh)
  "${SSH[@]}"
  ;;
site)
  # Run from a checkout whose frontend/ has the 0.3+ integration (testing branch, or frontend
  # once frontend/integration-0.3.patch is applied).
  az staticwebapp show -g "$RG" -n "$SITE" -o none 2>/dev/null ||
    az staticwebapp create -g "$RG" -n "$SITE" -l "$LOC" --sku Free -o none
  DEPLOY="$(az staticwebapp secrets list -g "$RG" -n "$SITE" --query properties.apiKey -o tsv)"
  (cd "$ROOT/frontend" && npm ci && VITE_DATA_BASE="https://${HOST}/" npm run build &&
    npx -y @azure/static-web-apps-cli deploy dist --deployment-token "$DEPLOY" --env production)
  echo "https://$(az staticwebapp show -g "$RG" -n "$SITE" --query defaultHostname -o tsv)"
  ;;
*)
  sed -n '2,7p' "$0"
  exit 1
  ;;
esac
