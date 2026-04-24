# Progress

Living document — every agent and contributor updates this after completing work.
Counterpart to `TODO.md` (what's left to do). This file tracks what's **done**.

---

## Project Setup

- [x] Next.js 16 + React 19 + Tailwind 4 scaffolded (2026-04-23)
- [x] SQLite via Drizzle ORM — 13 tables defined (`lib/db/schema.ts`) (2026-04-23)
- [x] pnpm workspace configured (2026-04-23)

## Data & Fixtures

- [x] 60 realistic mock bunq transactions seeded (`scripts/seed.ts`) (2026-04-23)
- [x] 37 Agribalyse / DEFRA / ADEME / Exiobase emission factors (`lib/factors/index.ts`) (2026-04-23)
- [x] 3 EU carbon credit projects seeded: biochar, peatland restoration, reforestation (2026-04-23)

## Backend — Core Pipeline

- [x] bunq webhook receiver with RSA-SHA256 signature verification (`app/api/webhook/bunq/route.ts`) (2026-04-23)
- [x] Merchant normalization + classification pipeline: rules (50+ patterns) -> cache -> LLM (`lib/classify/`) (2026-04-23)
- [x] Spend-based emission estimation with confidence ranges (`lib/emissions/estimate.ts`) (2026-04-23)
- [x] Policy evaluation engine — per-category reserve rules, approval threshold (`lib/policy/evaluate.ts`) (2026-04-23)
- [x] Chain-hashed SHA256 audit trail (`lib/audit/append.ts`) (2026-04-23)
- [x] bunq API client with mock mode (`lib/bunq/`) (2026-04-23)

## Backend — Agent / Close Flow

- [x] 12-state monthly close state machine (`lib/agent/close.ts`) (2026-04-23)
- [x] Refinement Q&A generation via Claude for high-uncertainty clusters (`lib/agent/questions.ts`) (2026-04-23)
- [x] API routes: `/api/close/run`, `/api/close/[id]/answer`, `/api/close/[id]/approve` (2026-04-23)

## Frontend — Dashboard

- [x] Main dashboard page: tx count, spend, CO2e, confidence bar, reserve (`app/page.tsx`) (2026-04-23)
- [x] 6-month stacked area trend chart via Recharts (`components/TrendChart`) (2026-04-23)
- [x] Base UI components: Card, Stat, Badge, Button, ConfidenceBar, Nav (2026-04-23)
- [x] Start Close button wired to backend (2026-04-23)

## Documentation

- [x] DESIGN.md — 500+ line visual/animation spec (2026-04-23)
- [x] Research docs for agent design and LLM ops (2026-04-23)
- [x] PROGRESS.md created (2026-04-24)

## bunq Sandbox / Live Integration

- [x] `scripts/bunq-make-sandbox-user.ts` — mints a fresh sandbox user + API key via `/v1/sandbox-user-person` (2026-04-25)
- [x] `lib/bunq/context.ts` — file-based persistence (`.bunq-context.json`) for installation token, server pub key, sub-account ids (2026-04-25)
- [x] `scripts/bunq-bootstrap.ts` — installation → device-server → session-server, persists session in DB and long-lived state in context file; auto-discovers main account id (2026-04-25)
- [x] `scripts/bunq-create-reserve.ts` — creates the Carbo Reserve sub-account and writes id to context + `orgs.reserve_account_id` (2026-04-25)
- [x] `scripts/bunq-sugardaddy.ts` — RequestInquiry to `sugardaddy@bunq.com` to top up sandbox balance (2026-04-25)
- [x] `scripts/dev-live.sh` — boots cloudflared quick tunnel + Next dev server, prints public webhook URL (2026-04-25)
- [x] Webhook handler now loads server pub key from `.bunq-context.json` (was: empty env var) and dedupes on `bunqTxId` for bunq's 5x retry (2026-04-25)
- [x] `intraUserTransfer` honors `DRY_RUN` — logs to audit chain instead of moving sandbox money when set (2026-04-25)
- [x] `reset-demo.ts` — fixed leftover `pnpm tsx` calls to `npx tsx` (2026-04-25)
