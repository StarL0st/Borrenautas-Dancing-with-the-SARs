# 04. Data Contracts

Status: Draft v0.3.0. 0.2.0 added C7 events and `/query`; 0.3.0 adds categories (frontend filter ids), one area per site, layer `group`/`role`, event outlines with `centroid`, `evidence` and `series`, `events.geojson`, and `/sites`. Frozen at about T+5h after kickoff. After the freeze, changes need approval from both the producer lane (Lane 1) and the consumer lane (Lane 2), and a version bump.

These contracts are the only coupling between the pipeline (producer) and the frontend (consumer). The build agent turns them into JSON Schema files (`contracts/schemas/`, draft 2020-12) and writes synthetic fixtures (`contracts/fixtures/`) so both lanes can work independently.

## Conventions

- All coordinates are WGS84 longitude/latitude in degrees. Bounding boxes are `[west, south, east, north]`.
- Dates are ISO 8601 (`YYYY-MM-DD`; timestamps in UTC with `Z`).
- URLs inside the contracts are relative to the data root (`frontend/public/data/`), except `xyz_tiles` URLs, which may be absolute (`https://`) when tiles live in a Cloud Storage bucket.
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
| `categories` | string[] | no | Categories of this area's events (see Categories), most frequent first. The frontend filters areas on this |
| `bbox` | number[4] | yes | |
| `center` | number[2] | yes | `[lon, lat]` |
| `zoom_default` | number | yes | |
| `layers` | Layer[] | yes | Change and SAR layers |
| `context_layers` | Layer[] | no | Optical/GIS context layers |
| `timeseries` | TimeSeriesRef[] | no | `{ id, title, url }` |
| `story_url` | string | no | Points to a Story file (C4) |
| `credits` | string[] | yes | Data and tool attributions |
| `products` | object | no | Per NISAR product used: `{ maturity, track?, frame?, direction? }` |

### Categories

The ids of the frontend filter panel (`frontend/src/filters.ts`), so filters map 1:1 to data: `earthquakes`, `volcanoes`, `landslides`, `floods`, `forecast`, `sinkholes`, `wildfires`, `drought`, `marine`, `glaciers`, `ice-sheets`, `sea-ice`, `permafrost`, `glacial-lakes`, `induced-seismicity`, `oil-spills`, `groundwater`, `subsidence`, `logging`, `coastal-loss`, `reservoirs`, `deforestation`, `urban`, `agriculture`, plus `other`. The backend currently produces `floods`, `deforestation`, `wildfires` (with fire data), `agriculture`, `urban`, `subsidence`, `groundwater`, `drought`, `other` (decision table in `backend/README.md`).

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
| `maturity` | enum | yes | `BETA`, `PROVISIONAL`, `VALIDATED`, `OTHER`. Never mix maturities inside one comparison |
| `units` | string | yes | e.g. `dB`, `dB difference`, `ratio`, `m`, `class` |
| `value_range` | number[2] | for rasters | Display stretch `[min, max]` |
| `colormap` | string | for rasters | Named colormap: `gray`, `rdbu` (diverging), `brbg` (dry to wet), `classes` (categorical). Colors are baked into the PNGs; the name is for the legend |
| `group` | string | no | Label for the layer picker, e.g. `HV backscatter`, `Detected change`, `Ground motion`, `Soil moisture`. Layers of one group form one date slider |
| `role` | enum | no | `backscatter`, `change`, `context`, `motion`, `soil_moisture`. Lets the frontend keep change layers apart from imagery |
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
| `GET /events.json` | All events: `{ contract_version, events: Event[] }` (C7). Also present in the static export |
| `GET /query?lat=<lat>&lon=<lon>` | `{ contract_version, events: Event[], area_ids: string[] }`: events whose geometry contains the point, and areas whose `bbox` contains it |
| `GET /query?bbox=w,s,e,n` | Same shape: events and areas whose `bbox` intersects the box |
| `GET /events.geojson` | The same events as a GeoJSON FeatureCollection with flat properties (`id`, `area_id`, `category` (primary), `categories` (comma-separated), `title`, `summary`, `from`, `to`, `confidence`, `area_km2`, `maturity`, `lon`, `lat`), for a MapLibre source. Also in the static export |
| `GET /sites` | Only with `serve --jobs`. `{ sites: [{ id, title, bbox, requested, status, error?, result?, finished? }] }`; `status` is `idle`, `queued`, `running`, `done`, or `error` |
| `POST /sites` | Only with `serve --jobs`. Body `{ lat, lon, km? (default 20, max 30), title?, id? }`. Adds a requested site and processes it in the background. 202 `{ id, status }`. When done, `/events` fires a `manifest` event |
| `POST /sites/<id>/refresh` | Only with `serve --jobs`. Search the catalog again and process if there are new granules (`?force=true` to reprocess). 202 |

