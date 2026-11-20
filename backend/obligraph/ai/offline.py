"""Deterministic engine used when Claude is not configured.

It is deliberately conservative: it extracts only sentences that carry a mandatory
modal ("shall", "must", ...), keeps them verbatim, and scores policy coverage by
lexical overlap. Output uses the same schemas as the Claude engine, so the rest of
the system cannot tell which engine ran (except via ``extracted_by``).
"""

from __future__ import annotations

import re

from obligraph import vocab
from obligraph.ai.schemas import (
    CoverageVerdict,
    EvidenceQuote,
    ExtractedLink,
    ExtractedRegulation,
    ExtractedRequirement,
    SuggestedTask,
)
from obligraph.textutil import durations, find_dates, normalize_ws, overlap_score, sentences

REF_RE = re.compile(r"(?<![\w(/])([A-Z][A-Za-z0-9.&-]*(?:/[A-Za-z0-9.()&_-]+){2,})")
ACT_RE = re.compile(r"\b((?:[A-Z][A-Za-z-]+\s(?:of\s|and\s|for\s)?){1,8}Act,?\s\d{4})")
MANDATORY = re.compile(
    r"\b(shall|must|are required to|is required to|are directed to|is directed to|"
    r"should ensure|shall ensure|is mandatory|are mandated|is mandated|"
    r"are advised to|is advised to)\b",
    re.IGNORECASE,
)
PROHIBITION = re.compile(
    r"\b(shall not|must not|shall refrain|shall desist|prohibited|not be permitted|"
    r"not permitted|no [a-z ]{1,40} shall)\b",
    re.IGNORECASE,
)
REPORTING = re.compile(r"\b(report|submit|furnish|file|intimate|notify)\w*\b", re.IGNORECASE)
DISCLOSURE = re.compile(r"\b(disclos\w*|display\w*|publish\w*|website)\b", re.IGNORECASE)
GOVERNANCE = re.compile(r"\b(board|committee|approved policy|board-approved)\b", re.IGNORECASE)
CRITICAL = re.compile(
    r"\b(immediately|forthwith|without delay|within (?:six|6|two|2|four|4) hours|penal action|"
    r"monetary penalt\w+|criminal)\b",
    re.IGNORECASE,
)
STRONG = re.compile(r"\b(strictly|mandatory|at all times|without fail|in no case)\b", re.IGNORECASE)
SOFT = re.compile(r"\b(are advised to|is advised to|encouraged|may consider)\b", re.IGNORECASE)
DEADLINE_CUE = re.compile(
    r"\b(by|on or before|not later than|latest by|before|w\.e\.f\.|with effect from|from|until)\b",
    re.IGNORECASE,
)
EFFECTIVE = re.compile(
    r"\b(come into (?:force|effect)|comes into (?:force|effect)|effective from|"
    r"shall be effective|with effect from|w\.e\.f\.|"
    r"comply with (?:these|this) (?:directions|circular|guidelines|regulations))",
    re.IGNORECASE,
)
BOILERPLATE = re.compile(
    r"^(yours faithfully|dear sir|madam|please refer|this circular is issued|"
    r"encl|copy to|\(?[a-z ]+\)?\s*chief general manager)",
    re.IGNORECASE,
)

FREQUENCIES = [
    ("monthly", re.compile(r"\b(monthly|every month|each month|per month)\b", re.I)),
    ("quarterly", re.compile(r"\b(quarterly|every quarter|each quarter|per quarter)\b", re.I)),
    ("half_yearly", re.compile(r"\b(half[- ]yearly|semi[- ]annual\w*|every six months)\b", re.I)),
    (
        "annual",
        re.compile(
            r"\b(annual(?! percentage)|annually|every year|each year|yearly|once a year)\b", re.I
        ),
    ),
    (
        "event_driven",
        re.compile(
            r"\b(within \w+(?:-\w+)? (?:hours|days|working days)|on becoming aware|"
            r"upon becoming aware|immediately|forthwith|"
            r"as and when|whenever|in the event|upon (?:the )?occurrence)\b",
            re.I,
        ),
    ),
]

