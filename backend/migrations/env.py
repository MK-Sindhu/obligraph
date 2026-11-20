"""Alembic environment: runs migrations over the app's async engine."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from obligraph.models import Base
from obligraph.settings import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# Tables owned by other libraries (LangGraph's checkpointer creates and migrates its own).
EXTERNAL_TABLE_PREFIXES = ("checkpoint",)


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    table = obj.table.name if type_ in ("index", "column", "unique_constraint") else name
    return not (reflected and str(table).startswith(EXTERNAL_TABLE_PREFIXES))


def _url() -> str:
    return config.attributes.get("database_url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run(connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, include_object=include_object
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(_url())
    async with engine.connect() as connection:
        await connection.run_sync(_do_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
