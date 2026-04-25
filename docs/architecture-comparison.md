# Architecture comparison — today vs proposed

> Reflects the post-merge state on `lucasduys` after `matrix` + `matrix-onboarding` landed.
> Original 7-agent plan: `C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md`.
> Per-agent system prompts + I/O schemas: `docs/agents/00-overview.md` and `docs/agents/0X-*.md`.
> Forge specs: `.forge/specs/spec-baseline-agent.md`, `.forge/specs/spec-dag-hardening.md` (next-round).

## Summary

The original plan was a 7-agent DAG replacing the legacy 12-state close machine's two LLM touchpoints. The shipped reality is an **8-agent DAG** (Research was inserted between Baseline and the proposal pair) plus a new onboarding suite, all behind `POST /api/impacts/research`. Two parallel agent tracks still exist (`lib/agent/impacts.ts` and `lib/agent/impact-analysis.ts`) and the legacy close machine is unchanged.

## Today (post-merge — reality)

```
                        ┌─── greenAlternatives (Sonnet) ─┐
baseline ─► research ──┤                                 ├─► greenJudge (Sonnet) ─┐
(SQL only) (Sonnet +    └─── costSavings    (Sonnet) ────┴─► costJudge  (Sonnet) ─┤
            web_search)                                                            │
                                                                                   ▼
                                                              creditStrategy (Sonnet + math)
                                                                                   │
                                                                                   ▼
                                                              executiveReport (Sonnet, optional)
```

- 8 agents · Sequential / parallel / parallel / sequential / sequential.
- Entry point: `POST /api/impacts/research` → `runDag()` → persisted via `lib/impacts/store`.
- Recordkeeping: every run + every agent message audited in `agentRuns` + `agentMessages` tables; web searches in `webSearchAudit`; research outputs cached 30d in `researchCache`.

## Side-by-side: original plan vs reality

| Agent | Original plan | Reality post-merge | Status |
|---|---|---|---|
| **01 Baseline** | Hybrid: deterministic agg + Haiku tool_use enhance | **Pure deterministic**, no LLM. `reason_for_priority_detail` from canned `reasons.ts` lookup. | Lost LLM enhance pass — likely intentional since downstream Sonnet does the reasoning. Detail strings regressed from context-aware to canned. |
| **NEW Research** | not in plan | Sonnet + native `web_search_20250305` tool + 2 custom Zod tools (`record_alternative`, `lookup_emission_factor`). 30-day cache keyed on `(category, jurisdiction, policyDigest, week)`. | Net new node. Inserted between baseline and proposal agents to feed real-citation alternatives into Green Alt + Cost Savings. |
| **02 Green Alternatives** | Sonnet, propose lower-carbon alts | Sonnet plain JSON completion. **Tools pre-resolved** (`findLowerCarbonAlternative` + researchedPool merged before LLM call). | Faithful, but architecture is "code finds candidates → LLM ranks + writes prose" rather than "LLM calls tools at will." Saves tokens. |
| **03 Cost Savings** | Sonnet, propose cost wins | Sonnet plain JSON completion. Calls `detectRecurringSpend` + `findCostSaving` before LLM. | Faithful. Same pre-resolve pattern. |
| **04 Green Judge** | Sonnet, evaluate proposals | Sonnet plain JSON completion **+ hard rule in code: zero-sources → auto-rejected regardless of LLM verdict**. Math re-verified in code. | **Drifted** — judges are validators, not authorities. Documented honestly here. |
| **05 Cost Judge** | Sonnet, evaluate proposals | Same drift as Green Judge. Math re-checked in code; LLM verdict can be silently overridden. | **Drifted** — same. |
| **06 Credit Strategy** | Sonnet, compute company-scale impact | Sonnet for prose labels only. **All math deterministic in code** (compute() lines 89–167). No audit logging. | Faithful in shape; missing audit hook. |
| **07 Executive Report** | Sonnet, compose CFO report | Numbers deterministic; Sonnet only for optional summary prose. | Faithful, lighter than original. |

## What stays the same

- `lib/audit/append.ts` — append-only SHA-256 hash chain.
- `lib/bunq/*` — 8 endpoints (installation → device → session → webhook → payments → accounts → insights).
- `lib/db/schema.ts` core 13 tables — preserved. **5 new tables added**: `impactRecommendations`, `agentRuns`, `agentMessages`, `researchCache`, `webSearchAudit`. (Plus `onboardingRuns` + `onboardingQa` for the onboarding suite.)
- `lib/policy/evaluate.ts` — deterministic policy engine.
- `lib/factors/index.ts` + `lib/emissions/estimate.ts` — Baseline's foundation.
- `DESIGN.md` — every UI change still reads tokens from it.

## What changed (since pre-merge)

