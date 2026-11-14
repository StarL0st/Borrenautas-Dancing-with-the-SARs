# Deploy

One scripted target: **Azure** (`azure.sh`). Run on 2026-11-14 (`vm`, `deploy`, `seed`, `status`); `site` and `dns` are not run yet. The earlier Google Cloud scripts were removed on 2026-11-14 (git history has them).

## Design

```
browser --files (manifest, layers, events, cards, history, live)--> Blob Storage (public read)
   |                                                                   ^ copied every 20 s
   +--lookup, status, /query, /history, push--> Caddy (HTTPS) --> API on the VM --> /opt/sars/data
```

| Piece | Azure service | Does |
|---|---|---|
| Results | Storage account `<prefix>sars`, container `data` (Blob, locally redundant) | Every file under `data/processed`. Anyone may read a file; nobody may list or write. CORS open for GET. Browsers load the map from here, so visitor load never reaches the VM |
| Backend | Virtual machine `sars-vm` (Ubuntu 24.04, 2 vCPU / 8 GB, 64 GB disk, 4 GB swap), Docker Compose (`compose.yaml`) | `api`: `serve --jobs --public --watch-hours 12 --live-minutes 15` (place lookup, `/query`, `/history`, `/events`, refresh timers). `sync`: copies results to storage. `caddy`: HTTPS (`Caddyfile`) |
| Working data | The VM disk, `/opt/sars/data` mounted at `/data` | `selected/`, `interim/` (cached radar windows), `processed/`, `sites.json`; survive rebuilds |
| Site | Static Web App `sars-site` (Free) | The frontend, built with `VITE_DATA_BASE=<storage url>` and `VITE_API_BASE=<api url>` |

Why two places: if the VM stops or crashes, the site still shows every map, event, card and history from storage. Only looking up a new place and live push need the VM.

How results reach storage (`sync` in `compose.yaml`, rclone):
- Signs in as the VM itself (managed identity with the role "Storage Blob Data Contributor"). No storage key is stored anywhere.
- Two passes: files first, then `manifest.json`, `events.*` and `live.geojson`, so a browser never gets a manifest naming a file that is not uploaded yet.
- Copies, never deletes: an empty VM disk cannot wipe storage. A removed area stays in storage until deleted by hand.
- After each full copy it writes its start time to a shared file; the API sends the "new data" push only when that time is later than the manifest's (`SARS_SYNC_MARKER`), so browsers reload when storage has the new files, not before.
- Files carry `Cache-Control: no-cache`: URLs are reused after a rerun, so browsers revalidate (a cheap "not modified" answer).

## Frontend change this needs (frontend lane, `src/main.ts`)

Committed on the local `frontend` branch on 2026-11-14 (after `22d8ca9`). One base URL served files and calls; with storage they differ. Three lines:

```
 const BASE = new URL(import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/", location.href);
+const API = new URL(import.meta.env.VITE_API_BASE ?? BASE, location.href); // lookup, push, history
-    const res = await fetch(new URL("sites", BASE), {
+    const res = await fetch(new URL("sites", API), {
-const events = new EventSource(new URL("events", BASE));
+const events = new EventSource(new URL("events", API));
```

Without `VITE_API_BASE` nothing changes (local use, static build). `query` and `history` calls, when added, also go to `API`. Until this is in, build the site with `VITE_DATA_BASE=https://<api host>/` only: everything then comes from the VM (works, no crash protection).

## Guards against load and crashes

| Risk | Guard |
|---|---|
| Many visitors | Files come from storage, not the VM |
| Too many open push streams | At most 500; more get 503 and the frontend falls back to reloading on a timer |
| Lookup while push is lost | `GET /sites/<id>` gives status and queue position; poll every 5 s |
| `/query`, `/history` under load | Parsed `events.json` and `manifest.json` are kept in memory until the files change |
| A big job eats the memory | 4 GB swap; the `api` container is limited to 6 GB, so Docker restarts it instead of the VM freezing |
| The process dies | `restart: always`; health check on `/health` |
| The disk fills | No new place is accepted under 5 GB free (429) |
| Lookup abuse | 5 new places per address per hour, 20 queued, 300 places; requests over 16 KB refused |

Measured on a laptop (2026-11-14, `scripts/load_test.py`, real data): 300 open streams plus 50 requests a second on `/query`, `/history` and `/health` for 20 s: 1000 of 1000 answered, median 120 ms, slowest 435 ms. 600 streams: 500 opened, 100 refused with 503.

