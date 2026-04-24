# Carbo — project guide for agents

## Repo purpose
Hackathon build of **Carbo**: agentic carbon accounting for bunq Business.
- Passive webhook ingestion of bunq transactions.
- Monthly close: aggregate → estimate (with confidence) → cluster uncertainty → refine via 2–3 questions → apply policy → propose reserve transfer + EU credit recommendation → approve → execute.
- Output: CSRD ESRS E1-shaped monthly report + SHA-256 hash-chained audit ledger.

## Design (locked)
- **[`DESIGN.md`](./DESIGN.md) at repo root is the single source of truth for look, feel, and voice.** Read it before touching anything visual — components, pages, `globals.css`, Tailwind tokens, copy, motion, a11y. It inherits Wise's friendly-fintech primitives and bunq's Easy Green palette + Montserrat/Inter/Fragment Mono typography, mapped to the files in `components/` and `app/`.
- Hard rules on every UI change: reference design tokens from §2 (no raw hex, no raw `emerald-*` / `zinc-*`); every CO₂e number pairs with a confidence indicator; sentence-case headlines; `tabular-nums` on every number; pill CTAs; ring-shadows only; dark + light parity; respect `prefers-reduced-motion` and `prefers-color-scheme`.
- If `DESIGN.md` and code disagree, fix the code. If you learned something the doc doesn't cover, update `DESIGN.md` in the same PR.

## Stack (locked)
- **Next.js 16 App Router + TypeScript + Tailwind 4**.
- **SQLite + better-sqlite3 + Drizzle ORM**. NOT Postgres/Neon — we switched for hackathon simplicity.
- **Anthropic TS SDK**: Haiku 4.5 for classification, Sonnet 4.6 for refinement questions + CSRD narrative. No Opus. No external emission factor APIs (factors hardcoded from DEFRA 2024 / ADEME / Exiobase).
- **bunq** signed HTTP client + mock mode. RSA-SHA256. Webhook signature verify required in live mode.
- Mock-first: `ANTHROPIC_MOCK=1 BUNQ_MOCK=1 DRY_RUN=1` are the safe defaults.

## Core patterns
- **State machine with DB-persisted state** in `lib/agent/close.ts`. Each transition guarded. No LangGraph, no Temporal.
- **Rule-first classifier with LLM fallback and cache** in `lib/classify/`. Never re-classify the same merchant twice.
- **Hard-coded emission factor table** in `lib/factors/`. Cite source + tier + uncertainty per row.
- **Confidence = (1 − factor_uncertainty) × classifier_confidence × tier_weight**. Roll up spend-weighted.
- **Append-only audit chain** in `lib/audit/append.ts`. UPDATE/DELETE blocked by trigger. Verify on load.

## Conventions
- Path alias: `@/*` → repo root. Used in every import.
- `"use client"` only for components that actually need state/events — keep pages as server components.
- Zod schemas wrap every LLM output and every user input.
- No implicit classifier defaults in new categories — if you add a category, add it to `ALL_CATEGORIES`, `SUB_CATEGORIES_BY_CATEGORY`, the rule table, and at least one factor row. Otherwise `factorFor` silently falls back to `other.generic`.
- Every bunq call goes through `lib/bunq/client.ts callBunq()` so mock + signing + session are centralized.
- Every state change in the agent writes an `audit_events` row via `appendAudit`.

## File map

