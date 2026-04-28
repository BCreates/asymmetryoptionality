---
name: asymmetry-pipeline
description: Deterministic multi-stage pipeline that transforms variable-length arrays of industry GPT outputs into a structured asymmetry decision artifact. Use when Codex, Hermes, OpenClaw, or another agent needs to extract pains, inefficiencies, constraints, and unmet demand from raw industry analyses; cluster cross-industry patterns; synthesize and score asymmetrical opportunities; rank them; and emit top feasibility memos as strict machine-readable JSON.
---

# Asymmetry Pipeline

## Overview

Use this skill to convert multiple raw industry GPT outputs into one stateless, structured decision artifact. Always preserve the exact industry labels provided in input and ensure every downstream pattern, opportunity, ranking, and memo traces back to extracted input evidence.

## Callable Interface

Prefer the bundled deterministic runner:

```bash
python scripts/asymmetry_pipeline.py --input input.json --output output.json
```

Or call the Python function directly:

```python
from asymmetry_pipeline import asymmetry_pipeline

result = asymmetry_pipeline({
    "industry_outputs": [
        {"industry": "Healthcare", "content": "raw GPT output text"}
    ]
})
```

The function is stateless:

```python
def asymmetry_pipeline(payload: dict) -> dict
```

For an agent-callable HTTP endpoint, use the bundled Apps Script API layer:

- `assets/apps-script-api/Code.gs`: standalone Google Apps Script Web App implementation with `doPost(e)`, `runAsymmetryPipeline(industry_outputs)`, and `storeSignals(signals)`.
- `references/http_endpoint.md`: request/response contract, persistence behavior, and deployment notes.

Use this endpoint path when Hermes, OpenClaw, or another external agent needs to call the pipeline over HTTP instead of running local Python.

Input:

```json
{
  "industry_outputs": [
    {
      "industry": "string",
      "content": "raw GPT output text"
    }
  ]
}
```

Output top-level keys, in order:

```json
{
  "signals": [],
  "patterns": [],
  "opportunities": [],
  "ranked_opportunities": [],
  "top_feasibility_memos": []
}
```

Do not emit narrative prose outside the JSON object.

## Mandatory Pipeline

Run these stages in order.

1. Signal extraction
   - Parse every `industry_outputs[]` item.
   - Extract pains, inefficiencies, constraints, and unmet demand only from input text.
   - Normalize into signal objects with `signal_id`, `signal`, `industry`, `evidence`, and `strength_score`.
   - Deduplicate identical normalized signals within the same industry.

2. Pattern clustering
   - Group signals across industries by deterministic pattern rules.
   - Emit `pattern_id`, `pattern`, `industries`, `frequency`, `cross_industry_spread`, `confidence`, and `supporting_signals`.
   - `industries` must contain only labels from the input.
   - `supporting_signals` must reference extracted `signal_id` values.

3. Opportunity synthesis
   - Convert each pattern into one opportunity.
   - Include `opportunity_id`, `name`, `description`, `underlying_pattern`, `industries_affected`, `supporting_signals`, `scores`, and `opportunity_index`.
   - `industries_affected` must be copied from the pattern's `industries`.

4. Asymmetry scoring
   - Score each opportunity from 1 to 10 on `demand`, `asymmetry`, `arbitrage`, `optionality`, and `timing`.
   - `optionality` is a composite of 5 founder-specific dimensions (see below).
   - Compute `opportunity_index = demand * asymmetry * arbitrage * optionality * timing`.

   **Optionality dimensions** — the composite `optionality` score is a weighted average of:
   - `creation_option` (weight 1.5): Can a small team build the wedge? Signals: APIs, software, SaaS, platform, automation (+3). Hard constraints: hardware, physical, regulatory licensure (-2).
   - `sale_option` (weight 1.2): Does ONE buyer have budget and authority? Signals: budget, procurement, enterprise, vendor (+2). Consensus blockers: board, committee, multi-stakeholder (-2).
   - `scale_option` (weight 1.0): Does the wedge expand within the org? Signals: cross-department, multi-team, entire org (+2). Single-team/narrow: (-1).
   - `pricing_option` (weight 1.0): Clear ROI without custom demos? Signals: ROI, reduce costs %, savings, measurable (+3). Complex eval: demos, POC, pilot (-2).
   - `repeat_option` (weight 0.8): Recurring revenue from the wedge? Signals: subscription, recurring, per seat (+3). One-time: perpetual, license (-2).
   - Top 3 opportunities include `optionality_dims` for full transparency.

