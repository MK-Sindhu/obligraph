from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from obligraph import vocab
from obligraph.api.deps import Caller, caller, requires
from obligraph.api.schemas import (
    ActivityOut,
    MemberCreate,
    MemberOut,
    MemberUpdate,
    OrgOut,
    OrgUpdate,
    OrgUpdateOut,
    UserOut,
)
from obligraph.audit import record
from obligraph.compliance.obligations import org_has_policies, queue_assessments, resync_org
from obligraph.models import AuditEvent, Membership, User
from obligraph.security import hash_password

router = APIRouter(prefix="/org", tags=["organisation"])


@router.get("", response_model=OrgOut)
async def get_org(c: Caller = Depends(caller)) -> OrgOut:
    return OrgOut.model_validate(c.org)


@router.patch("", response_model=OrgUpdateOut)
async def update_org(body: OrgUpdate, c: Caller = Depends(requires("admin"))) -> OrgUpdateOut:
    org = c.org
    if body.name is not None:
        org.name = body.name
    if body.profile is not None:
        profile = {**(org.profile or {}), **body.profile}
        layer = profile.get("sbr_layer")
        if layer not in (None, "", *vocab.SBR_LAYERS):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"sbr_layer must be one of {', '.join(vocab.SBR_LAYERS)}",
            )
        sla = profile.get("approval_sla_days")
        if sla is not None and not (isinstance(sla, int) and 1 <= sla <= 60):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "approval_sla_days must be 1-60"
            )
        org.profile = profile
    if body.entity_classes is not None:
        org.entity_classes = vocab.canonical_entity_classes(body.entity_classes)
    if body.regulators is not None:
        org.regulators = [r for r in (vocab.canonical_regulator(x) for x in body.regulators) if r]
    elif body.entity_classes is not None:
        org.regulators = vocab.regulators_for(org.entity_classes)
    await c.session.flush()
    changes = await resync_org(c.session, org)
    new = changes["created"] + changes["reopened"]
    if new and await org_has_policies(c.session, org.id):
        await queue_assessments(c.session, new)
    await record(
        c.session,
        org_id=org.id,
        actor_id=c.user.id,
        action="org.updated",
        target_type="org",
        target_id=org.id,
        data=body.model_dump(exclude_none=True)
        | {"added": len(new), "retired": len(changes["retired"])},
    )
    out = OrgUpdateOut.model_validate(org)
    out.obligations_added, out.obligations_retired = len(new), len(changes["retired"])
    return out


@router.get("/members", response_model=list[MemberOut])
async def members(c: Caller = Depends(caller)) -> list[MemberOut]:
    rows = (
        (
            await c.session.execute(
                select(Membership)
                .where(Membership.org_id == c.org.id)
                .order_by(Membership.created_at)
            )
        )
        .scalars()
        .all()
    )
    return [
        MemberOut(user=UserOut.model_validate(m.user), role=m.role, joined_at=m.created_at)
        for m in rows
    ]


@router.post("/members", response_model=MemberOut, status_code=201)
async def add_member(body: MemberCreate, c: Caller = Depends(requires("admin"))) -> MemberOut:
    if body.role == "owner" and c.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only an owner can add owners")
    email = body.email.lower()
    user = (await c.session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        if not body.password:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "password is required for a new user"
            )
        user = User(
            id=uuid.uuid4(), email=email, name=body.name, password_hash=hash_password(body.password)
        )
        c.session.add(user)
        await c.session.flush()
    existing = await c.session.get(Membership, (user.id, c.org.id))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "already a member")
    m = Membership(user_id=user.id, org_id=c.org.id, role=body.role)
    c.session.add(m)
    await c.session.flush()
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="member.added",
        target_type="user",
        target_id=user.id,
        data={"role": body.role},
    )
    return MemberOut(user=UserOut.model_validate(user), role=m.role, joined_at=m.created_at)


@router.patch("/members/{user_id}", response_model=MemberOut)
async def update_member(
    user_id: uuid.UUID, body: MemberUpdate, c: Caller = Depends(requires("admin"))
) -> MemberOut:
    m = await c.session.get(Membership, (user_id, c.org.id))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if "owner" in (m.role, body.role) and c.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only an owner can change owners")
    if m.role == "owner" and body.role != "owner":
        owners = (
            await c.session.execute(
                select(func.count()).where(
                    Membership.org_id == c.org.id, Membership.role == "owner"
                )
            )
        ).scalar_one()
        if owners <= 1:
            raise HTTPException(status.HTTP_409_CONFLICT, "an organisation needs an owner")
    previous, m.role = m.role, body.role
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="member.role_changed",
        target_type="user",
        target_id=user_id,
        data={"from": previous, "to": body.role},
    )
    return MemberOut(user=UserOut.model_validate(m.user), role=m.role, joined_at=m.created_at)


@router.delete("/members/{user_id}", status_code=204)
async def remove_member(user_id: uuid.UUID, c: Caller = Depends(requires("admin"))) -> None:
    m = await c.session.get(Membership, (user_id, c.org.id))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if m.role == "owner":
        raise HTTPException(status.HTTP_409_CONFLICT, "transfer ownership before removing")
    await c.session.delete(m)
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="member.removed",
        target_type="user",
        target_id=user_id,
    )


@router.get("/activity", response_model=list[ActivityOut])
async def activity(
    c: Caller = Depends(caller), limit: int = Query(50, le=200)
) -> list[ActivityOut]:
    rows = (
        await c.session.execute(
            select(AuditEvent, User.name)
            .outerjoin(User, User.id == AuditEvent.actor_id)
            .where(AuditEvent.org_id == c.org.id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        ActivityOut(
            id=e.id,
            action=e.action,
            actor=name or "Obligraph",
            target_type=e.target_type,
            target_id=e.target_id,
            data=e.data,
            created_at=e.created_at,
        )
        for e, name in rows
    ]
