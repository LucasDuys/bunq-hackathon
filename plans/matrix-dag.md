# Plan — agentic matrix + cost/green savings DAG

> Turn the 7-agent DAG from `docs/agents/00-overview.md` + `research/11-impact-matrix.md` + `research/13-context-scaling-patterns.md` from fixture-replay stubs into a real, deterministic-where-possible, Anthropic-where-judgment-is-needed pipeline that powers `/impacts`.

## Problem

What we have today (on the `matrix` branch, just pulled):

- `lib/agents/dag/*` — 7 agent stubs that all replay the same `fixtures/demo-runs/sample-run.json`. Zero real data flows through them.
- `lib/impacts/aggregate.ts` — deterministic baseline builder that **does** read real transactions, used only by the simple `lib/agent/impacts.ts` Sonnet call.
- `lib/agent/impacts.ts` — one-shot Sonnet call with a hard-coded fallback template library. Shipped today to `/impacts`.
- `app/impacts/page.tsx` — renders flat `impactRecommendations` rows + a 2×2 cost-vs-CO₂e matrix. Visually works, but the UI uses raw `emerald-*`/`#10b981` hex values (DESIGN.md violation), and nothing from the 7-agent DAG is displayed.
- `fixtures/demo-runs/sample-run.json` — high-quality sample output for the DAG; useful as a golden reference for prompt engineering.

The research (`research/11-impact-matrix.md`, `13-context-scaling-patterns.md`, `docs/agents/*`) is pointing at something larger: a **reasoning + judging** pipeline where proposal agents (Green Alt, Cost Savings) produce candidate switches, judge agents validate each claim, a strategy agent turns verified switches into a CFO-grade net financial impact, and a report agent composes the user-facing matrix + top-N + CSRD export.

The goal of this branch: stop replaying fixtures, wire the real DAG, and make `/impacts` the DAG's user surface.

## Architecture

```
      real bunq transactions
                │
                ▼
  ┌─────────────────────────────┐
  │  spendBaseline.run()        │   (deterministic; no LLM)
  │   ↳ lib/impacts/aggregate.ts│
  │   ↳ rollup + priority_targets (≤20)
  └──────────────┬──────────────┘
                 │ BaselineOutput (compressed, ~5k tokens)
       ┌─────────┴─────────┐
       ▼                   ▼
  greenAlternatives    costSavings        ← parallel; Sonnet 4.6
       │                   │                 system-prompt cached
       ▼                   ▼
   greenJudge          costJudge           ← parallel; Sonnet 4.6
       │                   │
       └─────────┬─────────┘
                 ▼
         creditStrategy                    ← Sonnet 4.6 + deterministic NL/DE/EU tax table
                 │
                 ▼
       executiveReport                     ← Sonnet 4.6; composes KPI block + matrix + top-N
                 │
                 ▼
   persistDagRun() + appendAudit per stage
                 │
                 ▼
      /impacts page renders from DB
```

### Non-negotiables

1. **Math is deterministic.** LLMs propose + judge; code computes every kg/EUR/percentage. `creditStrategy` in particular does all net-impact arithmetic in TS; the agent's job is to pick credit types and assumption labels, not to add numbers.
2. **Context budget ≤ 25% per agent** (per `research/13`). Baseline output caps at 20 priority targets; downstream agents operate at cluster granularity, never raw rows.
3. **System prompt cached** on every Anthropic call via `cache_control: { type: "ephemeral" }`.
4. **Parallel dispatch** at both fan-outs: {GreenAlt ‖ CostSavings} and {GreenJudge ‖ CostJudge}.
5. **Mock mode** always works. `ANTHROPIC_MOCK=1` (the default) returns deterministic fixtures derived from the real baseline — so even without an API key, `/impacts` shows real merchant data with simulated-but-plausible alternatives (the same library already in `lib/agent/impacts.ts`).
6. **Audit chain.** Every agent run appends a `agent.<name>.run` event via `appendAudit`. Judge verdicts append one event per verdict so the ledger shows "judged by" per recommendation.

## Deliverables

### D1. Tool layer — `lib/agents/dag/tools.ts` (new)

Bounded SQL-backed tools the agents call. Each returns ≤50 rows or one aggregate.

```ts
export const tools = {
  getTransactionRows({ orgId, clusterId?, category?, merchantNorm?, limit = 50 }): Tx[]
  getMerchantCluster(orgId, merchantNorm): { totalSpendEur, txCount, categorySplit, monthlyTrend[6] }
  getSpendByCategory(orgId, month?): Array<{ category, spendEur, txCount }>
  getEmissionFactor(category, subCategory): FactorRow
  detectRecurringSpend(orgId, minMonthsPresent = 3): Array<{ merchantNorm, monthlyAvgEur, months }>
  getHistoricalSpendByMerchant(orgId, merchantNorm, months = 6): Array<{ month, eur }>
  findLowerCarbonAlternative(category, subCategory): AltTemplate[]
    // wraps the MOCK_BY_SUBCATEGORY library from lib/agent/impacts.ts
    // + extends with a few new "simulated=true" templates for categories not yet covered.
  getCarbonCreditPrice(projectType, region): { eurPerTonne, confidence }
  getCorporateTaxRate(jurisdiction = "NL", entityType = "BV"): { rate, source }
  getCarbonPriceExposure(country, sector): { euPerTonne, applicable, source }
};
```

