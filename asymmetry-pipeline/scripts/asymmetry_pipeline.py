#!/usr/bin/env python3
"""Deterministic asymmetry pipeline for industry GPT outputs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Sequence, Tuple


SECTION_ALIASES = {
    "pain": "pain",
    "pains": "pain",
    "problems": "pain",
    "challenges": "pain",
    "inefficiency": "inefficiency",
    "inefficiencies": "inefficiency",
    "waste": "inefficiency",
    "constraints": "constraint",
    "constraint": "constraint",
    "limitations": "constraint",
    "unmet demand": "unmet_demand",
    "demand": "unmet_demand",
    "customer demand": "unmet_demand",
    "market demand": "unmet_demand",
}


CATEGORY_KEYWORDS = {
    "pain": {
        "pain", "problem", "challenge", "friction", "issue", "bottleneck",
        "delay", "slow", "churn", "complaint", "error", "failure", "burden",
        "costly", "expensive", "manual", "rework", "backlog",
    },
    "inefficiency": {
        "inefficiency", "inefficient", "waste", "duplicate", "duplicative",
        "fragmented", "silo", "silos", "spreadsheet", "manual", "re-enter",
        "reenter", "rework", "redundant", "handoff", "underutilized",
        "idle", "low utilization",
    },
    "constraint": {
        "constraint", "limited", "limit", "shortage", "compliance",
        "regulatory", "regulation", "budget", "capacity", "legacy",
        "dependency", "procurement", "approval", "approvals", "labor",
        "capital", "vendor",
    },
    "unmet_demand": {
        "unmet", "demand", "want", "wants", "need", "needs", "requested",
        "waitlist", "backlog", "underserved", "gap", "lack", "shortage",
        "willing to pay", "faster", "real-time", "automation",
    },
}


ALL_KEYWORDS = sorted({word for words in CATEGORY_KEYWORDS.values() for word in words}, key=len, reverse=True)


STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "into", "is", "it", "its", "of", "on", "or", "that",
    "the", "their", "to", "with", "when", "while", "across", "causing",
    "make", "makes", "using", "use", "uses", "teams", "staff", "customers",
    "customer", "want", "wants", "need", "needs",
}


PATTERN_RULES = [
    {
        "key": "manual_workflow_rework",
        "pattern": "Manual workflow and rework burden",
        "tokens": {"manual", "spreadsheet", "spreadsheets", "rework", "re-enter", "reenter", "handoff", "calls", "approval", "approvals"},
        "opportunity": "Workflow Automation Layer",
        "description": "Automate recurring manual work and exception routing for {industries}.",
    },
    {
        "key": "fragmented_systems_data",
        "pattern": "Fragmented systems and data silos",
        "tokens": {"fragmented", "silo", "silos", "disconnected", "portal", "portals", "systems", "integration", "data"},
        "opportunity": "Cross-System Data Unification Layer",
        "description": "Unify fragmented operational data and expose a single action layer for {industries}.",
    },
    {
        "key": "capacity_shortage",
        "pattern": "Demand exceeds operational capacity",
        "tokens": {"shortage", "capacity", "backlog", "waitlist", "delayed", "delays", "bottleneck", "limited", "underutilized"},
        "opportunity": "Capacity Orchestration Marketplace",
        "description": "Match constrained supply, overloaded work queues, and unmet demand across {industries}.",
    },
    {
        "key": "compliance_drag",
        "pattern": "Compliance and regulatory drag",
        "tokens": {"compliance", "regulatory", "regulation", "audit", "reviews", "review", "approval", "approvals"},
        "opportunity": "Compliance Evidence Automation",
        "description": "Automate evidence collection, review workflows, and audit-ready records for {industries}.",
    },
    {
        "key": "cost_margin_pressure",
        "pattern": "Cost pressure and margin leakage",
        "tokens": {"cost", "costly", "expensive", "margin", "pricing", "waste", "leakage", "budget"},
        "opportunity": "Margin Leakage Intelligence",
        "description": "Detect avoidable cost, wasted effort, and margin leakage in recurring operations for {industries}.",
    },
    {
        "key": "labor_constraint",
        "pattern": "Labor capacity constraints",
        "tokens": {"labor", "staffing", "hiring", "driver", "drivers", "shortage", "operator", "operators"},
        "opportunity": "Labor Leverage Operating System",
        "description": "Increase throughput per operator by automating repetitive coordination work for {industries}.",
    },
    {
        "key": "legacy_tooling",
        "pattern": "Legacy tooling constraints",
        "tokens": {"legacy", "old", "outdated", "procurement", "vendor", "dependency", "tooling"},
        "opportunity": "Legacy Modernization Adapter",
        "description": "Wrap legacy systems with a modern workflow and data-access layer for {industries}.",
    },
    {
        "key": "quality_reliability",
        "pattern": "Quality and reliability breakdowns",
        "tokens": {"error", "errors", "failure", "failures", "quality", "complaint", "complaints", "reliability"},
        "opportunity": "Quality Assurance Copilot",
        "description": "Prevent recurring errors and quality breakdowns with guided checks for {industries}.",
    },
    {
        "key": "customer_experience_friction",
        "pattern": "Customer experience friction",
        "tokens": {"churn", "complaint", "complaints", "scheduling", "appointment", "appointments", "delay", "delays", "faster"},
        "opportunity": "Customer Friction Triage System",
        "description": "Triage the recurring service failures that create delays, churn, and unmet demand in {industries}.",
    },
]


INTENSITY_MARKERS = {
    "acute", "backlog", "critical", "expensive", "high", "major", "severe",
    "shortage", "urgent", "waitlist", "willing to pay",
}


def asymmetry_pipeline(payload: Mapping[str, Any]) -> Dict[str, Any]:
    """Run the full stateless pipeline and return strict JSON-ready output."""
    industry_outputs = _validate_payload(payload)
    signals = _extract_signals(industry_outputs)
    patterns = _cluster_patterns(signals)
    opportunities = _synthesize_opportunities(patterns, signals)
    ranked_opportunities = _rank_opportunities(opportunities)
    top_feasibility_memos = _build_memos(ranked_opportunities[:3], opportunities)
    return {
        "signals": signals,
        "patterns": patterns,
        "opportunities": opportunities,
        "ranked_opportunities": ranked_opportunities,
        "top_feasibility_memos": top_feasibility_memos,
    }


def _validate_payload(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    if not isinstance(payload, Mapping):
        raise ValueError("payload must be a JSON object")
    raw_outputs = payload.get("industry_outputs")
    if not isinstance(raw_outputs, list):
        raise ValueError("payload.industry_outputs must be a list")

    validated: List[Dict[str, str]] = []
    for index, item in enumerate(raw_outputs):
        if not isinstance(item, Mapping):
            raise ValueError(f"industry_outputs[{index}] must be an object")
        industry = item.get("industry")
        content = item.get("content")
        if not isinstance(industry, str) or not industry.strip():
            raise ValueError(f"industry_outputs[{index}].industry must be a non-empty string")
        if not isinstance(content, str):
            raise ValueError(f"industry_outputs[{index}].content must be a string")
        validated.append({"industry": industry.strip(), "content": content})
    return validated


def _extract_signals(industry_outputs: Sequence[Mapping[str, str]]) -> List[Dict[str, Any]]:
    signals: List[Dict[str, Any]] = []
    seen = set()
    next_id = 1

    for item in industry_outputs:
        industry = item["industry"]
        for evidence, section in _candidate_units(item["content"]):
            categories = _matched_categories(evidence, section)
            if not categories:
                continue
            signal_text = _normalize_signal(evidence)
            if not signal_text:
                continue
            dedupe_key = (industry.casefold(), _dedupe_text(signal_text))
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            strength = _strength_score(evidence, categories, section)
            signals.append({
                "signal_id": f"sig_{next_id:03d}",
                "signal": signal_text,
                "industry": industry,
                "evidence": evidence,
                "strength_score": strength,
            })
            next_id += 1
    return signals


def _candidate_units(content: str) -> Iterable[Tuple[str, str | None]]:
    current_section: str | None = None
    for raw_line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        cleaned_line = _strip_bullet(raw_line)
        if not cleaned_line:
            continue
        heading = _section_heading(cleaned_line)
        if heading:
            current_section = heading
            remainder = _heading_remainder(cleaned_line)
            if remainder:
                for sentence in _split_sentences(remainder):
                    yield sentence, current_section
            continue
        for sentence in _split_sentences(cleaned_line):
            if _is_section_heading_only(sentence):
                heading = _section_heading(sentence)
                if heading:
                    current_section = heading
                continue
            yield sentence, current_section


def _strip_bullet(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^[-*+>]\s+", "", text)
    text = re.sub(r"^\(?\d+[\).:-]\s+", "", text)
    text = re.sub(r"^[A-Za-z][\).:-]\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _section_heading(text: str) -> str | None:
    lowered = text.strip().lower().strip(":")
    if lowered in SECTION_ALIASES:
        return SECTION_ALIASES[lowered]
    match = re.match(r"^([A-Za-z ]{3,30})\s*:\s*(.+)$", text)
    if match:
        label = match.group(1).strip().lower()
        return SECTION_ALIASES.get(label)
    return None


def _heading_remainder(text: str) -> str:
    match = re.match(r"^[A-Za-z ]{3,30}\s*:\s*(.+)$", text)
    return match.group(1).strip() if match else ""


def _is_section_heading_only(text: str) -> bool:
    lowered = text.strip().lower().strip(":")
    return lowered in SECTION_ALIASES


def _split_sentences(text: str) -> List[str]:
    pieces = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text.strip())
    return [piece.strip() for piece in pieces if _word_count(piece) >= 3]


def _matched_categories(evidence: str, section: str | None) -> List[str]:
    lowered = evidence.lower()
    categories = set()
    if section:
        categories.add(section)
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(_keyword_present(lowered, keyword) for keyword in keywords):
            categories.add(category)
    return sorted(categories)


def _keyword_present(lowered: str, keyword: str) -> bool:
    if " " in keyword or "-" in keyword:
        return keyword in lowered
    return re.search(rf"\b{re.escape(keyword)}\b", lowered) is not None


def _normalize_signal(evidence: str) -> str:
    text = re.sub(r"^[A-Za-z ]{3,30}\s*:\s*", "", evidence.strip())
    text = text.strip(" .;:-")
    text = re.sub(r"\s+", " ", text)
    text = text.lower()
    return _truncate_words(text, 180)


def _dedupe_text(text: str) -> str:
    text = re.sub(r"[^a-z0-9 ]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def _strength_score(evidence: str, categories: Sequence[str], section: str | None) -> int:
    lowered = evidence.lower()
    keyword_hits = sum(1 for keyword in ALL_KEYWORDS if _keyword_present(lowered, keyword))
    marker_hits = sum(1 for marker in INTENSITY_MARKERS if marker in lowered)
    numeric_hit = 1 if re.search(r"(\$|\d|%)", evidence) else 0
    section_hit = 1 if section else 0
    category_bonus = min(2, max(0, len(categories) - 1))
    score = 3 + min(3, keyword_hits) + min(2, marker_hits) + numeric_hit + section_hit + category_bonus
    return max(1, min(10, score))


def _cluster_patterns(signals: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    grouped: MutableMapping[str, List[Mapping[str, Any]]] = defaultdict(list)
    labels: Dict[str, str] = {}

    for signal in signals:
        key, label = _pattern_for_signal(signal)
        grouped[key].append(signal)
        labels[key] = label

    unsorted_patterns: List[Dict[str, Any]] = []
    for key, grouped_signals in grouped.items():
        industries = sorted({str(signal["industry"]) for signal in grouped_signals})
        frequency = len(grouped_signals)
        spread = len(industries)
        confidence = _confidence(grouped_signals, frequency, spread)
        unsorted_patterns.append({
            "_key": key,
            "pattern": labels[key],
            "industries": industries,
            "frequency": frequency,
            "cross_industry_spread": spread,
            "confidence": confidence,
            "supporting_signals": [str(signal["signal_id"]) for signal in grouped_signals],
        })

    unsorted_patterns.sort(
        key=lambda item: (
            -int(item["frequency"]),
            -int(item["cross_industry_spread"]),
            -float(item["confidence"]),
            str(item["pattern"]),
        )
    )

    patterns: List[Dict[str, Any]] = []
    for index, item in enumerate(unsorted_patterns, start=1):
        patterns.append({
            "pattern_id": f"pat_{index:03d}",
            "pattern": item["pattern"],
            "industries": item["industries"],
            "frequency": item["frequency"],
            "cross_industry_spread": item["cross_industry_spread"],
            "confidence": item["confidence"],
            "supporting_signals": item["supporting_signals"],
        })
    return patterns


def _pattern_for_signal(signal: Mapping[str, Any]) -> Tuple[str, str]:
    combined = f"{signal.get('signal', '')} {signal.get('evidence', '')}".lower()
    token_set = set(_tokens(combined))
    best_rule = None
    best_score = 0
    for rule in PATTERN_RULES:
        score = sum(1 for token in rule["tokens"] if token in combined or token in token_set)
        if score > best_score:
            best_rule = rule
            best_score = score
    if best_rule and best_score > 0:
        return str(best_rule["key"]), str(best_rule["pattern"])

    top_tokens = [token for token, _ in Counter(_tokens(combined)).most_common(4)]
    if not top_tokens:
        return "uncategorized_signal", "Uncategorized input-backed signal"
    key = "input_terms_" + "_".join(top_tokens[:3])
    label = "Input-backed pattern: " + " / ".join(top_tokens[:3])
    return key, label


def _confidence(grouped_signals: Sequence[Mapping[str, Any]], frequency: int, spread: int) -> float:
    avg_strength = sum(int(signal["strength_score"]) for signal in grouped_signals) / max(1, frequency)
    value = 0.35 + min(5, frequency) * 0.07 + min(4, spread) * 0.08 + (avg_strength / 10.0) * 0.22
    return round(min(0.99, value), 2)


def _synthesize_opportunities(
    patterns: Sequence[Mapping[str, Any]],
    signals: Sequence[Mapping[str, Any]],
) -> List[Dict[str, Any]]:
    signals_by_id = {str(signal["signal_id"]): signal for signal in signals}
    opportunities: List[Dict[str, Any]] = []

    for pattern in patterns:
        rule = _rule_for_pattern(str(pattern["pattern"]))
        industries = list(pattern["industries"])
        industry_text = _format_industries(industries)
        name = rule["opportunity"] if rule else _fallback_opportunity_name(str(pattern["pattern"]))
        description_template = rule["description"] if rule else "Create a focused product wedge around {pattern} for {industries}."
        description = description_template.format(pattern=str(pattern["pattern"]).lower(), industries=industry_text)
        supporting = [signals_by_id[signal_id] for signal_id in pattern["supporting_signals"] if signal_id in signals_by_id]
        scores = _score_opportunity(pattern, supporting)
        opportunity_index = (
            scores["demand"]
            * scores["asymmetry"]
            * scores["arbitrage"]
            * scores["optionality"]
            * scores["timing"]
        )
        opportunities.append({
            "name": name,
            "description": description,
            "underlying_pattern": pattern["pattern"],
            "industries_affected": industries,
            "supporting_signals": list(pattern["supporting_signals"]),
            "scores": scores,
            "opportunity_index": opportunity_index,
        })

    opportunities.sort(key=lambda item: (-int(item["opportunity_index"]), str(item["name"])))
    ranked_with_ids: List[Dict[str, Any]] = []
    for index, opportunity in enumerate(opportunities, start=1):
        ranked_with_ids.append({
            "opportunity_id": f"opp_{index:03d}",
            **opportunity,
        })
    return ranked_with_ids


def _rule_for_pattern(pattern: str) -> Mapping[str, str] | None:
    for rule in PATTERN_RULES:
        if rule["pattern"] == pattern:
            return rule
    return None


def _fallback_opportunity_name(pattern: str) -> str:
    cleaned = re.sub(r"^Input-backed pattern:\s*", "", pattern).strip()
    words = [word.capitalize() for word in re.split(r"[^A-Za-z0-9]+", cleaned) if word]
    if not words:
        return "Input-Backed Opportunity"
    return " ".join(words[:5]) + " Opportunity"


def _score_opportunity(pattern: Mapping[str, Any], supporting: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    combined = " ".join(f"{signal.get('signal', '')} {signal.get('evidence', '')}" for signal in supporting).lower()
    tokens = set(_tokens(combined))
    frequency = int(pattern["frequency"])
    spread = int(pattern["cross_industry_spread"])
    avg_strength = sum(int(signal["strength_score"]) for signal in supporting) / max(1, len(supporting))

    # ── demand ─────────────────────────────────────────────────────────────────
    demand = 3 + avg_strength * 0.35 + min(3, frequency) + min(2, spread - 1)
    demand += _any_bonus(tokens, combined, {"demand", "unmet", "waitlist", "backlog", "shortage", "wants", "needs", "faster"})

    # ── asymmetry ─────────────────────────────────────────────────────────────
    asymmetry = 4 + min(2, spread - 1) + _any_bonus(tokens, combined, {"manual", "spreadsheet", "fragmented", "legacy", "compliance", "disconnected"})
    asymmetry += 1 if frequency >= 3 else 0

    # ── arbitrage ─────────────────────────────────────────────────────────────
    arbitrage = 3 + _any_bonus(tokens, combined, {"manual", "spreadsheet", "waste", "duplicate", "rework", "costly", "fragmented"}, weight=2)
    arbitrage += min(2, spread)

    # ── optionality (5 real dimensions) ───────────────────────────────────────
    #
    #  Dimension 1 — CREATION OPTION (can a small team build the wedge?)
    #    high: mentions APIs, software, SaaS, automation, digital
    #    low:  mentions hardware, physical infrastructure, regulatory licensure
    creation_markers = {"api", "apis", "software", "saas", "platform", "automation", "automate", "digital", "tool", "portal", "portal", "dashboard", "integration", "connect", "connector", "webhook"}
    creation_low_markers = {"hardware", "physical", "regulatory", "licensure", "certification", "approval", "approvals"}
    has_creation = any(m in tokens for m in creation_markers)
    has_hard_constraint = any(m in tokens for m in creation_low_markers)
    creation_score = 5 + (3 if has_creation and not has_hard_constraint else 0) - (2 if has_hard_constraint else 0)
    creation_score = _clamp_score(creation_score)

    #  Dimension 2 — SALE OPTION (does ONE buyer have budget and authority?)
    #    high: mentions budget, procurement, enterprise, vendor, approved
    #    low:  consensus buying, multi-stakeholder, board approval
    sale_markers = {"budget", "procurement", "enterprise", "vendor", "approved", "contract", "purchasing", "CFO", "CTO", "VP", "director"}
    sale_consensus = {"board", "committee", "consensus", "multiple", "stakeholder", "alignment", "approval"}
    has_sale_signal = any(m in tokens for m in sale_markers)
    has_consensus = any(m in tokens for m in sale_consensus)
    sale_score = 5 + (2 if has_sale_signal else 0) - (2 if has_consensus else 0)
    sale_score = _clamp_score(sale_score)

    #  Dimension 3 — SCALE OPTION (does the wedge naturally expand within the org?)
    #    high: cross-department, multi-team, "entire org", "whole company", integrations across
    #    low:  single-team, single-department, point solution
    scale_markers = {"cross", "multi", "entire", "whole", "org", "organization", "department", "teams", "across", "global"}
    scale_narrow = {"single", "one", "point", "one-off"}
    has_scale_signal = any(m in tokens for m in scale_markers)
    has_narrow = any(m in tokens for m in scale_narrow)
    scale_score = 5 + (2 if has_scale_signal else 0) - (1 if has_narrow else 0)
    scale_score = _clamp_score(scale_score)

    #  Dimension 4 — PRICING OPTION (can it be sold at premium without sales org?)
    #    high: clear ROI, measurable, "reduce X by Y%", payback period, TCO
    #    low:  requires custom demos, proof-of-concept, long eval cycles
    pricing_markers = {"roi", "reduce", "saving", "savings", "cost", "percent", "%", "payback", "TCO", "measurable", "baseline", "benchmark"}
    pricing_complex = {"demo", "demos", "POC", "proof", "eval", "evaluation", "pilot", "trial", "custom"}
    has_pricing_signal = any(m in tokens for m in pricing_markers)
    has_complex = any(m in tokens for m in pricing_complex)
    pricing_score = 5 + (3 if has_pricing_signal else 0) - (2 if has_complex else 0)
    pricing_score = _clamp_score(pricing_score)

    #  Dimension 5 — REPEAT OPTION (does revenue recur naturally from the wedge?)
    #    high: subscription, recurring, annual, "per seat", "per user", usage-based
    #    low:  one-time license, perpetual, implementation-heavy
    repeat_markers = {"subscription", "recurring", "annual", "monthly", "per seat", "per user", "usage", "usage-based", "tier", "tiers"}
    repeat_once = {"one-time", "one time", "perpetual", "license", "implementation"}
    has_repeat_signal = any(m in tokens for m in repeat_markers)
    has_once = any(m in tokens for m in repeat_once)
    repeat_score = 5 + (3 if has_repeat_signal else 0) - (2 if has_once else 0)
    repeat_score = _clamp_score(repeat_score)

    # Composite optionality = geometric mean of 5 dims, weighted by importance
    opt_dims = [creation_score, sale_score, scale_score, pricing_score, repeat_score]
    weighted = (
        creation_score  * 1.5 +   # creation leverage is most important
        sale_score      * 1.2 +   # sale motion matters a lot
        scale_score     * 1.0 +
        pricing_score   * 1.0 +
        repeat_score    * 0.8     # recurring is nice but not mandatory
    )
    optionality = round(weighted / 5.5)

    # ── timing ────────────────────────────────────────────────────────────────
    timing = 4 + _any_bonus(tokens, combined, {"urgent", "shortage", "backlog", "compliance", "real-time", "delayed", "delays", "faster"}, weight=2)
    timing += 1 if avg_strength >= 7 else 0
    timing += 1 if spread >= 2 else 0

    return {
        "demand": _clamp_score(round(demand)),
        "asymmetry": _clamp_score(round(asymmetry)),
        "arbitrage": _clamp_score(round(arbitrage)),
        "optionality": _clamp_score(optionality),
        "timing": _clamp_score(round(timing)),
        # detailed breakdown for top-3 opportunities
        "optionality_dims": {
            "creation_option": creation_score,      # can a small team build it?
            "sale_option": sale_score,              # can one buyer self-serve or buy fast?
            "scale_option": scale_score,            # does it expand within the org?
            "pricing_option": pricing_score,       # clear ROI without custom demos?
            "repeat_option": repeat_score,          # recurring revenue from the wedge?
        },
    }


def _any_bonus(tokens: set[str], combined: str, markers: set[str], weight: int = 1) -> int:
    return weight if any(marker in tokens or marker in combined for marker in markers) else 0


def _clamp_score(value: int) -> int:
    return max(1, min(10, value))


def _rank_opportunities(opportunities: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "rank": index,
            "opportunity_id": str(opportunity["opportunity_id"]),
            "name": str(opportunity["name"]),
            "opportunity_index": int(opportunity["opportunity_index"]),
        }
        for index, opportunity in enumerate(opportunities, start=1)
    ]


def _build_memos(
    top_ranked: Sequence[Mapping[str, Any]],
    opportunities: Sequence[Mapping[str, Any]],
) -> List[Dict[str, Any]]:
    by_id = {str(opportunity["opportunity_id"]): opportunity for opportunity in opportunities}
    memos: List[Dict[str, Any]] = []

    for ranked in top_ranked:
        opportunity = by_id[str(ranked["opportunity_id"])]
        industries = list(opportunity["industries_affected"])
        industry_text = _format_industries(industries)
        pattern = str(opportunity["underlying_pattern"]).lower()
        memos.append({
            "opportunity_id": opportunity["opportunity_id"],
            "opportunity_name": opportunity["name"],
            "build_approach": [
                f"Start with a narrow workflow wedge for {industry_text}.",
                f"Anchor the product on the '{pattern}' pattern and only automate steps supported by input evidence.",
                "Ship intake, routing, exception handling, and reporting before expanding into adjacent workflows.",
            ],
            "defensibility": [
                "Workflow data captured from repeated resolutions.",
                "Integration depth with the operating systems and portals present in the buyer workflow.",
                f"Cross-industry benchmarks from {len(industries)} affected industry label(s).",
            ],
            "risks": [
                "Evidence may reflect analyst output rather than measured buyer behavior.",
                "Incumbent systems may copy the narrow workflow once demand is proven.",
                "Integration and data-quality variance may slow deployment across affected industries.",
            ],
            "execution_steps": [
                "Select the highest-frequency workflow from the supporting signals.",
                "Interview operators in the affected industries.",
                "Map the current inputs, approvals, handoffs, and exceptions.",
                "Build a minimal intake, routing, and resolution prototype.",
                "Measure cycle-time reduction against the manual baseline.",
            ],
            "evidence_basis": list(opportunity["supporting_signals"]),
        })
    return memos


def _tokens(text: str) -> List[str]:
    raw = re.findall(r"[a-z0-9][a-z0-9-]*", text.lower())
    return [_stem(token) for token in raw if token not in STOPWORDS and len(token) > 2]


def _stem(token: str) -> str:
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    for suffix in ("ing", "ed", "es", "s"):
        if token.endswith(suffix) and len(token) > len(suffix) + 3:
            return token[: -len(suffix)]
    return token


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+", text))


def _truncate_words(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    shortened = text[:max_chars].rsplit(" ", 1)[0].rstrip(" ,;:")
    return shortened + "..."


def _format_industries(industries: Sequence[str]) -> str:
    if not industries:
        return "the affected industries"
    if len(industries) == 1:
        return industries[0]
    if len(industries) == 2:
        return f"{industries[0]} and {industries[1]}"
    return ", ".join(industries[:-1]) + f", and {industries[-1]}"


def _read_payload(path: str | None) -> Mapping[str, Any]:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("provide JSON on stdin or pass --input")
    return json.loads(raw)


def _write_result(result: Mapping[str, Any], path: str | None, indent: int) -> None:
    text = json.dumps(result, ensure_ascii=True, indent=indent)
    if path:
        Path(path).write_text(text + "\n", encoding="utf-8")
    else:
        sys.stdout.write(text + "\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the deterministic asymmetry pipeline.")
    parser.add_argument("--input", help="Path to input JSON. Reads stdin when omitted.")
    parser.add_argument("--output", help="Path to output JSON. Writes stdout when omitted.")
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation spaces.")
    args = parser.parse_args(argv)

    try:
        payload = _read_payload(args.input)
        result = asymmetry_pipeline(payload)
        _write_result(result, args.output, args.indent)
    except Exception as exc:  # noqa: BLE001 - CLI should return a clean JSON error.
        sys.stderr.write(json.dumps({"error": str(exc)}, ensure_ascii=True) + "\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
