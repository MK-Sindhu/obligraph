from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import ratelimit, vocab
from obligraph.api.deps import SessionDep, current_user
from obligraph.api.schemas import (
    LoginIn,
    MembershipOut,
    MeOut,
    OrgOut,
    RegisterIn,
    SessionOut,
    UserOut,
)
from obligraph.audit import record
from obligraph.compliance.obligations import sync_org
from obligraph.models import Membership, Org, User
from obligraph.security import hash_password, issue_token, verify_password
from obligraph.settings import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


async def memberships_of(session: AsyncSession, user: User) -> list[MembershipOut]:
    rows = (
        (
            await session.execute(
                select(Membership)
                .where(Membership.user_id == user.id)
                .order_by(Membership.created_at)
            )
        )
        .scalars()
        .all()
    )
    return [MembershipOut(org=OrgOut.model_validate(m.org), role=m.role) for m in rows]


async def unique_slug(session: AsyncSession, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "org"
    slug, n = base, 1
    while (await session.execute(select(Org.id).where(Org.slug == slug))).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


@router.post("/register", response_model=SessionOut, status_code=201)
async def register(
    body: RegisterIn, request: Request, session: AsyncSession = SessionDep
) -> SessionOut:
    ratelimit.enforce(ratelimit.LOGIN_PER_IP, ratelimit.client_ip(request))
    email = body.email.lower()
    if (await session.execute(select(User.id).where(User.email == email))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    classes = vocab.canonical_entity_classes(body.entity_classes)
    admin_email = get_settings().admin_email.strip().lower()
    if admin_email:
        platform_admin = email == admin_email
    else:  # no ADMIN_EMAIL configured: the very first account administers the platform
        platform_admin = (await session.execute(select(func.count(User.id)))).scalar_one() == 0
    user = User(
        id=uuid.uuid4(),
        email=email,
        name=body.name,
        password_hash=hash_password(body.password),
        is_superuser=platform_admin,
    )
    org = Org(
        id=uuid.uuid4(),
        name=body.org_name,
        slug=await unique_slug(session, body.org_name),
        entity_classes=classes,
        regulators=vocab.regulators_for(classes),
        profile={},
    )
    session.add_all([user, org])
    await session.flush()
    session.add(Membership(user_id=user.id, org_id=org.id, role="owner"))
    await sync_org(session, org)
    await record(
        session,
        org_id=org.id,
        actor_id=user.id,
        action="org.created",
        target_type="org",
        target_id=org.id,
        data={"entity_classes": classes},
    )
    await session.flush()
    return SessionOut(
        token=issue_token(user.id),
        user=UserOut.model_validate(user),
        memberships=await memberships_of(session, user),
    )


@router.post("/login", response_model=SessionOut)
async def login(body: LoginIn, request: Request, session: AsyncSession = SessionDep) -> SessionOut:
    ratelimit.enforce(ratelimit.LOGIN_PER_IP, ratelimit.client_ip(request))
    user = (
        await session.execute(select(User).where(User.email == body.email.lower()))
    ).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    return SessionOut(
        token=issue_token(user.id),
        user=UserOut.model_validate(user),
        memberships=await memberships_of(session, user),
    )


@router.get("/me", response_model=MeOut)
async def me(user: User = Depends(current_user), session: AsyncSession = SessionDep) -> MeOut:
    return MeOut(
        user=UserOut.model_validate(user),
        memberships=await memberships_of(session, user),
        ai_mode="claude" if get_settings().claude_enabled else "offline",
    )
