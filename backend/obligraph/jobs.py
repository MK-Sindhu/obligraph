"""A small durable job queue in Postgres.

Producers call ``enqueue`` inside their own transaction, so a job exists if and only if
the data it refers to was committed. Workers claim one job at a time with
``FOR UPDATE SKIP LOCKED``, so any number of workers can run side by side.
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import traceback
import uuid
from collections.abc import Awaitable, Callable
from datetime import timedelta

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.db import session_scope
from obligraph.models import Job, Source
from obligraph.settings import get_settings

log = logging.getLogger(__name__)

HOUSEKEEPING_SECONDS = 15 * 60
Handler = Callable[[AsyncSession, dict], Awaitable[None]]
HANDLERS: dict[str, Handler] = {}
_HANDLER_MODULES = (
    "obligraph.ingest.pipeline",
    "obligraph.compliance.assess",
    "obligraph.ingest.sources",
    "obligraph.compliance.housekeeping",
)


def handler(kind: str):
    def register(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn

    return register


def load_handlers() -> None:
    for name in _HANDLER_MODULES:
        importlib.import_module(name)


async def _init_runtime() -> None:
    from obligraph.compliance import approvals

    await approvals.init()


async def enqueue(
    session: AsyncSession,
    kind: str,
    payload: dict,
    *,
    dedupe_key: str | None = None,
    delay_seconds: float = 0,
    max_attempts: int = 3,
) -> None:
    stmt = insert(Job).values(
        id=uuid.uuid4(),
        kind=kind,
        payload=payload,
        dedupe_key=dedupe_key,
        max_attempts=max_attempts,
        # The database clock, not ours: workers compare against now() in SQL.
        run_after=func.now() + timedelta(seconds=delay_seconds),
    )
    # Serverless hosts have no background worker: the request that enqueued work runs it
    # (time-boxed) after committing. See api.deps.get_session.
    session.info["enqueued"] = True
    if dedupe_key:
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["dedupe_key"],
            index_where=text("status IN ('queued', 'running') AND dedupe_key IS NOT NULL"),
        )
    await session.execute(stmt)


async def _claim() -> tuple[uuid.UUID, str, dict, int, int] | None:
    async with session_scope() as session:
        row = (
            await session.execute(
                text(
                    """UPDATE jobs SET status = 'running', locked_at = now(),
                              attempts = attempts + 1
                       WHERE id = (SELECT id FROM jobs
                                   WHERE status = 'queued' AND run_after <= now()
                                   ORDER BY run_after, created_at
                                   FOR UPDATE SKIP LOCKED LIMIT 1)
                       RETURNING id, kind, payload, attempts, max_attempts"""
                )
            )
        ).first()
    return tuple(row) if row else None  # type: ignore[return-value]


async def _finish(job_id: uuid.UUID, error: str | None, attempts: int, max_attempts: int) -> None:
    async with session_scope() as session:
        if error is None:
            await session.execute(
                text(
                    "UPDATE jobs SET status='done', finished_at=now(), last_error=NULL WHERE id=:id"
                ),
                {"id": job_id},
            )
        elif attempts < max_attempts:
            backoff = 15 * (4 ** (attempts - 1))
            await session.execute(
                text(
                    "UPDATE jobs SET status='queued', locked_at=NULL, last_error=:err, "
                    "run_after = now() + make_interval(secs => :backoff) WHERE id=:id"
                ),
                {"id": job_id, "err": error[-4000:], "backoff": backoff},
            )
        else:
            await session.execute(
                text(
                    "UPDATE jobs SET status='failed', finished_at=now(), last_error=:err "
                    "WHERE id=:id"
                ),
                {"id": job_id, "err": error[-4000:]},
            )


async def run_one() -> bool:
    """Claim and run a single job. Returns False when the queue had nothing ready."""
    claimed = await _claim()
    if claimed is None:
        return False
    job_id, kind, payload, attempts, max_attempts = claimed
    fn = HANDLERS.get(kind)
    error = None
    if fn is None:
        error = f"no handler registered for {kind!r}"
        attempts = max_attempts
    else:
        try:
            async with session_scope() as session:
                await fn(session, payload)
        except Exception:
            error = traceback.format_exc()
            log.warning("job %s (%s) failed on attempt %s", job_id, kind, attempts)
    await _finish(job_id, error, attempts, max_attempts)
    return True


async def drain(max_jobs: int = 10_000, budget_seconds: float | None = None) -> int:
    """Run ready jobs until none are left, ``max_jobs`` ran, or ``budget_seconds`` passed."""
    load_handlers()
    await _init_runtime()
    loop = asyncio.get_running_loop()
    deadline = loop.time() + budget_seconds if budget_seconds else None
    n = 0
    while n < max_jobs and (deadline is None or loop.time() < deadline) and await run_one():
        n += 1
    return n


async def pending_count() -> int:
    async with session_scope() as session:
        return (
            await session.execute(
                text("SELECT count(*) FROM jobs WHERE status IN ('queued', 'running')")
            )
        ).scalar_one()


async def _reclaim_stale() -> None:
    async with session_scope() as session:
        await session.execute(
            text(
                "UPDATE jobs SET status='queued', locked_at=NULL "
                "WHERE status='running' AND locked_at < now() - interval '15 minutes'"
            )
        )


async def _schedule_crawls() -> None:
    async with session_scope() as session:
        sources = (await session.execute(select(Source).where(Source.enabled))).scalars().all()
        for src in sources:
            await enqueue(session, "crawl_source", {"key": src.key}, dedupe_key=f"crawl:{src.key}")


async def run_worker(stop: asyncio.Event | None = None) -> None:
    settings = get_settings()
    load_handlers()
    await _init_runtime()
    stop = stop or asyncio.Event()
    last_reclaim = last_crawl = last_housekeeping = 0.0
    loop = asyncio.get_running_loop()
    log.info("worker started")
    while not stop.is_set():
        now = loop.time()
        try:
            if now - last_reclaim > 60:
                await _reclaim_stale()
                last_reclaim = now
            if now - last_housekeeping > HOUSEKEEPING_SECONDS:
                async with session_scope() as session:
                    await enqueue(session, "housekeeping", {}, dedupe_key="housekeeping")
                last_housekeeping = now
            if settings.crawl_enabled and now - last_crawl > settings.crawl_interval_minutes * 60:
                await _schedule_crawls()
                last_crawl = now
            if await run_one():
                continue
        except Exception:
            log.exception("worker loop error")
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.worker_poll_seconds)
        except TimeoutError:
            pass
    log.info("worker stopped")
