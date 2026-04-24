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

## Onboarding

- [x] Agentic onboarding state machine with 11 states, DB-persisted, audit-event on every transition (`lib/agent/onboarding.ts`) (2026-04-24)
- [x] Two new tables: `onboarding_runs`, `onboarding_qa`, with indexes (`lib/db/schema.ts`, `scripts/migrate.ts`) (2026-04-24)
- [x] Three-track UX: generate from interview, upload existing policy, mix (upload + refine) (`app/onboarding/page.tsx`) (2026-04-24)
- [x] LLM interviewer (Sonnet) with deterministic fallback plan — 15-question topic tree, skip logic, profile accumulation (`lib/agent/onboarding-interviewer.ts`) (2026-04-24)
- [x] LLM drafter (Sonnet) produces Zod-valid Policy + CSRD-flavoured markdown document + calibration notes (`lib/agent/onboarding-drafter.ts`) (2026-04-24)
- [x] LLM parser for uploaded policies — PDF via Sonnet multimodal, DOCX via adm-zip, MD/YAML/JSON/TXT native (`lib/agent/onboarding-parser.ts`) (2026-04-24)
- [x] Profile → calibrated policy heuristics (ambition / travel / cloud multipliers, sector-aware procurement) (`lib/onboarding/calibration.ts`) (2026-04-24)
- [x] Deterministic markdown renderer for auditor-ready policy docs (`lib/onboarding/markdown.ts`) (2026-04-24)
- [x] Finalization writes policy row, deactivates prior, mocks/creates bunq sub-accounts, seeds first close run (2026-04-24)
- [x] API routes: `/api/onboarding/start`, `[runId]/upload`, `[runId]/answer`, `[runId]/approve`, `[runId]/revise`, `[runId]/cancel` (2026-04-24)
- [x] OnboardingClient.tsx — track picker, MC/numeric/free-text/confirm answer form, drag-drop upload, draft preview with rules-table + markdown view + .md download, approve + reset controls (2026-04-24)
- [x] Dashboard banner + Nav link shown when no active policy or active onboarding run exists (2026-04-24)
- [x] Example policy fixture at `fixtures/example-policy.md` to demo the upload path (2026-04-24)
