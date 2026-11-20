"""Command line: ``obligraph <command>``."""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
from pathlib import Path

from obligraph import jobs, seed
from obligraph.db import dispose, session_scope


def _run(coro) -> None:
    async def wrapper():
        try:
            await coro
        finally:
            await dispose()

    asyncio.run(wrapper())


async def _worker() -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await jobs.run_worker(stop)


async def _crawl(key: str | None) -> None:
    from sqlalchemy import select

    from obligraph.ingest.sources import crawl
    from obligraph.models import Source

    async with session_scope() as session:
        stmt = select(Source)
        stmt = stmt.where(Source.key == key) if key else stmt.where(Source.enabled)
        for src in (await session.execute(stmt)).scalars():
            n = await crawl(session, src)
            print(f"{src.key}: {n} new item(s)")
    print(f"processed {await jobs.drain()} job(s)")


async def _ingest(path: Path, regulator: str, title: str | None) -> None:
    from obligraph import vocab
    from obligraph.ingest.documents import bytes_to_text
    from obligraph.ingest.pipeline import ingest_regulation

    reg = vocab.canonical_regulator(regulator)
    if reg is None:
        raise SystemExit(f"unknown regulator {regulator!r}; one of {', '.join(vocab.REGULATORS)}")
    text = bytes_to_text(path.name, path.read_bytes())
    async with session_scope() as session:
        doc = await ingest_regulation(session, title=title or path.stem, text=text, regulator=reg)
    print(f"document {doc.id}; processed {await jobs.drain()} job(s)")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="obligraph")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seed", help="seed sources; --demo adds a sample corpus and demo org")
    s.add_argument("--demo", action="store_true")
    sub.add_parser("worker", help="run the background job worker")
    sub.add_parser("drain", help="run all queued jobs, then exit")
    c = sub.add_parser("crawl", help="crawl regulator feeds now")
    c.add_argument("--source", help="source key (default: all enabled sources)")
    i = sub.add_parser("ingest", help="ingest a regulation file (pdf/docx/html/txt)")
    i.add_argument("path", type=Path)
    i.add_argument("--regulator", required=True)
    i.add_argument("--title")
    args = parser.parse_args()

    if args.cmd == "seed":
        _run(seed.run(demo=args.demo))
    elif args.cmd == "worker":
        _run(_worker())
    elif args.cmd == "drain":
        _run(jobs.drain())
    elif args.cmd == "crawl":
        _run(_crawl(args.source))
    elif args.cmd == "ingest":
        _run(_ingest(args.path, args.regulator, args.title))


if __name__ == "__main__":
    main()
