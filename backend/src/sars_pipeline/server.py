"""HTTP server: serves contract files from the data dir and pushes update events over SSE."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .export import ingest, ingested_ids
from .granule import open_granule

log = logging.getLogger(__name__)


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


def create_app(data_dir, inbox=None, poll_seconds: float = 5.0) -> FastAPI:
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
