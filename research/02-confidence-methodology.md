# 02 — Confidence methodology

## Problem
Every emission estimate carries uncertainty. Users (and CSRD auditors) need a single confidence score per tx and per close to (a) know whether to trust the number and (b) drive the agent's refinement-question selection.

## Key facts
- **GHG Protocol Scope 3 Standard (Chapter 7)** classifies data quality across four dimensions: technological representativeness, temporal, geographic, completeness. Each gets a 1–5 score; factors are aggregated into an overall tier.
- **Tier 1 (primary activity data, supplier-specific)** is best; **Tier 4 (spend-based, generic)** is worst. We are mostly Tier 3–4.
- **Pedigree matrix** approach (Weidema): multiplicative uncertainty factors combine into a lognormal σ; overkill for a hackathon.
- Three inputs drive confidence in our context:
  1. **Classifier confidence** — how sure we are which category the merchant is in (0–1, produced by rules or LLM).
  2. **Factor uncertainty %** — from the factor table (±25–70%).
  3. **Factor tier** — how specific the factor is (1 = fully regional/sectoral, 3 = economy-wide mean).

## Design choices
Single-number score is informally:
```
confidence = (1 − factor.uncertaintyPct) · classifierConfidence · tierWeight
```
with `tierWeight ∈ {1.0, 0.9, 0.75}` for tiers 1/2/3. Clamp to [0, 1].

Ranges:
- Per-tx: `low = point · (1 − u)`, `high = point · (1 + u)` — symmetric around point, which slightly under-states upside tail vs. proper lognormal, but is easy to interpret and aligns with DEFRA guidance for mid-quality factors.
- Rollup across txs: **quadrature sum** assuming independent errors — `σ_total = √Σ σ_i²`. Realistic lower bound; correlated errors would widen this.
- Confidence rollup: spend-weighted mean of per-tx confidence. Big uncertain items dominate the score, which is what we want users to focus on.

## What the agent does with it
- **Cluster uncertainty**: `impactScore = spend · (1 − confidence)` per merchant cluster. Top-3 clusters get questions.
- **Refinement budget**: cap at 3 questions. Each question should target the single cluster whose worst-case tail dominates the current estimate's high end.
- **Post-refinement**: factor shifts to a more specific sub-category (e.g. `procurement.electronics` at 45% uncertainty instead of `other.generic` at 70%). Classifier confidence jumps to 0.95 since user confirmed. Combined, confidence usually lifts 15–25 pts per answered question.

## What it does NOT do
- No pedigree matrix; no full Monte Carlo. If a stakeholder wants it, we can swap in pedigree multipliers and keep the same range interface.
- No correlation modelling between factors; we acknowledge this is optimistic for the top-line range and note it in the CSRD report.

## Decisions for this build
- Single confidence score per tx; rolled up spend-weighted per close.
- Range via symmetric ± uncertainty %, quadrature summed for totals.
- Agent uses `spend × (1 − confidence)` as its refinement-priority metric.
- Every factor's uncertainty & source lives in the factor table and is audit-exportable.
