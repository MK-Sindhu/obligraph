"""Turn uploaded or downloaded bytes into plain text."""

from __future__ import annotations

import io
import re
import zipfile

from bs4 import BeautifulSoup

SUPPORTED = (".pdf", ".txt", ".md", ".html", ".htm", ".docx")


class UnsupportedDocument(ValueError):
    pass


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    # Not "form": ASP.NET sites (rbi.org.in among them) wrap the whole page in one.
    for tag in soup(
        ["script", "style", "nav", "header", "footer", "noscript", "select", "button", "input"]
    ):
        tag.decompose()
    main = soup.find("main") or soup.find("article") or soup.body or soup
    lines = []
    for block in main.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "pre", "div"]):
        if block.find(["p", "li", "div", "table"]):
            continue  # take leaves only, to avoid duplicating nested text
        t = block.get_text(" ", strip=True)
        if t:
            lines.append(t)
    text = "\n\n".join(lines)
    if len(text) < 200:
        text = main.get_text("\n", strip=True)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def pdf_to_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(p for p in pages if p)


def docx_to_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    paragraphs = re.findall(r"<w:p[ >].*?</w:p>", xml, flags=re.S)
    out = []
    for p in paragraphs:
        runs = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, flags=re.S)
        line = "".join(runs).strip()
        if line:
            out.append(line)
    return "\n\n".join(out)


def guess_title(filename: str | None, text: str) -> str:
    """A document's own first heading, else a tidied file name."""
    for line in text.splitlines()[:15]:
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("# ").strip()[:200]
        if line:
            break
    stem = (filename or "Untitled document").rsplit(".", 1)[0]
    return re.sub(r"[_-]+", " ", stem).strip().capitalize()[:200] or "Untitled document"


def bytes_to_text(filename: str, data: bytes, content_type: str | None = None) -> str:
    name = filename.lower()
    if name.endswith(".pdf") or content_type == "application/pdf":
        if not data.lstrip()[:5].startswith(b"%PDF"):
            raise UnsupportedDocument("not a PDF (the server returned something else)")
        try:
            text = pdf_to_text(data)
        except Exception as exc:  # pypdf raises a variety of errors on damaged files
            raise UnsupportedDocument(f"unreadable PDF: {exc}") from exc
    elif name.endswith(".docx"):
        text = docx_to_text(data)
    elif name.endswith((".html", ".htm")) or (content_type or "").startswith("text/html"):
        text = html_to_text(data.decode("utf-8", errors="ignore"))
    elif name.endswith((".txt", ".md")) or (content_type or "").startswith("text/"):
        text = data.decode("utf-8", errors="ignore")
    else:
        raise UnsupportedDocument(f"unsupported file type: {filename}")
    text = text.replace("\x00", "").strip()
    if len(text) < 20:
        raise UnsupportedDocument("no extractable text (is it a scanned image?)")
    return text
