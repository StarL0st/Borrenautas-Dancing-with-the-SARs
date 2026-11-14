# Deploy

Two scripted options share one image (`backend/deploy/Dockerfile`): **Azure** (`azure.sh`, a VM, the current choice) and Google Cloud (`gcp.sh`, below). Neither has been run against a live account yet.

## Azure

| Piece | Azure service | Does |
|---|---|---|
| Backend | Virtual machine `sars-vm` (Ubuntu 24.04, 2 vCPU / 8 GB, 64 GB disk), Docker Compose (`compose.yaml`) | `api`: `serve --jobs --public --watch-hours 12` (contract files, `/query`, `/events`, public place lookup, 12 h refresh of curated sites). `caddy`: HTTPS in front, certificate obtained automatically |
| Data | The VM disk, `/opt/sars/data` mounted at `/data` | `selected/`, `interim/`, `processed/`, `sites.json` survive rebuilds |
| Site | Static Web App `sars-site` (Free) | The frontend, built with `VITE_DATA_BASE=https://<vm host>/` |

The two are detached: the site is static files and talks to the backend only over HTTPS (contract C6).

Once:
1. Install the Azure CLI (https://learn.microsoft.com/cli/azure/install-azure-cli), then `az login` and, if you have several, `az account set --subscription <id>`. Add a budget alert (Cost Management > Budgets).
2. `backend/.env` holds `ASF_EARTH_DATA_TOKEN=...` and `FIRMS_MAP_KEY=...` (wildfire case study, Mexico fire layer).
3. From the repo root of an up-to-date checkout, in Git Bash:
   ```
   export AZ_PREFIX=<short lowercase name>   # the VM becomes <prefix>-sars.westus2.cloudapp.azure.com
   backend/deploy/azure.sh vm       # creates the VM; ports 80/443 open, SSH only from your current address
   backend/deploy/azure.sh deploy   # committed code + backend/.env -> VM, build, start; prints the URL
   backend/deploy/azure.sh seed     # uploads data/selected and data/processed so the API starts with data
   backend/deploy/azure.sh site     # from a checkout with the frontend integration (testing branch); prints the site URL
   ```
Each change: commit, then `deploy` again. `seed` again only to push locally processed outputs.

Check it: `curl https://<vm host>/health`, `curl "https://<vm host>/query?lat=19.43&lon=-99.13"`, `curl -X POST https://<vm host>/sites -H 'content-type: application/json' -d '{"lat": 21.0, "lon": -101.3}'`.

Notes:
- The VM costs while it runs. Stop it without losing data: `az vm deallocate -g sars -n sars-vm`; start: `az vm start -g sars -n sars-vm`. Remove everything: `az group delete -n sars`.
- `deploy` sends only committed files (`git archive`). Secrets go to `/opt/sars/.env` on the VM (owner-only), not into the image. The admin token (`SARS_ADMIN_TOKEN`, for `km`/`title`/`id`/`refresh`) is generated on the first deploy: `backend/deploy/azure.sh ssh`, then `grep SARS_ADMIN_TOKEN /opt/sars/.env`.
- If your network address changes, SSH is refused: `az network nsg rule update -g sars --nsg-name sars-vmNSG -n ssh --source-address-prefixes <new ip>`.
- Logs: `backend/deploy/azure.sh ssh`, then `sudo docker logs -f sars-api-1`.
- Not run yet: the script is syntax-checked only. No Azure account was available when it was written.

## Google Cloud

One container image (`backend/deploy/Dockerfile`) runs both halves of the backend:

| Piece | Cloud Run | Does |
|---|---|---|
| Batch | Job `sars-batch` | `sars-pipeline refresh`: search the catalog for every site, process only sites with new granules |
| API | Service `sars-api` | `sars-pipeline serve --jobs`: contract files, `/query`, `/events` (SSE), `/sites` (process places on request) |
| Schedule | Cloud Scheduler `sars-refresh` | Runs the batch job every 12 hours |

Both mount one Cloud Storage bucket at `/data` (`processed/`, `interim/`, `selected/`, `sites.json`), so the job writes what the API serves. Region `us-west1` sits next to the NISAR data (AWS `us-west-2`); ASF HTTPS downloads are free. The job scales to zero; the API keeps its CPU on while running (it processes requests in the background) and scales to zero when idle.

## Once

1. Install the Google Cloud CLI (https://cloud.google.com/sdk/docs/install), then:
   ```
   gcloud auth login
   gcloud projects create <project-id>        # or use an existing one
   ```
2. In the console, link the project to the billing account that holds the credit, and add a budget alert (Billing > Budgets & alerts), for example at 50% and 90% of the credit.
3. `backend/.env` must hold `ASF_EARTH_DATA_TOKEN=...`; optionally `FIRMS_MAP_KEY=...`.
4. From the repo root of an up-to-date `backend` checkout, in Git Bash. `build` uploads the working tree as it is, uncommitted edits included, so run `git status` and `git pull` first.
   ```
   export GCP_PROJECT=<project-id>
   backend/deploy/gcp.sh setup
   ```
   Enables the APIs, creates the image registry, the bucket `<project-id>-sars-data`, the service account, and the secrets (`earthdata-token` and `firms-map-key` from `backend/.env`, never printed; `sars-admin-token` generated), and copies `data/selected/` to the bucket.

## Each change

```
backend/deploy/gcp.sh build      # Cloud Build builds and pushes the image; no local Docker needed
backend/deploy/gcp.sh batch      # refresh every site now (or: backend/deploy/gcp.sh batch cdmx)
backend/deploy/gcp.sh api        # deploy the API, prints its URL
backend/deploy/gcp.sh schedule   # once: refresh every 12 hours
```

Check it: `curl <url>/health`, `curl "<url>/query?lat=19.43&lon=-99.13"`.

Request a new place (the token is in Secret Manager):
```
TOKEN=$(gcloud secrets versions access latest --secret sars-admin-token)
curl -X POST <url>/sites -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"lat": 17.99, "lon": -92.93, "km": 15, "title": "Villahermosa"}'
curl <url>/sites
```

Point the frontend at it with `VITE_DATA_BASE=<url>/` (frontend README).

## Notes

- `backend/deploy/.gcloudignore` keeps `.env`, `data/`, `.git`, and the frontend out of the build upload.
- The first run per site streams every selected granule (about 30 granules, a few minutes for a 20 km site); later runs reuse `/data/interim` and only stream new ones.
- Job limits: 4 CPU, 8 GiB, 1 h. The API: 2 CPU, 4 GiB, one instance (one job queue).
- `setup` gives the Compute Engine default account (which new projects use for Cloud Build) `roles/cloudbuild.builds.builder`. If `build` still fails on permissions, check that account in IAM, or rerun `setup` after the first build attempt (the account may not exist before).
- `schedule` gives the service account `roles/run.invoker` on the job so Cloud Scheduler can start it; if the scheduler call is refused, grant `roles/run.developer` instead (not verified on a live project).
- Logs: `gcloud run jobs executions list --job sars-batch --region us-west1`, then the console link it prints.
- Not run yet from this repo: the scripts are syntax-checked and the container start command was tested locally, but no gcloud deploy has happened.
