"""HTTP server: serves contract files from the data dir and pushes update events over SSE."""

import asyncio
import json
import logging
import math
import mimetypes
import shutil
import time
from contextlib import asynccontextmanager
from itertools import pairwise
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import history
from .export import CONTRACT_VERSION, ingest, ingested_ids, load_events, load_manifest
from .granule import open_granule
from .sites import add_site, bbox_around

log = logging.getLogger(__name__)
mimetypes.add_type("application/geo+json", ".geojson")  # events.geojson, live.geojson

# Public lookups (serve --public). Points snap to a grid so nearby lookups share one cached cell.
CELL_DEG = 0.2  # about 22 km
CELL_KM = 22
CELL_MAX_DATES = {"GCOV": 4, "GUNW": 4, "SME2": 6}  # few dates: a visitor is waiting
RECHECK_HOURS = 12
MAX_QUEUED = 20
MAX_CELLS = 300
MAX_NEW_PER_HOUR = 5  # per client address
MIN_FREE_GB = 5  # below this no new place is accepted: cached windows fill the disk
MAX_STREAMS = 500  # open /events connections; each one holds a socket and a queue
HISTORY_KM = 5  # /history keeps events within this box around the point

_cache: dict[Path, tuple[int, dict]] = {}


def _cached(path: Path, load) -> dict:
    """A parsed JSON file, read again only when it changed (events.json is several MB and
    /query and /history would otherwise parse it on every request). Callers must not modify it."""
    mtime = path.stat().st_mtime_ns if path.exists() else 0
    if _cache.get(path, (None,))[0] != mtime:
        _cache[path] = (mtime, load(path.parent))
    return _cache[path][1]


class SiteRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    # The fields below need the admin token when the server is public.
    km: float | None = Field(None, gt=1, le=30)  # on-demand sites stay small: they stream
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
        for e in _cached(Path(data_dir) / "events.json", load_events)["events"]
        if _overlaps(e["bbox"], box)
        and (point is None or contains(e["geometry"], *point))
        and (type_ is None or e["type"] == type_)
        and (category is None or category in e.get("categories", []))
        and (from_ is None or e["date_range"][1] >= from_)
        and (to is None or e["date_range"][0] <= to)
    ]
    manifest = _cached(Path(data_dir) / "manifest.json", load_manifest)
    areas = [a["id"] for a in manifest["areas"] if _overlaps(a["bbox"], box)]
    return {"contract_version": CONTRACT_VERSION, "events": events, "area_ids": areas}


def history_at(data_dir: Path, lon: float, lat: float, from_=None, to=None, category=None) -> dict:
    """C10 /history: per area at the point, what happened near it, in time order."""
    near = bbox_around(lon, lat, HISTORY_KM)
    found = query(data_dir, bbox=near, from_=from_, to=to, category=category)["events"]
    manifest = _cached(Path(data_dir) / "manifest.json", load_manifest)
    return {
        "contract_version": CONTRACT_VERSION,
        "point": [lon, lat],
        "histories": [
            history.build(a, [e for e in found if e["area_id"] == a["id"]], data_dir, from_, to)
            for a in manifest["areas"]
            if _overlaps(a["bbox"], [lon, lat, lon, lat])
        ],
    }


