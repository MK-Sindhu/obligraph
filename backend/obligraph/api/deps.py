"""Request dependencies: DB session, the authenticated user, and their org + role."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.db import sessionmaker
from obligraph.models import Membership, Org, User
from obligraph.security import read_token, role_at_least
from obligraph.settings import get_settings

bearer = HTTPBearer(auto_error=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise
        enqueued = session.info.pop("enqueued", False)
    settings = get_settings()
    if enqueued and settings.is_serverless:
        from obligraph import jobs

        await jobs.drain(budget_seconds=settings.job_inline_budget_seconds)


# scope="function": commit runs when the endpoint returns, before the response is sent,
# so a client never observes a response for a write that later fails to commit.
SessionDep = Depends(get_session, scope="function")


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = SessionDep,
) -> User:
    user_id = read_token(creds.credentials) if creds else None
    user = await session.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@dataclass
class Caller:
    user: User
    org: Org
    role: str
    session: AsyncSession

    def require(self, role: str) -> None:
        if not role_at_least(self.role, role):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"requires {role} role")


async def caller(
    user: User = Depends(current_user),
    session: AsyncSession = SessionDep,
    x_org_id: str | None = Header(default=None),
) -> Caller:
    stmt = select(Membership).where(Membership.user_id == user.id)
    if x_org_id:
        try:
            stmt = stmt.where(Membership.org_id == uuid.UUID(x_org_id))
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad X-Org-Id") from exc
    membership = (await session.execute(stmt.order_by(Membership.created_at))).scalars().first()
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a member of this organisation")
    return Caller(user=user, org=membership.org, role=membership.role, session=session)


def requires(role: str):
    async def dep(c: Caller = Depends(caller)) -> Caller:
        c.require(role)
        return c

    return dep


async def superuser(user: User = Depends(current_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "platform admin only")
    return user
