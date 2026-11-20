"""Platform administration and reference data."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text

from obligraph import vocab
from obligraph.api.deps import SessionDep, superuser
from obligraph.api.schemas import JobOut, SourceOut, Vocabulary
from obligraph.jobs import enqueue
from obligraph.models import Job, LLMCall, Source, User
from obligraph.settings import get_settings

router = APIRouter(tags=["admin"])


@router.get("/meta/vocabulary", response_model=Vocabulary)
async def vocabulary() -> Vocabulary:
    return Vocabulary(
        entity_classes=[
            {"key": k, "label": label, "regulator": reg}
            for k, (label, reg, _a) in vocab.ENTITY_CLASSES.items()
        ],
        regulators=[{"key": k, "label": v} for k, v in vocab.REGULATORS.items()],
        topics=[{"key": k, "label": label} for k, (label, _a) in vocab.TOPICS.items()],
    )


@router.get("/admin/overview")
async def overview(_: User = Depends(superuser), session=SessionDep) -> dict:
    counts = {}
    for table in ("documents", "regulations", "requirements", "orgs", "users", "obligations"):
        counts[table] = (await session.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()
    jobs = dict(
        (await session.execute(select(Job.status, func.count()).group_by(Job.status))).all()
    )
    usage = (
        await session.execute(
            select(
                LLMCall.purpose,
                func.count(),
                func.sum(LLMCall.input_tokens),
                func.sum(LLMCall.output_tokens),
                func.sum(LLMCall.cache_read_tokens),
                func.avg(LLMCall.latency_ms),
                func.count(LLMCall.error),
            ).group_by(LLMCall.purpose)
        )
    ).all()
    return {
        "ai_mode": "claude" if get_settings().claude_enabled else "offline",
        "model": get_settings().claude_model,
        "counts": counts,
        "jobs": jobs,
        "llm_usage": [
            {
                "purpose": p,
                "calls": n,
                "input_tokens": i or 0,
                "output_tokens": o or 0,
                "cache_read_tokens": cr or 0,
                "avg_latency_ms": round(lat or 0),
                "errors": e,
            }
            for p, n, i, o, cr, lat, e in usage
        ],
    }


@router.get("/admin/sources", response_model=list[SourceOut])
async def sources(_: User = Depends(superuser), session=SessionDep) -> list[SourceOut]:
    rows = (await session.execute(select(Source).order_by(Source.regulator, Source.key))).scalars()
    return [SourceOut.model_validate(s) for s in rows]


@router.post("/admin/sources/{key}/run", status_code=202)
async def run_source(key: str, _: User = Depends(superuser), session=SessionDep) -> dict:
    src = (await session.execute(select(Source).where(Source.key == key))).scalar_one_or_none()
    if src is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "source not found")
    await enqueue(session, "crawl_source", {"key": key}, dedupe_key=f"crawl:{key}")
    return {"queued": True}


@router.patch("/admin/sources/{key}", response_model=SourceOut)
async def toggle_source(
    key: str, enabled: bool, _: User = Depends(superuser), session=SessionDep
) -> SourceOut:
    src = (await session.execute(select(Source).where(Source.key == key))).scalar_one_or_none()
    if src is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "source not found")
    src.enabled = enabled
    return SourceOut.model_validate(src)


@router.get("/admin/jobs", response_model=list[JobOut])
async def jobs(
    _: User = Depends(superuser), session=SessionDep, status_filter: str | None = None
) -> list[JobOut]:
    stmt = select(Job)
    if status_filter:
        stmt = stmt.where(Job.status == status_filter)
    rows = (await session.execute(stmt.order_by(Job.created_at.desc()).limit(100))).scalars()
    return [JobOut.model_validate(j) for j in rows]
