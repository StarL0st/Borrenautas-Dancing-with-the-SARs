# 04. Data Contracts

Status: Draft v0.6.0. 0.2.0 added C7 events and `/query`; 0.3.0 added categories (frontend filter ids), one area per site, layer `group`/`role`, event outlines with `centroid`, `evidence` and `series`, `events.geojson`, and `/sites`; 0.4.0 adds the `burn_scar` signature (fire-season NASA FIRMS detections plus NISAR radar after them); 0.5.0 adds friendly cards (C8, area `friendly`), public place lookup on `POST /sites`, `GET /sites/<id>`, and country mosaic areas; 0.6.0 adds live events (C9, `live.geojson`, the `live` push event and the `storms` category) and history (C10, area `history`, `GET /history`). Frozen at about T+5h after kickoff. After the freeze, changes need approval from both the producer lane (Lane 1) and the consumer lane (Lane 2), and a version bump.

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
| `friendly` | string | no | URL of this area's friendly cards (C8) |
| `history` | string | no | URL of this area's history (C10) |

### Categories

The ids of the frontend filter panel (`frontend/src/filters.ts`), so filters map 1:1 to data: `earthquakes`, `volcanoes`, `landslides`, `floods`, `forecast`, `sinkholes`, `wildfires`, `drought`, `marine`, `glaciers`, `ice-sheets`, `sea-ice`, `permafrost`, `glacial-lakes`, `induced-seismicity`, `oil-spills`, `groundwater`, `subsidence`, `logging`, `coastal-loss`, `reservoirs`, `deforestation`, `urban`, `agriculture`, `storms` (live events only, C9), plus `other`. The backend currently produces `floods`, `deforestation`, `wildfires` (with fire data), `agriculture`, `urban`, `subsidence`, `groundwater`, `drought`, `other` (decision table in `backend/README.md`).

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
| `GET /history?lat=<lat>&lon=<lon>` | `{ contract_version, point: [lon, lat], histories: History[] }` (C10): one history per area whose `bbox` contains the point, holding only the events within 5 km of the point. Optional `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `category=<category>`. `histories` is empty where no area covers the point. Only on the server; against the static export use the area's `history` file |
| `GET /live.geojson` | C9 live events. Only when the server runs with `serve --live-minutes N` (or after `sars-pipeline live-events`); otherwise 404, and the frontend must work without it. `/events` then also sends `event: live` with data `{"type": "live", "url": "live.geojson"}` whenever the file changes |
| `GET /events.json` | All events: `{ contract_version, events: Event[] }` (C7). Also present in the static export |
| `GET /query?lat=<lat>&lon=<lon>` | `{ contract_version, events: Event[], area_ids: string[] }`: events whose geometry contains the point, and areas whose `bbox` contains it |
| `GET /query?bbox=w,s,e,n` | Same shape: events and areas whose `bbox` intersects the box |
| `GET /api/areas` | `{ contract_version, areas: [{ id, title, summary, bbox, center, categories, products, layers (count), events (count), friendly, history }] }`: every processed area without its layer list. Since 2026-11-15 |
| `GET /api/events` | `{ contract_version, total, events: Event[] }` (C7), highest `confidence` first. Optional `area=<area id>`, `category=<category>`, `from=`, `to=` (as `/query`), `min_confidence=<0 to 1>`, `limit=<1 to 1000, default 100>`, `offset=`. `total` counts every match, not only the page. Since 2026-11-15 |
| `GET /api/live` | C9 document with `features` filtered by optional `category=` and `source=<source id>`. 404 when there is no `live.geojson`. Since 2026-11-15 |
| `GET /docs`, `GET /openapi.json` | Every call with its parameters, as a page to try them and as OpenAPI JSON |
| `GET /events.geojson` | The same events as a GeoJSON FeatureCollection with flat properties (`id`, `area_id`, `category` (primary), `categories` (comma-separated), `title`, `summary`, `from`, `to`, `confidence`, `area_km2`, `maturity`, `lon`, `lat`), for a MapLibre source. Also in the static export |
| `GET /sites` | Only with `serve --jobs`. `{ sites: [{ id, title, bbox, requested, status, error?, result?, finished? }] }`; `status` is `idle`, `queued`, `running`, `done`, or `error` |
| `POST /sites` | Only with `serve --jobs`. Body `{ lat, lon, km? (default 20, max 30), title?, id? }`. Adds a requested site and processes it in the background. 202 `{ id, status }`. When done, `/events` fires a `manifest` event |
| `GET /sites/<id>` | Only with `serve --jobs`. `{ id, status, position?, processed, error? }`: `position` is the place in the queue (0 = next), `processed` says the area has data |
| `POST /sites` (public) | Only with `serve --jobs --public`, no token. Body `{ lat, lon }` only. Answers with the curated site at the point, or the grid cell around it (0.2 degree grid, 22 km box, id `cell-<lat>n-<lon>w`). 200 `{ id, status: "done", empty?, message? }` when cached (`empty`: no NISAR data there); 202 `{ id, status, position }` when queued, then `/events` fires a `manifest` event; 429 `{ detail }` over a limit (new places per address per hour, queue length, total places) |
| `POST /sites/<id>/refresh` | Only with `serve --jobs`. Search the catalog again and process if there are new granules (`?force=true` to reprocess). 202 |

- `/query` also takes optional filters `category=<category>`, `type=<change type>`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (event `date_range` overlaps `[from, to]`).
- POST requests need `Authorization: Bearer <token>` when the server has an admin token set (always in the cloud: they start downloads). On a public server the token is needed only for `km`, `title`, `id` and `/refresh`.
- The three `/api/` calls exist only on the server (like `/query`). They were added without a version bump: no file changed shape and the frontend does not depend on them.
- Events with `confidence` under 0.3 are not published (backend setting `min_confidence`, since 2026-11-15), so `events.json`, `events.geojson`, friendly cards and histories hold only events at 0.3 or more.
- CORS is open for GET; responses carry `Cache-Control: no-cache`.
- `/query` exists only on the server. Against the static export the frontend loads `events.json` and filters it itself.
- Area IDs are site ids (`cdmx`; requested places `at-<lat>n-<lon>w`, looked-up cells `cell-<lat>n-<lon>w`, dots as `_`; `mexico` is a country mosaic: soil moisture at about 2 km per 12-day cycle, layers with `date_range`, far larger than other areas). An area mixes products; each product keeps one viewing geometry and maturity, stated in `products` and in every layer's provenance. Backscatter layer IDs are `<pol>-<YYYY-MM-DD>`.
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
| `signature` | string | yes | What the radar saw before interpretation: `darkening_both`, `hv_drop`, `brightening`, `strong_change`, `seasonal_cycle`, `sinking`, `soil_drying`, `burn_scar` (GCOV plus NASA FIRMS: `date_range` starts at the fire season, `series` has `HV` and `HV_unburned_vegetation`) |
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

## C8. Friendly cards (`areas/<area>/friendly.json`)

The area's events (C7) summed per category and graded, in plain language, for the friendly mode. No new detections: every card points back to events and a layer. Also in the static export.

| Field | Type | Req | Notes |
|---|---|---|---|
| `contract_version` | string | yes | |
| `area_id` | string | yes | |
| `title` | string | yes | The area title |
| `status` | enum | yes | `calm`, `watch`, `alert`: from the highest card level (0-1, 2, 3) |
| `headline` | string | yes | One plain sentence for the whole area |
| `cards` | Card[] | yes | Highest level first. May be empty |
| `data_notes` | string[] | yes | Maturity wording (BETA, PROVISIONAL) and the "hypothesis, not confirmed" note. Must be shown |

Card:

| Field | Type | Req | Notes |
|---|---|---|---|
| `category` | string | yes | A category id (C1 Categories) |
| `label` | string | yes | Plain name, e.g. `Flooding` |
| `level` | integer | yes | 0 = watched for here, nothing found; 1 = found, small or weak; 2 = 1 to 5% of the area; 3 = over 5%. Thresholds in `backend/README.md` |
| `headline` | string | yes | One plain sentence |
| `number` | object | when level > 0 | `{ value, unit, label }`, e.g. `{ 12.4, "km2", "area affected" }` |
| `share_percent` | number | when level > 0 | Share of the area inside this category's events |
| `places` | integer | when level > 0 | Number of events |
| `from`, `to` | string | when level > 0 | Dates the events span |
| `confidence` | number | when level > 0 | Highest event confidence, 0 to 1 |
| `maturity` | enum | when level > 0 | Lowest maturity among the events |
| `event_ids` | string[] | when level > 0 | Up to 5 C7 event ids, largest first |
| `layer_id` | string or null | when level > 0 | A C2 layer that shows it |

## C9. Live events (`live.geojson`)

What public disaster feeds report right now, shown next to the radar results. **These are not NISAR detections and not C7 events**: the frontend must draw them differently (hollow rings today) and show each feature's `credit`. Optional file, in the data root; also in the static export when present. Sources and licenses: `docs/09`.

A GeoJSON FeatureCollection with extra top-level fields:

| Field | Type | Req | Notes |
|---|---|---|---|
| `type` | string | yes | `FeatureCollection` |
| `generated_at` | string | yes | UTC, `YYYY-MM-DDTHH:MM:SSZ` |
| `note` | string | yes | Plain sentence saying these are not NISAR detections |
| `sources` | Source[] | yes | One per feed, also the feeds that failed |
| `refresh_minutes` | number | no | How often the server rewrites the file (since 2026-11-15) |
| `features` | Feature[] | yes | Point features, newest first. May be empty |

Source:

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | enum | yes | `usgs` (earthquakes of magnitude 2.5+ and other shaking, last 24 h), `gdacs`, `eonet` (NASA EONET), `nws` (US weather alerts), `volcano` (US volcano alert levels), `nhc` (NOAA hurricanes), `firms` (NASA fire detections, last 24 h, Mexico) |
| `name`, `owner`, `url`, `credit` | string | yes | Feed name, who runs it, its address, credit line |
| `ok` | boolean | yes | `false`: the feed failed or has no key; the other feeds still load |
| `count` | integer | yes | Features kept from this feed; 0 when `ok` is false |
| `error` | string | when `ok` is false | Reason, at most 200 characters |

Feature: `geometry` is a `Point` (`[lon, lat]`); `properties` are flat:

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | `<source>-<the feed's own id>`; stable between refreshes |
| `source` | enum | yes | A Source `id` |
| `source_name` | string | yes | Who runs the feed |
| `credit` | string | yes | Credit line. Must be shown with the event |
| `category` | string | yes | A category id (C1 Categories): `wildfires`, `volcanoes`, `floods`, `landslides`, `drought`, `earthquakes`, `sea-ice`, `storms`, `hurricanes`, `marine`, `cold`, `heat`, `dust`, `forecast`, `industrial`, `oil-spills`, `glaciers`, `sinkholes`, `induced-seismicity` or `other` (the frontend's filter ids) |
| `title` | string | yes | What is happening, e.g. `Magnitude 5.1 earthquake` |
| `place` | string | yes | Where, in words; `""` when the feed gives none |
| `date` | string | yes | UTC. `YYYY-MM-DD`, or with a time (`YYYY-MM-DDTHH:MMZ`) when the feed gives one. The latest update of the event |
| `detail` | string | yes | One short line (size, alert level, who reported it); may be `""` |
| `url` | string | yes | Link to the source's page for the event; may be `""` |
| `lon`, `lat` | number | yes | Same as the geometry, for popups |
| `severity` | integer | no | 0 minor to 3 most dangerous, from the source's own scale (magnitude, alert level). Since 2026-11-15 |
| `active` | boolean | no | `true`: the source still lists the event as going on. Absent otherwise. Since 2026-11-15 |

- One event may reach us through two feeds; the backend keeps one (GDACS events are taken from GDACS, not EONET; earthquakes from USGS, not GDACS).
- A fire detection (`firms`) is a hot spot seen from space: it can also be a crop burn or a gas flare. Its `detail` says so.
- What is in the file: events dated within the last 24 hours, plus `active` ones however old. The frontend's own collector (`frontend/src/livefeeds.ts`, used when no server file is reachable) follows the same rules, so both give the same events; only the server has `nhc` and `firms` (a web page cannot ask them).
- `severity`, `active`, `refresh_minutes`, the two new sources and the new categories were added on 2026-11-15 without a version bump: the frontend already produced and read them.
- Refresh: the server rewrites the file every N minutes; the frontend reloads on the `live` push event or on its own timer.

## C10. History (`areas/<area>/history.json`, `GET /history`)

Everything known about an area in time order, for a timeline or replay. No new detections: every id points to a C2 layer, a C7 event or a C4 series. Also in the static export.

| Field | Type | Req | Notes |
|---|---|---|---|
| `contract_version` | string | in the file | In `/history` it is on the envelope |
| `area_id`, `title` | string | yes | The area |
| `from`, `to` | string or null | yes | The range asked for, else the first and last date on the timeline; null when the timeline is empty |
| `periods` | Period[] | yes | `{ maturity, from, to }`, one per maturity level present, oldest first. Values from different levels must not be compared |
| `timeline` | Day[] | yes | Oldest first. Only dates that have something. May be empty |
| `events` | object[] | yes | C7 events without `geometry`, `evidence`, `series`, `summary` and `provenance`: `id`, `type`, `categories`, `signature`, `title`, `date_range`, `centroid`, `bbox`, `area_km2`, `confidence`, `maturity`, `product`, `layer_ids`. Full events: `events.json` or `/query` |
| `layers` | object[] | yes | C2 layers reduced to `id`, `title`, `group`, `role`, `product`, `maturity`, `date` or `date_range`, `url` |
| `series` | object[] | yes | `{ series_id, title, units, maturity, url }` for each C4 series with values in range |

Day:

| Field | Type | Req | Notes |
|---|---|---|---|
| `date` | string | yes | `YYYY-MM-DD` |
| `layer_ids` | string[] | yes | Layers of this date |
| `event_ids` | string[] | yes | Events first visible on this date |
| `values` | object | yes | Series id to value on this date, e.g. `{ "hv-backscatter": -14.38 }`. A pass without a reading has no key |

- A layer or event with a `date_range` sits at its **last** date: the pass on which it became visible. A change layer from June 17 to June 29 is under June 29.
- Layers without a date (for example surface type) are not in a history.
- With `from`/`to`, a layer or event is kept when its dates overlap the range; a series value when its date is inside.
- Area files hold every event of the area. `/history` holds only those near the point.

## Validation rules

- `make validate` validates every JSON file under `frontend/public/data/` and `contracts/fixtures/` against the schemas. CI runs it on every PR.
- A manifest with `synthetic: true` makes the frontend show a visible banner.
- Fixtures must be obviously synthetic (for example, a Gaussian blob, a checkerboard) and must never resemble a real area.

## Change protocol

1. Open a PR that changes the schema, the fixture, and this document together, with the label `contract-change`.
2. Both Lane 1 and Lane 2 owners approve. The spec keeper merges.
3. Bump `contract_version`: patch for clarifications, minor for additive fields, major for breaking changes.