Same tool surface gets passed into every agent via `AgentContext` so Anthropic tool-use calls have a typed dispatcher.

### D2. Deterministic baseline — `lib/agents/dag/spendBaseline.ts` (replace stub)

Delete the `sampleRun.baseline` replay. Real implementation:

1. Pull the org's policy (for `priority_targets.reason_for_priority = "policy_relevant"`).
2. Run `computeBaselines(orgId)` from `lib/impacts/aggregate.ts` but remove the `IMPACT_CATEGORIES` allow-list so **all** categories participate (the research says we should prioritize across the full spend, not just cloud/travel/utilities).
3. Also pull `getCategorySpendForMonth` for the current + previous month → compute `top_spend_categories` and `top_emission_categories` with `share_pct`.
4. Compute `high_cost_high_carbon_clusters` = top 3 by `(spend × kg)`. `uncertain_high_value_clusters` = top 3 by `(spend × (1-confidence))`.
5. Assemble `priority_targets` (≤20) picking clusters that maximize `spend × kg × (1-confidence)`. Tag each with `recommended_next_agent` per a simple rule:
   - green-only if emissions > ~0.1 kg/EUR AND the category has a greener alternative in the factor table
   - cost-only for SaaS / software / services where factor < 0.1 kg/EUR
   - both for travel + procurement + food.
6. Return a `BaselineOutput` matching the existing type. No LLM call.

### D3. Proposal agents — `greenAlternatives.ts` + `costSavings.ts`

Each has two paths:

- **Live (ANTHROPIC_MOCK=0)**: structured call to Sonnet 4.6 with the system prompt from `docs/agents/02-*` / `03-*`, cached via `cache_control`. Input = the compressed `BaselineOutput` + org policy + bounded tool-use loop (max 5 tool calls, matching `env.maxToolCalls`). Output validated by Zod matching `GreenAltOutput` / `CostSavingsOutput`. On parse failure, fall back to mock path (don't error the DAG — this is a dashboard, not a transaction).
- **Mock (default)**: deterministic synthesis from `baseline.priority_targets` ×  the factor-library templates already in `lib/agent/impacts.ts` (`MOCK_BY_SUBCATEGORY`). Also add a small `COST_MOCK_BY_CATEGORY` for cost-side templates (seat audits, contract rebidding, bulk purchase, recurring-spend cancellations) so the Cost Savings path has something to show with zero API cost. `source: "simulated"` on every one.

Both paths run in parallel from `runDag`.

### D4. Judge agents — `greenJudge.ts` + `costJudge.ts`

Same live/mock split. In mock mode, judges:
- Score each result by a deterministic heuristic: `score = 100 × (alt.confidence × evidence_completeness)` where evidence_completeness = 1.0 if ≥2 sources + non-empty rationale, 0.7 if 1 source, 0.4 otherwise.
- Verdict: ≥85 `approved`, 70–84 `approved_with_caveats`, 50–69 `needs_context`, <50 `rejected`.
- Correct math: recompute `carbon_saving_kg = baseline_kg × co2eDeltaPct` (or `estimatedMonthlySavingEur × 12` for cost). Replace the agent's claim if off by >10%.
- Append one audit event per judged item.

In live mode the Sonnet judge receives `{ proposal, policy, factor_table }` and returns structured verdicts; we Zod-validate then reconcile math the same way (judge can't escape math correction; if it disagrees we log the divergence and trust code).

### D5. Credit Strategy — `creditStrategy.ts`

- Pull jurisdiction table from `lib/agents/dag/jurisdictions.ts` (new): `{ NL: { rate: 0.258, etsEurPerTonne: 90, source: "Belastingdienst 2024" }, DE: {...}, EU_default: {...} }`.
- Deterministic formulas from the doc:
  - `avoided_offset_purchase_cost_eur = kg_reduced / 1000 × creditPricePerTonne`
  - `tax_deduction_value_eur = deductible_amount × corporate_tax_rate`
  - `avoided_carbon_price_exposure_eur = tCo2e_reduced × etsEurPerTonne`
  - `net = direct_saving + tax + subsidy + avoided_carbon + avoided_offset − implementation − risk_adj`
- Agent (live) picks `credit_type` (removal vs avoidance), `tax_treatment` label (`confirmed` / `scenario_only` / `requires_verification`), and prose `cfo_summary`. Never touches the math.
- Mock: pick the cheapest EU removal project from `lib/credits/projects.ts` + label `tax_treatment = "scenario_only"`.

### D6. Executive Report — `executiveReport.ts`

- Build the matrix in code (deterministic quadrant bucketing — the LLM should not classify its own recommendations).
- Pick top-5 by `net_financial_impact / baseline_kg` (value per kg).
- Compose `executive_summary` (prose) live or fallback to a string template in mock mode.
- `limitations[]` populated from any `needs_context` / `rejected` counts so the CFO sees what we dropped.

### D7. DAG persistence

New tables in `lib/db/schema.ts` + `scripts/migrate.ts`:

```sql
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  month TEXT NOT NULL,
  research_run_id TEXT,        -- FK to the existing impactRecommendations.research_run_id
  dag_payload TEXT NOT NULL,   -- JSON: full DagRunResult (baseline → report)
  total_latency_ms INTEGER NOT NULL,
  mock INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_agent_runs_org ON agent_runs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_run_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  role TEXT NOT NULL,          -- system | user | assistant | tool_result
  content TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cached INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_agent_messages_run ON agent_messages(agent_run_id);
```

`persistDagRun()` in `lib/impacts/store.ts`:
- Inserts one `agent_runs` row with full JSON payload.
- Also flattens the judge-approved green alternatives into `impact_recommendations` rows (keeps the existing `/impacts` page working).
- Appends an `agent.run.dag` audit event with summary metrics.

### D8. API wiring

`/app/api/impacts/research/route.ts`:
- Kick off `runDag()` instead of `researchAlternatives()`.
- Persist via `persistDagRun()`.
- Return `{ runId, month, metrics, totalLatencyMs }`.

### D9. UI — `/impacts` page

Three visible changes:
1. Replace raw hex `#10b981` / `#f59e0b` / `#f43f5e` / `#a1a1aa` in `components/ImpactMatrix.tsx` with DESIGN.md tokens (`--status-success`, `--status-warning`, `--status-danger`, `--fg-muted`).
2. Replace raw `emerald-*` / `violet-*` / `sky-*` badge classes in `app/impacts/page.tsx` with category-rainbow tokens from DESIGN.md §2.5 (render via inline style + CSS var).
3. New "CFO summary" card at the top driven by `executiveReport.kpis`:
   - `net_company_scale_financial_impact_eur`, `emissions_reduced_tco2e`, `payback_period_months`.
   - Pair the CO₂e number with a confidence bar per the design invariant.
4. New "Top 5 switches" card from `executiveReport.top_recommendations`.
5. Keep the existing per-baseline list at the bottom (it's still the most actionable view).

## Model + cost discipline

| Agent | Model | Input tokens (est) | Cached? |
|---|---|---|---|
| Spend Baseline | none (deterministic) | — | — |
| Green Alt | Sonnet 4.6 | ~5k in / ~3k out | system prompt cached |
| Cost Savings | Sonnet 4.6 | ~5k in / ~3k out | system prompt cached |
| Green Judge | Sonnet 4.6 | ~5k in / ~2k out | system prompt cached |
| Cost Judge | Sonnet 4.6 | ~5k in / ~2k out | system prompt cached |
| Credit Strategy | Sonnet 4.6 | ~7k in / ~2k out | system prompt cached |
| Exec Report | Sonnet 4.6 | ~8k in / ~3k out | system prompt cached |

Total real-mode call budget per DAG run: ~70k tokens in / ~15k tokens out, ~6 Sonnet 4.6 calls on the critical path. At list prices that is under €0.30 per close. Mock-mode calls cost nothing.

## Test surface

- `npm run typecheck` must pass.
- `npm run dev` + visit `/impacts`, click **Run impact research**, see matrix populate with mock data in <1s.
- Audit ledger at `/ledger` shows one `agent.run.dag` + ≤20 `agent.<name>.verdict` events per run.
- `ANTHROPIC_MOCK=0 ANTHROPIC_API_KEY=sk-... npm run dev` with a funded key hits Sonnet; mock fallback engages cleanly on parse errors.

## Out of scope for this branch

- Live tool-use loop with `tool_use` blocks (we'll do tool dispatch _in code_ before the model call, passing resolved values in the user message — simpler, cheaper, matches the hackathon scope).
- PDF rendering from `executiveReport.pdf_render_payload` — stub only; real renderer is a follow-up.
- Replacing `lib/agent/close.ts` LLM touchpoints — that's orchestrator-scope work; keep the close flow untouched on this branch.
- New `/agents/[runId]` page showing per-agent traces — useful, but not blocking the matrix story.

## Rollout order (same as TaskList)

1. Plan (this doc) ✓
2. Real baseline from DB
3. Tool layer
4. Green Alt + Cost Savings (parallel)
5. Green Judge + Cost Judge (parallel)
6. Credit Strategy + Exec Report
7. DAG persistence + API wiring
8. UI tokens + KPI/top-5 cards
9. Verify, commit, update PROGRESS