def create_app(
    data_dir,
    inbox=None,
    poll_seconds: float = 5.0,
    jobs=None,
    admin_token: str | None = None,
    public: bool = False,
) -> FastAPI:
    """`jobs` (live.Jobs) enables /sites; without it the server is read-only. With `admin_token`
    set, POST requests need `Authorization: Bearer <token>` (they start downloads). `public`
    lets anyone POST /sites {lat, lon} without a token, within limits (see lookup)."""
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    clients: set[asyncio.Queue] = set()
    recent: dict[str, list[float]] = {}  # client address -> times of its new cells

    async def watch():
        manifest, last, failed = data_dir / "manifest.json", None, {}
        live_file, live_last = data_dir / "live.geojson", None
        while True:
            if inbox:
                await asyncio.to_thread(scan_inbox, inbox, data_dir, failed)
            # Any writer (inbox, CLI ingest) changes manifest.json; that is the push trigger.
            mtime = manifest.stat().st_mtime_ns if manifest.exists() else None
            if mtime != last:
                last = mtime
                for q in clients:
                    q.put_nowait({"type": "manifest", "url": "manifest.json"})
            # Live disaster feeds (livefeeds.py) have their own push event.
            live_mtime = live_file.stat().st_mtime_ns if live_file.exists() else None
            if live_mtime != live_last:
                live_last = live_mtime
                for q in clients:
                    q.put_nowait({"type": "live", "url": "live.geojson"})
            await asyncio.sleep(poll_seconds)

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(watch())
        yield
        task.cancel()

    app = FastAPI(title="sars-pipeline", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type"],
    )

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

    def processed(site_id: str) -> bool:
        return any(a["id"] == site_id for a in load_manifest(data_dir)["areas"])

    def lookup(req: SiteRequest, request: Request, response: Response) -> dict:
        """A visitor's lookup: the curated site at the point, or the grid cell around it.
        Cached cells answer 200 at once; new or stale ones are queued first in line (202)."""
        sites = jobs.sites()
        site_id = next(
            (
                k
                for k, s in sites.items()
                if not s.get("requested")
                and s.get("kind") != "mosaic"
                and _overlaps(s["bbox"], [req.lon, req.lat, req.lon, req.lat])
            ),
            None,
        )
        if site_id is None:
            lat = (math.floor(req.lat / CELL_DEG) + 0.5) * CELL_DEG
            lon = (math.floor(req.lon / CELL_DEG) + 0.5) * CELL_DEG
            ns, ew = "ns"[lat < 0], "ew"[lon < 0]
            site_id = f"cell-{abs(lat):.1f}{ns}-{abs(lon):.1f}{ew}".replace(".", "_")
        state = jobs.state(site_id)
        if state["status"] in ("queued", "running"):
            response.status_code = 202
            return {"id": site_id, **state}
        age = jobs.checked_hours_ago(site_id)
        if site_id in sites and age is not None and age < RECHECK_HOURS:
            if not processed(site_id):
                state["empty"] = True
                state["message"] = state.get("error") or "No NISAR data for this place yet."
            response.status_code = 200
            return {"id": site_id, **state, "status": "done"}
        if jobs.queued() >= MAX_QUEUED:
            raise HTTPException(429, "the processing queue is full; try again in a few minutes")
        if shutil.disk_usage(data_dir).free < MIN_FREE_GB * 1e9:
            raise HTTPException(429, "this server is out of space for new places")
        if site_id not in sites:
            if sum(bool(s.get("requested")) for s in sites.values()) >= MAX_CELLS:
                raise HTTPException(429, "this server holds its maximum number of places")
            # Behind the reverse proxy the last X-Forwarded-For entry is the one it added.
            forwarded = request.headers.get("x-forwarded-for", "")
            who = forwarded.split(",")[-1].strip() or (request.client and request.client.host)
            now = time.monotonic()
            mine = recent[who] = [t for t in recent.get(who, []) if now - t < 3600]
            if len(mine) >= MAX_NEW_PER_HOUR:
                raise HTTPException(429, "too many new places from this address; try in an hour")
            site = {
                "title": f"Around {lat:.1f}, {lon:.1f}",
                "summary": "A place looked up from the app, processed on demand.",
                "bbox": bbox_around(lon, lat, CELL_KM),
                "change_types": ["other"],
                "looks": 4,
                "max_dates": CELL_MAX_DATES,
            }
            try:
                add_site(site_id, site, path=jobs.data / "sites.json", max_sq_deg=0.1)
            except ValueError as err:
                raise HTTPException(400, str(err)) from err
            mine.append(now)
        response.status_code = 202
        return {"id": site_id, **jobs.submit(site_id, front=True)}

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
                    **jobs.state(site_id),
                }
                for site_id, site in jobs.sites().items()
            ]
        }

    @app.get("/sites/{site_id}")
    def site_status(site_id: str):
        if jobs is None or site_id not in jobs.sites():
            raise HTTPException(404, f"unknown site {site_id}")
        return {"id": site_id, "processed": processed(site_id), **jobs.state(site_id)}

    @app.post("/sites", status_code=202)
    def request_site(
        req: SiteRequest,
        request: Request,
        response: Response,
        authorization: str | None = Header(None),
    ):
        """Ask for a new site around a point; it is processed in the background. The manifest
        event (/events) fires when its data is ready."""
        is_admin = admin_token and authorization == f"Bearer {admin_token}"
        if public and jobs is not None and not is_admin:
            if req.km or req.title or req.id:
                raise HTTPException(401, "km, title and id need the admin token")
            return lookup(req, request, response)
        require_jobs(authorization)
        # URL-safe id from the point, e.g. at-17_990n-92_930w
        ns, ew = "ns"[req.lat < 0], "ew"[req.lon < 0]
        site_id = req.id or f"at-{abs(req.lat):.3f}{ns}-{abs(req.lon):.3f}{ew}".replace(".", "_")
        if site_id in jobs.sites():
            return {"id": site_id, **jobs.submit(site_id)}
        site = {
            "title": req.title or f"Requested place ({req.lat:.3f}, {req.lon:.3f})",
            "summary": "A place requested from the app, processed on demand.",
            "bbox": bbox_around(req.lon, req.lat, req.km or 20),
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

    @app.get("/history")
    def history_endpoint(
        lat: float = Query(ge=-90, le=90),
        lon: float = Query(ge=-180, le=180),
        category: str | None = None,
        from_: str | None = Query(None, alias="from"),
        to: str | None = None,
    ):
        return history_at(data_dir, lon, lat, from_, to, category)

    @app.get("/events")
    async def events():
        if len(clients) >= MAX_STREAMS:
            # The frontend works without the stream (it reloads on a timer).
            raise HTTPException(503, "too many open event streams")
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
