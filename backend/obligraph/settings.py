"""Runtime configuration, read once from the environment (and an optional .env)."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = "postgresql+asyncpg://obligraph:obligraph@localhost:5442/obligraph"

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
