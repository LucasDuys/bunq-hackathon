# Carbon Autopilot — project guide for agents

## Repo purpose
Hackathon build of **Carbon Autopilot**: monthly carbon-close system for bunq Business.
- Passive webhook ingestion of bunq transactions.
- Monthly close: aggregate → estimate (with confidence) → cluster uncertainty → refine via 2–3 questions → apply policy → propose reserve transfer + EU credit recommendation → approve → execute.
- Output: CSRD ESRS E1-shaped monthly report + SHA-256 hash-chained audit ledger.

## Stack (locked)
- **Next.js 15 App Router + TypeScript + Tailwind 4**.
- **SQLite + better-sqlite3 + Drizzle ORM**. NOT Postgres/Neon — we switched for hackathon simplicity.
- **Anthropic TS SDK**: Haiku 4.5 for classification, Sonnet 4.6 for refinement questions + CSRD narrative. No Opus.
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

## Research briefs
`research/` has 12 practical briefs (400–800 words each). Every non-obvious design choice has a matching brief.
Read the relevant brief before changing the code it informs. Update the brief's **Decisions for this build** list when you change the code.

## Commands
```
pnpm dev          # Next dev server
pnpm migrate      # apply schema
pnpm seed         # deterministic 61-tx seed
pnpm reset        # wipe + re-migrate + re-seed (restart dev after!)
pnpm typecheck    # tsc --noEmit
```

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
