---
domain: dag-hardening
status: approved
created: 2026-04-25
complexity: medium
linked_repos: []
design: DESIGN.md
---

# DAG Hardening + Annual Savings Forecaster Spec

## Overview

The 8-agent DAG (`baseline → research → [greenAlt ‖ cost] → [judges] → strategy → report`) is functional end-to-end via `POST /api/impacts/research`. Three classes of work remain before this is demo-grade:

1. **Hardening** — close audit gaps, fix the multi-tenant research-cache leakage risk, make silent mock-fallback observable, add a runtime metrics dashboard hook.
2. **Annual Savings Forecaster** — answer "if a company spends €X/month with this distribution, what does it save per year and when does it pay back?" Today's `creditStrategy` answers it for *this* month's actual data; sales and CFO conversations need the spend-tier extrapolation. Deterministic helper, no LLM.
3. **Path consolidation** — pick between the canonical DAG and the parallel `lib/agent/impacts.ts` flow; wire the canonical path into the legacy 12-state close machine and the presentation page so there is one demo path.

**Authority discipline (must hold across all changes):** judges remain validators (LLM scores + audit text, code overrides verdict on hard rules); credit strategy + executive report numbers stay deterministic. No requirement here moves authority from code to LLM.

## Requirements

### R001: Credit Strategy audit hook

Credit Strategy produces the headline `net_financial_impact_eur` number with no audit log entry today. Add a single signed event with input + output digests so a sign-flip or formula bug is detectable post-hoc.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/index.ts::runDag` emits `agent.credit_strategy.run` audit event after credit strategy completes, payload at minimum `{ orgId, month, runId, total_net_company_scale_financial_impact_eur, total_emissions_reduced_tco2e, total_recommended_credit_purchase_cost_eur, tax_advisor_review_required, input_digest_sha256 }`.
- [ ] `input_digest_sha256` is `sha256(JSON.stringify({ greenJudgeApprovedCount, costJudgeApprovedCount, baselineTotalSpendEur, baselineTotalTco2e }))` so two runs with identical inputs hash equal.
- [ ] The event lands in `audit_events` table and verifies via `verifyChain`.
- [ ] No change to credit strategy module signature.

### R002: Mock-fallback observability

Each Sonnet-using agent currently calls `buildMock()` silently when `isMock()` returns true. Production runs that hit the API but get rate-limited could fall back to mock and nobody would know. Make this observable.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/llm.ts::callAgent` returns an additional flag `usedMock: boolean` alongside `tokenIn/tokenOut/cached`.
- [ ] Each agent that has a `buildMock()` branch records its mode in the `agentMessages` table via a new column `mock_path: integer (0|1)` (additive migration).
- [ ] `runDag()` emits `agent.<name>.fallback_to_mock` audit event whenever any of the 7 LLM-using agents took the mock path.
- [ ] `DagRunResult.metrics` gains a top-level `mock_agent_count: number` so downstream consumers can flag a degraded run without re-reading messages.
- [ ] When `env.anthropicMock === true` (intended mock mode), the audit events are still emitted but the flag is recorded as `intended` not `degradation`.

### R003: Research cache leakage fix

`researchCache` PK is `(category, jurisdiction, policyDigest, week)` with no `orgId`. Two NL orgs with the default policy share rows including source URLs. Decide and ship one mitigation.

**Acceptance Criteria:**
- [ ] Pick one path and document the choice in `docs/architecture-comparison.md` under "Imbalances": (A) add `orgId` to the cache PK (loses amortization benefit), or (B) strip per-row source URLs to org-neutral fields (`{title, snippet, domain}`) and keep the multi-tenant key.
- [ ] If (B): `lib/agents/dag/research.ts` strips the cached `sources[].url` to a domain prefix before insert; on read, full URLs are only present from live runs in the current invocation, never from cache.
- [ ] Schema migration if needed (add column or change PK).
- [ ] Test: two orgs in NL, same default policy, run research for the same category in the same week — second org sees cache hit AND its returned sources are org-neutral (or it sees a fresh live run if (A) was chosen).

### R004: Annual Savings Forecaster (deterministic helper)

Build a pure function that projects annual savings + payback period from a hypothetical monthly spend profile. No LLM. Mirror the math used in `creditStrategy::compute()` but parameterize on spend distribution rather than reading live transactions.

**Acceptance Criteria:**
- [ ] New module `lib/agents/dag/projector.ts` exports `forecastAnnualSavings(input: ForecastInput): ForecastOutput`.
- [ ] `ForecastInput`: `{ jurisdiction: "NL"|"DE"|"FR"|"EU", entityType: "BV"|"NV"|"GmbH"|"SARL"|"other", monthlySpendEur: number, spendDistribution: Record<string, number> /* category → fraction, sums to 1 */, switchAdoptionPct: number /* 0..1 default 0.5 */, policyId?: string }`.
- [ ] `ForecastOutput`: `{ baseline_annual_spend_eur, baseline_annual_tco2e, projected_savings: { direct_procurement_eur, avoided_offset_purchase_eur, tax_or_incentive_upside_eur, avoided_carbon_tax_eur, implementation_cost_eur, net_company_scale_financial_impact_eur, payback_period_months }, confidence: number, assumptions: string[], sensitivity: Array<{ adoption_pct: number; net_impact_eur: number }> /* 25%, 50%, 75%, 100% */ }`.
- [ ] Math reuses `lib/agents/dag/tools.ts::{getCorporateTaxRate, getCarbonPriceExposure, getCarbonCreditPrice}` plus `lib/factors` for emission factors and `lib/tax/incentives` for jurisdiction-specific schemes (EIA/MIA/Vamil for NL).
- [ ] Bounded: returns in <50ms on any input. No I/O outside the tool helpers.
- [ ] If `switchAdoptionPct === 0` returns zero savings (sanity test).
- [ ] If `monthlySpendEur === 0` returns zero savings without throwing.
- [ ] Confidence ∈ [0..1] reflects how many input categories matched a known emission factor (high) vs fell back to wildcard (low).

