# 13 — Context scaling patterns for the 7-agent DAG

> Synthesized from `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\*`.
> Sources cited inline. Applies the patterns to the Carbon Autopilot 7-agent DAG (`docs/agents/00-overview.md`).

## Problem

A Carbon Autopilot close can touch a company's full monthly transaction set. A seeded demo is ~60 rows, but a realistic production month is 500–10,000 transactions. Naively passing the full set to every agent would spend a Sonnet 200k-token window on raw data and leave no room for reasoning.

## Token budget per agent

Per `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\context_window_management.md`, a JSON transaction row serializes to ~80–120 tokens:

| Dataset | Tokens (raw JSON) | % of 200k window |
|---|---|---|
| 60 rows (demo seed) | ~6,000 | 3% |
| 500 rows | ~50,000 | 25% |
| 2,000 rows | ~200,000 | 100% (breaks) |
| 10,000 rows | ~1,000,000 | exceeds any current Claude model |

So: **no agent ever sees raw rows**. Summarize first, fetch on demand.

## Per-agent context budget

| Agent | Expected input size | Chunking | Retrieval | Window headroom (Sonnet 200k) |
|---|---|---|---|---|
| 01 Spend-Baseline | Full dataset → summarize only | None — deterministic aggregation | `getTransactionRows(filters)` tool for detail on demand | ≥ 90% (schema + top-K clusters only) |
| 02 Green Alternatives | Priority targets (≤20) + policy | Per-cluster | `findLowerCarbonAlternative` tool per cluster | ≥ 85% |
| 03 Cost Savings | Priority targets (≤20) + history summary | Per-cluster | `getHistoricalSpendByMerchant` per cluster | ≥ 85% |
| 04 Green Judge | Green Alt output (≤20 items) + policy | Batch-judge all items in one call | `getEmissionFactor` for spot-checks | ≥ 90% |
| 05 Cost Judge | Cost Savings output (≤20 items) + policy | Batch-judge all items in one call | `getSpendByCategory` for spot-checks | ≥ 90% |
| 06 Credit Strategy | Both judge outputs + baseline + jurisdiction table | Single call | `getCarbonCreditPrice`, `getCorporateTaxRate` | ≥ 80% |
| 07 Executive Report | All approved items + baseline | Single call | `generateCSRDExport` tool for compliance fields | ≥ 75% |

**Rule of thumb:** every agent's input fits in < 25% of a 200k Sonnet window, leaving 150k+ tokens for reasoning. If a real company run exceeds this, split by category (one DAG run per category) not by agent.

## Chunking strategy

Per `large_dataset_chunking_strategies.md`, two chunking modes apply:

1. **Cluster-based chunking.** The Baseline agent emits `priority_targets` as named clusters (e.g. `cluster_travel_flights_q2`). Every downstream agent operates at cluster granularity, not row granularity. This is the primary scaling lever — it decouples agent input size from dataset size.

2. **Schema + sample rows.** Where a cluster needs row-level context (e.g. to spot a duplicate-looking transaction), the agent receives: (a) schema, (b) 3-5 sample rows via `getTransactionRows({ cluster_id, limit: 5 })`. Never the whole cluster.

## Retrieval pattern

Per `RAG_and_retrieval_patterns.md`, RAG is **not** the right answer here. Carbon Autopilot's data is structured, relational, and smallish (< 10k rows/month). A tool-augmented agent with SQL-backed lookup functions beats vector search on precision, latency, and cost. The retrieval pattern is **tool call**, not **embedding search**.

Applied:
- `getTransactionRows(filters)` — SQL-backed; returns row batches by filter (cluster_id, category, merchant, date range).
- `getMerchantCluster(merchantName)` — returns aggregate stats for one merchant.
- `getHistoricalSpendByMerchant(merchant)` — returns last-N-month spend trend.
- `getEmissionFactor(categoryOrItem)` — returns factor + uncertainty from `lib/factors/index.ts`.

Every tool is bounded (returns ≤ 50 rows or one aggregate). Agents cannot unboundedly pull raw data.

## Scale tradeoffs

Per `scale_tradeoffs.md`, three knobs exist:

| Knob | Setting | Why |
|---|---|---|
| Model | Haiku for Baseline + cheap extraction, Sonnet for judgment agents | Haiku is 5× cheaper; judgment demands Sonnet |
| Prompt cache | ON for SYSTEM_PROMPT + baseline summary | System prompts are ~2–4k tokens each; caching cuts turn-2 cost by ~60% |
| Parallel dispatch | ON for {Green Alt ‖ Cost Savings} and {Green Judge ‖ Cost Judge} | Halves wall-clock time for the DAG |

## Applied to Carbon Autopilot — 5 concrete rules

1. **Never pass raw transaction rows to any agent.** The Baseline agent emits compressed `priority_targets` + summary stats. Every downstream agent operates at cluster granularity.
2. **Cap priority targets at 20 per run.** Top-20 by `spend × emissions × uncertainty`. If more exist, split the run by category.
3. **Prompt-cache the system prompt on every agent call.** Each agent's SYSTEM_PROMPT is ≥ 1,024 tokens and identical across calls — textbook cacheable. Wrap in `cache_control: { type: "ephemeral" }` in `lib/anthropic/client.ts::callWithSystemPrompt`.
4. **Bound every tool.** `getTransactionRows` returns ≤ 50 rows. `getHistoricalSpendByMerchant` returns ≤ 6 months. No unbounded fetches.
5. **Run Green Alt + Cost Savings and Green Judge + Cost Judge in parallel.** `Promise.all` at both fan-out points. Total wall-clock for the DAG ≈ max(Baseline, GreenAlt+Judge, CostSavings+Judge) + Credit + Report ≈ 5 sequential Sonnet calls on the critical path.

## Sources

- `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\context_window_management.md` — token budgets, prompt caching, compression techniques.
- `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\large_dataset_chunking_strategies.md` — cluster-based vs row-level chunking.
- `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\RAG_and_retrieval_patterns.md` — when NOT to use RAG; tool-augmented retrieval for structured data.
- `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\scale_tradeoffs.md` — model split, prompt caching, parallel dispatch.