- `/query` also takes optional filters `category=<category>`, `type=<change type>`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (event `date_range` overlaps `[from, to]`).
- POST requests need `Authorization: Bearer <token>` when the server has an admin token set (always in the cloud: they start downloads).
- CORS is open for GET; responses carry `Cache-Control: no-cache`.
- `/query` exists only on the server. Against the static export the frontend loads `events.json` and filters it itself.
- Area IDs are site ids (`cdmx`; requested places `at-<lat>n-<lon>w`, dots as `_`). An area mixes products; each product keeps one viewing geometry and maturity, stated in `products` and in every layer's provenance. Backscatter layer IDs are `<pol>-<YYYY-MM-DD>`.
- Layers may carry an extra `stats` object (`mean_db`, `n_pixels`); the frontend must not depend on it.
- The static build sets the base to the site's own `data/` path; nothing else changes. `/events` does not exist there, so the frontend must work without it.

## C7. Event

A detected and classified surface change: "this place shows X between these dates". Produced by the classify stage, served by `/events.json` and `/query`. The manifest change event (`/events`) also fires when `events.json` changes.

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | Unique, stable across reruns with the same inputs |
| `area_id` | string | yes | The C1 area it was found in |
| `type` | enum | yes | Same values as `change_types` in C1 |
| `categories` | string[] | yes | Categories (C1), primary first, e.g. `["subsidence", "groundwater"]` |
| `signature` | string | yes | What the radar saw before interpretation: `darkening_both`, `hv_drop`, `brightening`, `strong_change`, `seasonal_cycle`, `sinking`, `soil_drying` |
| `product` | string | yes | NISAR product it comes from: `GCOV`, `GUNW`, `SME2` |
| `title` | string | yes | Short, plain language |
| `summary` | string | yes | One or two plain-language sentences, data basis first |
| `date_range` | [string, string] | yes | `[from, to]`, the two acquisitions compared |
| `geometry` | GeoJSON geometry | yes | Polygon or MultiPolygon, WGS84: the region's real outline |
| `centroid` | number[2] | yes | `[lon, lat]` of a point inside the outline, for markers and fly-to |
| `bbox` | number[4] | yes | Of `geometry` |
| `area_km2` | number | yes | |
| `confidence` | number | yes | 0 to 1; how it is computed is stated in `provenance.steps` |
| `method` | enum | yes | `rules` or `model` (`model` is experimental and labelled so in the UI) |
| `polarization` | string | yes | Polarization(s) the detection used, e.g. `HV`, `HH/HV` |
| `maturity` | enum | yes | As in C2 |
| `layer_ids` | string[] | yes | C2 layers in the same area that show it |
| `evidence` | object | yes | The numbers behind the decision, e.g. `mean_d_hv_db`, `surface_before`, `fire_detections`, `persistent`, `rate_cm_yr_line_of_sight` |
| `series` | object | no | The region's own values per date, `{ <name>: [{ date, value }] }`, e.g. `HH`/`HV` (dB), `line_of_sight_cm`, `soil_moisture_m3_m3` |
| `synthetic` | boolean | yes | |
| `provenance` | Provenance | yes | C3 |

## Validation rules

- `make validate` validates every JSON file under `frontend/public/data/` and `contracts/fixtures/` against the schemas. CI runs it on every PR.
- A manifest with `synthetic: true` makes the frontend show a visible banner.
- Fixtures must be obviously synthetic (for example, a Gaussian blob, a checkerboard) and must never resemble a real area.

## Change protocol

1. Open a PR that changes the schema, the fixture, and this document together, with the label `contract-change`.
2. Both Lane 1 and Lane 2 owners approve. The spec keeper merges.
3. Bump `contract_version`: patch for clarifications, minor for additive fields, major for breaking changes.
