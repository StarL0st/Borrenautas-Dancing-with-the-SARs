"""Live updates: poll the catalog for each site and process only what is new.

A refresh searches ASF again (a few seconds per product). If the picked granules are the same as
last time, nothing else happens. If not, the site is re-run; windows already read are loaded from
data/interim/, so only the new granules are streamed.
"""

import json
import logging
import threading
import time
from pathlib import Path

from . import sites as site_config
from .export import load_manifest
from .selection import granule_ids, select_site

log = logging.getLogger(__name__)


def refresh_site(site_id: str, site: dict, data: Path, force: bool = False, days: int = 180):
    from .site import run_site  # heavy imports only when processing

    path = data / "selected" / f"{site_id}.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    new = select_site(site_id, site, path, days)
    added = granule_ids(new) - granule_ids(old)
    have_area = any(a["id"] == site_id for a in load_manifest(data / "processed")["areas"])
    if not (added or force or not have_area):
        return {"site": site_id, "status": "unchanged", "new_granules": 0}
    result = run_site(site_id, site, data / "processed", data / "interim", new)
    return {"site": site_id, "status": "updated", "new_granules": len(added), **result}


class Jobs:
    """One background worker that processes site refreshes in order, plus an optional timer that
    queues every site every `watch_hours`. Used by the API server (serve --jobs)."""

    def __init__(self, data: Path, watch_hours: float | None = None, refresh=refresh_site):
        self.data = Path(data)
        self.refresh = refresh
        self.status: dict[str, dict] = {}
        self._queue: list[tuple[str, bool]] = []
        self._cv = threading.Condition()
        threading.Thread(target=self._work, daemon=True, name="sars-jobs").start()
        if watch_hours:
            threading.Thread(target=self._watch, args=(watch_hours,), daemon=True).start()

    def sites(self) -> dict:
        return site_config.load_sites(requested=self.data / "sites.json")

    def submit(self, site_id: str, force: bool = False) -> dict:
        with self._cv:
            if not any(s == site_id for s, _ in self._queue):
                self._queue.append((site_id, force))
            self.status[site_id] = {**self.status.get(site_id, {}), "status": "queued"}
            self._cv.notify()
        return self.status[site_id]

    def wait_idle(self, timeout: float = 30) -> bool:
        """For tests: block until the queue is empty and nothing is running."""
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            with self._cv:
                if not self._queue and all(
                    s.get("status") not in ("queued", "running") for s in self.status.values()
                ):
                    return True
            time.sleep(0.05)
        return False

    def _work(self):
        while True:
            with self._cv:
                while not self._queue:
                    self._cv.wait()
                site_id, force = self._queue.pop(0)
                self.status[site_id] = {**self.status.get(site_id, {}), "status": "running"}
            try:
                site = self.sites()[site_id]
                result = self.refresh(site_id, site, self.data, force)
                state = {"status": "done", "result": result, "error": None}
            except Exception as err:  # keep the worker alive for the next site
                log.exception("refresh %s failed", site_id)
                state = {"status": "error", "error": str(err)}
            with self._cv:
                self.status[site_id] = {
                    **state,
                    "finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }

    def _watch(self, hours: float):
        while True:
            for site_id in self.sites():
                self.submit(site_id)
            time.sleep(hours * 3600)
