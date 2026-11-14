# 04. Data Contracts

Status: Draft v0.1.0. Frozen at about T+5h after kickoff. After the freeze, changes need approval from both the producer lane (Lane 1) and the consumer lane (Lane 2), and a version bump.

These contracts are the only coupling between the pipeline (producer) and the frontend (consumer). The build agent turns them into JSON Schema files (`contracts/schemas/`, draft 2020-12) and writes synthetic fixtures (`contracts/fixtures/`) so both lanes can work independently.

## Conventions

- All coordinates are WGS84 longitude/latitude in degrees. Bounding boxes are `[west, south, east, north]`.
- Dates are ISO 8601 (`YYYY-MM-DD`; timestamps in UTC with `Z`).
- All URLs inside the contracts are relative to the data root (`frontend/public/data/`).
- `contract_version` is semver. Frontend rejects a manifest with an unsupported major version.
- Unknown fields are allowed (forward compatibility); required fields are not optional.

## C1. `manifest.json`

| Field | Type | Req | Notes |
|---|---|---|---|
| `contract_version` | string | yes | e.g. `0.1.0` |
| `generated_at` | string | yes | UTC timestamp |
| `git_commit` | string | yes | Commit of the pipeline that produced it |
| `synthetic` | boolean | yes | `true` only for fixtures |
| `areas` | Area[] | yes | At least one |

### Area

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | Slug, unique |
| `title` | string | yes | |
| `summary` | string | yes | One or two plain-language sentences |
| `change_types` | string[] | yes | From: `flood_wetland`, `forest_loss`, `wildfire`, `agriculture`, `soil_moisture`, `glacier_ice`, `deformation`, `other` |
| `bbox` | number[4] | yes | |
| `center` | number[2] | yes | `[lon, lat]` |
| `zoom_default` | number | yes | |
| `layers` | Layer[] | yes | Change and SAR layers |
| `context_layers` | Layer[] | no | Optical/GIS context layers |
| `timeseries` | TimeSeriesRef[] | no | `{ id, title, url }` |
| `story_url` | string | no | Points to a Story file (C4) |
| `credits` | string[] | yes | Data and tool attributions |

## C2. Layer

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within the area |
| `title` | string | yes | |
| `description` | string | yes | Plain language: what the viewer is seeing |
| `kind` | enum | yes | `image_overlay`, `xyz_tiles`, `geojson` |
| `url` | string | yes | For tiles: URL template with `{z}/{x}/{y}` |
| `bounds` | number[4] | when `image_overlay` | |
| `date` | string | one of | Single acquisition date |
| `date_range` | [string, string] | one of | For composites or differences, `[from, to]` |
| `product` | string | yes | e.g. `GCOV`; `derived` allowed with provenance |
| `polarization` | string or null | yes | e.g. `HH`, `HV`, `HH/HV`, `null` for non-polarimetric products |
| `maturity` | enum | yes | `BETA`, `PROVISIONAL`, `OTHER` |
| `units` | string | yes | e.g. `dB`, `dB difference`, `ratio`, `m`, `class` |
| `value_range` | number[2] | for rasters | Display stretch `[min, max]` |
| `colormap` | string | for rasters | Named colormap that the frontend implements |
| `synthetic` | boolean | yes | |
| `provenance` | Provenance | yes | See C3 |

## C3. Provenance

| Field | Type | Req | Notes |
|---|---|---|---|
| `source_granules` | string[] | yes | Full NISAR granule IDs (empty only if `synthetic`) |
| `steps` | string[] | yes | Ordered processing steps in plain words, e.g. "converted to dB", "5x5 multilook" |
| `params` | object | yes | Parameters used (window sizes, thresholds, etc.) |
| `software` | object | yes | `{ name, version, commit }` |
| `attribution` | string | yes | Credit line shown in the UI |

## C4. Time series file

| Field | Type | Req | Notes |
|---|---|---|---|
| `area_id` | string | yes | |
| `series_id` | string | yes | |
| `title` | string | yes | |
| `units` | string | yes | |
| `polarization` | string | yes | |
| `statistic` | enum | yes | `mean`, `median`, `pixel` |
| `region` | GeoJSON geometry | yes | Point or Polygon the statistic covers |
| `points` | object[] | yes | Each `{ date, value, n_pixels, granule }` sorted by date |
| `maturity` | enum | yes | As in C2 |
| `synthetic` | boolean | yes | |

## C5. Story file

| Field | Type | Req | Notes |
|---|---|---|---|
| `area_id` | string | yes | |
| `title` | string | yes | |
| `steps` | Step[] | yes | Ordered |

Step: `{ id, title, text, layer_ids[], date?, camera: { center, zoom, bearing? }, callout? }`. `text` is plain-language Markdown, short (under 80 words per step is the target).

## C6. Live data server (backend `sars-pipeline serve`)

The backend serves the same data root over HTTP, so the frontend can switch between the live server and the static copy by changing one base URL. Default base: `http://127.0.0.1:8765/`.

| Endpoint | Returns |
|---|---|
| `GET /manifest.json` | C1 manifest. Every URL inside it is relative to the base |
| `GET /<layer.url>` | Layer files, e.g. `areas/<area>/layers/<id>.png` (C2 `image_overlay`) |
| `GET /<timeseries.url>` | C4 time series, e.g. `areas/<area>/timeseries/<pol>.json` |
| `GET /events` | Server-sent events. `event: manifest` with data `{"type": "manifest", "url": "manifest.json"}` whenever the manifest changes. The frontend refetches the manifest on each event |
| `GET /health` | `{"ok": true}` |

- CORS is open for GET; responses carry `Cache-Control: no-cache`.
- Area IDs are `t<track>-f<frame>-<a|d>` (one track, frame, and pass direction, so every date shares viewing geometry). Layer IDs are `<pol>-<YYYY-MM-DD>`.
- Layers may carry an extra `stats` object (`mean_db`, `n_pixels`); the frontend must not depend on it.
- The static build sets the base to the site's own `data/` path; nothing else changes. `/events` does not exist there, so the frontend must work without it.

## Validation rules

- `make validate` validates every JSON file under `frontend/public/data/` and `contracts/fixtures/` against the schemas. CI runs it on every PR.
- A manifest with `synthetic: true` makes the frontend show a visible banner.
- Fixtures must be obviously synthetic (for example, a Gaussian blob, a checkerboard) and must never resemble a real area.

## Change protocol

1. Open a PR that changes the schema, the fixture, and this document together, with the label `contract-change`.
2. Both Lane 1 and Lane 2 owners approve. The spec keeper merges.
3. Bump `contract_version`: patch for clarifications, minor for additive fields, major for breaking changes.
