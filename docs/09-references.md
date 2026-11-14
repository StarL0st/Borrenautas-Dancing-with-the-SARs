# 09. References, data sources, and licenses

Rule (team instruction, 2026-11-14): prefer NASA data. Other sources are allowed only when their license permits our use, and each must be cited here and in the app credits. Add every online source you use to this file in the same change that starts using it.

Status column: **used** (data or code in the product), **consulted** (read for facts, no data used), **candidate** (planned, not used yet; check the license before use).

## 1. Data

### NASA (preferred)

| Dataset | DOI / ID | Status | Used for |
|---|---|---|---|
| NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1), `NISAR_L2_GCOV_PROVISIONAL_V1` | [10.5067/NIL2GCOV-P1](https://doi.org/10.5067/NIL2GCOV-P1), CMR C2854338529-ASF | used | San Francisco test site (track 135, frame 21) |
| NISAR Validated Geocoded Polarimetric Covariance Product (Version 1), `NISAR_L2_GCOV_V1` | [10.5067/NIL2GCOV-V1](https://doi.org/10.5067/NIL2GCOV-V1), CMR C3622241360-ASF | used | Mexico City site (track 19, frame 11) |
| NISAR Beta GCOV, `NISAR_L2_GCOV_BETA_V1` | [10.5067/NIL2GCOV-B1](https://doi.org/10.5067/NIL2GCOV-B1) | consulted | Format checks only. Beta products "are not intended for use in scientific research" (Earthdata catalog) |
| NISAR Provisional Geocoded Unwrapped Interferogram (Version 1), `NISAR_L2_GUNW_PROVISIONAL_V1` | [10.5067/NIL2GUNW-P1](https://doi.org/10.5067/NIL2GUNW-P1), CMR C2854335566-ASF. CMR lists `10.5067/NIL1GUNW-P1`, which does not resolve (checked 2026-11-14); the granules' own `productDoi` is `NIL2GUNW-P1`, which does | used | Ground motion, subsidence |
| NISAR Provisional Soil Moisture (Version 1), `NISAR_L3_SME2_PROVISIONAL_V1` | [10.5067/NIL3SME2-P1](https://doi.org/10.5067/NIL3SME2-P1), CMR C2854344945-ASF | used | Soil moisture series, soil drying |
| NASA FIRMS active fire data (VIIRS S-NPP, standard and near-real-time) via the FIRMS area API | https://firms.modaps.eosdis.nasa.gov/api/ | used when `FIRMS_MAP_KEY` is set (not run yet: no key) | Wildfire context |
| NASADEM (elevation) | to add | candidate | Slope for landslides |
| OPERA DSWx (surface water) and DIST (vegetation disturbance), NASA JPL | to add | candidate | Flood and forest-loss context and cross-checks |

The GUNW `mask` layer embeds a NISAR water mask that, per its own attribute text, JPL derived from JRC Global Surface Water, ESA WorldCover, OpenStreetMap water polygons, and MEaSUREs GIMP. We use it only as part of the NASA product; credit the product.

The exact granules behind each site are listed in `data/selected/<site>.json` and in every layer's and event's `provenance.source_granules`.

**Citation format** (Earthdata catalog, APA). Example for the Validated GCOV:

> NASA/JPL/NISAR. (2026). NISAR Validated Geocoded Polarimetric Covariance Product (Version 1) [Data set]. NASA Alaska Satellite Facility Distributed Active Archive Center. https://doi.org/10.5067/NIL2GCOV-V1 Date Accessed: 2026-11-14

Use the same pattern with each collection's title and DOI.

**License / use:** "This dataset is openly shared, without restriction, in accordance with the EOSDIS Data Use and Citation Guidance." (Earthdata catalog page for GCOV; guidance: https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance). "All NISAR science data is freely available and open to the public, consistent with the long-standing NASA Earth Science open data policy." (https://nisar-docs.asf.alaska.edu/)

### Non-NASA (only if license allows, always cited)

| Source | License | Status | Note |
|---|---|---|---|
| RADARSAT-1 archive, Canadian Space Agency / Natural Resources Canada (C-band, HH, 1996-2013), Cloud Optimized GeoTIFFs in `s3://radarsat-r1-l1-cog` (AWS ca-central-1, public) | [Open Government Licence - Canada](https://open.canada.ca/en/open-government-licence-canada) (per the [AWS open data registry entry](https://registry.opendata.aws/radarsat-1/)) | candidate (from the challenge resource list) | Historical baseline. Bucket keys hold date and beam mode only, no location: find scenes through the EODMS catalog (https://www.eodms-sgdot.nrcan-rncan.gc.ca). `asf_search` returned no RADARSAT-1 results on 2026-11-14 |
| RADARSAT Constellation Mission (RCM), Canadian Space Agency (C-band, current) | **VERIFY** (EODMS terms) | candidate (from the challenge resource list) | EODMS registration needed; coverage over Mexico unknown |
| CSA SAR Python tutorial | n/a (tutorial) | candidate (from the challenge resource list) | Reference for reading RCM/RADARSAT products |
| MapLibre demo tiles (basemap, `https://demotiles.maplibre.org/`) | **VERIFY** | used (frontend) | Check the tile data license and attribution before submission; switch to a NASA basemap (for example GIBS) if unclear |
| ESA WorldCover 10 m (land cover) | **VERIFY** before use | candidate | Only if no NASA land cover is fine enough |
| JRC Global Surface Water | **VERIFY** before use | candidate | Prefer OPERA DSWx (NASA) |
| Copernicus DEM | **VERIFY** before use | candidate | Prefer NASADEM (NASA) |

## 2. Documentation consulted

| Source | URL | Used for |
|---|---|---|
| NISAR Data User Guide (Kristenson et al. 2026, Zenodo, [10.5281/ZENODO.20075813](https://doi.org/10.5281/ZENODO.20075813)) | https://nisar-docs.asf.alaska.edu/ | Product levels, maturity, access, GCOV layout, projections, metadata. Pages: `products-overview/`, `gcov/`, `data-format/`, `metadata/`, `projections/`, `earthdata-search/`, `asf-search`, `aws-s3-access/` |
| NISAR L2 GUNW Product Specification, JPL D-102272 Rev E | https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-102272_RevE_NASA_SDS_Product_Specification_L2_GUNW_Nov8_2024_w-sigs.pdf | GUNW layers; the ionospheric phase screen is "not applied ... by default" (p. 15). The phase sign is not stated there |
| NISAR GUNW data guide page | https://nisar-docs.asf.alaska.edu/gunw/ | GUNW overview |
| ISCE / ARIA interferogram sign convention (positive unwrapped phase = range increase) | general InSAR practice; **VERIFY** with a citable source | Phase-to-motion sign; also checked against Mexico City's known subsidence |
| Mexico City subsidence context, e.g. Chaussard, E., Wdowinski, S., Cabral-Cano, E., Amelung, F. (2014), "Land subsidence in central Mexico detected by ALOS InSAR time-series", Remote Sensing of Environment 140, 94-106 | **VERIFY** (cited from memory, not opened) | Story context; sanity check of the GUNW result |
| NISAR L2 GCOV Product Specification, JPL D-102274 Rev F | https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf | HDF5 paths, units (linear gamma0), masks, grids |
| Earthdata NISAR catalog (GCOV Beta) | https://www.earthdata.nasa.gov/data/catalog/asf-nisar-l2-gcov-beta-v1-1 | Citation format, use statement |
| NASA CMR search API | https://cmr.earthdata.nasa.gov/search/ | Collection titles, DOIs, concept IDs |
| Earthdata NISAR platform page | https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/nisar | Mission overview |
| NISAR sample data | https://nisar.jpl.nasa.gov/data/sample-data, https://science.nasa.gov/mission/nisar/sample-data/ | Background |
| ASF OpenSARLab NISAR cookbook | https://asfopensarlab.github.io/NISAR_Cookbook/notebooks/nisar-data-access | `asf_search` + `h5py` access pattern |
| MAAP NISAR access tutorial | https://docs.maap-project.org/en/hub/science/NISAR/NISAR_access.html | Access background |
| ASF Vertex guide | https://nisar-docs-test.asf.alaska.edu/vertex | Visual search background |
| Earthdata Login (token, ASF app EULA) | https://urs.earthdata.nasa.gov/ | Authentication |
| Challenge page | https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/ | Requirements |

## 3. Challenge resource list: what we used

| Resource | Status |
|---|---|
| NASA Earthdata Search | consulted (we query the same NASA catalog through `asf_search` and CMR) |
| ASF Vertex | consulted |
| ASF NISAR Data User Guide | used (see section 2) |
| Intro to Remote Sensing, Intro to SAR, NASA ARSET trainings, NISAR StoryMaps, NISAR Applications White Papers, UAVSAR Postcards | not used yet |
| UAVSAR format documents (uavsar.jpl.nasa.gov, uavdb.jpl.nasa.gov) | consulted during resource review, no data used |
| CSA RADARSAT Constellation Mission (RCM) product format and spec (download-telecharger.services.geo.ca), RADARSAT-1 open data (asc-csa.gc.ca, registry.opendata.aws/radarsat-1, earthdata.nasa.gov RADARSAT-1 announcement), GDAL RCM driver | consulted during resource review, no data used |
| CONAE SAOCOM catalogue and product format (catalogos.conae.gov.ar, earth.esa.int SAOCOM page) | consulted during resource review, no data used |

## 4. Software

| Package | Version | License | Where |
|---|---|---|---|
| asf_search (ASF) | 14.1.0 | BSD | backend: granule search |
| h5py | 3.16.0 | BSD-3-Clause | backend: HDF5 reading |
| fsspec | 2026.9.0 | BSD-3-Clause | backend: HTTPS streaming |
| aiohttp | 3.14.5 | Apache-2.0 AND MIT | backend: HTTP client for fsspec |
| NumPy | 2.5.4 | BSD-3-Clause (and bundled permissive licenses) | backend |
| SciPy | 1.18.1 | BSD-3-Clause | backend: smoothing, region labelling |
| pyproj (PROJ) | 3.8.0 | MIT | backend: coordinate transforms |
| Pillow | 13.0.0 | MIT-CMU | backend: PNG export |
| FastAPI | 0.162.7 | MIT | backend: API |
| Uvicorn | 0.54.0 | BSD-3-Clause | backend: API server |
| python-dotenv | 1.2.4 | BSD-3-Clause | backend: local secrets |
| rasterio | 1.5.2 | BSD-3-Clause | backend: event outlines from pixels |
| Shapely | 2.2.0 | BSD-3-Clause | backend: outline simplification, inside points |
| affine | 3.0.1 | BSD-3-Clause | backend: grid transforms (rasterio dependency) |
| uv | 0.12.13 | MIT OR Apache-2.0 | tooling |
| MapLibre GL JS | 6.18.0 | BSD-3-Clause | frontend: globe and map |
| Vite | 8.3.8 | MIT | frontend: build |
| TypeScript | 7.0.2 | Apache-2.0 | frontend |

## 5. App credits (shown on every layer and event)

The backend writes the matching collection citation into each layer's and event's `provenance.attribution` and each area's `credits`, chosen by product and maturity (`backend/src/sars_pipeline/export.py`, `CITATIONS`).
