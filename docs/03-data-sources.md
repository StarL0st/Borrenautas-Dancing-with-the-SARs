# 03. Data Sources

Status: living document. "Verified" means seen in ASF/NASA documentation during spec preparation (November 13, 2026). Re-check anything marked **VERIFY** before relying on it.

## NISAR basics (verified)

- NISAR (NASA-ISRO SAR) launched July 30, 2025. ASF DAAC is its data hub.
- Products are HDF5 files, identified by a four-letter code:

| Level | Codes | Meaning |
|---|---|---|
| L0 | RRSD | Raw radar signal data |
| L1 | RSLC, RIFG, RUNW, ROFF | Single-look complex (range-Doppler), interferogram, unwrapped interferogram, offsets (radar coordinates) |
| L2 | GSLC, GCOV, GUNW, GOFF | Geocoded counterparts. GCOV = geocoded polarimetric covariance matrix (the usual choice for backscatter change). GUNW = geocoded unwrapped interferogram (deformation) |
| L3 | SME2 | Soil moisture |

- Data maturity levels: **BETA** (pre-calibration, released January and February 2026), **PROVISIONAL** (calibrated, released from June 17, 2026) and **VALIDATED** (released November 6, 2026, acquisitions from October 21, 2026). Maturity appears only in the collection name, never in the granule file. Older dates exist in both BETA and PROVISIONAL: use the higher maturity and never mix maturities in one comparison. Every layer we publish must state its maturity.
- Collection short names: `NISAR_L2_GCOV_BETA_V1`, `NISAR_L2_GCOV_PROVISIONAL_V1`, and `NISAR_L2_GCOV_V1` for VALIDATED (the same pattern for GUNW, GOFF, GSLC, RUNW, RIFG). Urgent Response products appear under `NISAR_UR_L2` / `UR_L2_L_GCOV`.
- Products reported by ASF documentation as L-band for the BETA and PROVISIONAL releases.
- Coordinates are encoded with NetCDF CF conventions, so NetCDF drivers may work better than plain HDF5 drivers in GDAL. Files are cloud-optimized and can be streamed.
- ASF also offers sample datasets and an "Urgent Response" stream for disasters.
- NISAR citation guidance was marked "available soon" on the ASF page. **VERIFY** the citation text for credits.

## Access paths (verified)

| Path | Use |
|---|---|
| NASA Earthdata Login account | Required for downloads |
| ASF Vertex / Earthdata Search | Visual search; download icon per granule |
| `asf_search` (Python) | e.g. `asf.search(dataset='NISAR', processingLevel='GCOV')`; `ASFSession` for auth; `results.download(...)` |
| `earthaccess` (Python) | e.g. `earthaccess.search_data(short_name="NISAR_L2_GCOV_BETA_V1", ...)`; returns HTTPS and S3 links |
| Direct S3 access | Supported with limitations; see the ASF S3 access page. **VERIFY** region and credential requirements |
| Harmony | Download individual layers as stand-alone GeoTIFF subsets, avoiding full-file downloads |
| NISAR track-frame map (NISAR mission site) | Check which tracks/frames cover a place before downloading |

## Links

- ASF NISAR docs: https://nisar-docs.asf.alaska.edu/
- Earthdata Search access guide: https://nisar-docs.asf.alaska.edu/earthdata-search/
- `asf_search` for NISAR: https://nisar-docs.asf.alaska.edu/asf-search
- S3 access: https://nisar-docs.asf.alaska.edu/aws-s3-access/
- ASF Vertex guide: https://nisar-docs-test.asf.alaska.edu/vertex
- ASF OpenSARLab NISAR cookbook (data access walkthrough with `asf_search` and `h5py`): https://asfopensarlab.github.io/NISAR_Cookbook/notebooks/nisar-data-access
- MAAP NISAR access tutorial: https://docs.maap-project.org/en/hub/science/NISAR/NISAR_access.html
- Earthdata NISAR page: https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/nisar
- NISAR sample data: https://nisar.jpl.nasa.gov/data/sample-data

## GCOV structure (verified on a real granule and the product spec, JPL D-102274 Rev F)

