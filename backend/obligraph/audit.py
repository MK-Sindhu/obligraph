"""Activity log: who did what, when. Written in the same transaction as the change."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.models import AuditEvent


async def record(
    session: AsyncSession,
    *,
    org_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    data: dict | None = None,
) -> None:
    session.add(
        AuditEvent(
            org_id=org_id,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            data=data or {},
        )
    )
