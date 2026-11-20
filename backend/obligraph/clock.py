"""Business time. Compliance deadlines are Indian dates, so "today" means today in the
configured business timezone (IST by default) everywhere: in Python, and in SQL, where
the database session uses the same zone (see db.py)."""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from obligraph.settings import get_settings


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().timezone)


def today() -> date:
    return datetime.now(tz()).date()
