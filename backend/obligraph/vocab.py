"""Controlled vocabulary for Indian financial regulation.

Extraction (by Claude or offline) produces free text like "Non-Banking Financial
Companies" or "NBFC-MFIs"; everything downstream (applicability, filters, the graph)
works on the canonical keys defined here.
"""

from __future__ import annotations

import re

REGULATORS: dict[str, str] = {
    "RBI": "Reserve Bank of India",
    "SEBI": "Securities and Exchange Board of India",
    "IRDAI": "Insurance Regulatory and Development Authority of India",
    "PFRDA": "Pension Fund Regulatory and Development Authority",
    "IFSCA": "International Financial Services Centres Authority",
    "MCA": "Ministry of Corporate Affairs",
    "FIU-IND": "Financial Intelligence Unit - India",
    "CERT-In": "Indian Computer Emergency Response Team",
    "MeitY": "Ministry of Electronics and Information Technology",
}

# Instruments from these bind every organisation unless they name specific entity types
# (the DPDP Act and CERT-In directions apply regardless of financial-sector licence).
UNIVERSAL_REGULATORS = {"MeitY", "CERT-In"}

# key -> (label, primary regulator, aliases matched case-insensitively as whole words)
ENTITY_CLASSES: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "commercial_bank": (
        "Commercial bank",
        "RBI",
        (
            "commercial bank",
            "commercial banks",
            "scheduled commercial bank",
            "scheduled commercial banks",
            "scbs",
            "banks",
            "bank",
            "banking company",
            "banking companies",
        ),
    ),
    "small_finance_bank": (
        "Small finance bank",
        "RBI",
        ("small finance bank", "small finance banks", "sfb", "sfbs"),
    ),
    "payments_bank": ("Payments bank", "RBI", ("payments bank", "payments banks")),
    "cooperative_bank": (
        "Co-operative bank",
        "RBI",
        (
            "co-operative bank",
            "co-operative banks",
            "cooperative bank",
            "cooperative banks",
            "urban co-operative banks",
            "ucbs",
            "ucb",
        ),
    ),
    "nbfc": (
        "NBFC",
        "RBI",
        (
            "nbfc",
            "nbfcs",
            "non-banking financial company",
            "non-banking financial companies",
            "non banking financial companies",
            "nbfc-icc",
            "nbfc-icc",
            "investment and credit company",
        ),
    ),
    "nbfc_mfi": (
        "NBFC-MFI",
        "RBI",
        (
            "nbfc-mfi",
            "nbfc-mfis",
            "microfinance institution",
            "microfinance institutions",
            "microfinance lenders",
            "mfis",
        ),
    ),
    "hfc": (
        "Housing finance company",
        "RBI",
        ("housing finance company", "housing finance companies", "hfc", "hfcs"),
    ),
    "payment_aggregator": (
        "Payment aggregator",
        "RBI",
        (
            "payment aggregator",
            "payment aggregators",
            "payment gateway",
            "payment gateways",
            "pa",
            "pas",
            "pa-pg",
        ),
    ),
    "ppi_issuer": (
        "PPI issuer",
        "RBI",
        (
            "ppi issuer",
            "ppi issuers",
            "prepaid payment instrument issuers",
            "prepaid payment instruments",
        ),
    ),
    "arc": (
        "Asset reconstruction company",
        "RBI",
        ("asset reconstruction company", "asset reconstruction companies", "arc", "arcs"),
    ),
    "aif": (
        "Alternative investment fund",
        "SEBI",
        ("alternative investment fund", "alternative investment funds", "aif", "aifs"),
    ),
    "mutual_fund": (
        "Mutual fund / AMC",
        "SEBI",
        (
            "mutual fund",
            "mutual funds",
            "asset management company",
            "asset management companies",
            "amc",
            "amcs",
        ),
    ),
    "stock_broker": (
        "Stock broker",
        "SEBI",
        (
            "stock broker",
            "stock brokers",
            "stockbroker",
            "stockbrokers",
            "trading member",
            "trading members",
        ),
    ),
    "investment_adviser": (
        "Investment adviser",
        "SEBI",
        (
            "investment adviser",
            "investment advisers",
            "investment advisor",
            "investment advisors",
            "research analyst",
            "research analysts",
        ),
    ),
    "portfolio_manager": (
        "Portfolio manager",
        "SEBI",
        ("portfolio manager", "portfolio managers", "pms"),
    ),
    "depository_participant": (
        "Depository participant",
        "SEBI",
        ("depository participant", "depository participants", "dp", "dps"),
    ),
    "listed_company": (
        "Listed entity",
        "SEBI",
        ("listed entity", "listed entities", "listed company", "listed companies"),
    ),
    "insurer": (
        "Insurer",
        "IRDAI",
        (
            "insurer",
            "insurers",
            "insurance company",
            "insurance companies",
            "life insurers",
            "general insurers",
        ),
    ),
    "insurance_intermediary": (
        "Insurance intermediary",
        "IRDAI",
        (
            "insurance intermediary",
            "insurance intermediaries",
            "insurance broker",
            "insurance brokers",
            "corporate agent",
            "corporate agents",
        ),
    ),
}

