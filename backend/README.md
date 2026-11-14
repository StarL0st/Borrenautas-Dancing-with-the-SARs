# Backend (lane 1): sars-pipeline

Python backend, managed with [uv](https://docs.astral.sh/uv/). It ingests NISAR L2 GCOV HDF5 granules, parses them into the data contracts in `docs/04-contracts.md`, and serves those files to the frontend with live update pushes. It is fully detachable: the frontend only ever sees contract files over HTTP, so the same output can be copied to `web/public/data/` as a static build.

## Run

```
cd backend
uv sync                                    # install
uv run sars-pipeline serve                 # http://127.0.0.1:8765, watches data/inbox/
uv run sars-pipeline synthetic --dates 3   # drop 3 synthetic granules into data/inbox/
uv run sars-pipeline ingest FILE.h5 ...    # one-off ingest without the server
uv run pytest && uv run ruff check .       # checks
```

Paths default to `<repo>/data/`: `data/inbox/` (incoming `.h5`), `data/processed/` (contract output). Override with `--data-dir` or `SARS_DATA_ROOT`. Both are gitignored.

## Flow

```
data/inbox/*.h5 ──(watcher, every --poll s)──> granule.py: parse identification + grids
                                                export.py:  per polarization -> dB -> PNG layer
                                                            per area -> time series JSON
                                                            manifest.json (atomic write)
                                           ──> server.py: manifest changed -> SSE "manifest" event
```

- **Area** = one track/frame/pass (`t001-f001-a`), so every date in an area shares viewing geometry.
- **Layer** = one polarization on one date (`hh-2026-01-13`), grayscale PNG with transparent nodata, stretched between the 2nd and 98th percentile (`value_range`).
- **Time series** = mean backscatter per polarization over the frame, one point per date.
- Re-ingesting a granule replaces its layers. Files that fail to parse (for example, still copying) are retried once they change.

## HTTP API (for the frontend)

| Endpoint | Returns |
|---|---|
| `GET /manifest.json` | Contract C1 manifest; all other URLs inside it are relative to the server root |
| `GET /areas/<area>/layers/<id>.png` | Image overlay; place it with the layer's `bounds` |
| `GET /areas/<area>/timeseries/<pol>.json` | Contract C4 time series |
| `GET /events` | Server-sent events: `event: manifest` whenever the manifest changes |
| `GET /health` | `{"ok": true}` |

CORS is open for GET, and responses carry `Cache-Control: no-cache`.

```js
const base = "http://127.0.0.1:8765/";
const load = async () => render(await (await fetch(base + "manifest.json")).json());
new EventSource(base + "events").addEventListener("manifest", load);
load();
```

## Known shortcuts (search the code for `shortcut:`)

- HDF5 paths follow the GCOV product spec layout; verify against a real granule.
- Downsampling is decimation, not multilooking.
- Linear power to dB assumes the GCOV scaling; verify in the product spec.
- Maturity is guessed from the granule ID; the attribution line is provisional.
- Overlays use the WGS84 bounding box of a UTM grid, which is slightly off at the edges for large frames.

## Not built yet

Download from ASF (F02 fetch), AOI cropping, change detection (F03, waits on ADR-003), and contract JSON Schema validation (Phase 0 `contracts/schemas/`).
