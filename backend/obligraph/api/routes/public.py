"""Unauthenticated endpoints used by the marketing site, plus their admin views."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import delete, select

from obligraph import ratelimit
from obligraph.api.deps import SessionDep, superuser
from obligraph.models import DemoRequest, User

log = logging.getLogger(__name__)
router = APIRouter(tags=["public"])


class DemoRequestIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    company: str = Field(min_length=1, max_length=200)
    role: str = Field("", max_length=200)
    entity_type: str = Field("", max_length=64)
    message: str = Field("", max_length=4000)
    website: str = Field("", description="Honeypot: real visitors never fill this in.")


class DemoRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str
    company: str
    role: str
    entity_type: str
    message: str
    status: Literal["new", "contacted", "closed"]
    created_at: datetime
    handled_at: datetime | None


class DemoRequestUpdate(BaseModel):
    status: Literal["new", "contacted", "closed"]


@router.post("/public/demo-requests", status_code=201)
async def create_demo_request(body: DemoRequestIn, request: Request, session=SessionDep) -> dict:
    ip = ratelimit.client_ip(request)
    ratelimit.enforce(ratelimit.DEMO_PER_IP, ip)
    ratelimit.enforce(ratelimit.DEMO_GLOBAL, "all")
    if body.website.strip():
        log.info("demo request dropped by honeypot")
        return {"ok": True}  # look successful so bots learn nothing
    email = body.email.lower()
    recent = (
        await session.execute(
            select(DemoRequest.id).where(
                DemoRequest.email == email,
                DemoRequest.created_at > datetime.now(UTC) - timedelta(hours=24),
            )
        )
    ).first()
    if recent is None:
        session.add(
            DemoRequest(
                name=body.name.strip(),
                email=email,
                company=body.company.strip(),
                role=body.role.strip(),
                entity_type=body.entity_type.strip(),
                message=body.message.strip(),
                ip_hash=ratelimit.ip_hash(ip),
            )
        )
    return {"ok": True}


@router.get("/admin/demo-requests", response_model=list[DemoRequestOut])
async def list_demo_requests(
    _: User = Depends(superuser), session=SessionDep, status_filter: str | None = None
) -> list[DemoRequestOut]:
    stmt = select(DemoRequest)
    if status_filter:
        stmt = stmt.where(DemoRequest.status == status_filter)
    rows = (
        await session.execute(stmt.order_by(DemoRequest.created_at.desc()).limit(500))
    ).scalars()
    return [DemoRequestOut.model_validate(r) for r in rows]


@router.patch("/admin/demo-requests/{request_id}", response_model=DemoRequestOut)
async def update_demo_request(
    request_id: uuid.UUID, body: DemoRequestUpdate, _: User = Depends(superuser), session=SessionDep
) -> DemoRequestOut:
    row = await session.get(DemoRequest, request_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "demo request not found")
    row.status = body.status
    row.handled_at = None if body.status == "new" else datetime.now(UTC)
    await session.flush()
    return DemoRequestOut.model_validate(row)


@router.delete("/admin/demo-requests/{request_id}", status_code=204)
async def delete_demo_request(
    request_id: uuid.UUID, _: User = Depends(superuser), session=SessionDep
) -> None:
    """Erase a request entirely, e.g. when the person asks for their data to be deleted."""
    res = await session.execute(
        delete(DemoRequest).where(DemoRequest.id == request_id).returning(DemoRequest.id)
    )
    if res.first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "demo request not found")
