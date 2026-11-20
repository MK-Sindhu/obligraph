"""Vercel entry point: Vercel's Python runtime serves the FastAPI ``app`` found here."""

from obligraph.api.app import app

__all__ = ["app"]
