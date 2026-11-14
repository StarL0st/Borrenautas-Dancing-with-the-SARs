# Deploy to Google Cloud

One container image (`deploy/Dockerfile`) runs both halves of the backend:

| Piece | Cloud Run | Does |
|---|---|---|
| Batch | Job `sars-batch` | `sars-pipeline run`: select granules, stream site windows, detect change, write contract files and `events.json` |
| API | Service `sars-api` | `sars-pipeline serve`: contract files, `/query`, `/events` (SSE) |

Both mount one Cloud Storage bucket at `/data` (`processed/`, `interim/`, `selected/`), so the job writes what the API serves. Region `us-west1` sits next to the NISAR data (AWS `us-west-2`); ASF HTTPS downloads are free. Both scale to zero, so the credit is only spent while a job runs or requests arrive.

## Once

1. Install the Google Cloud CLI (https://cloud.google.com/sdk/docs/install), then:
   ```
   gcloud auth login
   gcloud projects create <project-id>        # or use an existing one
   ```
2. In the console, link the project to the billing account that holds the credit, and add a budget alert (Billing > Budgets & alerts), for example at 50% and 90% of the credit.
3. Put your Earthdata token in `backend/.env` (`ASF_EARTH_DATA_TOKEN=...`), as for local runs.
4. From the repo root, in Git Bash:
   ```
   export GCP_PROJECT=<project-id>
   deploy/gcp.sh setup
   ```
   Enables the APIs, creates the image registry, the bucket `<project-id>-sars-data`, the service account, and the secret `earthdata-token` (read from `backend/.env`, never printed or put in the image), and copies `data/selected/` to the bucket.

## Each change

```
deploy/gcp.sh build          # Cloud Build builds and pushes the image; no local Docker needed
deploy/gcp.sh batch          # run every site in backend/sites.json (or: deploy/gcp.sh batch sf)
deploy/gcp.sh api            # deploy the API, prints its URL
```

Check it: `curl <url>/health`, `curl "<url>/query?lat=37.7967&lon=-122.3166"`.

Point the frontend at it with `VITE_DATA_BASE=<url>/` (frontend README).

## Notes

- `.gcloudignore` keeps `.env`, `data/`, `.git`, and the frontend out of the build upload.
- The first batch run per site streams every selected granule (about 20 s each for a 20 km window); later runs reuse `/data/interim`.
- Job limits: 4 CPU, 8 GiB, 1 h. Raise `--memory`/`--task-timeout` in `gcp.sh` for big sites or the national overview.
- Logs: `gcloud run jobs executions list --job sars-batch --region us-west1`, then the console link it prints.
- Not run yet from this repo: the scripts are syntax-checked and the container start command was tested locally, but no gcloud deploy has happened.
