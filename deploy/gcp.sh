#!/usr/bin/env bash
# Google Cloud deployment for sars-pipeline. See deploy/README.md.
#   deploy/gcp.sh setup         once: APIs, image registry, bucket, secret, service account
#   deploy/gcp.sh build         build and push the image (Cloud Build, no local Docker needed)
#   deploy/gcp.sh batch [site]  run the pipeline as a Cloud Run job (default: all sites)
#   deploy/gcp.sh api           deploy the API as a Cloud Run service, print its URL
set -euo pipefail

PROJECT="${GCP_PROJECT:?set GCP_PROJECT to your project id}"
REGION="${GCP_REGION:-us-west1}"  # next to the NISAR data in AWS us-west-2 (Oregon)
BUCKET="${GCP_BUCKET:-${PROJECT}-sars-data}"
REPO=sars
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/sars-pipeline:latest"
SA="sars-pipeline@${PROJECT}.iam.gserviceaccount.com"
SECRET=earthdata-token
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
gc() { gcloud --project "$PROJECT" "$@"; }

# The bucket is mounted at /data in both the job and the service (Cloud Storage volume).
MOUNT=(--add-volume "name=data,type=cloud-storage,bucket=${BUCKET}" --add-volume-mount "volume=data,mount-path=/data")

case "${1:-}" in
setup)
  gc services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com storage.googleapis.com
  gc artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 ||
    gc artifacts repositories create "$REPO" --location "$REGION" --repository-format docker
  gc storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1 ||
    gc storage buckets create "gs://${BUCKET}" --location "$REGION" --uniform-bucket-level-access
  gc iam service-accounts describe "$SA" >/dev/null 2>&1 ||
    gc iam service-accounts create sars-pipeline --display-name "sars-pipeline"
  gc storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member "serviceAccount:${SA}" --role roles/storage.objectAdmin >/dev/null
  # Token comes from backend/.env and goes straight into Secret Manager; it is never printed.
  TOKEN="$(grep -E '^ASF_EARTH_DATA_TOKEN=' "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\r"')"
  [ -n "$TOKEN" ] || { echo "ASF_EARTH_DATA_TOKEN missing in backend/.env" >&2; exit 1; }
  if gc secrets describe "$SECRET" >/dev/null 2>&1; then
    printf %s "$TOKEN" | gc secrets versions add "$SECRET" --data-file=-
  else
    printf %s "$TOKEN" | gc secrets create "$SECRET" --data-file=- --replication-policy automatic
  fi
  gc secrets add-iam-policy-binding "$SECRET" \
    --member "serviceAccount:${SA}" --role roles/secretmanager.secretAccessor >/dev/null
  # Committed granule selections, so the cloud run uses the same granules as local runs.
  [ -d "$ROOT/data/selected" ] && gc storage rsync "$ROOT/data/selected" "gs://${BUCKET}/selected"
  echo "setup done: bucket gs://${BUCKET}, image ${IMAGE}"
  ;;
build)
  gc builds submit "$ROOT" --region "$REGION" --config "$ROOT/deploy/cloudbuild.yaml" \
    --substitutions "_IMAGE=${IMAGE},_GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
  ;;
batch)
  shift
  gc run jobs deploy sars-batch --region "$REGION" --image "$IMAGE" --service-account "$SA" \
    "${MOUNT[@]}" --set-secrets "ASF_EARTH_DATA_TOKEN=${SECRET}:latest" \
    --command sars-pipeline --args "run${*:+,$(IFS=,; echo "$*")}" \
    --cpu 4 --memory 8Gi --task-timeout 3600 --max-retries 0
  gc run jobs execute sars-batch --region "$REGION" --wait
  ;;
api)
  gc run deploy sars-api --region "$REGION" --image "$IMAGE" --service-account "$SA" \
    "${MOUNT[@]}" --allow-unauthenticated --execution-environment gen2 --cpu 1 --memory 1Gi --min-instances 0 --max-instances 3
  gc run services describe sars-api --region "$REGION" --format 'value(status.url)'
  ;;
*)
  sed -n '2,7p' "$0"
  exit 1
  ;;
esac
