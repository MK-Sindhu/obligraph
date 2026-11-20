"""Turn whatever Postgres URL the platform provides into what each driver needs.

Hosted Postgres (Neon or Supabase via Vercel, RDS, ...) hands out ``postgres://`` or
``postgresql://`` URLs carrying libpq options (``sslmode``, ``channel_binding``) and
provider extras (Supabase's ``supa=...`` and ``pgbouncer=true``). asyncpg rejects all
of those, psycopg rejects the provider extras, and pooled endpoints (PgBouncer /
Supavisor in transaction mode) need prepared-statement caching off.

SQLAlchemy gets a ``postgresql+asyncpg`` URL plus connect args; psycopg (LangGraph's
checkpointer) gets a libpq URL with only libpq-recognised options.
"""

from __future__ import annotations

import uuid

from sqlalchemy.engine import make_url

# Options libpq (and so psycopg) understands; anything else is dropped for psycopg.
_LIBPQ_PARAMS = {
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslcrl",
    "channel_binding",
    "connect_timeout",
    "application_name",
    "options",
    "target_session_attrs",
    "keepalives",
    "keepalives_idle",
    "keepalives_interval",
    "keepalives_count",
}


def _plain(raw: str) -> str:
    if raw.startswith("postgres://"):
        return "postgresql://" + raw[len("postgres://") :]
    return raw


def is_pooled(raw: str) -> bool:
    """Neon (``-pooler`` hosts), Supabase (``pooler.supabase.com`` / port 6543) or any URL
    flagged ``pgbouncer=true``."""
    url = make_url(_plain(raw))
    host = url.host or ""
    return (
        "pooler" in host
        or url.port == 6543
        or str(url.query.get("pgbouncer", "")).lower() == "true"
    )


def async_url(raw: str) -> tuple[str, dict]:
    url = make_url(_plain(raw))
    sslmode = url.query.get("sslmode")
    connect_args: dict = {}
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = sslmode
    if is_pooled(raw):
        # Transaction-mode poolers: no cached or named prepared statements.
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__ob_{uuid.uuid4().hex}__"
    # asyncpg takes connection options as arguments, not URL parameters: drop them all.
    url = url.set(drivername="postgresql+asyncpg", query={})
    return url.render_as_string(hide_password=False), connect_args


def libpq_url(raw: str) -> str:
    url = make_url(_plain(raw))
    query = {k: v for k, v in url.query.items() if k in _LIBPQ_PARAMS}
    url = url.set(drivername="postgresql", query=query)
    return url.render_as_string(hide_password=False)
