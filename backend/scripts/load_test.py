"""Small load test for a running API: open push streams plus a steady rate of requests.

    uv run python backend/scripts/load_test.py https://api.example.org --streams 300 --rps 50

Prints how many streams opened, how many were refused (503 over the cap is the designed answer),
and the error count and slowest times of the requests. Needs httpx (a dev dependency).
"""

import argparse
import asyncio
import random
import statistics
import time

import httpx

# Points with data: Chapala, Hopelchén, Villahermosa, Mexico City (country map only), and open sea (no area).
POINTS = [(20.3, -103.2), (19.75, -89.85), (17.99, -92.93), (19.43, -99.13), (15.0, -110.0)]


async def stream(client: httpx.AsyncClient, base: str, seconds: float, opened: list, refused: list):
    try:
        async with client.stream("GET", f"{base}/events", timeout=None) as r:
            if r.status_code != 200:
                refused.append(r.status_code)
                return
            opened.append(1)
            await asyncio.sleep(seconds)
    except httpx.HTTPError as err:
        refused.append(type(err).__name__)


async def request(client: httpx.AsyncClient, base: str, times: list, errors: list):
    lat, lon = random.choice(POINTS)
    path = random.choice(["query", "history", "health"])
    start = time.perf_counter()
    try:
        r = await client.get(f"{base}/{path}", params={"lat": lat, "lon": lon}, timeout=20)
        (times if r.status_code == 200 else errors).append(time.perf_counter() - start)
    except httpx.HTTPError:
        errors.append(time.perf_counter() - start)


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("base")
    p.add_argument("--streams", type=int, default=300)
    p.add_argument("--rps", type=int, default=50)
    p.add_argument("--seconds", type=int, default=30)
    a = p.parse_args()
    base = a.base.rstrip("/")
    opened, refused, times, errors = [], [], [], []
    limits = httpx.Limits(max_connections=None, max_keepalive_connections=100)
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            asyncio.create_task(stream(client, base, a.seconds + 2, opened, refused))
            for _ in range(a.streams)
        ]
        for _ in range(a.seconds):
            tasks += [
                asyncio.create_task(request(client, base, times, errors)) for _ in range(a.rps)
            ]
            await asyncio.sleep(1)
        await asyncio.gather(*tasks)
    print(f"streams: {len(opened)} opened, {len(refused)} refused {sorted(set(map(str, refused)))}")
    print(f"requests: {len(times)} ok, {len(errors)} failed")
    if times:
        times.sort()
        print(
            f"time: median {statistics.median(times) * 1000:.0f} ms, "
            f"95% {times[int(len(times) * 0.95)] * 1000:.0f} ms, max {times[-1] * 1000:.0f} ms"
        )


if __name__ == "__main__":
    asyncio.run(main())
