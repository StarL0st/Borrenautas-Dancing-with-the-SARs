# Deploy

One scripted target: **Azure** (`azure.sh`). Run on 2026-11-14 (`vm`, `deploy`, `seed`, `status`); `site` and `dns` are not run: the site was published from the Cloudflare dashboard instead (https://gigas-project.starl0stgaming.workers.dev). The earlier Google Cloud scripts were removed on 2026-11-14 (git history has them).

## Design

```
browser --files (manifest, layers, events, cards, history, live)--> Blob Storage (public read)
   |                                                                   ^ copied every 20 s
   +--lookup, status, /query, /history, push--> Caddy (HTTPS) --> API on the VM --> /opt/sars/data
```

| Piece | Azure service | Does |
|---|---|---|
| Results | Storage account `<prefix>sars`, container `data` (Blob, locally redundant) | Every file under `data/processed`. Anyone may read a file; nobody may list or write. CORS open for GET. Browsers load the map from here, so visitor load never reaches the VM |
| Backend | Virtual machine `sars-vm` (Ubuntu 24.04, 2 vCPU / 8 GB, 64 GB disk, 4 GB swap), Docker Compose (`compose.yaml`) | `api`: `serve --jobs --public --watch-hours 12 --live-minutes 5` (place lookup, `/query`, `/history`, `/events`, refresh timers). `sync`: copies results to storage. `caddy`: HTTPS (`Caddyfile`) |
| Working data | The VM disk, `/opt/sars/data` mounted at `/data` | `selected/`, `interim/` (cached radar windows), `processed/`, `sites.json`; survive rebuilds |
| Site | Cloudflare Worker `gigas-project` (static files, free plan; `frontend/wrangler.jsonc`), not Azure: it stays up when the VM or the Azure credit is gone | The frontend, built with `VITE_DATA_BASE=<storage url>` and `VITE_API_BASE=<api url>` |

Why two places: if the VM stops or crashes, the site still shows every map, event, card and history from storage. Only looking up a new place and live push need the VM.

How results reach storage (`sync` in `compose.yaml`, rclone):
- Signs in as the VM itself (managed identity with the role "Storage Blob Data Contributor"). No storage key is stored anywhere.
- Two passes: files first, then `manifest.json`, `events.*` and `live.geojson`, so a browser never gets a manifest naming a file that is not uploaded yet.
- Copies, never deletes: an empty VM disk cannot wipe storage. A removed area stays in storage until deleted by hand: on the VM, `sudo docker run --rm -v /opt/sars/data:/data:ro -e RCLONE_AZUREBLOB_ACCOUNT=<storage> -e RCLONE_AZUREBLOB_USE_MSI=true rclone/rclone:1 sync --dry-run /data/processed :azureblob:data --exclude "*.tmp"` lists what a mirror would delete; read the list, then run it without `--dry-run` (done 2026-11-15: nine areas, 311 files).
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
   backend/deploy/azure.sh site     # by hand: build the frontend and replace the live site (first: npx wrangler login)
   ```
4. Own domain (any time later; the domain's DNS must be at Cloudflare): `SARS_DOMAIN=<domain> backend/deploy/azure.sh dns` prints the `api` record and the commands that follow. The `api` record stays **DNS only** (proxy off): with the proxy on, every visitor would reach the VM from Cloudflare's addresses, so the per-address lookup limit would treat all visitors as one, and Caddy could not get its certificate the simple way. The site's own domain is added on the Worker (Settings > Domains & Routes).

### Site (Cloudflare Worker `gigas-project`)

Live at https://gigas-project.starl0stgaming.workers.dev since 2026-11-14, built with the storage and API addresses above. It is a Worker that serves static files, not a Pages project: `wrangler pages ...` commands do not apply.

| Way | How | When it publishes |
|---|---|---|
| Cloudflare builds it (Workers Builds) | Dashboard > Workers & Pages > `gigas-project` > Settings > Build. Root directory `frontend`, build command `npm ci && npm run build`, deploy command `npx wrangler deploy`. Build variables: `VITE_DATA_BASE=https://<storage>.blob.core.windows.net/data/`, `VITE_API_BASE=https://<api host>/`, `NODE_VERSION=24` | On push to the production branch set there |
| By hand | `azure.sh site` | When someone runs it; replaces the live site |

The first attempt on 2026-11-14 published the source folder without building it (the page loaded with no map): the build command and the variables were missing.

### Domain `gigas.earth` (2026-11-14)

The site answers at https://gigas.earth (set on the Worker). The API was redeployed with `SARS_DOMAIN=gigas.earth`: it answers at https://api.gigas.earth (DNS record `A api <VM address>`, proxy off; certificate issued and checked the same evening) and still at the VM's own name (`SARS_ALSO` in `compose.yaml`), which the published site uses until its `VITE_API_BASE` build variable is changed to `https://api.gigas.earth/`. From now on every `azure.sh deploy` needs `SARS_DOMAIN=gigas.earth`, or the API drops the new name.

### Updating what runs on Azure

| Change | Do | Downtime |
|---|---|---|
| Backend code | Commit, then `azure.sh deploy` (SSH: at a venue that blocks port 22, use a VPN and allow its address, see Notes) | API about 1 minute; the site keeps working from storage |
| New or changed site | Edit `backend/sites.json`, commit, `azure.sh deploy`: the VM processes it by itself (queue order = file order; progress at `/sites`) | API about 1 minute |
| Data processed locally | `azure.sh seed`. **Not since 2026-11-14 without care**: the VM holds areas the local `data/` does not (city sites, larger boxes), and seeding replaces the VM's `manifest.json` and `events.json` with the local ones | None |
| Remove an area | Remove it on the VM disk, then the mirror command under "How results reach storage" | None |
| Site | Push to the branch Cloudflare builds, or `azure.sh site` | None |

Pending (decided 2026-11-14: not now): the VM updating itself from the `backend` branch (a timer that pulls and rebuilds). It would make "push to `backend`" the whole deployment; it needs the repository to be public or a read-only key on the VM.

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
| Site on Cloudflare (Worker with static files, free plan) | 0 |

Stop the VM without losing anything (the site keeps working from storage, without lookups): `az vm deallocate -g sars -n sars-vm`; start: `az vm start -g sars -n sars-vm`. Remove everything: `az group delete -n sars`.

## Notes

- `deploy` sends only committed files (`git archive`). Secrets go to `/opt/sars/.env` on the VM (owner-only), not into the image. The admin token (`SARS_ADMIN_TOKEN`, for `km`/`title`/`id`/`refresh`) is generated on the first deploy: `azure.sh ssh`, then `grep SARS_ADMIN_TOKEN /opt/sars/.env`.
- If your network address changes, SSH is refused: `az network nsg rule update -g sars --nsg-name sars-vmNSG -n ssh --source-address-prefixes <new ip>`.
- Logs: `azure.sh ssh`, then `sudo docker logs -f sars-api-1` (or `sars-sync-1`, `sars-caddy-1`).
- The first run per site streams every selected granule (a few minutes for a 20 km site); later runs reuse `/data/interim` and only stream new ones.
- Some subscriptions forbid public read on storage (`az storage account create` then fails or the container stays private). Fallback: let Caddy serve `/data/processed` from the VM and build the site with one URL; this loses the crash protection.
- Verified on the first run: rclone signs in with the VM identity, the swap file, the VM size list (`Standard_B2s_v2` chosen), public read on storage.
- Some networks block SSH (port 22): `deploy`, `seed`, `status` and `ssh` then time out. Use another network or a VPN and allow its address (note above).