- Identification: `/science/LSAR/identification/` with `granuleId`, `productType`, `trackNumber`, `frameNumber`, `orbitPassDirection` (`Ascending`/`Descending`), `zeroDopplerStartTime` (`YYYY-mm-ddTHH:MM:SS.sssssssss`, UTC), `processingType` (`Nominal`/`Urgent`/`Custom`), `boundingPolygon` (WKT, lon/lat).
- Grids: `/science/LSAR/GCOV/grids/frequencyA/` (10 or 20 m) and `frequencyB/` (80 m). Diagonal terms `HHHH`, `HVHV` (dual-pol over Mexico) are float32, linear gamma0 power (RTC applied), fill NaN, 512x512 gzip chunks. `xCoordinates`/`yCoordinates` are pixel centers in meters. `projection` holds the EPSG code in attribute `epsg_code` (UTM; EPSG 3413/3031 beyond 60 degrees). `mask`: 0 invalid, 255 outside acquisition, 1..n valid subswath. Skip terms whose `isReceiveOnlyChannel1/2` is `"True"` (noise only).
- Size: about 6 to 7 GB per granule. One frequencyA term is about 35000 x 35000 pixels (about 4.9 GB in memory); frequencyB is about 4400 x 4400 (about 77 MB).
- Each granule also ships browse PNGs and KML, a QA report PDF, and QA summary CSV.
- Remote reads work: `h5py` over HTTPS (`fsspec`, Earthdata bearer token) reads a 20 x 20 km frequencyA window in about 16 s and a full frequencyB term in about 8 s, without downloading the file.
- `asf_search` token login needs the ASF app EULA approved once per Earthdata account (https://urs.earthdata.nasa.gov/approve_app?client_id=BO_n7nTIlMljdvU6kRRB3g).

## Mexico coverage (searched 2026-11-13)

| Window before latest acquisition (2026-11-13) | Granules | Unique track/pass/frame | Full-granule size |
|---|---|---|---|
| 12 days | 65 (32 VALIDATED, 33 Urgent Response) | 41 | 404 GB |
| 24 days | 177 | 122 | 968 GB |
| 48 days | 509 | 158 | 2777 GB |

About 158 frames (ascending and descending) cover Mexico. Nominal products lag acquisition, so one complete national snapshot needs roughly the last 24 to 48 days. Mexico spans UTM zones 11 to 16.

## Challenge resource list

The challenge says to use "the list of resources provided". It was not in the pasted text. **Paste it here:**

- NASA: Earthdata Search, ASF Vertex, the ASF NISAR Data User Guide, Intro to Remote Sensing, Intro to SAR, NASA ARSET trainings, NISAR StoryMaps, NISAR Applications White Papers, UAVSAR Postcards.
- CSA: RADARSAT Constellation Mission (RCM) data (GeoTIFF + `product.xml`, via EODMS), a SAR Python tutorial, RADARSAT-1 data (open licence; CEOS or GeoTIFF via EODMS, COG on AWS).
- CONAE: SAOCOM catalogue and registration (L-band; one GeoTIFF per polarization plus XML).

## Ancillary data candidates (not decisions)

Verify license and attribution requirements before use.

| Purpose | Candidates |
|---|---|
| Optical context | Sentinel-2, Landsat or HLS imagery for the same AOI and period |
| Land cover / vegetation type | Public land-cover products |
| Population / infrastructure | Public gridded population, OpenStreetMap |
| Terrain | Public DEM |
| Basemap | An open tile source with proper attribution |

## Data handling rules

1. Raw granules and interim rasters are gitignored. Only small samples (under 5 MB each) and synthetic fixtures are committed.
2. Every derived layer records its source granule IDs, product code, polarization, data maturity, and processing parameters (see `docs/04-contracts.md`).
3. Synthetic data is allowed only in `contracts/fixtures/` and must carry `"synthetic": true`.
4. Credentials come from environment variables or `~/.netrc`, never from the repo.

## Dataset inventory (fill in during F01)

| Dataset | Product / short name | Maturity | AOI coverage | Dates | Polarizations | Size | Granule IDs | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## To verify at kickoff

- [x] Resource list from the challenge page pasted above
- [ ] Coverage over each candidate AOI (number of usable acquisitions, same track/frame preferred)
- [ ] Which maturity levels are available for each candidate
- [x] GCOV units and scaling: linear gamma0 power, convert with 10*log10 after averaging in linear units
- [ ] Earthdata credentials work for each person who will download (works for one account so far; approve the ASF app EULA first)
- [ ] Citation text for NISAR data
