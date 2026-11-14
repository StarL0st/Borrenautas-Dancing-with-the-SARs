# Deploy

One scripted target: **Azure** (`azure.sh`, a VM running the image from `backend/deploy/Dockerfile`). Not run against a live account yet. The earlier Google Cloud scripts were removed on 2026-11-14 (git history has them).

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
   backend/deploy/azure.sh seed     # uploads data/selected, data/interim (cache) and data/processed so the API starts with data
   backend/deploy/azure.sh site     # from a checkout with the frontend integration (testing branch); prints the site URL
   ```
Each change: commit, then `deploy` again. `seed` again only to push locally processed outputs.

Check it: `curl https://<vm host>/health`, `curl "https://<vm host>/query?lat=19.43&lon=-99.13"`, `curl -X POST https://<vm host>/sites -H 'content-type: application/json' -d '{"lat": 21.0, "lon": -101.3}'`.

Notes:
- The VM costs while it runs. Stop it without losing data: `az vm deallocate -g sars -n sars-vm`; start: `az vm start -g sars -n sars-vm`. Remove everything: `az group delete -n sars`.
- `deploy` sends only committed files (`git archive`). Secrets go to `/opt/sars/.env` on the VM (owner-only), not into the image. The admin token (`SARS_ADMIN_TOKEN`, for `km`/`title`/`id`/`refresh`) is generated on the first deploy: `backend/deploy/azure.sh ssh`, then `grep SARS_ADMIN_TOKEN /opt/sars/.env`.
- If your network address changes, SSH is refused: `az network nsg rule update -g sars --nsg-name sars-vmNSG -n ssh --source-address-prefixes <new ip>`.
- Logs: `backend/deploy/azure.sh ssh`, then `sudo docker logs -f sars-api-1`.
- The first run per site streams every selected granule (a few minutes for a 20 km site); later runs reuse `/data/interim` and only stream new ones.
- Not run yet: the script is syntax-checked only. No Azure account was available when it was written.
