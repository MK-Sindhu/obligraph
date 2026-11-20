"""Password hashing and access tokens."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from obligraph.settings import get_settings

ROLES = ("viewer", "member", "admin", "owner")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


def issue_token(user_id: uuid.UUID) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=s.jwt_ttl_minutes)},
        s.jwt_secret,
        algorithm="HS256",
    )


def read_token(token: str) -> uuid.UUID | None:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        return uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def role_at_least(role: str, needed: str) -> bool:
    return ROLES.index(role) >= ROLES.index(needed)