EVIDENCE_HINTS = {
    "reporting": "Copy of each submitted report or return, with the regulator's acknowledgement.",
    "disclosure": "URL or screenshot of the published disclosure, with publication date.",
    "governance": "Board-approved policy, board/committee minutes and the approval date.",
    "prohibition": "Controls that block the practice, and monitoring records showing no breaches.",
    "obligation": "Documented procedure plus records that show it was followed.",
}


def _kind(sentence: str) -> str:
    if PROHIBITION.search(sentence):
        return "prohibition"
    if REPORTING.search(sentence):
        return "reporting"
    if DISCLOSURE.search(sentence):
        return "disclosure"
    if GOVERNANCE.search(sentence):
        return "governance"
    return "obligation"


def _frequency(sentence: str, has_due: bool) -> str:
    for name, pat in FREQUENCIES:
        if pat.search(sentence):
            return name
    return "one_time" if has_due else "ongoing"


def _severity(sentence: str, kind: str, has_due: bool) -> str:
    if CRITICAL.search(sentence):
        return "critical"
    if SOFT.search(sentence) and not STRONG.search(sentence):
        return "low"
    if kind == "prohibition" or has_due or STRONG.search(sentence):
        return "high"
    return "medium"


def _due_date(sentence: str) -> str | None:
    if not DEADLINE_CUE.search(sentence):
        return None
    hits = find_dates(sentence)
    return hits[-1][1].isoformat() if hits else None


def _doc_type(title: str) -> str:
    t = title.lower()
    for needle, kind in (
        ("master direction", "master_direction"),
        ("press release", "press_release"),
        ("notification", "notification"),
        ("regulations", "regulation"),
        ("guideline", "guideline"),
        ("circular", "circular"),
    ):
        if needle in t:
            return kind
    return "circular"


def _refs(text: str) -> list[str]:
    out: list[str] = []
    for m in REF_RE.finditer(text):
        ref = m.group(1).rstrip(".,;)")
        if re.search(r"\d{4}", ref) and ref not in out:
            out.append(ref)
    return out


def _preamble(body: str) -> str:
    """Text before the first mandatory sentence: title block, addressees, introduction.
    Instrument-wide scope (e.g. "All Upper Layer NBFCs") is stated here; layer mentions in
    individual requirements must not widen to the whole instrument."""
    m = MANDATORY.search(body)
    return body[: min(m.start() if m else 800, 1500)]


def extract_regulation(
    title: str, text: str, published_on: str | None = None
) -> ExtractedRegulation:
    body = text.strip()
    head = body[:1500]
    ref_no = next(iter(_refs(head)), None)
    sents = sentences(body)

    issued = published_on
    if not issued:
        dates = find_dates(head)
        issued = dates[0][1].isoformat() if dates else None

    effective = None
    links: list[ExtractedLink] = []
    requirements: list[ExtractedRequirement] = []
    summary_parts: list[str] = []

    for s in sents:
        low = s.lower()
        if EFFECTIVE.search(s) and effective is None:
            ds = find_dates(s)
            if ds:
                effective = ds[-1][1].isoformat()
        targets = [r for r in _refs(s) if r != ref_no]
        if targets:
            if "supersession" in low or "supersede" in low or "replaces" in low:
                rel = "supersedes"
            elif "amend" in low or "partial modification" in low or "modif" in low:
                rel = "amends"
            else:
                rel = "references"
            for t in targets:
                links.append(ExtractedLink(relation=rel, target_ref=t, target_title=None))

        if (
            len(summary_parts) < 2
            and 60 < len(s) < 400
            and not BOILERPLATE.search(s)
            and not s.lower().startswith(title.lower()[:30])
        ):
            summary_parts.append(s)

        if not MANDATORY.search(s) or BOILERPLATE.search(s) or not 40 <= len(s) <= 900:
            continue
        if EFFECTIVE.search(s) and len(s) < 160:
            continue  # "These directions shall come into force on ..." is metadata
        due = _due_date(s)
        kind = _kind(s)
        requirements.append(
            ExtractedRequirement(
                text=normalize_ws(s)[:600],
                source_quote=s,
                kind=kind,
                severity=_severity(s, kind, bool(due)),
                frequency=_frequency(s, bool(due)),
                due_date=due,
                entity_classes=vocab.detect_entity_classes(s),
                topics=vocab.detect_topics(s, limit=2),
                sbr_layers=vocab.detect_layers(s),
                evidence_hint=EVIDENCE_HINTS[kind],
            )
        )

    entity_classes = vocab.detect_entity_classes(f"{title}\n{head}")
    for r in requirements:
        for ec in r.entity_classes:
            if ec not in entity_classes:
                entity_classes.append(ec)

    acts: list[str] = []
    for m in ACT_RE.finditer(body):
        act = normalize_ws(m.group(1)).replace(" ,", ",")
        if act not in acts:
            acts.append(act)

    return ExtractedRegulation(
        title=title.strip()[:300] or "Untitled document",
        ref_no=ref_no,
        doc_type=_doc_type(title),
        issued_on=issued,
        effective_on=effective,
        summary=" ".join(summary_parts)[:700],
        entity_classes=entity_classes,
        topics=vocab.detect_topics(body),
        sbr_layers=vocab.detect_layers(f"{title}\n{_preamble(body)}"),
        parent_acts=acts[:5],
        links=links,
        requirements=requirements,
    )


