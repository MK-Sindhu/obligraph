"""Runtime information and job control, for serverless hosts without a background worker.

- ``GET /api/meta/runtime``: upload limit, mode and whether the demo login exists, so the UI
  can adapt.
- ``GET /api/jobs/status`` / ``POST /api/jobs/drain``: lets a signed-in browser advance
  queued work (assessments, extraction) in short, time-boxed steps.
- ``GET /api/internal/cron``: the scheduled entry point (Vercel Cron sends
  ``Authorization: Bearer $CRON_SECRET``): housekeeping, feed crawls, queued jobs.
"""

from __future__ import annotations

import asyncio
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select

from obligraph import jobs, ratelimit
from obligraph.api.deps import Caller, SessionDep, caller
from obligraph.db import session_scope
from obligraph.models import Source, User
from obligraph.seed import DEMO_EMAIL
from obligraph.settings import get_settings

log = logging.getLogger(__name__)
router = APIRouter(tags=["ops"])

DRAIN_PER_USER = ratelimit.SlidingWindow(limit=12, window_seconds=60)
_drain_lock = asyncio.Lock()


@router.get("/meta/runtime")
async def runtime(session=SessionDep) -> dict:
    s = get_settings()
    # The login page offers the demo credentials only when they would work.
    demo = (await session.execute(select(User.id).where(User.email == DEMO_EMAIL))).first()
    return {
        "serverless": s.is_serverless,
        "upload_limit_mb": s.upload_limit_bytes // (1024 * 1024),
        "ai_mode": "claude" if s.claude_enabled else "offline",
        "demo": demo is not None,
    }


@router.get("/jobs/status")
async def job_status(_c: Caller = Depends(caller)) -> dict:
    return {"pending": await jobs.pending_count(), "serverless": get_settings().is_serverless}


@router.post("/jobs/drain")
async def drain(c: Caller = Depends(caller)) -> dict:
    ratelimit.enforce(DRAIN_PER_USER, str(c.user.id))
    if _drain_lock.locked():
        return {"processed": 0, "pending": await jobs.pending_count(), "busy": True}
    async with _drain_lock:
        processed = await jobs.drain(budget_seconds=get_settings().job_inline_budget_seconds)
    return {"processed": processed, "pending": await jobs.pending_count(), "busy": False}


@router.get("/internal/cron")
async def cron(authorization: str | None = Header(default=None)) -> dict:
    secret = get_settings().cron_secret
    if (
        not secret
        or not authorization
        or not hmac.compare_digest(authorization, f"Bearer {secret}")
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unauthorized")
    async with session_scope() as session:
        await jobs.enqueue(session, "housekeeping", {}, dedupe_key="housekeeping")
        for src in (await session.execute(select(Source).where(Source.enabled))).scalars():
            await jobs.enqueue(
                session, "crawl_source", {"key": src.key}, dedupe_key=f"crawl:{src.key}"
            )
    # Leave headroom under the platform's 300 s limit.
    processed = await jobs.drain(budget_seconds=240)
    pending = await jobs.pending_count()
    log.info("cron: processed %s job(s), %s pending", processed, pending)
    return {"processed": processed, "pending": pending}