### R005: Forecaster API route

Surface the projector at `POST /api/forecast/annual` so the dashboard + presentation can call it without code changes.

**Acceptance Criteria:**
- [ ] `app/api/forecast/annual/route.ts` exports `POST` accepting `ForecastInput` (defaults: NL/BV/€100k/equal-distribution-across-top-5/0.5).
- [ ] Returns `200` with `ForecastOutput`.
- [ ] Returns `400` on invalid jurisdiction or non-summing distribution.
- [ ] Audit event `forecast.annual.completed` written on success with `{ orgId, monthlySpendEur, switchAdoptionPct, netImpactEur }`.
- [ ] No DB writes other than the audit event.
- [ ] Returns in <200ms (deterministic, no Anthropic).

### R006: Forecaster unit tests

Lock the Forecaster's behavior so it's a stable contract for the dashboard UI.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/__tests__/projector.test.ts` runnable via `pnpm exec tsx --test`.
- [ ] Test: NL/BV/€100k/equal-spread-across-{travel,procurement,food,services,cloud}/0.5 returns `net_company_scale_financial_impact_eur > 0` and `payback_period_months >= 0`.
- [ ] Test: zero adoption → zero savings.
- [ ] Test: zero spend → zero savings.
- [ ] Test: doubling `monthlySpendEur` roughly doubles `direct_procurement_savings_eur` (linearity within ±5%).
- [ ] Test: confidence drops when 50% of distribution lands on `other`.
- [ ] Test: sensitivity[3].net_impact_eur (100% adoption) >= sensitivity[0].net_impact_eur (25% adoption).

### R007: Path consolidation decision + wiring

Two parallel paths exist for "what should we recommend": canonical `runDag()` and `lib/agent/impacts.ts`. Pick one.

**Acceptance Criteria:**
- [ ] Decision recorded in `docs/architecture-comparison.md` under "Imbalances": either (A) retire `lib/agent/impacts.ts` (callers migrate to `runDag()`), or (B) keep both with documented use cases (DAG for monthly close, impacts.ts for what-if simulator).
- [ ] If (A): `app/impacts/page.tsx` (or whichever page consumes `impacts.ts`) calls `/api/impacts/research` instead. `lib/agent/impacts.ts` deleted; `lib/agent/impact-analysis.ts` deleted (already unwired).
- [ ] If (B): both paths remain; `docs/agents/00-overview.md` "Entry points" section gains a row for impacts.ts with its scope.
- [ ] No silent regressions: typecheck + smoke run (`pnpm exec tsx scripts/dag-smoke.ts`) still pass.

### R008: Legacy close-machine integration

The 12-state machine in `lib/agent/close.ts` still calls `lib/agent/questions.ts` + `lib/agent/narrative.ts` for its two LLM touchpoints. Replace with `runDag()`.

**Acceptance Criteria:**
- [ ] `lib/agent/close.ts::QUESTIONS_GENERATED` state replaced by a `DAG_RUNNING` state that calls `runDag(orgId, month, ctx)` and stores the resulting `runId` on the `close_runs` row (additive column `dag_run_id text`).
- [ ] `lib/agent/questions.ts` + `lib/agent/narrative.ts` deleted; their callers migrated.
- [ ] The 12-state machine's `AWAITING_ANSWERS` state stays only if `runDag().required_context_question != null`; otherwise the close machine advances directly to `APPLY_POLICY`.
- [ ] Smoke run: existing `app/api/close/run/route.ts` POST still returns `200` and the close completes end-to-end on the seeded fixture.
- [ ] Typecheck + 7 baseline tests still pass.

### R009: Presentation page wires real data

`app/presentation/page.tsx` still replays `fixtures/demo-runs/sample-run.json`. Switch the "Live run" section to fetch real data from `/api/impacts/research`.

**Acceptance Criteria:**
- [ ] Presentation's "Live run" section calls `POST /api/impacts/research` on first scroll into view (lazy, not on page load).
- [ ] If the API returns 200, render the real `DagRunResult` (replacing the fixture).
- [ ] If the API errors or returns 500, render the fixture as a fallback and show a small badge "demo replay (live unavailable)".
- [ ] No new dependencies; reuses existing `DagReplay` component shape.
- [ ] `app/presentation/page.tsx` typecheck clean.

## Future Considerations

- **Per-run dashboard tile** showing `mock_agent_count` + `cache_hit_pct` so degraded runs surface visually.
- **Cost ledger** that converts `agentMessages.tokens_in/out` into EUR via current Anthropic pricing — useful for cost regression alarms.
- **Onboarding suite ↔ DAG bridge** — `lib/agent/onboarding-*.ts` produces a draft policy and emission factor overrides; wire those into `policies` + `merchantCategoryCache` so a freshly-onboarded org's first DAG run uses its own customizations.
- **Promotion of judges from validators to authorities** — once enough runs exist, train the judges to honor LLM verdicts and let the code-overrides become judge "audit notes" instead. Out of scope for this spec.
- **CSRD export** as its own endpoint (currently embedded in executive report payload).
