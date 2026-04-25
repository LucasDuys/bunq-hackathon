# Architecture

## System

```
bunq webhook  ──►  /api/webhook/bunq  ──►  classify merchant  ──►  transactions table
                                                                       │
                                                                       ▼
                                  ┌──────────── "Run Close" button ◄──┤
                                  ▼                                    │
                          /api/close/run                               │
                                  │                                    │
                                  ▼                                    │
                     lib/agent/close.ts (state machine)                │
                                  │                                    │
   AGGREGATE → ESTIMATE_INITIAL → CLUSTER → QUESTIONS → AWAITING_ANSWERS│
                                  │                                    │
              /api/close/[id]/answer  ◄──── user clicks option         │
                                  │                                    │
                    APPLY → ESTIMATE_FINAL → APPLY_POLICY              │
                                  │                                    │
                          PROPOSED / AWAITING_APPROVAL                 │
                                  │                                    │
              /api/close/[id]/approve ◄──── user clicks "approve"      │
                                  │                                    │
                          EXECUTING → COMPLETED                        │
                                  │                                    │
                     bunq.payments.intraUserTransfer (DRY_RUN-gated)   │
                                  │                                    │
                                  ▼                                    │
                          audit_events  (SHA-256 hash chain) ──────────┘
                                  │
                                  ▼
             /report/[month], /ledger, /reserve, /categories
```

## Data model
See `lib/db/schema.ts`. Thirteen tables; four are core:

- `transactions` — one row per bunq tx. category + confidence set at ingest by the classifier.
- `emission_estimates` — one row per (tx, close_run). Stores point + low + high + confidence + factor id + method (`spend_based` | `refined`).
- `close_runs` — the state machine row. Tracks state, initial + final estimates, reserve amount, proposed actions, approval.
- `audit_events` — append-only hash chain. UPDATE/DELETE blocked by triggers.

Supporting: `orgs`, `policies`, `emission_factors`, `credit_projects`, `credit_purchases`, `merchant_category_cache`, `refinement_qa`, `bunq_sessions`.

## State machine invariants
- Each transition is an idempotent step guarded by `WHERE state = 'PREVIOUS_STATE'` — retries are safe.
- LLM calls are isolated to `QUESTIONS_GENERATED` (Sonnet) and CSRD narrative — never in the reserve-amount decision path.
- `DRY_RUN=1` skips the real bunq transfer but still writes `action.reserve_transfer` to the audit log — the demo is visually identical.
- `MAX_TOOL_CALLS=8` caps bunq calls per close run.

## Reasoning layer — 8-agent DAG

Lives in `lib/agents/dag/`. Entry point: `POST /api/impacts/research` → `runDag()` in `index.ts`. Persists per-agent latency / tokens / cache-hit rate into `agent_runs` + `agent_messages` (live mode only).

```
                    spendBaseline (deterministic)
                            │
                            ▼
                       research            (Sonnet 4.6 + web_search_20250305 + 30d cache)
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
             greenAlternatives    costSavings    (Sonnet 4.6, parallel)
                  │                   │
                  ▼                   ▼
              greenJudge          costJudge      (Sonnet; verdict re-verified in code)
                  └─────────┬─────────┘
                            ▼
                     creditStrategy             (Sonnet writes prose; numbers deterministic)
                            │
                            ▼
                     executiveReport            (CFO-facing; numbers frozen pre-LLM)
```

**Authority discipline.** LLMs author, code adjudicates. `greenJudge` / `costJudge` re-check evidence quality and arithmetic in code — they can flip an LLM's `approved` to `rejected` on hard rules (zero-source recommendation, math mismatch). `creditStrategy` math is computed deterministically before the Sonnet prose is generated. `executiveReport` numbers are frozen before the LLM writes the CFO summary. The LLM cannot move money or invent savings.

**Mock fallback.** Every Sonnet-using agent has a deterministic `buildMock()` path used when `ANTHROPIC_MOCK=1` (default). Demo flow stays populated without an API key. Live mode (`ANTHROPIC_MOCK=0`) uses native tool_use with Zod validation (`lib/agents/dag/llm.ts::callAgent`, `callAgentWithTools`).

The close state machine and the DAG run independently today; integration is on the spec list (`.forge/specs/spec-dag-hardening.md`). See [`docs/agents/00-overview.md`](docs/agents/00-overview.md) for per-agent system prompts and I/O schemas.

## Confidence & ranges
- Per-tx: `point = spend × factor`, range `±factor.uncertainty%`, confidence `(1 − u) · classifierConfidence · tierWeight`.
- Rollup: point sum + quadrature-summed half-ranges; spend-weighted mean confidence.
- Refinement flips a tx's method from `spend_based` to `refined` (higher classifier confidence, often a tighter-uncertainty sub-category factor).

## Policy evaluator
JSON policy (`lib/policy/schema.ts`) maps categories to reserve rules (`pct_spend` / `eur_per_kg_co2e` / `flat_eur`) with wildcard fallback. Evaluator is pure, auditable, deterministic. Approval threshold is a property of the policy, not the agent.

## Audit chain
`appendAudit` reads latest hash per org, computes `sha256(prev || actor || type || payload || ts)`, inserts new row. `verifyChain` walks forward and reports break point. The ledger page displays chain status live.

## What lives where
| Concern | Files |
|---|---|
| Ingest | `app/api/webhook/bunq/route.ts`, `lib/bunq/webhook.ts`, `lib/classify/*` |
| Close run | `app/api/close/*`, `lib/agent/close.ts`, `lib/agent/questions.ts` |
| Estimation | `lib/factors/`, `lib/emissions/estimate.ts` |
| Allocation | `lib/policy/*`, `lib/credits/projects.ts` |
| Execution | `lib/bunq/payments.ts`, `lib/bunq/accounts.ts`, `lib/bunq/client.ts` |
| Reporting | `app/report/[month]/page.tsx`, `lib/agent/narrative.ts` |
| Audit | `lib/audit/append.ts`, migrations' triggers |
| UI | `app/` pages, `components/` |

## Local DB & persistence
- SQLite file at `./data/carbon.db` (plus `-wal`, `-shm`).
- Schema created by `scripts/migrate.ts` — raw DDL, kept in sync with Drizzle schema manually.
- Full reset: `pnpm run reset`. Restart dev server after reset so the Node process's DB handle is fresh.
