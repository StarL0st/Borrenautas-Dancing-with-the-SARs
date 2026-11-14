"""HTTP server: serves contract files from the data dir and pushes update events over SSE."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from itertools import pairwise
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .export import CONTRACT_VERSION, ingest, ingested_ids, load_events, load_manifest
from .granule import open_granule
from .sites import add_site, bbox_around

log = logging.getLogger(__name__)


class SiteRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    km: float = Field(20, gt=1, le=30)  # on-demand sites stay small: they stream on request
    title: str | None = Field(None, max_length=80)
    id: str | None = Field(None, pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")


def scan_inbox(inbox: Path, data_dir: Path, failed: dict) -> list[str]:
    """Ingest every new granule in the inbox. Files that fail are retried only once they change."""
    done, added = ingested_ids(data_dir), []
    for path in sorted(Path(inbox).glob("*.h5")):
        stat = path.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        if failed.get(path.name) == key:
            continue
        try:
            if open_granule(path).granule_id not in done:
                added += ingest(path, data_dir)
                log.info("ingested %s", path.name)
        except Exception:  # a half-copied or foreign file must not stop the watcher
            log.exception("could not ingest %s", path.name)
            failed[path.name] = key
    return added


def _in_ring(lon: float, lat: float, ring) -> bool:
    """Ray casting: does a horizontal ray from the point cross the ring an odd number of times?"""
    inside = False
    for (x0, y0), (x1, y1) in pairwise(ring):
        if (y0 > lat) != (y1 > lat) and lon < x0 + (lat - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


def contains(geometry: dict, lon: float, lat: float) -> bool:
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    # Outer ring in, every hole out.
    return any(
        _in_ring(lon, lat, p[0]) and not any(_in_ring(lon, lat, h) for h in p[1:]) for p in polygons
    )


def _overlaps(a, b) -> bool:
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def query(
    data_dir: Path, point=None, bbox=None, type_=None, from_=None, to=None, category=None
) -> dict:
    """C6 /query: events and areas at a point or in a box, optionally filtered."""
    box = bbox or [point[0], point[1], point[0], point[1]]
    events = [
        e
        for e in load_events(data_dir)["events"]
        if _overlaps(e["bbox"], box)
        and (point is None or contains(e["geometry"], *point))
        and (type_ is None or e["type"] == type_)
        and (category is None or category in e.get("categories", []))
        and (from_ is None or e["date_range"][1] >= from_)
        and (to is None or e["date_range"][0] <= to)
    ]
    areas = [a["id"] for a in load_manifest(data_dir)["areas"] if _overlaps(a["bbox"], box)]
    return {"contract_version": CONTRACT_VERSION, "events": events, "area_ids": areas}


def create_app(
    data_dir, inbox=None, poll_seconds: float = 5.0, jobs=None, admin_token: str | None = None
) -> FastAPI:
    """`jobs` (live.Jobs) enables /sites; without it the server is read-only. With `admin_token`
    set, POST requests need `Authorization: Bearer <token>` (they start downloads)."""
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    clients: set[asyncio.Queue] = set()

    async def watch():
        manifest, last, failed = data_dir / "manifest.json", None, {}
        while True:
            if inbox:
                await asyncio.to_thread(scan_inbox, inbox, data_dir, failed)
            # Any writer (inbox, CLI ingest) changes manifest.json; that is the push trigger.
            mtime = manifest.stat().st_mtime_ns if manifest.exists() else None
            if mtime != last:
                last = mtime
                for q in clients:
                    q.put_nowait({"type": "manifest", "url": "manifest.json"})
            await asyncio.sleep(poll_seconds)

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(watch())
        yield
        task.cancel()

    app = FastAPI(title="sars-pipeline", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

    @app.middleware("http")
    async def revalidate(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("Cache-Control", "no-cache")  # data changes under the same URLs
        return response

    @app.get("/health")
    def health():
        return {"ok": True}

    def require_jobs(authorization: str | None):
        if jobs is None:
            raise HTTPException(404, "site processing is off (serve --jobs)")
        if admin_token and authorization != f"Bearer {admin_token}":
            raise HTTPException(401, "missing or wrong token")

    @app.get("/sites")
    def list_sites():
        if jobs is None:
            raise HTTPException(404, "site processing is off (serve --jobs)")
        return {
            "sites": [
                {
                    "id": site_id,
                    "title": site["title"],
                    "bbox": site["bbox"],
                    "requested": site.get("requested", False),
                    **jobs.status.get(site_id, {"status": "idle"}),
                }
                for site_id, site in jobs.sites().items()
            ]
        }

    @app.post("/sites", status_code=202)
    def request_site(req: SiteRequest, authorization: str | None = Header(None)):
        """Ask for a new site around a point; it is processed in the background. The manifest
        event (/events) fires when its data is ready."""
        require_jobs(authorization)
        site_id = req.id or f"p{req.lat:+.3f}{req.lon:+.3f}".replace(".", "_")
        if site_id in jobs.sites():
            return {"id": site_id, **jobs.submit(site_id)}
        site = {
            "title": req.title or f"Requested place ({req.lat:.3f}, {req.lon:.3f})",
            "summary": "A place requested from the app, processed on demand.",
            "bbox": bbox_around(req.lon, req.lat, req.km),
            "change_types": ["other"],
            "looks": 4,
        }
        try:
            add_site(site_id, site, path=jobs.data / "sites.json", max_sq_deg=0.1)
        except ValueError as err:
            raise HTTPException(400, str(err)) from err
        return {"id": site_id, **jobs.submit(site_id)}

    @app.post("/sites/{site_id}/refresh", status_code=202)
    def refresh(site_id: str, force: bool = False, authorization: str | None = Header(None)):
        require_jobs(authorization)
        if site_id not in jobs.sites():
            raise HTTPException(404, f"unknown site {site_id}")
        return {"id": site_id, **jobs.submit(site_id, force)}

    @app.get("/query")
    def query_endpoint(
        lat: float | None = None,
        lon: float | None = None,
        bbox: str | None = None,
        type: str | None = None,
        category: str | None = None,
        from_: str | None = Query(None, alias="from"),
        to: str | None = None,
    ):
        if bbox is not None:
            try:
                box = [float(v) for v in bbox.split(",")]
            except ValueError:
                box = []
            if len(box) != 4:
                raise HTTPException(400, "bbox must be w,s,e,n")
            return query(data_dir, bbox=box, type_=type, from_=from_, to=to, category=category)
        if lat is None or lon is None:
            raise HTTPException(400, "give lat and lon, or bbox")
        return query(data_dir, point=[lon, lat], type_=type, from_=from_, to=to, category=category)

    @app.get("/events")
    async def events():
        q: asyncio.Queue = asyncio.Queue()
        clients.add(q)

        async def stream():
            try:
                yield "retry: 3000\n\n"
                while True:
                    try:
                        event = await asyncio.wait_for(q.get(), 15)
                    except TimeoutError:
                        yield ": ping\n\n"  # keeps proxies from closing an idle stream
                        continue
                    yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
            finally:
                clients.discard(q)

        return StreamingResponse(stream(), media_type="text/event-stream")

    app.mount("/", StaticFiles(directory=data_dir), name="data")
    return app
