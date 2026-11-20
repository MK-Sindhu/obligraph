"""Structured-output contracts shared by the Claude and offline engines."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RequirementKind = Literal["obligation", "prohibition", "reporting", "disclosure", "governance"]
Severity = Literal["low", "medium", "high", "critical"]
Frequency = Literal[
    "one_time", "ongoing", "event_driven", "monthly", "quarterly", "half_yearly", "annual"
]
DocType = Literal[
    "master_direction",
    "circular",
    "notification",
    "regulation",
    "guideline",
    "press_release",
    "other",
]
Relation = Literal["amends", "supersedes", "references", "derived_from"]
Layer = Literal["base", "middle", "upper", "top"]


class ExtractedRequirement(BaseModel):
    text: str = Field(description="The requirement restated as one imperative sentence.")
    source_quote: str = Field(
        description="The sentence from the document this requirement comes from, copied verbatim."
    )
    kind: RequirementKind
    severity: Severity
    frequency: Frequency
    due_date: str | None = Field(description="Hard deadline as YYYY-MM-DD, if the text gives one.")
    entity_classes: list[str] = Field(
        description="Regulated entity types this requirement binds, as named in the text."
    )
    topics: list[str]
    sbr_layers: list[Layer] = Field(
        description="NBFC scale-based-regulation layers this is limited to; empty if not limited."
    )
    evidence_hint: str = Field(
        description="What a firm would show an inspector to prove compliance."
    )


class ExtractedLink(BaseModel):
    relation: Relation
    target_ref: str = Field(
        description="Reference number of the other instrument if given, else its title."
    )
    target_title: str | None


class ExtractedRegulation(BaseModel):
    title: str
    ref_no: str | None = Field(description="The instrument's own reference number, if printed.")
    doc_type: DocType
    issued_on: str | None = Field(description="Date of issue as YYYY-MM-DD.")
    effective_on: str | None = Field(description="Date it takes effect as YYYY-MM-DD.")
    summary: str = Field(description="Two or three sentences for a compliance officer.")
    entity_classes: list[str]
    topics: list[str]
    sbr_layers: list[Layer] = Field(
        description="NBFC layers the whole instrument is limited to; empty if not limited."
    )
    parent_acts: list[str] = Field(description="Statutes it is issued under, e.g. RBI Act, 1934.")
    links: list[ExtractedLink]
    requirements: list[ExtractedRequirement]


class SuggestedTask(BaseModel):
    title: str
    detail: str
    priority: Literal["low", "medium", "high", "urgent"]
    due_in_days: int


class EvidenceQuote(BaseModel):
    passage: int = Field(description="Number of the policy passage the quote is taken from.")
    quote: str = Field(description="Exact words copied from that passage.")


class CoverageVerdict(BaseModel):
    coverage: Literal["covered", "partial", "missing"]
    confidence: float = Field(description="0.0 to 1.0")
    rationale: str
    quotes: list[EvidenceQuote]
    remediation: str = Field(description="What to change in the policy. Empty if covered.")
    tasks: list[SuggestedTask]