| Concern | Before | Now |
|---|---|---|
| Agent count | 7 (planned), 1 real, 6 stubs | 8 real (Research is new) |
| Shared LLM helper | none | `lib/agents/dag/llm.ts` — `callAgent`, `callAgentWithTools`, `isMock`. Prompt cache built in. |
| Tool layer | none | `lib/agents/dag/tools.ts` — 18 helpers (SQL queries, factor lookups, recurring detection, alternative templates, jurisdiction tax + carbon-price tables) |
| DAG persistence | nothing | `agentRuns` (full DagRunResult JSON) + `agentMessages` (per-call I/O) + `researchCache` + `webSearchAudit` |
| Entry point | `/api/baseline/run` | `/api/impacts/research` runs the full 8-agent DAG (route name misleading) |
| Mock fallback | per-agent ad hoc | uniform: each agent has a `buildMock()` deterministic path keyed off `isMock()` |

## Parallel agent paths (still present, still unconsolidated)

| Path | Lines | Entry | Uses |
|---|---|---|---|
| **Canonical 8-agent DAG** | 4,077 | `POST /api/impacts/research` | `lib/agents/dag/*` + `lib/agents/dag/tools.ts` |
| `lib/agent/impacts.ts` | 414 | called from `/impacts` (page render) | `lib/tax/*` + `GREEN_ALTERNATIVES`, **does NOT call runDag()** |
| `lib/agent/impact-analysis.ts` | 269 | unwired (no current route) | `lib/tax/*` + `lib/benchmarks` |
| **Onboarding suite** | 1,371 | `/api/onboarding/*` | own LLM stack, not in DAG |
| **Legacy close machine** | 295 + ~100 | `/api/close/*` | `lib/agent/questions.ts` + `lib/agent/narrative.ts`, **does NOT call runDag()** |

## Migration order — what's left

1. **Hardening** (next spec):
   - Add audit logging to credit strategy.
   - Fix `researchCache` cross-org leakage (add `orgId` or content-only fields to the key).
   - Surface mock-fallback signal in audit + dashboard.
   - Document judge-as-validator contract.
2. **Annual-savings forecaster** (next spec): given an org's monthly spend distribution, project annual savings + payback under different switch-adoption rates. Currently the report tells you what *this* month would save; sales/CFO want "if you spend €X/mo, you save €Y/year."
3. **Path consolidation:** decide between the canonical DAG and `lib/agent/impacts.ts`. Either retire `impacts.ts` (folding its `CategoryAnalysis` into Baseline's output) or keep two paths and document when to use each.
4. **Legacy close-machine integration:** swap `lib/agent/close.ts::QUESTIONS_GENERATED` + `narrative.ts` for a `runDag()` call. The 12-state machine remains the orchestrator; the DAG replaces both legacy LLM touchpoints.
5. **Onboarding ↔ DAG bridge:** the onboarding suite produces a draft policy + emission factor overrides. Wire those outputs into the canonical `policies` + `merchantCategoryCache` tables so the DAG picks them up.
6. **Presentation page:** stop replaying the JSON fixture; call `/api/impacts/research` and render real `DagRunResult` data.

## Imbalances called out for the record

| Risk | Where | Mitigation in next spec |
|---|---|---|
| Judge LLM verdict overridden in code | `greenJudge.ts:160-161, 253` and `costJudge.ts:150-156` | Document explicitly that judges are validators; surface the override count per run |
| Credit Strategy has no audit trail | `creditStrategy.ts` (no `ctx.auditLog` call) | Add `agent.credit_strategy.run` audit event with input + output digest |
| Multi-tenant `researchCache` leakage | `researchCache` PK is `(category, jurisdiction, policyDigest, week)` — no `orgId` | **Resolved (R003, option B):** `research.ts::orgNeutralizeForCache` strips per-row source URLs to a `https://{domain}` prefix on cache insert + nulls snippets. Multi-tenant amortization preserved; cross-tenant reads only see domain-only evidence. Live (current invocation) results keep full URLs without round-tripping through the cache. PK + schema unchanged. |
| Silent mock fallback masks API degradation | every proposal agent's `if (isMock())` branch | Emit `agent.<name>.fallback_to_mock` audit event + dashboard tile |
| Two parallel agent paths | `runDag()` vs `impacts.ts` | **Resolved (R007, option B):** kept both. `runDag()` is the canonical monthly-close path (8-agent DAG, audit-chained, mock-aware) reached via `POST /api/impacts/research`. `lib/agent/impacts.ts` is the lightweight what-if simulator backing `app/impacts/page.tsx` and exports the `Quadrant` + `ResolvedAlternative` types consumed by `components/ImpactMatrix.tsx` and `lib/impacts/store.ts`. `lib/agent/impact-analysis.ts::buildCategoryAnalyses` powers the dashboard category roll-up at `app/page.tsx`. Both paths intentionally retained — DAG for new monthly-close work, `impacts.ts` for the simpler simulator + shared types. See `docs/agents/00-overview.md` "Entry points". |
| Old close machine LLM still fires | `questions.ts` + `narrative.ts` | Replace with `runDag()` call inside `close.ts::QUESTIONS_GENERATED` |
