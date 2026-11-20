"""A small sliding-window rate limiter for public endpoints.

In-process: limits apply per API process, which is enough to blunt form spam and
credential stuffing on a single instance. Put a shared limiter (Redis, the edge proxy)
in front when running several API replicas.
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from obligraph.settings import get_settings


class SlidingWindow:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        q = self._hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


def client_ip(request: Request) -> str:
    """The original client address. The web app's proxy forwards X-Forwarded-For; its
    first entry is the browser (spoofable, so only ever used for rate limiting)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    return first or (request.client.host if request.client else "unknown")


def ip_hash(ip: str) -> str:
    return hashlib.sha256(f"{get_settings().jwt_secret}:{ip}".encode()).hexdigest()


def enforce(limiter: SlidingWindow, key: str) -> None:
    if not limiter.allow(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too many requests, try later",
            headers={"Retry-After": str(int(limiter.window))},
        )


DEMO_PER_IP = SlidingWindow(limit=5, window_seconds=3600)
DEMO_GLOBAL = SlidingWindow(limit=200, window_seconds=3600)
LOGIN_PER_IP = SlidingWindow(limit=20, window_seconds=300)
