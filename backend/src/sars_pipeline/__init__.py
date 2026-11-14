"""NISAR backend: turn GCOV, GUNW and SME2 granules into layers and categorized events, and serve
them to the frontend."""

import argparse
import json
import logging
import os
import time
from pathlib import Path

# Editable install: src/sars_pipeline -> backend -> repo root.
BACKEND = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("SARS_DATA_ROOT", BACKEND.parent / "data"))


def _describe(sel: dict) -> str:
    parts = []
    for product, p in sel["products"].items():
        where = f" t{p['track']} f{p['frame']} {p['direction'].lower()}" if "track" in p else ""
        parts.append(f"{product}: {len(p['granules'])} {p['maturity']}{where}")
    return "; ".join(parts) or "nothing found"


def main() -> None:
    parser = argparse.ArgumentParser(prog="sars-pipeline")
    parser.add_argument(
        "--data-dir", type=Path, default=DATA / "processed", help="contract file output"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    ingest_p = sub.add_parser("ingest", help="parse local GCOV granules into contract files")
    ingest_p.add_argument("files", nargs="+", type=Path)

    serve_p = sub.add_parser("serve", help="serve contract files and /query, push updates")
    serve_p.add_argument("--inbox", type=Path, default=DATA / "inbox")
    serve_p.add_argument("--host", default="127.0.0.1")
    serve_p.add_argument("--port", type=int, default=8765)
    serve_p.add_argument("--poll", type=float, default=5.0, help="seconds between change checks")
    serve_p.add_argument("--no-inbox", action="store_true", help="serve only (cloud)")
    serve_p.add_argument("--jobs", action="store_true", help="enable /sites: on-demand processing")
    serve_p.add_argument(
        "--watch-hours", type=float, help="with --jobs: re-check every site this often"
    )

    synth_p = sub.add_parser("synthetic", help="write synthetic GCOV-shaped granules (for testing)")
    synth_p.add_argument("--out", type=Path, default=DATA / "inbox")
    synth_p.add_argument("--dates", type=int, default=3)

    select_p = sub.add_parser("select", help="pick granules for a site (asf_search)")
    select_p.add_argument("site")
    select_p.add_argument("--days", type=int, default=180, help="search window, days back")

    add_p = sub.add_parser("add-site", help="add a site to backend/sites.json")
    add_p.add_argument("site", help="short id, e.g. cdmx")
    where = add_p.add_mutually_exclusive_group(required=True)
    where.add_argument("--bbox", help="west,south,east,north in degrees")
    where.add_argument("--center", help="lon,lat in degrees (box of --km around it)")
    add_p.add_argument("--km", type=float, default=20, help="box size with --center")
    add_p.add_argument("--title", required=True)
    add_p.add_argument("--summary", default="", help="one or two plain-language sentences")
    add_p.add_argument("--types", default="other", help="comma-separated C1 change_types")
    add_p.add_argument("--products", default="GCOV,GUNW,SME2", help="comma-separated products")
    add_p.add_argument("--reference", help="GUNW stable reference area: west,south,east,north")
    add_p.add_argument("--looks", type=int, default=4, help="pixels averaged per side (10 m each)")
    add_p.add_argument("--force", action="store_true", help="replace an existing site")

    run_p = sub.add_parser("run", help="select (if needed) and process sites")
    run_p.add_argument("sites", nargs="*", help="site ids (default: all)")
    run_p.add_argument("--reselect", action="store_true", help="search again even if selected")
    run_p.add_argument("--days", type=int, default=180)

    refresh_p = sub.add_parser("refresh", help="search again; process only sites with new data")
    refresh_p.add_argument("sites", nargs="*", help="site ids (default: all)")
    refresh_p.add_argument("--force", action="store_true", help="process even if nothing is new")
    refresh_p.add_argument("--days", type=int, default=180)

    watch_p = sub.add_parser("watch", help="refresh every site in a loop")
    watch_p.add_argument("--hours", type=float, default=6)

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("fsspec").setLevel(logging.WARNING)  # logs every block fetched

    from dotenv import load_dotenv

    load_dotenv(BACKEND / ".env")  # local secrets; in the cloud the env is set directly

    from .sites import add_site, bbox_around, load_sites

    if args.cmd == "add-site":
        if args.bbox:
            bbox = [float(v) for v in args.bbox.split(",")]
        else:
            lon, lat = (float(v) for v in args.center.split(","))
            bbox = bbox_around(lon, lat, args.km)
        site = {
            "title": args.title,
            "summary": args.summary or f"Radar view of {args.title} and what changed recently.",
            "bbox": bbox,
            "change_types": [t.strip() for t in args.types.split(",")],
            "products": [p.strip().upper() for p in args.products.split(",")],
            "looks": args.looks,
        }
        if args.reference:
            site["reference_bbox"] = [float(v) for v in args.reference.split(",")]
        try:
            add_site(args.site, site, force=args.force)
        except ValueError as err:
            parser.error(str(err))
        print(f"added {args.site}: bbox {bbox}. Next: uv run sars-pipeline run {args.site}")
    elif args.cmd in ("select", "run"):
        from .selection import select_site
        from .site import run_site

        sites = load_sites()
        for site_id in [args.site] if args.cmd == "select" else args.sites or list(sites):
            path = DATA / "selected" / f"{site_id}.json"
            sel = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            if args.cmd == "select" or args.reselect or "products" not in sel:
                sel = select_site(site_id, sites[site_id], path, args.days)
                print(f"{site_id}: {_describe(sel)} -> {path}")
            if args.cmd == "run":
                print(
                    site_id, run_site(site_id, sites[site_id], args.data_dir, DATA / "interim", sel)
                )
    elif args.cmd in ("refresh", "watch"):
        from .live import refresh_site

        while True:
            sites = load_sites()
            for site_id in getattr(args, "sites", None) or list(sites):
                force = getattr(args, "force", False)
                days = getattr(args, "days", 180)
                print(refresh_site(site_id, sites[site_id], DATA, force, days))
            if args.cmd == "refresh":
                break
            time.sleep(args.hours * 3600)
    elif args.cmd == "ingest":
        from .export import ingest

        for f in args.files:
            print(f"{f.name}: {', '.join(ingest(f, args.data_dir))}")
    elif args.cmd == "serve":
        import uvicorn

        from .server import create_app

        inbox = None if args.no_inbox else args.inbox
        if inbox:
            inbox.mkdir(parents=True, exist_ok=True)
        jobs = None
        if args.jobs:
            from .live import Jobs

            jobs = Jobs(DATA, args.watch_hours)
        token = os.environ.get("SARS_ADMIN_TOKEN")
        app = create_app(args.data_dir, inbox, args.poll, jobs=jobs, admin_token=token)
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        from .synthetic import write_synthetic

        for i in range(args.dates):
            date = f"2026-01-{1 + 12 * i:02d}"
            print(write_synthetic(args.out / f"SYNTHETIC_{date}.h5", date, growth=0.5 * i))