Measured on Azure (2026-11-14, `Standard_B2s_v2`, test sent through a VPN while a site job ran): same 300 streams and 50 requests a second: 1000 of 1000 answered, median 767 ms, slowest 2913 ms. API container stopped: storage kept serving every file; API back in about 10 s. A new place (Oaxaca, 14 granules) took about 2 minutes from request to storage. Seeding 585 MB took 51 s.

## Steps

Once:
1. Azure CLI installed, `az login`; with several subscriptions `az account set --subscription <id>`. Add a budget alert first (Cost Management > Budgets), for example at 100 and 150 USD.
2. `backend/.env` holds `ASF_EARTH_DATA_TOKEN=...` and `FIRMS_MAP_KEY=...`.
3. From the repo root of an up-to-date checkout that has `backend/` and `frontend/` (`testing`), in Git Bash:
   ```
   export AZ_PREFIX=<short lowercase name>   # VM: <prefix>-sars.westus2.cloudapp.azure.com, storage: <prefix>sars
   backend/deploy/azure.sh sizes    # which VM sizes this subscription may create (read-only)
   backend/deploy/azure.sh vm       # VM (first allowed size), storage, access rules
   backend/deploy/azure.sh deploy   # committed code + backend/.env -> VM, build, start
   backend/deploy/azure.sh seed     # local data/selected, data/interim, data/processed -> VM; sync then fills storage
   backend/deploy/azure.sh status   # health, containers, disk, last copies
   backend/deploy/azure.sh site     # build and publish the frontend; prints its URL
   ```
4. Own domain (optional, any time later): `SARS_DOMAIN=<domain> backend/deploy/azure.sh dns` prints the two DNS records and the three commands that follow. In Cloudflare both records stay **DNS only** (proxy off): with the proxy on, every visitor would reach the VM from Cloudflare's addresses, so the per-address lookup limit would treat all visitors as one, and Caddy could not get its certificate the simple way.

Each change: commit, then `deploy` again. `seed` again only to push locally processed data.

Options (environment): `AZ_VM_SIZE` (skip the automatic choice), `AZ_LOCATION` (default `westus2`, next to the NISAR data), `AZ_RG` (default `sars`), `AZ_SSH_FROM` (address allowed to SSH), `SARS_DOMAIN`.

Check it:
```
curl https://<storage>.blob.core.windows.net/data/manifest.json -H 'Origin: https://example.org' -i   # 200 and access-control-allow-origin
curl https://<api host>/health
curl "https://<api host>/history?lat=20.3&lon=-103.2"
curl -X POST https://<api host>/sites -H 'content-type: application/json' -d '{"lat": 21.0, "lon": -101.3}'
uv run python backend/scripts/load_test.py https://<api host>
```
Crash test: `azure.sh ssh`, `sudo docker stop sars-api-1`, reload the site (maps and events must still load), `sudo docker start sars-api-1`.

## Cost (about, per month; confirm in the Azure pricing calculator)

| Item | USD |
|---|---|
| VM, 2 vCPU / 8 GB, running all month | 60 to 75 |
| 64 GB disk | 5 |
| Public address | 4 |
| Storage, under 1 GB, and data out | under 2 |
| Static Web App (Free) | 0 |

Stop the VM without losing anything (the site keeps working from storage, without lookups): `az vm deallocate -g sars -n sars-vm`; start: `az vm start -g sars -n sars-vm`. Remove everything: `az group delete -n sars`.

## Notes

- `deploy` sends only committed files (`git archive`). Secrets go to `/opt/sars/.env` on the VM (owner-only), not into the image. The admin token (`SARS_ADMIN_TOKEN`, for `km`/`title`/`id`/`refresh`) is generated on the first deploy: `azure.sh ssh`, then `grep SARS_ADMIN_TOKEN /opt/sars/.env`.
- If your network address changes, SSH is refused: `az network nsg rule update -g sars --nsg-name sars-vmNSG -n ssh --source-address-prefixes <new ip>`.
- Logs: `azure.sh ssh`, then `sudo docker logs -f sars-api-1` (or `sars-sync-1`, `sars-caddy-1`).
- The first run per site streams every selected granule (a few minutes for a 20 km site); later runs reuse `/data/interim` and only stream new ones.
- Some subscriptions forbid public read on storage (`az storage account create` then fails or the container stays private). Fallback: let Caddy serve `/data/processed` from the VM and build the site with one URL; this loses the crash protection.
- Verified on the first run: rclone signs in with the VM identity, the swap file, the VM size list (`Standard_B2s_v2` chosen), public read on storage.
- Some networks block SSH (port 22): `deploy`, `seed`, `status` and `ssh` then time out. Use another network or a VPN and allow its address (note above).
