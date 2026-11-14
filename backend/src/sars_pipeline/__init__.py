"""NISAR backend: ingest GCOV granules into contract files and serve them to the frontend."""

import argparse
import json
import logging
import os
from pathlib import Path

# Editable install: src/sars_pipeline -> backend -> repo root.
BACKEND = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("SARS_DATA_ROOT", BACKEND.parent / "data"))


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

    select_p = sub.add_parser("select", help="pick granules for a site (asf_search)")
    select_p.add_argument("site")
    select_p.add_argument("--days", type=int, default=120, help="search window, days back")

    run_p = sub.add_parser("run", help="select (if needed), stream, detect change, export a site")
    run_p.add_argument("sites", nargs="*", help="site ids from backend/sites.json (default: all)")
    run_p.add_argument("--reselect", action="store_true", help="search again even if selected")
    run_p.add_argument("--days", type=int, default=120)

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("fsspec").setLevel(logging.WARNING)  # logs every block fetched

    from dotenv import load_dotenv

    load_dotenv(BACKEND / ".env")  # local secrets; in the cloud the env is set directly

    if args.cmd in ("select", "run"):
        from .selection import select_site
        from .site import load_sites, run_site

        sites = load_sites()
        for site_id in [args.site] if args.cmd == "select" else args.sites or list(sites):
            path = DATA / "selected" / f"{site_id}.json"
            if args.cmd == "select" or args.reselect or not path.exists():
                sel = select_site(site_id, sites[site_id], path, args.days)
                print(
                    f"{site_id}: {len(sel['granules'])} granules, {sel['maturity']}, "
                    f"t{sel['track']} f{sel['frame']} {sel['direction'].lower()} -> {path}"
                )
            if args.cmd == "run":
                sel = json.loads(path.read_text(encoding="utf-8"))
                print(
                    site_id, run_site(site_id, sites[site_id], args.data_dir, DATA / "interim", sel)
                )
    elif args.cmd == "ingest":
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
