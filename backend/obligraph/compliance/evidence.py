"""Evidence files: stored once, hashed, never modified.

Two backends: local disk under ``STORAGE_DIR/evidence/<org>/<evidence id>``, or the
``evidence_blobs`` table (serverless hosts, whose disks do not persist). The original
file name is kept only in the database, so nothing user-supplied ever reaches a path.
"""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.models import Evidence, EvidenceBlob
from obligraph.settings import get_settings


def storage_root() -> Path:
    return Path(get_settings().storage_dir).resolve() / "evidence"


def path_for(storage_key: str) -> Path:
    root = storage_root()
    path = (root / storage_key).resolve()
    if not path.is_relative_to(root):
        raise ValueError("storage key escapes the evidence store")
    return path


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(path)


async def save(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    filename: str,
    content_type: str | None,
    data: bytes,
    uploaded_by: uuid.UUID | None,
    task_id: uuid.UUID | None = None,
    obligation_id: uuid.UUID | None = None,
    filing_id: uuid.UUID | None = None,
    note: str = "",
) -> Evidence:
    if not data:
        raise ValueError("empty file")
    limit = get_settings().upload_limit_bytes
    if len(data) > limit:
        raise ValueError(f"evidence files are limited to {limit // (1024 * 1024)} MB")
    eid = uuid.uuid4()
    in_db = get_settings().evidence_backend == "database"
    key = f"db:{eid}" if in_db else f"{org_id}/{eid}"
    if not in_db:
        await asyncio.to_thread(_write, path_for(key), data)
    ev = Evidence(
        id=eid,
        org_id=org_id,
        task_id=task_id,
        obligation_id=obligation_id,
        filing_id=filing_id,
        filename=(filename or "evidence").replace("/", "_").replace("\\", "_")[:255],
        content_type=content_type or "application/octet-stream",
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        storage_key=key,
        note=note,
        uploaded_by=uploaded_by,
    )
    session.add(ev)
    await session.flush()
    if in_db:
        session.add(EvidenceBlob(evidence_id=eid, data=data))
        await session.flush()
    return ev


async def read(ev: Evidence, session: AsyncSession | None = None) -> bytes:
    if ev.storage_key.startswith("db:"):
        if session is None:
            raise OSError("reading database-stored evidence needs a session")
        blob = await session.get(EvidenceBlob, ev.id)
        if blob is None:
            raise OSError(f"evidence {ev.id} has no stored content")
        data = blob.data
    else:
        data = await asyncio.to_thread(path_for(ev.storage_key).read_bytes)
    if hashlib.sha256(data).hexdigest() != ev.sha256:
        raise OSError(f"evidence {ev.id} failed its integrity check")
    return data


async def remove_file(ev: Evidence) -> None:
    if ev.storage_key.startswith("db:"):
        return  # the blob row is removed with the evidence row (ON DELETE CASCADE)
    await asyncio.to_thread(path_for(ev.storage_key).unlink, True)
