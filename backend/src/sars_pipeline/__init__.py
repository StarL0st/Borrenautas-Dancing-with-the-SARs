"""NISAR backend: ingest GCOV granules into contract files and serve them to the frontend."""

import argparse
import logging
import os
from pathlib import Path

# Editable install: src/sars_pipeline -> pipeline -> repo root.
DATA = Path(os.environ.get("SARS_DATA_ROOT", Path(__file__).resolve().parents[3] / "data"))


def main() -> None:
    parser = argparse.ArgumentParser(prog="sars-pipeline")
    parser.add_argument(
        "--data-dir", type=Path, default=DATA / "processed", help="contract file output"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    ingest_p = sub.add_parser("ingest", help="parse GCOV granules into contract files")
    ingest_p.add_argument("files", nargs="+", type=Path)

    serve_p = sub.add_parser("serve", help="serve contract files, ingest the inbox, push updates")
    serve_p.add_argument("--inbox", type=Path, default=DATA / "inbox")
    serve_p.add_argument("--host", default="127.0.0.1")
    serve_p.add_argument("--port", type=int, default=8765)
    serve_p.add_argument("--poll", type=float, default=5.0, help="seconds between inbox scans")

    synth_p = sub.add_parser("synthetic", help="write synthetic GCOV-shaped granules (for testing)")
    synth_p.add_argument("--out", type=Path, default=DATA / "inbox")
    synth_p.add_argument("--dates", type=int, default=3)

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.cmd == "ingest":
        from .export import ingest

        for f in args.files:
            print(f"{f.name}: {', '.join(ingest(f, args.data_dir))}")
    elif args.cmd == "serve":
        import uvicorn

        from .server import create_app

        args.inbox.mkdir(parents=True, exist_ok=True)
        app = create_app(args.data_dir, args.inbox, args.poll)
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        from .synthetic import write_synthetic

        for i in range(args.dates):
            date = f"2026-01-{1 + 12 * i:02d}"
            print(write_synthetic(args.out / f"SYNTHETIC_{date}.h5", date, growth=0.5 * i))
