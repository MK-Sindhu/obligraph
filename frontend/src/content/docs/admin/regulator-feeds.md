---
title: Regulator feeds
description: The regulator RSS sources Obligraph monitors, enabling and running them, polling schedules, and adding documents by upload or pasted text.
order: 3
---

Obligraph builds its shared corpus from regulator RSS feeds and from documents a platform admin adds by hand. Everything on this page needs platform admin access.

## Sources

| Key | Name | Regulator | Feed URL |
|---|---|---|---|
| `rbi_notifications` | RBI notifications | RBI | `https://www.rbi.org.in/notifications_rss.xml` |
| `rbi_press_releases` | RBI press releases | RBI | `https://www.rbi.org.in/pressreleases_rss.xml` |
| `sebi_updates` | SEBI circulars and updates | SEBI | `https://www.sebi.gov.in/sebirss.xml` |

The SEBI feed currently publishes no items, so add SEBI documents by upload or pasted text, as described below.

## Enabling and running

Sources start **disabled**. In **Admin → Regulator sources**:

- turn a source on with its **Enabled** switch;
- select **Run now** to queue a crawl straight away. Only enabled sources are crawled.

The panel shows each source's last run, its status, any error, and how many items it has picked up.

## Schedule

Feeds are polled on a schedule:

- **Docker or a VM**: when `CRAWL_ENABLED=true`, the worker polls enabled sources every `CRAWL_INTERVAL_MINUTES` (default 360, that is every 6 hours). `CRAWL_ENABLED` is `false` by default.
- **Vercel**: the daily cron at 02:30 UTC crawls every enabled source. It needs `CRON_SECRET` to be set.

New circulars appear after the next crawl, once extraction has run.

## What a crawl does

A crawl reads up to the 25 newest items in a feed and skips links it has already seen. For each new item it fetches the linked page or PDF. When a page has little text, it follows a PDF linked from the page. If the result is still only a stub, it uses the feed's own summary instead. Very short items are skipped, and text identical to a document already in the corpus isn't stored twice. New documents are queued for extraction and then matched to every organisation.

## Adding documents by hand

Under **Admin → Ingest a regulation**, choose:

- **Paste text**: a title, regulator and **Full text** (at least 40 characters), and optionally a **Source URL** and **Published on** date;
- **Upload file**: a PDF, Word, text, Markdown or HTML file and a regulator, and optionally a title. The title defaults to the file name.

Uploads follow the API's upload limit: 25 MB by default, 4 MB on Vercel. The regulator must be one Obligraph knows: RBI, SEBI, IRDAI, PFRDA, IFSCA, MCA, FIU-IND, CERT-In or MeitY.

For local development, the same is available from the command line inside `backend/`:

```bash
uv run obligraph crawl --source rbi_notifications    # crawl a feed now
uv run obligraph ingest circular.pdf --regulator RBI # ingest a local file
```
