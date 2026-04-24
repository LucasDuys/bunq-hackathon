---
domain: baseline-agent
status: approved
created: 2026-04-24
complexity: medium
linked_repos: []
design: DESIGN.md
---

# Spend & Emissions Baseline Agent Spec

## Overview

The Baseline agent is the first node in the 7-agent DAG defined in `docs/agents/00-overview.md`. It consumes the org's bunq transactions for a month and produces a compact structured payload (`BaselineOutput` in `lib/agents/dag/types.ts`) that Green Alternatives + Cost Savings (parallel stage-2 agents) consume directly. It must be stable, deterministic, and runnable today without an Anthropic key — the LLM integration is an additive enhancement layered on top.

**Core design decision: hybrid authority split.** Deterministic code always computes aggregates, cluster formation, and priority-target scoring. The Anthropic LLM (when wired) contributes exactly three narrow outputs: (i) merchant-cluster disambiguation when the MCC code is unclear, (ii) a one-sentence `reason_for_priority_detail` per cluster, (iii) a `required_context_question` if schema/data is ambiguous. The LLM never overrides priority ordering.

**Scope boundary.** This spec ships only the Baseline agent + its `/api/baseline/run` route + tests against `fixtures/bunq-transactions.json`. Wiring into `lib/agent/close.ts` as a close-state replacement is a follow-on spec. The `runDag()` orchestrator in `lib/agents/dag/index.ts` already calls `spendBaseline.run()` first — no change needed there.

## Requirements

### R001: Canonical input via existing query layer