| Path | What |
|---|---|
| `app/page.tsx` | Dashboard — monthly carbon close overview |
| `app/api/webhook/bunq/route.ts` | bunq webhook receiver |
| `app/api/close/run/route.ts` | Trigger monthly close run |
| `app/api/close/[id]/answer/route.ts` | Submit refinement answers |
| `app/api/close/[id]/approve/route.ts` | Approve proposed actions |
| `lib/agent/close.ts` | Monthly close state machine (the core loop) |
| `lib/agent/narrative.ts` | CSRD E1 narrative generator (Claude Sonnet) |
| `lib/agent/questions.ts` | Refinement question generator (Claude Sonnet) |
| `lib/classify/merchant.ts` | Merchant classifier (rules → Claude Haiku → fallback) |
| `lib/classify/rules.ts` | 30+ regex rules for Dutch/EU merchants |
| `lib/factors/index.ts` | Hardcoded emission factors (kg CO₂e per EUR) |
| `lib/emissions/estimate.ts` | Spend-based emission estimator + rollup |
| `lib/policy/evaluate.ts` | Policy engine (reserve allocation rules) |
| `lib/policy/schema.ts` | Policy YAML schema (Zod) |
| `lib/credits/projects.ts` | EU carbon credit project catalog |
| `lib/bunq/client.ts` | bunq API client (RSA-signed) |
| `lib/bunq/payments.ts` | Intra-account transfers (Carbo Reserve) |
| `lib/bunq/webhook.ts` | Webhook signature verification |
| `lib/bunq/accounts.ts` | Account listing |
| `lib/bunq/signing.ts` | RSA-SHA256 request signing |
| `lib/anthropic/client.ts` | Anthropic SDK wrapper + mock mode |
| `lib/db/schema.ts` | Drizzle schema (orgs, transactions, close_runs, etc.) |
| `lib/db/client.ts` | SQLite database client |
| `lib/env.ts` | Environment config |
| `lib/queries.ts` | Read queries (dashboard data) |
| `lib/audit/append.ts` | Audit log (SHA-256 hash chain) |
| `scripts/` | migrate / seed / reset / bunq bootstrap |
| `fixtures/` | Synthetic bunq transactions + Agribalyse emission factors |
| `DESIGN.md` | UI design system and component specs |

## What's not done
See [`todo.md`](./todo.md) for unfinished work — scope cuts, de-risked integrations (live bunq, live Anthropic), polish items. Design spec is now written: see [`DESIGN.md`](./DESIGN.md) (Wise + bunq-inspired). When picking up new work, check todo.md first.

## Commands
```
pnpm dev          # Next dev server
pnpm migrate      # apply schema
pnpm seed         # deterministic 61-tx seed
pnpm reset        # wipe + re-migrate + re-seed (restart dev after!)
pnpm typecheck    # tsc --noEmit
```

## Env vars

| Var | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | (empty) | Optional — mock mode works without it |
| `ANTHROPIC_MOCK` | `true` | Set `false` to hit real Claude API |
| `BUNQ_API_KEY` | (empty) | bunq sandbox API key |
| `BUNQ_MOCK` | `true` | Set `false` to hit real bunq API |
| `BUNQ_PRIVATE_KEY_B64` | (empty) | Base64-encoded RSA private key for bunq signing |
| `DATABASE_URL` | `file:./data/carbon.db` | SQLite path |
| `DRY_RUN` | `true` | Prevents real transfers |

## Gotchas
- **After `pnpm reset`, restart `pnpm dev`** or the running Node process holds a stale SQLite handle and writes silently to the deleted inode.
- **Path aliases work under `tsx`** as of 4.x — no `tsconfig-paths` registration needed.
- **Next 16 route params are Promises** — `params: Promise<{ id: string }>` and `await params`.
- **better-sqlite3 native build** requires `pnpm.onlyBuiltDependencies: ["better-sqlite3"]` in package.json.
- **LLM mock mode returns `"other"` for classification** — this deliberately creates uncertainty clusters for the agent to surface as questions.
- **Dev server warning about inferred workspace root** is harmless; silence by setting `turbopack.root` in `next.config.ts` if it bothers you.

## When adding features, preserve
- The audit chain — never bypass `appendAudit`.
- The DRY_RUN guard — external side effects must be opt-in, not default.
- The state machine linearity — don't branch close runs unless absolutely necessary.
- The rollup math — quadrature sum + spend-weighted confidence.
- The factor source citations — every row in `FACTORS` has a `source` string, keep it filled.

@AGENTS.md
@DESIGN.md

# Progress Tracking

After completing any meaningful unit of work (feature, fix, refactor, new component, API route, etc.):

1. **Update `PROGRESS.md`** — append a `- [x] description (YYYY-MM-DD)` line under the appropriate section. Add a new section if none fits. This is the team's living record of what's done.
2. **Commit frequently** — don't batch large changes. Commit after each logical unit of work with a clear message. Push to remote so teammates see progress.
3. **Keep it honest** — only mark something done when it actually works, not when it's half-wired. Stubbed/partial work goes in `TODO.md`, not here.

`PROGRESS.md` = what's done. `TODO.md` = what's left. Keep both current.