def assess_coverage(
    requirement_text: str, severity: str, passages: list[tuple[str, str]]
) -> CoverageVerdict:
    """``passages`` are (document title, passage text). Scores lexical overlap only."""
    best = (0.0, -1, "")
    for i, (_title, passage) in enumerate(passages):
        passage_score = overlap_score(requirement_text, passage)
        for s in sentences(passage) or [passage]:
            score = 0.6 * overlap_score(requirement_text, s) + 0.4 * passage_score
            if score > best[0]:
                best = (score, i, s)

    score, idx, quote = best
    if score >= 0.55:
        coverage = "covered"
    elif score >= 0.3:
        coverage = "partial"
    else:
        coverage = "missing"

    # A matching sentence with the wrong time limit is a gap, not coverage.
    timeline_note = ""
    required = durations(requirement_text)
    if required and coverage == "covered":
        stated = durations(quote)
        if not stated:
            coverage = "partial"
            timeline_note = " The policy does not state the required time limit ({}).".format(
                ", ".join(f"{v} {u}" for v, u in sorted(required))
            )
        elif not required & stated:
            coverage = "partial"
            timeline_note = (
                " Time limit differs: the requirement says {}, the policy says {}.".format(
                    ", ".join(f"{v} {u}" for v, u in sorted(required)),
                    ", ".join(f"{v} {u}" for v, u in sorted(stated)),
                )
            )

    quotes = (
        [EvidenceQuote(passage=idx + 1, quote=quote)] if idx >= 0 and coverage != "missing" else []
    )
    title = passages[idx][0] if idx >= 0 else "your policies"
    due = {"critical": 7, "high": 14, "medium": 30, "low": 60}.get(severity, 30)
    priority = {"critical": "urgent", "high": "high", "medium": "medium", "low": "low"}.get(
        severity, "medium"
    )
    short = requirement_text[:110] + ("..." if len(requirement_text) > 110 else "")

    if coverage == "covered":
        rationale = f"'{title}' contains language closely matching this requirement."
        remediation = ""
        tasks: list[SuggestedTask] = []
    elif coverage == "partial":
        rationale = (
            f"'{title}' touches on this requirement but does not match all of its terms; "
            "check the specifics (scope, timelines, responsibilities)." + timeline_note
        )
        remediation = f"Tighten '{title}' so it explicitly addresses: {requirement_text}"
        tasks = [
            SuggestedTask(
                title=f"Close partial gap: {short}",
                detail=remediation,
                priority=priority,
                due_in_days=due,
            )
        ]
    else:
        rationale = "No passage in the uploaded policies addresses this requirement."
        remediation = f"Add a clause to the relevant policy covering: {requirement_text}"
        tasks = [
            SuggestedTask(
                title=f"Draft policy clause: {short}",
                detail=remediation,
                priority=priority,
                due_in_days=due,
            )
        ]

    return CoverageVerdict(
        coverage=coverage,
        confidence=round(min(0.6, score), 2) if coverage != "missing" else 0.5,
        rationale=rationale + " (Offline heuristic assessment.)",
        quotes=quotes,
        remediation=remediation,
        tasks=tasks,
    )