The Baseline agent reads transactions exclusively through `lib/queries.ts::getTransactionsForMonth(orgId, month)`. It does not read the fixture JSON directly, nor parse CSVs, nor bypass the DB. Seed data lands in the DB through the existing webhook/seed pipeline.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/spendBaseline.ts::run()` calls `getTransactionsForMonth(orgId, month)` to fetch rows — verified by grep.
- [ ] No direct `import … from "@/fixtures/bunq-transactions.json"` or CSV parsing in the baseline module.
- [ ] Running `scripts/seed.ts` loads `fixtures/bunq-transactions.json` into the `transactions` table so the baseline has data to read (extend the existing seed script if needed).
- [ ] When the month has zero transactions, `run()` returns a valid `BaselineOutput` with zeroed aggregates, empty `priority_targets`, and `required_context_question: null` — no throw.

### R002: Deterministic aggregation

Compute the baseline summary fields deterministically from the period's transactions + existing `lib/emissions/estimate.ts` + `lib/factors/index.ts`. No LLM involvement in this layer.

**Acceptance Criteria:**
- [ ] `baseline.total_spend_eur` = sum of `abs(amount)` across all period txs, in EUR.
- [ ] `baseline.estimated_total_tco2e` = `sum(estimateEmission(tx).pointKg) / 1000`.
- [ ] `baseline.baseline_confidence` = spend-weighted mean of per-tx confidence from `estimateEmission(tx).confidence`.
- [ ] `baseline.top_spend_categories` = top 5 categories by spend, each with `{category, spend_eur, share_pct}` where share_pct is integer percent of total spend.
- [ ] `baseline.top_emission_categories` = top 5 categories by tCO2e, each with `{category, tco2e, share_pct}`.
- [ ] All numeric fields pass through JSON round-trip without loss (no `Infinity`, no `NaN`).

### R003: Category-level cluster formation

Each distinct category present in the period becomes one cluster. `cluster_id = cluster_${category}` (lowercase, snake_case). Downstream agents drill into merchant-level detail themselves via a `getTransactionRows({cluster_id})` tool they'll call as needed — Baseline does not produce merchant-level rows.

**Acceptance Criteria:**
- [ ] Cluster list is computed from `SELECT DISTINCT category FROM transactions WHERE ...` for the period.
- [ ] Each cluster object contains at minimum: `cluster_id`, `category`, `annualized_spend_eur` (monthly × 12), `estimated_tco2e`, `transaction_count`, `avg_confidence`.
- [ ] `high_cost_high_carbon_clusters` = `cluster_id`s where BOTH `share_pct >= 10` in `top_spend_categories` AND `share_pct >= 10` in `top_emission_categories`.
- [ ] `uncertain_high_value_clusters` = `cluster_id`s where `avg_confidence < 0.6` AND cluster `annualized_spend_eur >= 1200` (€100/month).
- [ ] Cluster IDs are stable across runs for the same input (deterministic — no random ordering).

### R004: Priority target scoring with policy override

Score each cluster by `annualized_spend_eur × estimated_tco2e × (1 − avg_confidence)`. Any cluster whose category is policy-breaching (per `lib/policy/evaluate.ts`) is guaranteed inclusion regardless of score. Combined top-20 cap.

**Acceptance Criteria:**
- [ ] Base score computed as specified; clusters sorted descending by score.
- [ ] `priority_targets.length <= 20` always.
- [ ] Any cluster where `lib/policy/evaluate.ts` returns a breaching verdict for its category is present in `priority_targets`, even if its score rank would exclude it.
- [ ] If policy-breaching clusters exceed 20, score ordering within that subset determines which 20 survive (drop the lowest-scored policy breaches last).
- [ ] Each target has: `cluster_id`, `category`, `annualized_spend_eur`, `estimated_tco2e`, `reason_for_priority` (enum: `high_spend | high_emissions | high_uncertainty | policy_relevant`), `recommended_next_agent` (enum: `green_alternatives_agent | cost_savings_agent | both`).
- [ ] `reason_for_priority` = `policy_relevant` whenever the policy override triggered, otherwise the dominant signal (`high_emissions` if emissions share >= 20%, else `high_spend` if spend share >= 20%, else `high_uncertainty`).
- [ ] `recommended_next_agent` is derived from category: travel/food/fuel/energy → `green_alternatives_agent`; software/office/utility_telco/retail → `cost_savings_agent`; procurement/electronics/furniture/grocery → `both`. (Table in `lib/agents/dag/routing.ts`.)

### R005: Anthropic integration hooks (no key required today)

Structure the code so flipping `env.anthropicMock=0` and setting `ANTHROPIC_API_KEY` enables LLM enhancements *without* changing the public `run()` signature or breaking the deterministic baseline. The LLM is called for three narrow tasks only.

**Acceptance Criteria:**
- [ ] `run()` calls deterministic aggregation + scoring unconditionally; the result is the default return.
- [ ] When `env.anthropicMock === false` (set in `lib/env.ts`), an `enhanceWithLlm(baselineOutput)` function runs after the deterministic pass and fills: (i) `reason_for_priority_detail` (short sentence per target), (ii) merges any cluster-disambiguation suggestions, (iii) populates `required_context_question` if the schema looks ambiguous (e.g. >50% of txs have unknown category).
- [ ] When `env.anthropicMock === true`, `enhanceWithLlm` is not called; `reason_for_priority_detail` is filled from a static enum-keyed lookup table (`lib/agents/dag/reasons.ts`), and `required_context_question` is always `null`.
- [ ] The LLM path uses `lib/anthropic/client.ts::anthropic()` (already exists) and the `SYSTEM_PROMPT` export from `lib/agents/dag/spendBaseline.ts`.
- [ ] No throw when `ANTHROPIC_API_KEY` is unset and `anthropicMock=false` — graceful fall-back to deterministic with a console warning.

### R006: Standalone API route

Expose `POST /api/baseline/run` for dev/test and future UI wiring. Not coupled to the close state machine. Writes one audit event per run so the ledger page reflects baseline activity.

**Acceptance Criteria:**
- [ ] `app/api/baseline/run/route.ts` exports `POST` accepting `{ orgId?: string, month?: string }` (defaults: `DEFAULT_ORG_ID`, `currentMonth()`).
- [ ] Responds `200` with the full `BaselineOutput` JSON body on success.
- [ ] Responds `400` with `{ error: "...", details: "..." }` on invalid month format (not `YYYY-MM`).
- [ ] Responds `500` with `{ error: "..." }` on unexpected throw; the route never crashes the Next server.
- [ ] Appends one `baseline.run.completed` audit event via `lib/audit/append.ts` with payload `{ orgId, month, runMs, totalSpendEur, totalTco2e, priorityTargetCount, policyBreachCount }` on success.
- [ ] Returns in < 500ms on the seeded 120-transaction fixture (deterministic path, no LLM).

### R007: Unit tests against the seeded fixture

Lock the Baseline's behavior against `fixtures/bunq-transactions.json`. Tests act as the regression harness when Green Alt / Cost Savings start consuming this output.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/__tests__/spendBaseline.test.ts` exists, runnable via `pnpm exec tsx --test` or the existing test runner.
- [ ] Test: "March 2026 baseline has exactly 12 category clusters" (matches the 12 merchant_category values in the fixture).
- [ ] Test: "priority_targets is ≤ 20 and non-empty on the seeded month".
- [ ] Test: "every priority target has a valid `recommended_next_agent` enum value".
- [ ] Test: "empty-month baseline returns zeroed aggregates and empty priority_targets without throwing".
- [ ] Test: "policy-breaching category always appears in priority_targets even when its raw score would rank it outside the top 20" — seed a synthetic breaching policy for the test.
- [ ] Test: "cluster IDs match pattern `^cluster_[a-z_]+$`".
- [ ] Tests pass with `env.anthropicMock=true`.

### R008: Type-safety + lint

No net-new type errors or lint warnings introduced by this work.

**Acceptance Criteria:**
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` (if configured) exits 0; otherwise not applicable.
- [ ] The `BaselineOutput` type in `lib/agents/dag/types.ts` is not altered in a breaking way — only additive optional fields (`reason_for_priority_detail?: string`, `transaction_count?: number`, `avg_confidence?: number` on the priority target type, etc.) if needed.

## Future Considerations

- **LLM enhancement path** (R005 hooks fire when key arrives): full prompt tuning, token-cache setup, latency budget (< 2s total).
- **Close state-machine integration** (separate spec): replace `CLUSTER → QUESTIONS_GENERATED → AWAITING_ANSWERS → APPLY_ANSWERS` with a single `DAG_RUNNING` state that calls `runDag()`.
- **Spreadsheet/CSV ingest adapter** (separate spec): a second ingest path for non-bunq data, normalizing into the same `transactions` shape.
- **Merchant-level sub-clusters** (separate spec): if Green Alt / Cost Savings need finer granularity than category, extend Baseline to emit a second merchant-level cluster layer.
- **Prompt caching** (separate spec): when the LLM path is active, cache SYSTEM_PROMPT + per-org policy with `cache_control: { type: "ephemeral" }` per `research/13-context-scaling-patterns.md`.
