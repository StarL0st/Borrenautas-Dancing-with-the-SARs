#!/usr/bin/env bash
# Microsoft Azure deployment for sars-pipeline. See backend/deploy/README.md ("Azure").
#   backend/deploy/azure.sh setup   once: resource group, registry, file share, Container Apps environment
#   backend/deploy/azure.sh build   build and push the image in the cloud (az acr build, no local Docker)
#   backend/deploy/azure.sh seed    copy data/selected and data/processed to the file share
#   backend/deploy/azure.sh api     deploy the API (refreshes every site every 12 h), print its URL
#   backend/deploy/azure.sh site    build the frontend against the API and publish it (Static Web Apps)
set -euo pipefail

PREFIX="${AZ_PREFIX:?set AZ_PREFIX to a short lowercase name, e.g. borrenautas}"
RG="${AZ_RG:-sars}"
LOC="${AZ_LOCATION:-westus2}"  # near the NISAR data in AWS us-west-2 (Oregon)
ACR="${PREFIX}sars"            # registry and storage names: global, lowercase letters and digits
STORE="${PREFIX}sarsdata"
ENV=sars-env
APP=sars-api
SITE=sars-site
IMAGE="${ACR}.azurecr.io/sars-pipeline:latest"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"  # repo root (uv workspace)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT  # also removes the generated app.yaml, which holds secrets

env_value() { grep -E "^$1=" "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\r"' || true; }
store_key() { az storage account keys list -g "$RG" -n "$STORE" --query '[0].value' -o tsv; }

case "${1:-}" in
setup)
  az extension add --name containerapp --upgrade --only-show-errors
  az provider register --namespace Microsoft.App --wait
  az provider register --namespace Microsoft.OperationalInsights --wait
  az group create -n "$RG" -l "$LOC" -o none
  az acr show -n "$ACR" -o none 2>/dev/null ||
    az acr create -g "$RG" -n "$ACR" --sku Basic --admin-enabled true -o none
  az storage account show -g "$RG" -n "$STORE" -o none 2>/dev/null ||
    az storage account create -g "$RG" -n "$STORE" -l "$LOC" --sku Standard_LRS --kind StorageV2 -o none
  az storage share-rm create -g "$RG" --storage-account "$STORE" -n data --quota 100 -o none
  az containerapp env show -g "$RG" -n "$ENV" -o none 2>/dev/null ||
    az containerapp env create -g "$RG" -n "$ENV" -l "$LOC" -o none
  # The share is mounted at /data in the app: selections, cached windows, outputs.
  az containerapp env storage set -g "$RG" -n "$ENV" --storage-name data \
    --azure-file-account-name "$STORE" --azure-file-account-key "$(store_key)" \
    --azure-file-share-name data --access-mode ReadWrite -o none
  echo "setup done: registry ${ACR}, file share ${STORE}/data, environment ${ENV}"
  ;;
build)
  # Only committed files go into the image (git archive): never .env or data/.
  git -C "$ROOT" archive HEAD pyproject.toml uv.lock backend | tar -x -C "$TMP"
  az acr build -r "$ACR" -t sars-pipeline:latest -f backend/deploy/Dockerfile \
    --build-arg "GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD)" "$TMP"
  ;;
seed)
  # Same granules as local runs, and the processed outputs, so the API starts with data.
  for dir in selected processed; do
    if [ -d "$ROOT/data/$dir" ]; then
      az storage file upload-batch --account-name "$STORE" --account-key "$(store_key)" \
        --destination data --destination-path "$dir" --source "$ROOT/data/$dir" -o none
    fi
  done
  ;;
api)
  TOKEN="$(env_value ASF_EARTH_DATA_TOKEN)"
  [ -n "$TOKEN" ] || { echo "ASF_EARTH_DATA_TOKEN missing in backend/.env" >&2; exit 1; }
  FIRMS="$(env_value FIRMS_MAP_KEY)"
  EXISTS=""
  if az containerapp show -g "$RG" -n "$APP" -o none 2>/dev/null; then EXISTS=1; fi
  # Keep the admin token for POST /sites across deploys; generate it the first time.
  ADMIN=""
  if [ -n "$EXISTS" ]; then
    ADMIN="$(az containerapp secret show -g "$RG" -n "$APP" --secret-name admin-token \
      --query value -o tsv 2>/dev/null || true)"
  fi
  [ -n "$ADMIN" ] || ADMIN="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
  ACR_PW="$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)"
  ENV_ID="$(az containerapp env show -g "$RG" -n "$ENV" --query id -o tsv)"
  FIRMS_SECRET="" FIRMS_ENV=""
  if [ -n "$FIRMS" ]; then
    FIRMS_SECRET="    - {name: firms-map-key, value: \"${FIRMS}\"}"
    FIRMS_ENV="      - {name: FIRMS_MAP_KEY, secretRef: firms-map-key}"
  fi
  # --jobs: POST /sites queues new places; --watch-hours 12: re-check every site for new
  # granules (only sites with new data are processed). One replica: one job queue.
  cat >"$TMP/app.yaml" <<EOF
location: ${LOC}
properties:
  managedEnvironmentId: ${ENV_ID}
  configuration:
    activeRevisionsMode: Single
    ingress: {external: true, targetPort: 8080, transport: auto}
    registries:
    - {server: ${ACR}.azurecr.io, username: ${ACR}, passwordSecretRef: acr-password}
    secrets:
    - {name: acr-password, value: "${ACR_PW}"}
    - {name: earthdata-token, value: "${TOKEN}"}
    - {name: admin-token, value: "${ADMIN}"}
${FIRMS_SECRET}
  template:
    containers:
    - name: ${APP}
      image: ${IMAGE}
      resources: {cpu: 2, memory: 4Gi}
      env:
      - {name: ASF_EARTH_DATA_TOKEN, secretRef: earthdata-token}
      - {name: SARS_ADMIN_TOKEN, secretRef: admin-token}
      - {name: SARS_SERVE_FLAGS, value: "--jobs --watch-hours 12"}
${FIRMS_ENV}
      volumeMounts:
      - {volumeName: data, mountPath: /data}
    scale: {minReplicas: 1, maxReplicas: 1}
    volumes:
    - {name: data, storageType: AzureFile, storageName: data}
EOF
  if [ -n "$EXISTS" ]; then
    az containerapp update -g "$RG" -n "$APP" --yaml "$TMP/app.yaml" -o none
  else
    az containerapp create -g "$RG" -n "$APP" --yaml "$TMP/app.yaml" -o none
  fi
  echo "https://$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)"
  echo "admin token for POST /sites: az containerapp secret show -g ${RG} -n ${APP} --secret-name admin-token --query value -o tsv"
  ;;
site)
  # Run from a checkout whose frontend/ has the 0.3+ integration (testing branch, or frontend
  # once frontend/integration-0.3.patch is applied).
  URL="https://$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)/"
  az staticwebapp show -g "$RG" -n "$SITE" -o none 2>/dev/null ||
    az staticwebapp create -g "$RG" -n "$SITE" -l "$LOC" --sku Free -o none
  DEPLOY="$(az staticwebapp secrets list -g "$RG" -n "$SITE" --query properties.apiKey -o tsv)"
  (cd "$ROOT/frontend" && npm ci && VITE_DATA_BASE="$URL" npm run build &&
    npx -y @azure/static-web-apps-cli deploy dist --deployment-token "$DEPLOY" --env production)
  echo "https://$(az staticwebapp show -g "$RG" -n "$SITE" --query defaultHostname -o tsv)"
  ;;
*)
  sed -n '2,8p' "$0"
  exit 1
  ;;
esac
