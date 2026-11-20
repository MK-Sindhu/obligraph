"""Feed crawling against a mocked regulator site."""

from __future__ import annotations

import httpx
from sqlalchemy import select

from obligraph import jobs
from obligraph.db import session_scope
from obligraph.ingest.sources import crawl
from obligraph.models import Document, Regulation, Source

FEED = """<?xml version="1.0"?><rss version="2.0"><channel><title>RBI</title>
<item><title>Directions on Outsourcing of IT Services</title>
  <link>https://rbi.example/notification?id=1</link>
  <pubDate>Wed, 11 Nov 2026 17:00:00 +0530</pubDate></item>
<item><title>Press release with a broken PDF</title>
  <link>https://rbi.example/press?id=2</link>
  <description>Regulated entities shall disclose all outsourcing arrangements on their
  website within thirty days of entering into them.</description>
  <pubDate>Thu, 12 Nov 2026 10:00:00 +0530</pubDate></item>
</channel></rss>"""

# ASP.NET-style page: everything lives inside a <form>.
PAGE = """<html><body><form id="aspnetForm"><table class="tablebg"><tr><td>
<p>RBI/DoS/2026-27/88</p><p>November 11, 2026</p>
<p>All Non-Banking Financial Companies (NBFCs)</p>
<p>Regulated entities shall obtain Board approval before outsourcing any critical IT service
and shall review every outsourcing arrangement at least once a year.</p>
<p>Regulated entities shall report material outsourcing arrangements to the Reserve Bank within
fifteen days.</p></td></tr></table></form></body></html>"""

THIN = """<html><body><form><a href="/docs/release.pdf">Download</a></form></body></html>"""


def handler(request: httpx.Request) -> httpx.Response:
    url = str(request.url)
    if url.endswith("/feed.xml"):
        return httpx.Response(200, text=FEED, headers={"content-type": "text/xml"})
    if "notification" in url:
        return httpx.Response(200, text=PAGE, headers={"content-type": "text/html"})
    if "press" in url:
        return httpx.Response(200, text=THIN, headers={"content-type": "text/html"})
    if url.endswith(".pdf"):  # claims to be a PDF, serves an HTML error page
        return httpx.Response(
            200, text="<!DOCTYPE html><p>Not found</p>", headers={"content-type": "application/pdf"}
        )
    return httpx.Response(404)


async def test_crawl_ingests_new_items_once():
    transport = httpx.MockTransport(handler)
    async with session_scope() as session:
        src = Source(
            key="rbi_test",
            name="RBI test",
            regulator="RBI",
            url="https://rbi.example/feed.xml",
            enabled=True,
            items_seen=0,
        )
        session.add(src)
        await session.flush()
        async with httpx.AsyncClient(transport=transport) as client:
            assert await crawl(session, src, client) == 2
            assert await crawl(session, src, client) == 0  # already seen
        assert src.last_status == "ok" and src.items_seen == 2
    await jobs.drain()

    async with session_scope() as session:
        docs = (
            (await session.execute(select(Document).order_by(Document.published_on)))
            .scalars()
            .all()
        )
        assert [d.source_key for d in docs] == ["rbi_test", "rbi_test"]
        assert "Board approval before outsourcing" in docs[0].text
        assert "disclose all outsourcing arrangements" in docs[1].text  # feed summary fallback
        regs = {r.ref_no: r for r in (await session.execute(select(Regulation))).scalars()}
        reg = regs["RBI/DoS/2026-27/88"]
        assert reg.entity_classes == ["nbfc"]
        await session.refresh(reg, ["requirements"])
        assert {r.frequency for r in reg.requirements} == {"annual", "event_driven"}