TOPICS: dict[str, tuple[str, tuple[str, ...]]] = {
    "kyc": (
        "KYC & customer due diligence",
        (
            "kyc",
            "know your customer",
            "customer due diligence",
            "cdd",
            "re-kyc",
            "periodic updation",
            "beneficial owner",
        ),
    ),
    "aml": (
        "AML / CFT",
        (
            "anti-money laundering",
            "aml",
            "pmla",
            "suspicious transaction",
            "str",
            "cft",
            "terrorist financing",
        ),
    ),
    "cyber_security": (
        "Cyber security",
        (
            "cyber",
            "cyber security",
            "cybersecurity",
            "information security",
            "incident",
            "cert-in",
            "vulnerability",
            "soc",
        ),
    ),
    "it_governance": (
        "IT governance",
        (
            "it governance",
            "information technology",
            "it outsourcing",
            "business continuity",
            "disaster recovery",
        ),
    ),
    "outsourcing": ("Outsourcing", ("outsourcing", "service provider", "third party")),
    "digital_lending": (
        "Digital lending",
        (
            "digital lending",
            "lending service provider",
            "lsp",
            "key fact statement",
            "kfs",
            "cooling-off",
            "digital loans",
        ),
    ),
    "fair_practices": (
        "Fair practices",
        (
            "fair practices",
            "fair practice code",
            "recovery agents",
            "collection practices",
            "harassment",
        ),
    ),
    "grievance_redressal": (
        "Grievance redressal",
        ("grievance", "complaint", "ombudsman", "nodal officer", "redressal"),
    ),
    "interest_rate": (
        "Interest rates & pricing",
        (
            "interest rate",
            "pricing of credit",
            "penal charges",
            "penal interest",
            "annual percentage rate",
            "apr",
        ),
    ),
    "capital_adequacy": (
        "Capital adequacy",
        ("capital adequacy", "crar", "tier 1", "risk weight", "net owned fund"),
    ),
    "liquidity": ("Liquidity risk", ("liquidity", "lcr", "alm", "asset liability")),
    "governance": (
        "Board & governance",
        (
            "board of directors",
            "board-approved",
            "board approved",
            "audit committee",
            "chief compliance officer",
            "cco",
            "governance",
        ),
    ),
    "regulatory_reporting": (
        "Regulatory reporting",
        ("return", "returns", "report to the", "submit", "furnish", "cims", "xbrl"),
    ),
    "disclosure": ("Disclosure", ("disclose", "disclosure", "display", "publish on")),
    "fraud_risk": ("Fraud risk", ("fraud", "red flag", "early warning signal")),
    "data_privacy": (
        "Data privacy",
        ("personal data", "privacy", "consent", "dpdp", "data localisation", "data storage"),
    ),
    "customer_protection": (
        "Customer protection",
        ("customer protection", "unauthorised transaction", "customer liability", "mis-selling"),
    ),
}

_WORD = re.compile(r"[^a-z0-9]+")


def slug(value: str) -> str:
    return _WORD.sub("_", value.strip().lower()).strip("_")


def _alias_index() -> dict[str, str]:
    index: dict[str, str] = {}
    for key, (label, _reg, aliases) in ENTITY_CLASSES.items():
        for alias in (*aliases, label, key):
            index[slug(alias)] = key
    return index


_ENTITY_ALIAS = _alias_index()
_TOPIC_ALIAS = {
    slug(a): key for key, (label, aliases) in TOPICS.items() for a in (*aliases, label, key)
}


def canonical_entity_class(value: str) -> str | None:
    return _ENTITY_ALIAS.get(slug(value))


def canonical_entity_classes(values: list[str]) -> list[str]:
    out: list[str] = []
    for v in values:
        key = canonical_entity_class(v)
        if key and key not in out:
            out.append(key)
    return out


def canonical_topic(value: str) -> str:
    """Known topics map to their key; unknown ones are kept as a slug."""
    s = slug(value)
    return _TOPIC_ALIAS.get(s, s)


def canonical_topics(values: list[str]) -> list[str]:
    out: list[str] = []
    for v in values:
        key = canonical_topic(v)
        if key and key not in out:
            out.append(key)
    return out


