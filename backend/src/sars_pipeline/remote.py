"""Stream NISAR granules over HTTPS without downloading them (docs/03: about 16 s per window)."""

import os
from contextlib import contextmanager

import h5py


def token() -> str:
    tok = os.environ.get("ASF_EARTH_DATA_TOKEN")
    if not tok:
        raise SystemExit("ASF_EARTH_DATA_TOKEN missing: put it in backend/.env (local) or env")
    return tok


@contextmanager
def open_remote(url: str):
    """Yield an h5py.File reading the granule at `url` lazily; only touched chunks are fetched."""
    import fsspec

    fs = fsspec.filesystem(
        "https", client_kwargs={"headers": {"Authorization": f"Bearer {token()}"}}
    )
    with fs.open(url, block_size=4 * 2**20, cache_type="blockcache") as fh, h5py.File(fh, "r") as f:
        yield f
