# 04 — Uncertainty clustering & minimal refinement

## Problem
The spec caps refinement at 2–3 questions per close. We need to pick the questions that maximally reduce the monthly CO₂e uncertainty. More than three and users tune out; fewer and we under-refine.

## Key facts
- **Information gain / expected variance reduction** is the right framework: for each candidate question, estimate how much the high/low range of the monthly total shrinks if the question is answered. Pick the top-k by expected reduction.
- In practice the dominant factor is **absolute spend × classifier uncertainty** — it's a 90% approximation of true information gain and avoids expensive hypothetical recomputes.
- **Materiality threshold**: if a cluster's worst-case contribution (spend × factor_high − spend × factor_low) is below some threshold (e.g. 5% of monthly point estimate), don't ask — accept the range.
- **Clustering level**: merchant-normalized name is the right grain. Grouping by category is too coarse (a question can't target "travel as a whole"); grouping by tx is too fine (dozens of small Amazon txs → one question about "Amazon").
- **Active learning / pool-based sampling**: well-studied. Techniques like Expected Model Change (EMC) work but for 3 questions the simpler heuristic is fine.

## Design choices
Algorithm in `lib/agent/close.ts` CLUSTER_UNCERTAINTY step:
1. Group current month's txs by `merchantNorm`.
2. For each group compute:
   - `totalSpendEur`
   - `avgClassifierConfidence`
   - Σ of per-tx half-ranges (`(high − low) / 2`)
   - `impactScore = rangeHalfSum × (1 − avgClassifierConfidence)`
3. Filter out low-materiality groups: `totalSpendEur < 300 EUR` or `avgClassifierConfidence > 0.85`.
4. Sort by impactScore descending; take top 3.

Question generation (Sonnet call, or mock):
- One question per cluster.
- 2–5 multiple-choice options per question, each mapping to a valid `(category, subCategory)` pair.
- Prompt constrains format with Zod schema.

## What the agent does NOT do
- Ask open-ended questions (hard to parse, hard to route).
- Re-ask about merchants that already have a refinement-sourced cache entry — those are locked in.
- Request receipts as the primary refinement path. Optional invoice upload is stubbed but not default.

## After answers
- Reclassify every tx in the affected cluster.
- Overwrite `merchant_category_cache` with `confidence: 0.95, source: refinement`.
- Recompute estimates for the entire month (cheap since factor lookup is just dict access).
- Roll up, update `close_runs.finalCo2eKg` and `finalConfidence`.
- Typical lift per answered question: +5 to +10 confidence points at the monthly level, depending on how uncertainty-weighted the cluster was.

## Decisions for this build
- Cluster by merchantNorm; rank by `spend × (1 − confidence)`.
- Cap at 3 questions; materiality threshold ≥ €300 spend and ≤ 0.85 avg confidence.
- Multiple-choice only; no free-text; no receipts by default.
- Cache user answers forever; future months don't re-ask about the same merchant.
