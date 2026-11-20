"""Regulator feed monitoring.

Each source is an RSS feed. New items are fetched (HTML page, or the PDF it links to),
converted to text and handed to the ingestion pipeline. Already-seen URLs are skipped,
so a crawl is cheap to repeat.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from urllib.parse import urljoin

import feedparser
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.ingest.documents import UnsupportedDocument, bytes_to_text, html_to_text
from obligraph.ingest.pipeline import ingest_regulation
from obligraph.jobs import handler
from obligraph.models import Document, Source

log = logging.getLogger(__name__)

USER_AGENT = "Obligraph/0.1 (regulatory change monitoring)"
MAX_ITEMS_PER_RUN = 25

DEFAULT_SOURCES = [
    (
        "rbi_notifications",
        "RBI notifications",
        "RBI",
        "https://www.rbi.org.in/notifications_rss.xml",
    ),
    (
        "rbi_press_releases",
        "RBI press releases",
        "RBI",
        "https://www.rbi.org.in/pressreleases_rss.xml",
    ),
    ("sebi_updates", "SEBI circulars and updates", "SEBI", "https://www.sebi.gov.in/sebirss.xml"),
]


def _published(entry) -> date | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        try:
            return date(parsed.tm_year, parsed.tm_mon, parsed.tm_mday)
        except ValueError:
            return None
    return None


async def fetch_item_text(client: httpx.AsyncClient, url: str) -> str | None:
    resp = await client.get(url)
    resp.raise_for_status()
    if resp.content.lstrip()[:5].startswith(b"%PDF"):
        return bytes_to_text("item.pdf", resp.content, "application/pdf")
    html = resp.text
    text = html_to_text(html)
    # Many regulator pages are a thin wrapper around a PDF; prefer the PDF when the page
    # itself carries little text.
    if len(text) < 800:
        soup = BeautifulSoup(html, "html.parser")
        link = next(
            (
                a["href"]
                for a in soup.find_all("a", href=True)
                if a["href"].lower().split("?")[0].endswith(".pdf")
            ),
            None,
        )
        if link is None:
            frame = soup.find(["iframe", "embed"], src=True)
            link = frame["src"] if frame and ".pdf" in frame["src"].lower() else None
        if link:
            try:
                pdf = await client.get(urljoin(url, link))
                if pdf.status_code == 200:
                    return bytes_to_text("item.pdf", pdf.content, "application/pdf")
            except (httpx.HTTPError, UnsupportedDocument) as exc:
                log.info("linked PDF unusable for %s: %s", url, exc)
    return text or None


async def crawl(
    session: AsyncSession, source: Source, client: httpx.AsyncClient | None = None
) -> int:
    owns = client is None
    client = client or httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True
    )
    new = 0
    try:
        resp = await client.get(source.url)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        for entry in feed.entries[:MAX_ITEMS_PER_RUN]:
            link = entry.get("link")
            title = (entry.get("title") or "").strip()
            if not link or not title:
                continue
            seen = (await session.execute(select(Document.id).where(Document.url == link))).first()
            if seen:
                continue
            try:
                body = await fetch_item_text(client, link)
            except (httpx.HTTPError, UnsupportedDocument) as exc:
                log.info("could not fetch %s: %s", link, exc)
                body = None
            summary = BeautifulSoup(entry.get("summary", ""), "html.parser").get_text(" ").strip()
            if len(body or "") < 200 and len(summary) > len(body or ""):
                body = summary  # a "Download" stub page is worse than the feed's own summary
            body = body or ""
            if len(body) < 40:
                continue
            await ingest_regulation(
                session,
                title=title,
                text=f"{title}\n\n{body}",
                regulator=source.regulator,
                source_key=source.key,
                url=link,
                published_on=_published(entry),
            )
            new += 1
        source.last_status, source.last_error = "ok", None
    except Exception as exc:
        source.last_status, source.last_error = "error", repr(exc)[:2000]
        raise
    finally:
        source.last_run_at = datetime.now(UTC)
        source.items_seen += new
        if owns:
            await client.aclose()
    return new


@handler("crawl_source")
async def crawl_source_job(session: AsyncSession, payload: dict) -> None:
    source = (
        await session.execute(select(Source).where(Source.key == payload["key"]))
    ).scalar_one_or_none()
    if source is None or not source.enabled:
        return
    try:
        await crawl(session, source)
    except Exception:
        # Keep the status update even though the job will be retried.
        await session.commit()
        raise
