# Architecture comparison — today vs proposed

> Side-by-side of the current linear close machine (`ARCHITECTURE.md`) and the proposed 7-agent DAG (`docs/agents/00-overview.md`).
> Reference: `C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md`.

## Summary

Today the monthly close is a 12-state orchestrator with **two** LLM touchpoints (refinement questions + CSRD narrative) and all estimation/allocation done in deterministic code. The proposal keeps the 12-state orchestrator as the outer loop and replaces those two touchpoints with a **7-agent DAG** — proposal agents (Green Alt, Cost Savings) validated by judge agents (Green Judge, Cost Judge), strategy synthesis (Credit & Incentive), and a composing report agent. Math stays deterministic; the agents propose and validate, code calculates.

## Side-by-side

| Concern | Today | Proposed |
|---|---|---|
| **Ingest** | `app/api/webhook/bunq/route.ts` + `lib/bunq/webhook.ts` — RSA-SHA256 verified, idempotent | Unchanged |
| **Merchant normalization** | `lib/classify/merchant.ts` — strip/normalize | Unchanged (fed to Baseline) |
| **Classification** | `lib/classify/{rules,cache,llm}.ts` — rules → cache → Haiku | Unchanged; Baseline consumes classified rows |
| **Spend-based emission** | `lib/emissions/estimate.ts` — point + range + confidence | Unchanged; Baseline summarizes |
| **Cluster uncertainty** | `lib/agent/close.ts::CLUSTER` state — uncertainty tiers | Unchanged; Baseline's `priority_targets` consume cluster output |
| **Refinement Q&A** | `lib/agent/questions.ts` — one Sonnet call per run | **Replaced** by Green Alt + Cost Savings proposing structured recommendations (not questions) |
| **Green recommendations** | Not present | **New:** `lib/agents/dag/greenAlternatives.ts` |
| **Cost recommendations** | Not present | **New:** `lib/agents/dag/costSavings.ts` |
| **Validation / judging** | Not present | **New:** `greenJudge.ts` + `costJudge.ts` (parallel) |
| **Policy evaluation** | `lib/policy/evaluate.ts` — pure deterministic | Unchanged; exposed as `compareAgainstPolicy` tool to judges |
| **Credit projects** | `lib/credits/projects.ts` — 3 EU projects seeded | Extended: `creditStrategy.ts` consumes project metadata + jurisdiction table to build CFO-grade impact |
| **Tax / incentive** | Not present | **New:** absorbed into `creditStrategy.ts` (no standalone tax agent — reduces context overhead) |
| **Report** | `lib/agent/narrative.ts` — one Sonnet call, prose narrative | **Replaced** by `executiveReport.ts` — structured KPI block + top-N + matrix + CSRD export |
| **PDF render** | Not implemented | Added: deterministic renderer driven by `executiveReport.ts` payload |
| **Audit** | `lib/audit/append.ts` + migration triggers — SHA256 chain, UPDATE/DELETE blocked | Unchanged; each agent verdict is a new audit event type (`agent.<name>.run`) |
| **Dashboard** | `app/page.tsx`, `app/report/[month]/page.tsx` | Unchanged shell; consumes Executive Report payload |

## Migration order

1. **Types + contracts** (`lib/agents/dag/types.ts`) — no behavior change, just schemas. Unblocks everything.
2. **Per-agent stubs** returning from `fixtures/demo-runs/*.json`. Presentation page can already replay.
3. **Baseline agent** — thinnest agent, wraps existing emission/classification aggregates.
4. **Green Alternatives + Cost Savings** (parallel) — real Anthropic calls; add `findLowerCarbonAlternative` + `detectRecurringSpend` tool stubs.
5. **Green Judge + Cost Judge** (parallel) — wire `validateMath` + `compareAgainstPolicy` tools.
6. **Credit & Incentive Strategy** — combines judge outputs with `lib/credits/projects.ts` + jurisdiction table.
7. **Executive Report** — replaces `lib/agent/narrative.ts`. Update `app/report/[month]/page.tsx` to consume structured payload.
8. **State machine rewiring** — `lib/agent/close.ts::QUESTIONS_GENERATED` state replaced by `runDag()`. `AWAITING_ANSWERS` becomes optional (only if any agent returns `required_context_question`).
9. **Audit event types** — extend `lib/audit/append.ts` with `agent.<name>.run` events.

## What stays the same

- `lib/audit/*` — append-only SHA256 hash chain, UPDATE/DELETE triggers. Every agent run is an audit event.
- `lib/bunq/*` — all 8 endpoints (installation → device → session → webhook → payments → accounts → insights).
- `lib/db/schema.ts` — 13 existing tables. We **may** add `agent_runs` and `agent_messages` tables for per-call observability, but the demo doesn't require them.
- 12-state orchestrator in `lib/agent/close.ts` — still the outer loop. The DAG fires inside its LLM-bearing states.
- `DESIGN.md` — every UI change still reads tokens from it.
- `lib/emissions/estimate.ts` — spend-based calc + confidence ranges. Baseline agent consumes, does not replace.
- `lib/policy/evaluate.ts` — still the deterministic policy engine.

## Agents that are scoped OUT of scaffold

- **Dedicated Tax / Incentive Judge** — merged into Cost Judge to keep context budget tight. If tax logic grows, split it back out.
- **Spend-based refinement questions** — replaced entirely by Green/Cost agents. We may keep the `refinement_qa` table for future `required_context_question` responses from the agents.
