# Frontend integration with backend contract 0.3 (testing branch only)

These changes live only on the `testing` branch, to check the frontend against the new backend. The `frontend` branch is untouched. To bring them over, either apply the patch or reimplement them by hand from the list below.

```
# on the frontend branch, from the repo root
git apply frontend/integration-0.3.patch     # copy the file from testing first; checked to apply cleanly to origin/frontend at eecf60c
```

Total: 6 files, about 160 lines added. Nothing removed from the existing UI; `example-areas.ts` and the `TYPES` fallback stay for back ends without categories.

## What the backend now sends (docs/04 v0.3.0)

- One area per site (`cdmx`, `sf`), with `categories`: frontend filter ids from `filters.ts` (`subsidence`, `floods`, ...), most frequent first. `other` means no filter matches.
- Layers carry `group` (picker label: `HH backscatter`, `HV backscatter`, `HH change`, `HV change`, `Detected change`, `Surface type`, `Ground motion`, `Soil moisture`) and `role`. Colors are baked into the PNGs; `colormap` is only a name.
- `events.geojson`: a FeatureCollection of detected changes with real outlines. Flat properties: `id`, `area_id`, `category` (primary), `categories` (comma-separated), `title`, `summary`, `from`, `to`, `confidence`, `area_km2`, `maturity`, `lon`, `lat` (a point inside the outline).
- `POST /sites` `{lat, lon}` (server started with `--jobs`): processes a new place in the background; a `manifest` event on `/events` fires when it is ready.

## Changes, file by file

### `src/logic.ts`
1. `Layer` gets optional `group?: string; role?: string`. `ManifestArea` gets optional `categories?: string[]`.
2. New `EventFeature` type for one `events.geojson` feature (the flat properties above).
3. The picker key is `l.group ?? l.polarization ?? "none"` instead of `l.polarization ?? "none"`. `polarizations`, `datesFor` and `layerAt` keep working unchanged; with groups each picker option is one kind of layer, and the date slider runs over that kind's dates (change layers use the end of `date_range`, as `layerDate` already does).
4. Area types: `a.categories` (minus `"other"`) when present, else the old `typesFor(change_types)` guess.
5. `toAreaView(a, reports = [])`: when the area has events, its timeline is those events, newest first (`date` = event `to`, `title`, `summary` + confidence); else one row per radar pass, as before.

### `src/globe.ts`
1. On load, two GeoJSON sources: `events` (outlines) and `event-points` (dots built from `lon`/`lat`).
2. Layers: `events-fill` (fill, 25% opacity) and `events-line` from zoom 8, inserted below `areas-box`; `events-dot` circles at every zoom. Color from each feature's `color` property.
3. Clicking a fill or dot opens a MapLibre `Popup` built with `el()` (title; dates, km², confidence, maturity; summary). Never `setHTML`: the text comes from data files.
4. New method `setEvents(features)`: sets both sources. Features arrive already filtered and colored.

### `src/main.ts`
1. `reports: EventFeature[]`. In `loadLive`, after a supported manifest: fetch `events.geojson` (optional; failure means no events), then `toAreaView(a, reports)`.
2. In `render`: `globe.setEvents(...)` with the reports that pass the filters, colored by their primary category's group color (`GROUPS`). Same rule as areas: an event whose categories are all non-filters (`other`) is always shown.
3. Status line also counts detected changes.
4. "Process this place" button: validates the coordinate form, `POST sites` with `{lat, lon}`, and reports 202 (processing, appears when ready), 404 (server without `--jobs`), 401 (server needs a token) or other errors in the status line. The existing SSE listener reloads the data when the backend finishes.
5. Picker label: "Layer (radar image per polarization, detected change, ground motion, soil moisture)".

### `index.html`
`<button type="button" id="process">Process this place</button>` after the Go button in `#coords`.

### `src/style.css`
Popup colors from the theme variables (`--panel`, `--text`, `--line`), so popup text stays readable on the dark theme.

### `test/logic.test.ts`
One test: categories drive filters, groups drive the picker and its dates, events fill the timeline (only the area's own).

## Checked

- `npm test` (4 passing) and `npm run build` pass.
- Live: testing backend (`serve --jobs`, port 8796) plus `vite --port 5174` with `VITE_DATA_BASE=http://127.0.0.1:8796/`, driven by headless Chrome over the DevTools protocol on 2026-11-14:
  - status reads "Radar data connected: 2 area(s), 28 detected change(s)";
  - Mexico City opens with its tags (Deforestation, Land subsidence, Agriculture, Groundwater extraction), the eight layer groups, and its timeline from events;
  - the Ground motion layer and the event outlines and dots draw on the map;
  - no console errors.
- Not checked: clicking a popup (the map canvas was not clicked), the Process button against a live server (the `/sites` API itself is tested in the backend and was run once by hand), phones, screen readers, other browsers.

## Not done (frontend lane)

- A time-series chart: each event has `series` in `events.json` (HH/HV dB, line-of-sight cm, soil moisture) and areas have C4 files; nothing plots them yet (F05).
- Legends for `rdbu`, `brbg` and `classes` colormaps (the range shows as text today).
- Hiding filter subdivisions the backend cannot produce yet (see `backend/README.md`).
- A per-event confidence threshold or date filter in the UI.
