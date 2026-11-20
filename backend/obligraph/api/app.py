"""FastAPI application."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from obligraph import bootstrap, jobs
from obligraph.api.routes import (
    admin,
    auth,
    compliance,
    copilot,
    corpus,
    insights,
    ops,
    org,
    oversight,
    public,
    sso,
    work,
)
from obligraph.compliance import approvals
from obligraph.db import dispose, session_scope
from obligraph.settings import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    stop = asyncio.Event()
    worker = None
    if settings.should_auto_migrate:
        await bootstrap.run()
    else:
        await approvals.init()
    if settings.run_worker_in_api and not settings.is_serverless:
        worker = asyncio.create_task(jobs.run_worker(stop))
    try:
        yield
    finally:
        stop.set()
        if worker:
            with contextlib.suppress(asyncio.CancelledError):
                await asyncio.wait_for(worker, timeout=10)
        await approvals.shutdown()
        await dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Obligraph API",
        version="0.1.0",
        description="Regulatory obligations intelligence for Indian financial institutions.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (
        auth,
        sso,
        public,
        ops,
        org,
        corpus,
        compliance,
        work,
        oversight,
        insights,
        copilot,
        admin,
    ):
        app.include_router(module.router, prefix="/api")

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"ok": True}

    @app.get("/ready", tags=["meta"])
    async def ready() -> dict:
        async with session_scope() as session:
            await session.execute(text("SELECT 1"))
        return {"ok": True, "ai_mode": "claude" if settings.claude_enabled else "offline"}

    return app


app = create_app()
