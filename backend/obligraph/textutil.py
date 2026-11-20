"""Text helpers: chunking, sentences, dates, and verbatim-quote checks."""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime

_WS = re.compile(r"\s+")
_SENT_SPLIT = re.compile(
    r"(?<=[.;:])\s+(?=[A-Z(\"'0-9])|\n\s*\n|\n(?=\s*(?:\(?[a-z0-9ivx]{1,4}[).]|[-*•])\s)"
)

STOPWORDS = frozenset(
    """a an the and or of to in for on at by with from as is are was were be been being this
    that these those it its shall must may should will would can could such any all each every
    which who whom whose what when where how than then there their they them we our you your
    not no nor under above below into onto over per via within without also only other
    such same so do does did done has have had having if else upon i ii iii iv v vi vii viii""".split()
)


def normalize_ws(text: str) -> str:
    return _WS.sub(" ", text).strip()


def sha256(text: str) -> str:
    return hashlib.sha256(normalize_ws(text).encode("utf-8")).hexdigest()


def sentences(text: str) -> list[str]:
    parts = (normalize_ws(p) for p in _SENT_SPLIT.split(text))
    return [p for p in parts if len(p) > 3]


def chunk_text(text: str, target: int = 1200, overlap: int = 150) -> list[str]:
    """Split on paragraph boundaries into ~``target``-char passages with a small overlap."""
    paras = [normalize_ws(p) for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paras:
        return []
    chunks: list[str] = []
    buf = ""
    for para in paras:
        while len(para) > target * 1.5:  # very long paragraph: cut at a sentence boundary
            cut = para.rfind(". ", 0, target)
            cut = cut + 1 if cut > target // 3 else target
            piece, para = para[:cut].strip(), para[cut:].strip()
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.append(piece)
        if buf and len(buf) + len(para) + 1 > target:
            chunks.append(buf)
            tail = buf[-overlap:]
            space = tail.find(" ")
            buf = (tail[space + 1 :] + " " + para) if space != -1 else para
        else:
            buf = f"{buf} {para}".strip()
    if buf:
        chunks.append(buf)
    return chunks


def content_words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in STOPWORDS]


def stem(word: str) -> str:
    for suffix in ("ations", "ation", "ments", "ment", "ings", "ing", "ies", "es", "ed", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def overlap_score(needle: str, haystack: str) -> float:
    """Share of the needle's content stems that appear in the haystack (0..1)."""
    want = {stem(w) for w in content_words(needle)}
    if not want:
        return 0.0
    have = {stem(w) for w in content_words(haystack)}
    return len(want & have) / len(want)


def _norm_quote(text: str) -> str:
    text = text.lower().replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def quote_in(quote: str, passage: str) -> bool:
    """True when ``quote`` appears in ``passage`` ignoring case, punctuation and spacing."""
    q = _norm_quote(quote)
    return bool(q) and len(q) >= 12 and q in _norm_quote(passage)


# --------------------------------------------------------------------------- durations

_NUM = {
    w: i
    for i, w in enumerate(
        "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
        "fifteen sixteen seventeen eighteen nineteen".split()
    )
}
_NUM.update(
    {
        w: 10 * i
        for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split())
        if w != "_"
    }
)
_UNITS = {
    "hour": "hours",
    "hours": "hours",
    "day": "days",
    "days": "days",
    "week": "weeks",
    "weeks": "weeks",
    "month": "months",
    "months": "months",
    "year": "years",
    "years": "years",
}


def _number(tokens: list[str]) -> int | None:
    if len(tokens) == 1 and tokens[0].isdigit():
        return int(tokens[0])
    total = 0
    for t in tokens:
        if t in _NUM:
            total += _NUM[t]
        elif t == "hundred":
            total = max(total, 1) * 100
        elif t != "and":
            return None
    return total or None


def durations(text: str) -> set[tuple[int, str]]:
    """Time limits like "six hours", "30 days", "one hundred and eighty days"."""
    toks = re.findall(r"[a-z0-9]+", text.lower())
    found: set[tuple[int, str]] = set()
    for i, tok in enumerate(toks):
        unit = _UNITS.get(tok)
        if unit is None:
            continue
        j = i - 1
        if j >= 0 and toks[j] in ("working", "business", "calendar"):
            j -= 1
        start = j
        while (
            start >= 0
            and (toks[start].isdigit() or toks[start] in _NUM or toks[start] in ("hundred", "and"))
            and j - start < 6
        ):
            start -= 1
        words = toks[start + 1 : j + 1]
        while words and words[0] == "and":
            words = words[1:]
        value = _number(words) if words else None
        if value:
            found.add((value, unit))
    return found


# --------------------------------------------------------------------------- dates

_MONTHS = {
    m: i
    for i, names in enumerate(
        [
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ],
        start=1,
    )
    for m in names
}
_MON = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
DATE_PATTERNS = [
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+" + _MON + r",?\s+(\d{4})\b", re.IGNORECASE),
    re.compile(r"\b" + _MON + r"\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b", re.IGNORECASE),
    re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b"),
]


def _mk(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def find_dates(text: str) -> list[tuple[int, date]]:
    """All dates in ``text`` with their character offsets, in order of appearance."""
    found: list[tuple[int, date]] = []
    for i, pat in enumerate(DATE_PATTERNS):
        for m in pat.finditer(text):
            g = m.groups()
            if i == 0:
                d = _mk(int(g[0]), int(g[1]), int(g[2]))
            elif i == 1:
                d = _mk(int(g[2]), _MONTHS[g[1].lower()[:3]], int(g[0]))
            elif i == 2:
                d = _mk(int(g[2]), _MONTHS[g[0].lower()[:3]], int(g[1]))
            else:  # Indian convention: DD.MM.YYYY
                d = _mk(int(g[2]), int(g[1]), int(g[0]))
            if d:
                found.append((m.start(), d))
    found.sort(key=lambda t: t[0])
    return found


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        hits = find_dates(value)
        return hits[0][1] if hits else None
