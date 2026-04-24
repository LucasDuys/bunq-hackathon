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

## Research Agent (plans/matrix-research.md)

- [x] Env vars: `RESEARCH_DISABLED`, `RESEARCH_MAX_SEARCHES_PER_CLUSTER=3`, `RESEARCH_CACHE_TTL_DAYS=30`, `RESEARCH_CONCURRENCY=4`, `RESEARCH_MAX_CLUSTERS=20` (`lib/env.ts`) (2026-04-25)
- [x] New tables `research_cache` + `web_search_audit`, plus `server_tool_use_count` + `web_search_requests` on `agent_messages` (schema + migration) (2026-04-25)
- [x] New types: `EvidenceSource`, `ResearchedAlternative`, `ResearchResult`, `ResearchOutput`, `ResearchedPool` (`lib/agents/dag/types.ts`) (2026-04-25)
- [x] `callAgentWithTools()` wrapper around `beta.messages.toolRunner` — extracts `web_search_requests`, citation blocks, server-tool-use count (`lib/agents/dag/llm.ts`) (2026-04-25)
- [x] Research Agent (`lib/agents/dag/research.ts`): native `web_search_20250305` + 2 `betaZodTool`s (`lookup_emission_factor`, terminal `record_alternative`); 4-wide concurrent fan-out; per-cluster sha256 cache with 30-day TTL and ISO-week bucket; fallback ladder live → cache → template → empty; mock mode synthesizes from `GREEN_TEMPLATES` deterministically (2026-04-25)
- [x] Incumbent resolver (`getIncumbentMerchant` in `lib/agents/dag/tools.ts`) — Research Agent skips "Switch to X" when X is the incumbent (2026-04-25)
- [x] Green/Cost agents accept `researchedPool?` — prefer researched over template candidates; source provenance flows through (`greenAlternatives.ts`, `costSavings.ts`) (2026-04-25)
- [x] Green/Cost Judges gain `evidence_quality` — weighted by source count, trusted-domain hits, freshness; zero-source rows auto-rejected regardless of self-score (`greenJudge.ts`, `costJudge.ts`) (2026-04-25)
- [x] `runDag` inserts research between baseline and proposal fan-out; emits `agent.research.run` + `agent.research.cache_hit` audit events with URL fingerprints (`lib/agents/dag/index.ts`) (2026-04-25)
- [x] Executive Report gains `evidence_source_count` + `web_search_spend_eur` KPIs; limitations surface clusters with no viable alternative (`lib/agents/dag/executiveReport.ts`) (2026-04-25)
- [x] `persistDagRun` joins researched sources onto the flattened `impact_recommendations` rows so the UI renders real citation chips (2026-04-25)
- [x] Agent doc `docs/agents/08-research.md` + DAG overview updated (2026-04-25)
- [x] `/impacts` gains Research-evidence KPI card (clusters, sources, web-search spend, freshness) and `ScenarioPlanner` slider — "adopt top N switches → projected Δ cost + Δ CO₂e + avg confidence" (2026-04-25)
- [x] Smoke script `scripts/smoke-research.ts` — mock-mode DAG E2E check; second run confirms cache hits (2026-04-25)
