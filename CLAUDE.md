# Carbo — agent guide

## Purpose
Hackathon: agentic carbon accounting on bunq Business.
- **Onboarding**: interview + statement upload → calibrated org profile + baseline.
- **Webhook**: passive bunq tx ingestion.
- **Monthly close** (state machine): aggregate → estimate(+confidence) → cluster uncertainty → 2–3 refine Qs → policy → propose reserve transfer + EU credit → approve → execute.
- **Impact / what-if**: green-alt research, cost-savings, tax incentives, executive narrative.
- Output: CSRD ESRS E1 report + SHA-256 hash-chained audit ledger.

See `ARCHITECTURE.md` (DAG layout), `DESIGN.md` (UI), `AGENTS.md` (Next 16 + design rules). All three loaded via `@`.

## Stack (locked)
- Next.js 16 App Router, TS, Tailwind 4.
- SQLite + better-sqlite3 + Drizzle (not Postgres).
- Anthropic TS SDK: Haiku 4.5 = classify; Sonnet 4.6 = refine Qs + CSRD narrative. No Opus. No external EF APIs (factors hardcoded: DEFRA 2024 / ADEME / Exiobase).
- bunq RSA-SHA256 signed client + mock mode. Live mode requires webhook sig verify.
- Mock-first defaults: `ANTHROPIC_MOCK=1 BUNQ_MOCK=1 DRY_RUN=1`.

## Core patterns
- **DB-persisted state machines**, guarded transitions: `lib/agent/close.ts`, `lib/agent/onboarding.ts`. No LangGraph/Temporal.
- **DAG agents** in `lib/agents/dag/`: typed nodes wired via `index.ts`; LLM via `llm.ts` (Anthropic `tool_use`, never free-text JSON; Zod-validate output); shared helpers `tools.ts`.
- **Classifier**: rules → Haiku → cache, in `lib/classify/`. Never reclassify same merchant.
- **Emission factors**: hardcoded `lib/factors/`, each row has source + tier + uncertainty.
- **Confidence** = (1 − factor_uncertainty) × classifier_confidence × tier_weight; rollup spend-weighted; sum via quadrature.
- **Audit chain**: `lib/audit/append.ts`, append-only (UPDATE/DELETE blocked by trigger), verify on load.

## Conventions
- `@/*` alias → repo root.
- `"use client"` only when needed; pages stay server components.
- Zod-wrap every LLM output and user input.
- New category ⇒ add to `ALL_CATEGORIES`, `SUB_CATEGORIES_BY_CATEGORY`, rules, ≥1 factor row. Else `factorFor` silently falls back to `other.generic`.
- All bunq calls go through `lib/bunq/client.ts callBunq()`.
- All agent state changes write `audit_events` via `appendAudit`.

## Invariants (don't break)
- Never bypass `appendAudit`.
- DRY_RUN guard: external side effects are opt-in, not default.
- Close runs stay linear — don't branch unless necessary.
- Rollup math: quadrature sum + spend-weighted confidence.
- Every `FACTORS` row keeps its `source` string.

## File map

Pages (`app/`):
- `page.tsx` dashboard · `close/[id]/` close detail+approve · `onboarding/`, `onboarding/[runId]/` agentic onboarding.
- Feature pages: `categories/`, `impacts/`, `invoices/`, `invoices/[id]/`, `ledger/`, `reserve/`, `tax-savings/`, `report/[month]/`, `presentation/`.

API (`app/api/`):
- `webhook/bunq/` receiver.
- `close/run/`, `close/[id]/{answer,approve}/`.
- `onboarding/start/`, `onboarding/[runId]/{answer,approve,revise,upload,cancel}/`.
- `baseline/run/` (spend+emissions baseline), `impacts/research/` (what-if).
- `invoices/upload/`, `invoices/`, `invoices/[id]/`, `invoices/[id]/link/`, `invoices/gmail/poll/`.

Agents (`lib/agent/`):
- `close.ts` (close SM), `onboarding.ts` + `onboarding-{interviewer,drafter,parser}.ts`.
- `impact-analysis.ts`, `impacts.ts`.
- `narrative.ts` (CSRD, Sonnet), `questions.ts` (refine Qs, Sonnet).

DAG (`lib/agents/dag/`):
- Nodes: `spendBaseline`, `research`, `greenAlternatives`/`greenJudge`, `costSavings`/`costJudge`, `creditStrategy`, `executiveReport`.
- Infra: `index` (orchestrator), `llm` (tool_use wrapper), `tools`, `types`, `fixtures`.

Domain libs:
- `classify/{merchant,rules}.ts` · `factors/index.ts` · `emissions/estimate.ts`.
- `policy/{evaluate,schema}.ts` · `credits/projects.ts`.
- `onboarding/{profile,calibration,markdown,types}.ts` · `impacts/{aggregate,store}.ts`.
- `tax/{index,incentives,alternatives,savings}.ts` · `benchmarks.ts`.
- `invoices/{storage,extract,process,gmail}.ts` (invoice ingestion pipeline).
- `bunq/{client,payments,webhook,accounts,signing}.ts` · `anthropic/client.ts`.
- `db/{schema,client}.ts` · `audit/append.ts` · `queries.ts` · `env.ts` · `utils.ts`.

Other: `scripts/` (migrate/seed/reset/bunq bootstrap), `fixtures/` (synthetic txs + Agribalyse).

`todo.md` = open work; `PROGRESS.md` = done log. Check `todo.md` before starting new work.

## Commands
Node 22 LTS (`.nvmrc`). **Never Node 25** — froze system on `better-sqlite3` native rebuild (18GB MBP). npm only (was pnpm).
```
npm run dev        # Next dev (4GB memory cap)
npm run migrate    # apply schema
npm run seed       # 61-tx deterministic seed
npm run reset      # wipe + migrate + seed (restart dev after!)
npm run typecheck  # tsc --noEmit
```

## Env vars
| Var | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | optional in mock mode |
| `ANTHROPIC_MOCK` | `true` | `false` → real Claude |
| `BUNQ_API_KEY` | — | sandbox key |
| `BUNQ_MOCK` | `true` | `false` → real bunq |
| `BUNQ_PRIVATE_KEY_B64` | — | base64 RSA priv key for signing |
| `DATABASE_URL` | `file:./data/carbon.db` | SQLite path |
| `DRY_RUN` | `true` | blocks real transfers |

## Gotchas
- After `npm run reset`, **restart `npm run dev`** — old process holds stale SQLite handle, writes to deleted inode.
- Path aliases work under `tsx` ≥4 (no `tsconfig-paths` needed).
- Next 16 route params are Promises: `params: Promise<{id:string}>`, `await params`.
- `better-sqlite3` native build runs on `npm install`; needs Node 22 LTS.
- LLM mock returns `"other"` for classification — intentional, drives uncertainty clusters.
- Inferred workspace-root warning is harmless; silence via `turbopack.root` in `next.config.ts`.

## Progress tracking
After each meaningful unit (feature/fix/refactor/component/route):
1. Append `- [x] desc (YYYY-MM-DD)` to `PROGRESS.md` under fitting section.
2. Commit per logical unit with clear message; push.
3. Mark done only when actually works — partials go to `TODO.md`.

`PROGRESS.md` = done. `TODO.md` = left. Keep both current.

@AGENTS.md
@DESIGN.md
