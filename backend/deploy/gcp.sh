#!/usr/bin/env bash
# Google Cloud deployment for sars-pipeline. See backend/deploy/README.md.
#   backend/deploy/gcp.sh setup         once: APIs, image registry, bucket, secrets, service account
#   backend/deploy/gcp.sh build         build and push the image (Cloud Build, no local Docker needed)
#   backend/deploy/gcp.sh batch [site]  refresh sites as a Cloud Run job (only new data is processed)
#   backend/deploy/gcp.sh api           deploy the API as a Cloud Run service, print its URL
#   backend/deploy/gcp.sh schedule      run the batch job every 12 hours (Cloud Scheduler)
set -euo pipefail

PROJECT="${GCP_PROJECT:?set GCP_PROJECT to your project id}"
REGION="${GCP_REGION:-us-west1}"  # next to the NISAR data in AWS us-west-2 (Oregon)
BUCKET="${GCP_BUCKET:-${PROJECT}-sars-data}"
REPO=sars
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/sars-pipeline:latest"
SA="sars-pipeline@${PROJECT}.iam.gserviceaccount.com"
SECRET=earthdata-token
ADMIN_SECRET=sars-admin-token  # guards POST /sites (it starts downloads)
FIRMS_SECRET=firms-map-key     # optional, for the wildfire category
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"  # repo root (uv workspace)
gc() { gcloud --project "$PROJECT" "$@"; }
secrets() {  # --set-secrets value; FIRMS only if that secret exists
  local s="ASF_EARTH_DATA_TOKEN=${SECRET}:latest"
  if gc secrets describe "$FIRMS_SECRET" >/dev/null 2>&1; then
    s="${s},FIRMS_MAP_KEY=${FIRMS_SECRET}:latest"
  fi
  echo "$s"
}

# The bucket is mounted at /data in both the job and the service (Cloud Storage volume).
MOUNT=(--add-volume "name=data,type=cloud-storage,bucket=${BUCKET}" --add-volume-mount "volume=data,mount-path=/data")

case "${1:-}" in
setup)
  gc services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com storage.googleapis.com cloudscheduler.googleapis.com
  gc artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 ||
    gc artifacts repositories create "$REPO" --location "$REGION" --repository-format docker
  gc storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1 ||
    gc storage buckets create "gs://${BUCKET}" --location "$REGION" --uniform-bucket-level-access
  gc iam service-accounts describe "$SA" >/dev/null 2>&1 ||
    gc iam service-accounts create sars-pipeline --display-name "sars-pipeline"
  gc storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member "serviceAccount:${SA}" --role roles/storage.objectAdmin >/dev/null
  # Values go from backend/.env straight into Secret Manager; they are never printed.
  put_secret() {  # name value
    if gc secrets describe "$1" >/dev/null 2>&1; then
      printf %s "$2" | gc secrets versions add "$1" --data-file=- >/dev/null
    else
      printf %s "$2" | gc secrets create "$1" --data-file=- --replication-policy automatic >/dev/null
    fi
    gc secrets add-iam-policy-binding "$1" \
      --member "serviceAccount:${SA}" --role roles/secretmanager.secretAccessor >/dev/null
  }
  env_value() { grep -E "^$1=" "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\r"' || true; }
  TOKEN="$(env_value ASF_EARTH_DATA_TOKEN)"
  [ -n "$TOKEN" ] || { echo "ASF_EARTH_DATA_TOKEN missing in backend/.env" >&2; exit 1; }
  put_secret "$SECRET" "$TOKEN"
  gc secrets describe "$ADMIN_SECRET" >/dev/null 2>&1 ||
    put_secret "$ADMIN_SECRET" "$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
  FIRMS="$(env_value FIRMS_MAP_KEY)"
  if [ -n "$FIRMS" ]; then put_secret "$FIRMS_SECRET" "$FIRMS"; fi
  # Committed granule selections, so the cloud run uses the same granules as local runs.
  if [ -d "$ROOT/data/selected" ]; then
    gc storage rsync "$ROOT/data/selected" "gs://${BUCKET}/selected"
  fi
  echo "setup done: bucket gs://${BUCKET}, image ${IMAGE}"
  echo "admin token for POST /sites: gcloud secrets versions access latest --secret ${ADMIN_SECRET}"
  ;;
build)
  gc builds submit "$ROOT" --region "$REGION" --config "$ROOT/backend/deploy/cloudbuild.yaml" \
    --ignore-file backend/deploy/.gcloudignore \
    --substitutions "_IMAGE=${IMAGE},_GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
  ;;
batch)
  shift
  gc run jobs deploy sars-batch --region "$REGION" --image "$IMAGE" --service-account "$SA" \
    "${MOUNT[@]}" --set-secrets "$(secrets)" \
    --command sars-pipeline --args "refresh${*:+,$(IFS=,; echo "$*")}" \
    --cpu 4 --memory 8Gi --task-timeout 3600 --max-retries 0
  gc run jobs execute sars-batch --region "$REGION" --wait
  ;;
api)
  # --jobs: POST /sites processes requested places in the background, so the CPU must stay on
  # between requests (--no-cpu-throttling), and one instance keeps one job queue.
  gc run deploy sars-api --region "$REGION" --image "$IMAGE" --service-account "$SA" \
    "${MOUNT[@]}" --allow-unauthenticated --execution-environment gen2 \
    --set-secrets "$(secrets),SARS_ADMIN_TOKEN=${ADMIN_SECRET}:latest" \
    --set-env-vars "SARS_SERVE_FLAGS=--jobs" --no-cpu-throttling \
    --cpu 2 --memory 4Gi --min-instances 0 --max-instances 1 --timeout 3600
  gc run services describe sars-api --region "$REGION" --format 'value(status.url)'
  ;;
schedule)
  # Polls the catalog twice a day; the job only processes sites that got new granules.
  gc run jobs add-iam-policy-binding sars-batch --region "$REGION" \
    --member "serviceAccount:${SA}" --role roles/run.invoker >/dev/null
  URI="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/sars-batch:run"
  VERB=create
  if gc scheduler jobs describe sars-refresh --location "$REGION" >/dev/null 2>&1; then
    VERB=update
  fi
  gc scheduler jobs "$VERB" http sars-refresh --location "$REGION" --schedule "0 */12 * * *" \
    --uri "$URI" --http-method POST --oauth-service-account-email "$SA"
  ;;
*)
  sed -n '2,9p' "$0"
  exit 1
  ;;
esac
