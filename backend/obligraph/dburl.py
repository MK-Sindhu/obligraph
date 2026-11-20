"""Turn whatever Postgres URL the platform provides into what each driver needs.

Hosted Postgres (Neon via Vercel, Supabase, RDS...) hands out ``postgres://`` or
``postgresql://`` URLs with libpq options such as ``sslmode`` and ``channel_binding``.
asyncpg rejects those, and pooled (PgBouncer) endpoints need prepared-statement caching
off. SQLAlchemy gets a ``postgresql+asyncpg`` URL plus connect args; psycopg (LangGraph's
checkpointer) gets a plain libpq URL.
"""

from __future__ import annotations

import uuid

from sqlalchemy.engine import make_url

_LIBPQ_ONLY = ("sslmode", "channel_binding", "pgbouncer", "sslrootcert", "options")


def is_pooled(raw: str) -> bool:
    url = make_url(_plain(raw))
    return "-pooler" in (url.host or "") or url.query.get("pgbouncer") == "true"


def _plain(raw: str) -> str:
    if raw.startswith("postgres://"):
        return "postgresql://" + raw[len("postgres://") :]
    return raw


def async_url(raw: str) -> tuple[str, dict]:
    url = make_url(_plain(raw))
    query = dict(url.query)
    sslmode = query.get("sslmode")
    pooled = is_pooled(raw)
    for key in _LIBPQ_ONLY:
        query.pop(key, None)
    connect_args: dict = {}
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = sslmode
    if pooled:
        # PgBouncer in transaction mode: no cached or named prepared statements.
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__ob_{uuid.uuid4().hex}__"
    url = url.set(drivername="postgresql+asyncpg", query=query)
    return url.render_as_string(hide_password=False), connect_args


def libpq_url(raw: str) -> str:
    url = make_url(_plain(raw))
    query = {k: v for k, v in url.query.items() if k != "pgbouncer"}
    url = url.set(drivername="postgresql", query=query)
    return url.render_as_string(hide_password=False)
