"""Pure functions: text handling, vocabulary, offline engine, calendar maths."""

from __future__ import annotations

from datetime import date

from obligraph import vocab
from obligraph.ai import offline
from obligraph.ai.schemas import CoverageVerdict, EvidenceQuote
from obligraph.compliance.assess import verify
from obligraph.compliance.calendar import add_months, occurrences
from obligraph.search import Hit, reciprocal_rank_fusion
from obligraph.seed import FIXTURES, read_fixture
from obligraph.textutil import chunk_text, durations, find_dates, parse_date, quote_in


def fixture(name: str) -> tuple[dict, str]:
    return read_fixture(FIXTURES / "regulations" / name)


def test_dates_in_indian_formats():
    text = "dated April 10, 2025; effective 1st July 2025 and reported on 15.03.2026 or 2026-04-01"
    assert [d for _, d in find_dates(text)] == [
        date(2025, 4, 10),
        date(2025, 7, 1),
        date(2026, 3, 15),
        date(2026, 4, 1),
    ]
    assert parse_date("2026-02-30") is None
    assert parse_date("31 December 2026") == date(2026, 12, 31)


def test_durations_words_and_digits():
    assert durations("within six hours of noticing") == {(6, "hours")}
    assert durations("within twenty-four hours") == {(24, "hours")}
    assert durations("for one hundred and eighty days") == {(180, "days")}
    assert durations("within seven working days") == {(7, "days")}
    assert durations("no limits here") == set()


def test_chunking_keeps_all_text_and_respects_size():
    paras = [f"Paragraph {i}. " + "word " * 60 for i in range(30)]
    chunks = chunk_text("\n\n".join(paras), target=800, overlap=100)
    assert len(chunks) > 3
    assert all(len(c) <= 1300 for c in chunks)
    for i in range(30):
        assert any(f"Paragraph {i}." in c for c in chunks)


def test_quote_matching_ignores_formatting_but_not_words():
    passage = "The company shall, at all times, maintain records for five years."
    assert quote_in("shall at all times maintain records", passage)
    assert not quote_in("shall maintain records for ten years", passage)
    assert not quote_in("records", passage)  # too short to count as evidence


def test_entity_detection_avoids_reserve_bank_false_positive():
    assert vocab.detect_entity_classes("report the incident to the Reserve Bank") == []
    assert vocab.detect_entity_classes("All Non-Banking Financial Companies (NBFCs)") == ["nbfc"]
    assert vocab.detect_entity_classes("NBFC-MFIs shall ...") == ["nbfc_mfi"]
    assert vocab.canonical_entity_classes(["Banks", "Payment Aggregators", "unknown"]) == [
        "commercial_bank",
        "payment_aggregator",
    ]


def test_offline_extraction_of_master_direction():
    meta, text = fixture("02_kyc_md_2025.txt")
    ex = offline.extract_regulation(meta["title"], text, meta["published_on"])
    assert ex.ref_no == "OG/SAMPLE/RBI/2025-26/01"
    assert ex.doc_type == "master_direction"
    assert ex.issued_on == "2025-04-10"
    assert ex.effective_on == "2025-07-01"
    assert set(ex.entity_classes) == {"commercial_bank", "nbfc", "payment_aggregator"}
    assert "Banking Regulation Act, 1949" in ex.parent_acts
    assert len(ex.requirements) == 7
    board = next(r for r in ex.requirements if "quarterly" in r.text)
    assert board.frequency == "quarterly"
    policy = next(r for r in ex.requirements if "Know Your Customer policy" in r.text)
    assert policy.kind == "governance" and policy.frequency == "annual"
    str_report = next(r for r in ex.requirements if "suspicious" in r.text)
    assert str_report.kind == "reporting" and str_report.frequency == "event_driven"
    assert all(quote_in(r.source_quote, text) for r in ex.requirements)


def test_offline_extraction_finds_lineage_links():
    meta, text = fixture("04_kyc_amendment_2026.txt")
    ex = offline.extract_regulation(meta["title"], text, meta["published_on"])
    assert ("amends", "OG/SAMPLE/RBI/2025-26/01") in {
        (lk.relation, lk.target_ref) for lk in ex.links
    }
    meta, text = fixture("05_fpc_2026.txt")
    ex = offline.extract_regulation(meta["title"], text, meta["published_on"])
    assert ("supersedes", "OG/SAMPLE/RBI/2019-20/07") in {
        (lk.relation, lk.target_ref) for lk in ex.links
    }
    # "Lenders shall comply with these directions by June 30, 2026" is a compliance
    # date, not a requirement of its own.
    assert not any("comply with these directions" in r.text for r in ex.requirements)
    kfs = next(r for r in ex.requirements if "Key Fact Statement" in r.text)
    assert kfs.frequency != "annual"  # "annual percentage rate" is not a frequency


def test_offline_assessment_flags_wrong_time_limit():
    req = (
        "Regulated entities shall report every cyber security incident to the Reserve Bank "
        "and to CERT-In within six hours of noticing the incident."
    )
    passages = [
        (
            "Infosec policy",
            "All cyber security incidents shall be reported to the "
            "Reserve Bank and CERT-In within twenty-four hours of noticing the incident.",
        )
    ]
    verdict = offline.assess_coverage(req, "critical", passages)
    assert verdict.coverage == "partial"
    assert "6 hours" in verdict.rationale and "24 hours" in verdict.rationale
    assert verdict.tasks and verdict.tasks[0].priority == "urgent"

    missing = offline.assess_coverage(req, "critical", [("HR policy", "Staff leave rules.")])
    assert missing.coverage == "missing" and missing.quotes == []


def _hit(text: str) -> Hit:
    import uuid

    return Hit(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Policy",
        text=text,
        score=1.0,
    )


def test_unverifiable_quotes_downgrade_coverage():
    hits = [_hit("Records shall be retained for five years after the relationship ends.")]
    good = CoverageVerdict(
        coverage="covered",
        confidence=0.9,
        rationale="ok",
        quotes=[EvidenceQuote(passage=1, quote="retained for five years after")],
        remediation="",
        tasks=[],
    )
    verdict, evidence = verify(good, hits)
    assert verdict.coverage == "covered" and len(evidence) == 1

    invented = good.model_copy(
        update={"quotes": [EvidenceQuote(passage=1, quote="retained for ten years")]}
    )
    verdict, evidence = verify(invented, hits)
    assert verdict.coverage == "partial" and evidence == [] and verdict.confidence <= 0.35

    out_of_range = good.model_copy(update={"quotes": [EvidenceQuote(passage=7, quote="x" * 20)]})
    assert verify(out_of_range, hits)[1] == []


def test_calendar_recurrence():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    got = occurrences(date(2025, 7, 1), 3, date(2026, 11, 1), date(2027, 5, 1))
    assert got == [date(2027, 1, 1), date(2027, 4, 1)]
    assert occurrences(date(2030, 1, 1), 12, date(2026, 1, 1), date(2026, 12, 31)) == []


def test_rrf_prefers_items_ranked_by_both_lists():
    fused = reciprocal_rank_fusion([["a", "b", "c"], ["c", "a", "d"]])
    assert [k for k, _ in fused][:2] == ["a", "c"]
