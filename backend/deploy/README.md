# Deploy to Google Cloud

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
4. From the repo root, in Git Bash:
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
- `schedule` gives the service account `roles/run.invoker` on the job so Cloud Scheduler can start it; if the scheduler call is refused, grant `roles/run.developer` instead (not verified on a live project).
- Logs: `gcloud run jobs executions list --job sars-batch --region us-west1`, then the console link it prints.
- Not run yet from this repo: the scripts are syntax-checked and the container start command was tested locally, but no gcloud deploy has happened.
