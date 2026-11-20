"""Runtime configuration, read once from the environment (and an optional .env)."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    # Any Postgres URL form works (postgres://, postgresql://, postgresql+asyncpg://,
    # with ?sslmode=...). Vercel's Neon/Postgres integrations set DATABASE_URL or POSTGRES_URL.
    database_url: str = Field(
        "postgresql+asyncpg://obligraph:obligraph@localhost:5442/obligraph",
        validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL"),
    )
    # A direct (non-pooled) URL, used for migrations and one-time setup when available.
    database_url_unpooled: str = Field(
        "", validation_alias=AliasChoices("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING")
    )

    # Serverless (Vercel): no long-running worker, no persistent disk. Auto-detected from
    # VERCEL=1; set SERVERLESS=true/false to override.
    serverless: bool | None = None
    # Run migrations and seed reference data on startup (default: on when serverless).
    auto_migrate: bool | None = None
    # Seconds a request may spend running queued jobs before responding (serverless).
    job_inline_budget_seconds: float = 20.0
    # Bearer secret for the scheduled /api/internal/cron endpoint.
    cron_secret: str = ""
    # Only this email becomes platform admin on registration. If unset, the first user does.
    admin_email: str = ""
    # Load the sample corpus and the demo org (demo@obligraph.dev) on first start.
    seed_demo: bool = False
    # Evidence storage: local disk, or the database (needed where disks are ephemeral).
    storage_backend: Literal["auto", "local", "database"] = "auto"
    # Upload size cap in MB (default: 4 when serverless, Vercel's request limit is 4.5 MB).
    max_upload_mb: int | None = None

    # Auth
    jwt_secret: str = DEV_JWT_SECRET
    jwt_ttl_minutes: int = 60 * 24

    # AI. "auto" uses Claude when credentials are present and falls back to the
    # deterministic offline engine otherwise, so the whole product runs without a key.
    ai_mode: Literal["auto", "claude", "offline"] = "auto"
    # Read here as well as by the SDK, so a key kept in .env (not the shell) still works.
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-5-5"
    effort_extraction: Literal["low", "medium", "high", "xhigh", "max"] = "high"
    effort_assessment: Literal["low", "medium", "high", "xhigh", "max"] = "high"
    effort_copilot: Literal["low", "medium", "high", "xhigh", "max"] = "medium"

    # Retrieval
    embeddings_provider: Literal["fastembed", "none"] = "none"
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Worker
    run_worker_in_api: bool = True
    worker_poll_seconds: float = 2.0
    crawl_enabled: bool = False
    crawl_interval_minutes: int = 360

    cors_origins: str = "http://localhost:3000"
    # Business timezone for "today", deadlines and overdue checks (Python and SQL).
    timezone: str = "Asia/Kolkata"
    # Where the browser reaches the app (used for SSO redirects).
    public_url: str = "http://localhost:3000"

    # Evidence files. Local disk (mount a volume in Docker).
    storage_dir: str = "./data"

    # SSO (OpenID Connect). Enabled when issuer and client id are set.
    oidc_issuer: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_scopes: str = "openid email profile"
    oidc_provider_name: str = "Single sign-on"

    @field_validator("jwt_secret")
    @classmethod
    def _secret(cls, v: str) -> str:
        if not v.strip():
            logging.getLogger(__name__).warning("JWT_SECRET is empty; using the dev default")
            return DEV_JWT_SECRET
        return v

    @property
    def is_serverless(self) -> bool:
        if self.serverless is not None:
            return self.serverless
        return os.getenv("VERCEL") == "1"

    @property
    def should_auto_migrate(self) -> bool:
        return self.is_serverless if self.auto_migrate is None else self.auto_migrate

    @property
    def evidence_backend(self) -> str:
        if self.storage_backend != "auto":
            return self.storage_backend
        return "database" if self.is_serverless else "local"

    @property
    def upload_limit_bytes(self) -> int:
        mb = self.max_upload_mb or (4 if self.is_serverless else 25)
        return mb * 1024 * 1024

    @property
    def claude_enabled(self) -> bool:
        if self.ai_mode == "offline":
            return False
        if self.ai_mode == "claude":
            return True
        return bool(
            self.anthropic_api_key
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("ANTHROPIC_AUTH_TOKEN")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