def canonical_regulator(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().upper().replace("_", "-")
    for key, name in REGULATORS.items():
        if v == key.upper() or v == name.upper():
            return key
    return None


def regulators_for(entity_classes: list[str]) -> list[str]:
    regs: list[str] = []
    for ec in entity_classes:
        meta = ENTITY_CLASSES.get(ec)
        if meta and meta[1] not in regs:
            regs.append(meta[1])
    return regs


def _alias_pattern(aliases: tuple[str, ...]) -> re.Pattern[str]:
    alts = sorted({re.escape(a) for a in aliases}, key=len, reverse=True)
    return re.compile(r"(?<![a-z0-9])(" + "|".join(alts) + r")(?![a-z0-9])", re.IGNORECASE)


# Aliases that are fine for normalising a model's output ("banks" -> commercial_bank) but
# too ambiguous to detect in free text ("Reserve Bank", "PA" as an abbreviation, ...).
_NOT_DETECTABLE = {
    "bank",
    "banks",
    "aifs",
    "aif",
    "mfis",
    "amcs",
    "amc",
    "pms",
    "pas",
    "pa",
    "dp",
    "dps",
    "arc",
    "arcs",
    "hfc",
    "hfcs",
    "sfb",
    "sfbs",
    "ucb",
    "ucbs",
    "scbs",
    "nbfc-icc",
}
ENTITY_PATTERNS = {
    key: _alias_pattern(
        tuple(a for a in aliases if len(a) > 3 and a not in _NOT_DETECTABLE) or (label.lower(),)
    )
    for key, (label, _r, aliases) in ENTITY_CLASSES.items()
}
TOPIC_PATTERNS = {
    key: _alias_pattern(tuple(a for a in aliases if len(a) > 3) or aliases)
    for key, (_l, aliases) in TOPICS.items()
}


def detect_entity_classes(text: str) -> list[str]:
    found = [key for key, pat in ENTITY_PATTERNS.items() if pat.search(text)]
    # "banks" matches inside "small finance banks" etc.; keep the generic class only
    # when it occurs outside a more specific phrase.
    if "commercial_bank" in found and len(found) > 1:
        stripped = text
        for key in ("small_finance_bank", "payments_bank", "cooperative_bank"):
            stripped = ENTITY_PATTERNS[key].sub(" ", stripped)
        if not ENTITY_PATTERNS["commercial_bank"].search(stripped):
            found.remove("commercial_bank")
    if "nbfc_mfi" in found and "nbfc" in found:
        stripped = ENTITY_PATTERNS["nbfc_mfi"].sub(" ", text)
        if not ENTITY_PATTERNS["nbfc"].search(stripped):
            found.remove("nbfc")
    return found


def detect_topics(text: str, limit: int = 4) -> list[str]:
    scored = []
    for key, pat in TOPIC_PATTERNS.items():
        n = len(pat.findall(text))
        if n:
            scored.append((n, key))
    scored.sort(reverse=True)
    return [k for _n, k in scored[:limit]]


# --------------------------------------------------------------------------- SBR layers

# RBI's scale-based regulation for NBFCs, in ascending order of regulatory intensity.
SBR_LAYERS = ["base", "middle", "upper", "top"]
SBR_LABELS = {
    "base": "Base Layer",
    "middle": "Middle Layer",
    "upper": "Upper Layer",
    "top": "Top Layer",
}
_LAYER = r"(base|middle|upper|top)"
_LAYER_PHRASE = re.compile(
    r"\b"
    + _LAYER
    + r"[- ]layer(?:s)?\b(\s+and\s+above|\s+(?:and|or)\s+(?:the\s+)?"
    + _LAYER
    + r"[- ]layers?)?",
    re.IGNORECASE,
)
_LAYER_CODE = re.compile(r"\bNBFC[- ](BL|ML|UL|TL)\b(\s+and\s+above)?", re.IGNORECASE)
_CODE_TO_LAYER = {"bl": "base", "ml": "middle", "ul": "upper", "tl": "top"}


def _and_above(layer: str) -> list[str]:
    return SBR_LAYERS[SBR_LAYERS.index(layer) :]


def detect_layers(text: str) -> list[str]:
    """SBR layers a sentence is scoped to: "Middle Layer and above" -> middle, upper, top."""
    found: list[str] = []

    def add(layers: list[str]) -> None:
        for layer in layers:
            if layer not in found:
                found.append(layer)

    for m in _LAYER_PHRASE.finditer(text):
        layer = m.group(1).lower()
        tail = (m.group(2) or "").lower()
        if "above" in tail:
            add(_and_above(layer))
        else:
            add([layer])
            if m.group(3):
                add([m.group(3).lower()])
    for m in _LAYER_CODE.finditer(text):
        layer = _CODE_TO_LAYER[m.group(1).lower()]
        add(_and_above(layer) if m.group(2) else [layer])
    return sorted(found, key=SBR_LAYERS.index)


def canonical_layers(values: list[str]) -> list[str]:
    out = []
    for v in values:
        key = v.strip().lower().replace("layer", "").replace("nbfc-", "").strip(" -_")
        key = _CODE_TO_LAYER.get(key, key)
        if key in SBR_LAYERS and key not in out:
            out.append(key)
    return sorted(out, key=SBR_LAYERS.index)


NBFC_CLASSES = {"nbfc", "nbfc_mfi", "hfc"}
