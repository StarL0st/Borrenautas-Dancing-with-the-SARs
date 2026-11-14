# Backend (lane 1): sars-pipeline

Turns NISAR GCOV granules into map layers and classified change events (C1-C7 in `docs/04-contracts.md`), and serves them to the frontend.

Python, managed with [uv](https://docs.astral.sh/uv/) as a member of the repo's uv workspace (root `pyproject.toml`). There is one shared `.venv` and `uv.lock` at the repo root; VS Code picks up `.venv` automatically.

```
uv sync                                      # from anywhere in the repo: create/update .venv
cd backend && uv add <package>               # add a dependency to the backend
```

- Never use `pip install` or `uv pip install`: they skip `pyproject.toml` and `uv.lock`, so the package vanishes on the next `uv sync`.
- Secrets: `backend/.env` (gitignored) with `ASF_EARTH_DATA_TOKEN=...`. Approve the ASF app EULA once per Earthdata account (link in `docs/03`).

## Run

```
cd backend
uv run sars-pipeline run sf            # one site from sites.json (no args: every site)
uv run sars-pipeline select sf         # only (re)pick granules -> data/selected/sf.json
uv run sars-pipeline add-site cdmx --center=-99.13,19.43 --km 20 --title "Mexico City" --types other
                                       # or --bbox=w,s,e,n; validates and writes sites.json
uv run sars-pipeline serve             # API on http://127.0.0.1:8765/
uv run pytest && uv run ruff check     # checks
```

## Pipeline (`run`)

| Step | Module | What |
|---|---|---|
| select | `selection.py` | `asf_search` over the site bbox (last 120 days); groups by track/frame/direction; picks the group with at least two dates of one maturity, highest maturity first; keeps the latest 6 dates. Saved to `data/selected/<site>.json` (committed, so runs are repeatable). `run` reuses it; `--reselect` searches again |
| read | `remote.py`, `granule.py` | Streams only the site window over HTTPS (`h5py` + `fsspec`), never the 6-7 GB file; averages `looks` x `looks` pixels in linear power; caches to `data/interim/` |
| change | `classify.py` | dB difference of the two latest dates, 3 px box smoothing |
| classify | `classify.py` | Rules (thresholds in `classify.DEFAULTS`, override per site with `"thresholds"`): `flood_wetland` (HH and HV both drop 3 dB and HH ends below -18 dB), `forest_loss` (HV drops 3 dB, 1.5 dB more than HH, from vegetation-level HV), `other` (5 dB change on land on both dates). Regions under 12 px dropped. Confidence formula is written into each event's provenance |
| export | `site.py`, `export.py` | Per date and pol: gray dB PNG. Per latest pair: HH and HV change PNGs (red darker, blue brighter) and a class PNG (blue flood, orange vegetation loss, gray other). `manifest.json`, time series, `events.json` |

Sites live in `sites.json`: `title`, `summary`, `bbox` [w, s, e, n], `change_types`, optional `looks` and `thresholds`. Add the three Mexico sites there.

Layers carry an extra `role` field (`backscatter` or `change`) so the frontend can keep change layers out of the date slider.

## API (`serve`, contract C6)

| Endpoint | Returns |
|---|---|
| `/manifest.json`, `/areas/...` | Contract files |
| `/events.json` | All events (C7) |
| `/query?lat=&lon=` | Events whose geometry contains the point, plus area ids |
| `/query?bbox=w,s,e,n` | Events and areas intersecting the box. Both take `type=`, `from=`, `to=` |
| `/events` | Server-sent `manifest` events when data changes |
| `/health` | `{"ok": true}` |

`serve` also ingests local granule files dropped into `data/inbox/` (synthetic test files: `sars-pipeline synthetic`). In the cloud it runs with `--no-inbox`.

## Status (testing branch, 2026-11-13)

- Tested on San Francisco: 6 PROVISIONAL granules (track 135, frame 21, ascending, 2026-08-22 to 2026-10-21), about 2 min 50 s first run, seconds from cache. The 2026-10-09 to 10-21 pair gives 24 events, mostly `other` on the eastern waterfront piers (ships and cargo moving), 2 small `forest_loss`. San Francisco is a test area only; the numbers mean nothing for the demo.
- Mexico City (`cdmx`, 20 km around the center): 2 VALIDATED granules (track 19, frame 11, ascending, 2026-10-25 and 11-06), 41 s. The whole scene got 1-2 dB brighter on 11-06, strongest around the airport and the southeast; a wetter surface (rain) is the first hypothesis, not yet checked against rainfall data. 6 small, low-confidence events.
- Cloud: see `deploy/README.md`. Scripted, not deployed yet.

Known limits:
- Event geometry is the region's bounding box (`shortcut:` in `site.py`); the class PNG shows exact pixels.
- Only the two latest dates are compared.
- Image overlays use the window's WGS84 bounds; a UTM window is slightly rotated in lon/lat, fine at 20 km.
- `wildfire`, `agriculture`, and `deformation` have no rule yet (F03).
