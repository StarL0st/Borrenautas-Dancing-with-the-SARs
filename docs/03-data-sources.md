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

- Data maturity levels: **BETA** (pre-calibration, first released February 2026) and **PROVISIONAL** (calibrated). `asf_search` accepts a `dataMaturity` filter (`BETA` or `PROVISIONAL`). Every layer we publish must state its maturity. **VERIFY** whether newer maturity levels exist.
- Collection short names follow the pattern `NISAR_L2_GCOV_BETA_V1`, `NISAR_L2_GCOV_PROVISIONAL_V1` (and the same for GUNW, GOFF, GSLC, RUNW, RIFG).
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

## Challenge resource list

The challenge says to use "the list of resources provided". It was not in the pasted text. **Paste it here:**

```
(paste the challenge page's resource list)
```

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

- [ ] Resource list from the challenge page pasted above
- [ ] Coverage over each candidate AOI (number of usable acquisitions, same track/frame preferred)
- [ ] Which maturity levels are available for each candidate
- [ ] GCOV units and scaling (linear power vs dB) from the product specification before any dB conversion
- [ ] Earthdata credentials work for each person who will download
- [ ] Citation text for NISAR data
