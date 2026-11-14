import os
from pathlib import Path

import asf_search as asf
from dotenv import load_dotenv

# Anchor paths to this file, not the current directory: src/sars_pipeline -> backend -> repo root.
BACKEND = Path(__file__).resolve().parents[2]
RAW = BACKEND.parent / "data" / "raw" / "NISAR"  # data/raw/ is gitignored

load_dotenv(BACKEND / ".env")
token = os.getenv("ASF_EARTH_DATA_TOKEN")
if not token:
    raise SystemExit(f"ASF_EARTH_DATA_TOKEN missing: add it to {BACKEND / '.env'}")

RAW.mkdir(parents=True, exist_ok=True)

r = asf.search(dataset="NISAR", processingLevel="GCOV", intersectsWith="POINT(-122.4 37.8)", maxResults=5)
r.download(path=str(RAW), session=asf.ASFSession().auth_with_token(token))