5. Ranking
   - Sort opportunities by `opportunity_index` descending.
   - Break ties by opportunity name ascending.
   - Emit `ranked_opportunities` as rank summaries referencing `opportunity_id`.

6. Feasibility memos
   - Generate memos for the top 3 ranked opportunities only.
   - Each memo must include `opportunity_id`, `opportunity_name`, `build_approach`, `defensibility`, `risks`, `execution_steps`, and `evidence_basis`.
   - `execution_steps` must contain exactly the first 5 actions.
   - `evidence_basis` must reference the same signal IDs used by the opportunity.

## Determinism Rules

- Use only the current payload; never rely on prior chat, memory, or unstated context.
- Do not create industries not present in `industry_outputs`.
- Do not invent evidence. Every signal evidence string must be copied from input content.
- Keep scores as integers and confidence as a 0.00-1.00 number.
- Keep JSON key order stable.
- If no qualifying text is found, return the strict top-level schema with empty arrays.

## Example Invocation

```bash
python scripts/asymmetry_pipeline.py --input mock_input.json
```

Mock input:

```json
{
  "industry_outputs": [
    {
      "industry": "Healthcare",
      "content": "Pains: Prior authorization is slow and manual, causing appointment delays. Inefficiency: Staff re-enter patient data across disconnected systems. Constraint: Compliance reviews make vendor changes slow. Unmet demand: Clinics want faster scheduling automation."
    },
    {
      "industry": "Logistics",
      "content": "Pain: Dispatch teams rely on spreadsheets and manual calls when shipments are delayed. Inefficiency: Data is fragmented across carrier portals. Constraint: Driver shortages limit capacity. Unmet demand: Shippers want real-time exception handling."
    }
  ]
}
```

Example output excerpt:

```json
{
  "signals": [
    {
      "signal_id": "sig_001",
      "signal": "prior authorization is slow and manual, causing appointment delays",
      "industry": "Healthcare",
      "evidence": "Prior authorization is slow and manual, causing appointment delays.",
      "strength_score": 7
    }
  ],
  "patterns": [
    {
      "pattern_id": "pat_001",
      "pattern": "Fragmented systems and data silos",
      "industries": ["Healthcare", "Logistics"],
      "frequency": 2,
      "cross_industry_spread": 2,
      "confidence": 0.8,
      "supporting_signals": ["sig_002", "sig_006"]
    }
  ],
  "opportunities": [
    {
      "opportunity_id": "opp_001",
      "name": "Cross-System Data Unification Layer",
      "description": "Unify fragmented operational data and expose a single action layer for Healthcare and Logistics.",
      "underlying_pattern": "Fragmented systems and data silos",
      "industries_affected": ["Healthcare", "Logistics"],
      "supporting_signals": ["sig_002", "sig_006"],
      "scores": {
        "demand": 8,
        "asymmetry": 6,
        "arbitrage": 7,
        "optionality": 8,
        "timing": 6
      },
      "opportunity_index": 16128
    }
  ],
  "ranked_opportunities": [
    {
      "rank": 1,
      "opportunity_id": "opp_001",
      "name": "Cross-System Data Unification Layer",
      "opportunity_index": 16128
    }
  ],
  "top_feasibility_memos": [
    {
      "opportunity_id": "opp_001",
      "opportunity_name": "Cross-System Data Unification Layer",
      "build_approach": [
        "Start with a narrow workflow wedge for Healthcare and Logistics."
      ],
      "defensibility": [
        "Workflow data captured from repeated resolutions."
      ],
      "risks": [
        "Evidence may reflect analyst output rather than measured buyer behavior."
      ],
      "execution_steps": [
        "Select the highest-frequency workflow from the supporting signals.",
        "Interview operators in the affected industries.",
        "Map the current inputs, approvals, handoffs, and exceptions.",
        "Build a minimal intake, routing, and resolution prototype.",
        "Measure cycle-time reduction against the manual baseline."
      ],
      "evidence_basis": ["sig_002", "sig_006"]
    }
  ]
}
```
