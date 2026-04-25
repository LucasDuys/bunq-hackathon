# Progress

> **For graders:** this is the receipt log of what shipped. The criterion-aligned summary with file evidence + run-to-verify steps is in [`JUDGE.md`](JUDGE.md). The candid backlog is in [`todo.md`](todo.md). Every claim a grader scores against is cross-referenced from `JUDGE.md`.

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

## Tax Savings & Incentives (Ben)

- [x] `lib/tax/incentives.ts` — Dutch EIA/MIA/Vamil + EU ETS scheme definitions with rates, thresholds, sources (2026-04-24)
- [x] `lib/tax/alternatives.ts` — Green alternative mappings per emission factor (flight→train, gas→electric, meat→plant, etc.) with price ratios (2026-04-24)
- [x] `lib/tax/savings.ts` — Per-transaction + monthly rollup tax savings calculator (2026-04-24)
- [x] `lib/queries.ts` — `getTaxSavingsForMonth()` query wired to tax module (2026-04-24)
- [x] `app/tax-savings/page.tsx` — Full tax savings page: scheme breakdown, category recommendations, switch tips (2026-04-24)
- [x] Dashboard tax savings card with €79,952 annual projection + link to detail page (2026-04-24)
- [x] Nav updated with Tax savings link (2026-04-24)
- [x] `research/13-tax-savings-incentives.md` — Full research brief: NL/EU schemes, category switch savings, demo numbers (2026-04-24)

## Environmental Impact Analysis (Ben)

- [x] `lib/benchmarks.ts` — Industry benchmark data (Exiobase sector averages) for 8 spending categories (2026-04-24)
- [x] `lib/agent/impact-analysis.ts` — Claude Sonnet impact analysis agent: benchmark comparison, switch opportunity ranking, AI narrative generation with mock mode (2026-04-24)
- [x] `app/api/impact/analyze/route.ts` — API route to trigger impact analysis (2026-04-24)
- [x] `components/BenchmarkChart.tsx` — Horizontal bar chart comparing user intensity vs industry average per category (2026-04-24)
- [x] `components/ImpactSimulator.tsx` — "What if" client-side simulator: toggle spending switches and see projected CO₂e + EUR savings update live (2026-04-24)
- [x] `app/impact/page.tsx` — Full impact analysis page: KPIs, AI narrative, benchmark chart, top 5 switches, what-if simulator, methodology (2026-04-24)
- [x] Dashboard impact CTA card with top switch opportunity + CO₂e avoidable per year (2026-04-24)
- [x] Nav updated with Impact link (2026-04-24)

## Frontend — UI Overhaul (Ben)

- [x] `app/globals.css` — Full design token system: near-black palette, green accents, border/shadow tokens, ca-card gradient class, keyframe animations (pulse-dot, shimmer, slide-up, bar-grow, count-flash), reduced-motion support (2026-04-24)
- [x] `components/ui.tsx` — Redesigned primitives: Card (ca-card), Stat (Instrument Serif numbers), Badge (toned), Button (pill-shaped gradient), ConfidenceBar (glow effect), new KpiChip + PulseDot components (2026-04-24)
- [x] `app/layout.tsx` — Instrument Serif font loading, dark-only body, widened max-width (2026-04-24)
- [x] `components/TrendChart.tsx` — Green gradient fill, dark tooltip with backdrop blur, removed grid strokes (2026-04-24)
- [x] `app/page.tsx` — Hero reserve card with radial glow, KPI chip column, pipeline explanation, category spend bars (2026-04-24)
- [x] `app/categories/page.tsx` — Stagger animations, gradient share bars with glow (2026-04-24)
- [x] `app/close/[id]/page.tsx` — Pipeline steps as grid cards with green active state + pulse (2026-04-24)
- [x] `app/ledger/page.tsx` — Consistent dark theme tokens (2026-04-24)
- [x] `app/reserve/page.tsx` — Serif stat cards, gradient credit project cards (2026-04-24)
- [x] `app/report/[month]/page.tsx` — Dark theme, serif E1-7 stats, styled methodology section (2026-04-24)

## UI Polish & Fixes (Ben)

- [x] `app/globals.css` — Section divider CSS (gradient lines, label centering), bunq accent colors (--blue, --purple + soft variants), class-based plain divider (replaced broken `:has()` pseudo-class) (2026-04-24)
- [x] `components/ui.tsx` — SectionDivider + DonutChart components added (2026-04-24)
- [x] `components/TrendChart.tsx` — Conditional dual-axis (spend line only when data exists), domain fallback for empty CO₂e, custom legend, formatter type fix (2026-04-24)
- [x] Section dividers added to all pages: dashboard, impact, tax-savings, categories, close, ledger, reserve, report (2026-04-24)
- [x] `app/tax-savings/page.tsx` — Converted from light Tailwind classes to dark-theme CSS variables (2026-04-24)
- [x] `app/impact/page.tsx` — Section dividers between all content blocks (2026-04-24)

## Impact Page Overhaul (Ben)

- [x] `app/impact/page.tsx` — Full visual overhaul: hero KPI card with serif € number + radial glow, 4 KpiChip cards (intensity, benchmark, CO₂e avoidable, monthly footprint), pullquote-style AI narrative, 2×2 matrix + benchmark chart side-by-side, switch cards grid, simulator, methodology footer (2026-04-24)
- [x] `components/ImpactMatrix.tsx` — 2×2 cost-vs-carbon quadrant matrix: Quick wins / Green investments / Cost savers / Avoid, median-based classification, category-colored items (2026-04-24)
- [x] `components/SwitchCard.tsx` — Before/after visual comparison cards: ranked switches with "Now" (red) → "After" (green) bars, CO₂e reduction %, annual savings stats (2026-04-24)

## Backend — Baseline Agent (Lucas)

- [x] `lib/agents/dag/spendBaseline.ts` — Spend & emissions baseline agent with structured output via Anthropic tool_use (2026-04-24)
- [x] `lib/agents/dag/` — DAG routing, reasons, types infrastructure (2026-04-24)
- [x] `scripts/dag-smoke.ts` — DAG smoke test script (2026-04-24)
- [x] `app/api/baseline/run/route.ts` — API route for baseline agent (2026-04-24)

## Documentation

- [x] DESIGN.md — 14-section visual/animation spec, Wise + bunq-inspired (2026-04-23)
- [x] Research docs for agent design and LLM ops (2026-04-23)
- [x] PROGRESS.md created (2026-04-24)
- [x] TODO.md updated — marked completed UI/impact items, added logging note (2026-04-25)

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

## Merge — matrix → merge-branch (2026-04-25)

- [x] Merged `matrix` into `merge-branch` — onboarding agent tracks, `/impacts` matrix page, research agent DAG node, and evidence-weighted judges now land on the shared branch (2026-04-25)
- [x] Consolidated duplicate impact surfaces: dropped legacy `/impact` page + `/api/impact/analyze` route, `components/ImpactSimulator.tsx`, `components/BenchmarkChart.tsx` in favor of matrix's `/impacts` + `ImpactMatrix` + `ScenarioPlanner` + `RunImpactResearch` (2026-04-25)
- [x] Removed orphaned baseline-agent helpers after accepting matrix's deterministic spendBaseline: `lib/agents/dag/reasons.ts`, `lib/agents/dag/routing.ts`, `lib/agents/dag/__tests__/spendBaseline.test.ts`, `scripts/baseline-mock-run.ts` (fields they assumed were collapsed into matrix's enriched `PriorityTarget`) (2026-04-25)
- [x] Kept tax-savings feature (`lib/tax/*`, `app/tax-savings`, `getTaxSavingsForMonth`) and `lib/agent/impact-analysis.ts` since the home KPI row still depends on `buildCategoryAnalyses` (2026-04-25)
- [x] Nav split into server `Nav.tsx` (queries onboarding + policy state) + client `NavLinks.tsx` (pathname-based active pill) so the onboarding link stays accurate without round-tripping through a status API (2026-04-25)
- [x] `app/globals.css` now carries both design systems: the dark-first Carbo tokens from merge-branch *and* matrix's semantic aliases (`--fg-*`, `--bg-surface*`, `--status-*`, `--quadrant-*`, `--brand-forest-*`, `--brand-mint-*`) so `ImpactMatrix`/`ScenarioPlanner` render against the same palette without raw hex (2026-04-25)
- [x] Home page keeps the polished dark hero and adds matrix's onboarding banner (themed to the dark palette) when `hasPolicy=false` or an onboarding run is active (2026-04-25)
- [x] `spendBaseline.run` ctx parameter relaxed to optional so `/api/baseline/run` + dag smoke callers keep working alongside the DAG entry (2026-04-25)
- [x] `npx tsc --noEmit` green end-to-end after merge (2026-04-25)

## Invoice Ingestion (Ben)

- [x] `lib/db/schema.ts` — `invoices` + `invoice_line_items` tables with indexes, type exports (2026-04-25)
- [x] `scripts/migrate.ts` — DDL for both tables + 4 indexes (2026-04-25)
- [x] `lib/env.ts` — Gmail env vars: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_POLL_ADDRESS`, `GMAIL_MOCK` (2026-04-25)
- [x] `lib/invoices/storage.ts` — File storage layer: save/read/base64, MIME validation, max 10MB (2026-04-25)
- [x] `lib/invoices/extract.ts` — Claude Sonnet multimodal extraction with Zod schema, mock mode, PDF + image support (2026-04-25)
- [x] `lib/invoices/process.ts` — Shared processing pipeline: extract → classify → link → store → audit (2026-04-25)
- [x] `lib/invoices/gmail.ts` — Gmail API polling client with OAuth2, attachment download, dedup via `gmail_message_id` (2026-04-25)
- [x] `app/api/invoices/upload/route.ts` — Upload endpoint with FormData, MIME + size validation (2026-04-25)
- [x] `app/api/invoices/route.ts` — List invoices GET endpoint (2026-04-25)
- [x] `app/api/invoices/[id]/route.ts` — Invoice detail GET endpoint with line items (2026-04-25)
- [x] `app/api/invoices/[id]/link/route.ts` — Manual transaction linking POST endpoint (2026-04-25)
- [x] `app/api/invoices/gmail/poll/route.ts` — Gmail poll trigger endpoint (2026-04-25)
- [x] `lib/queries.ts` — Invoice query functions: `getInvoicesForOrg`, `getInvoice`, `getInvoiceLineItems`, `getInvoiceWithItems`, `getInvoiceStats` (2026-04-25)
- [x] `components/InvoiceUpload.tsx` — Drag-and-drop upload component with progress states (2026-04-25)
- [x] `app/invoices/page.tsx` — Invoice list page: stats row, upload card, invoice table (2026-04-25)
- [x] `app/invoices/[id]/page.tsx` — Invoice detail page: stats, metadata, line items table (2026-04-25)
- [x] `components/Nav.tsx` — Added "Invoices" nav link (2026-04-25)
- [x] `fixtures/invoices/` — 3 demo fixtures: KLM, AWS, Albert Heijn with line items (2026-04-25)
- [x] `scripts/seed.ts` — `seedInvoices()` seeds demo invoices with classification + transaction linking (2026-04-25)
- [x] `npm install googleapis` — Gmail API dependency added (2026-04-25)
- [x] `app/api/invoices/[id]/file/route.ts` — File serving endpoint: view/download stored invoice files (2026-04-25)
- [x] `app/api/invoices/[id]/reprocess/route.ts` — Reprocess endpoint: re-run Claude extraction on failed/stale invoices (2026-04-25)
- [x] `components/InvoiceActions.tsx` — Client component: view file, download, reprocess buttons with loading states (2026-04-25)
- [x] `scripts/test-invoice-extraction.ts` — Test script for mock + live extraction pipeline (`npm run invoice:test`) (2026-04-25)
- [x] DAG integration: baseline agent queries linked invoices, boosts confidence +0.15, sets `data_basis: "invoice"` for downstream agents (2026-04-25)
- [x] `lib/agents/dag/types.ts` — Added `baseline_has_invoice`, `baseline_invoice_count`, `baseline_data_basis` to PriorityTarget (2026-04-25)
- [x] Green alternatives agent uses `data_basis: "item_level"` for invoice-backed clusters (2026-04-25)
- [x] Cost savings agent uses `data_basis: "invoice"` for invoice-backed clusters (2026-04-25)
- [x] `docs/invoices.md` — Full teammate documentation: architecture, API routes, testing, DB schema, DAG integration (2026-04-25)

## bunq Sandbox / Live Integration (2026-04-25)

- [x] `scripts/bunq-make-sandbox-user.ts` — mints a fresh sandbox user + API key via `/v1/sandbox-user-person` (2026-04-25)
- [x] `lib/bunq/context.ts` — file-based persistence (`.bunq-context.json`) for installation token, server pub key, sub-account ids (2026-04-25)
- [x] `scripts/bunq-bootstrap.ts` — installation → device-server → session-server, persists session in DB and long-lived state in context file; auto-discovers main account id (2026-04-25)
- [x] `scripts/bunq-create-reserve.ts` — creates the Carbo Reserve sub-account and writes id to context + `orgs.reserve_account_id` (2026-04-25)
- [x] `scripts/bunq-sugardaddy.ts` — RequestInquiry to `sugardaddy@bunq.com` to top up sandbox balance (2026-04-25)
- [x] `scripts/dev-live.sh` — boots cloudflared quick tunnel + Next dev server, prints public webhook URL (2026-04-25)
- [x] Webhook handler now loads server pub key from `.bunq-context.json` (was: empty env var) and dedupes on `bunqTxId` for bunq's 5x retry (2026-04-25)
- [x] `intraUserTransfer` honors `DRY_RUN` — logs to audit chain instead of moving sandbox money when set; carries `closeRunId` for chain linkage (2026-04-25)
- [x] `reset-demo.ts` — fixed leftover `pnpm tsx` calls to `npx tsx` (2026-04-25)
- [x] `scripts/fire-test-event.ts` (`npm run dev:fire`) — POSTs synthetic bunq MUTATION events to the local webhook handler so the demo has live ingestion without any real bunq (2026-04-25)
- [x] Wired close state machine to actually call `intraUserTransfer` for `reserve_transfer` actions (was: audit-log only). Verified via end-to-end run: `bunq.transfer.dry_run` audit row now follows every `action.reserve_transfer`. (2026-04-25)
- [x] Auto-execute under-threshold close runs per `CONCEPT.md` "Agentic action": `finalizeEstimates` calls `approveAndExecute("system")` inline when `outcome.requiresApproval` is false; audit row marked `actor: "system", auto: true`. (2026-04-25)

## Explain Assistant (2026-04-25)

- [x] `lib/explain/{metrics,context,prompt,mock,sse,schema}.ts` — 14-metric registry + per-metric context builders (≤5-contributor aggregation, <1.5KB stringified per AGENTS.md) + cached system prelude + deterministic mock narrator + SSE helpers + zod schemas (2026-04-25)
- [x] `app/api/explain/route.ts` — POST endpoint streaming `text/event-stream`. Mock path streams templated narrative; live path forwards Anthropic `text_delta` events with prompt-cache prelude. Aborts cleanly on client disconnect. (2026-04-25)
- [x] `components/ExplainProvider.tsx` — global client provider: `useExplain().{open, close, ask, stop}`. Tracks streaming reader, ESC, focus return, body scroll lock. Ephemeral history. (2026-04-25)
- [x] `components/ExplainButton.tsx` — icon-only Sparkles ghost button placed next to every metric. (2026-04-25)
- [x] `components/ExplainModal.tsx` — centered modal (640px desktop, full-bleed sheet < 600px), no shadow, focus trap, "Open in full view" deep-link to `/assistant`. Suppresses itself on `/assistant` so the page renders provider state inline. (2026-04-25)
- [x] `components/ExplainThread.tsx` — minimal markdown renderer (`**bold**`, lists, inline code) + citation chips for `[tx:…]`/`[run:…]`/`[event:…]`/`[factor:…]`. (2026-04-25)
- [x] `components/ExplainComposer.tsx` — autosize textarea (1–4 rows), Enter/Shift-Enter, Stop-while-streaming. (2026-04-25)
- [x] `components/AssistantWorkspace.tsx` + `app/assistant/page.tsx` — full-page assistant with deep-link hydration from `?metric&scope`. (2026-04-25)
- [x] Sidebar — added "Assistant" entry to `Workspace` group. (2026-04-25)
- [x] Wired ExplainButtons across dashboard (4 KPIs, trend, breakdown, confidence, impact teaser), close detail (hero), report month (hero), reserve (hero + credit-mix), ledger (header + chain card), invoices (header), impacts (header), briefing (header). (2026-04-25)
- [x] `app/globals.css` — `.explain-*` styles: tokenized colors, no shadows, mobile bottom-sheet, `prefers-reduced-motion` opacity-only. (2026-04-25)
- [x] `KpiChip` — added optional `action` slot (top-right) so the Explain affordance composes without wrapping div hacks. (2026-04-25)

## DAG ↔ Close Integration + Live Verification (2026-04-25)

- [x] `lib/agent/close.ts` — DAG_RUNNING state calls runDag(), replaces legacy questions.ts + narrative.ts (commit 187aace) (2026-04-25)
- [x] `lib/agent/close.ts` — persistDagRun() called after DAG completes so close-driven runs are visible in /agents inspector (2026-04-25)
- [x] Live E2E verified: ANTHROPIC_MOCK=false, 0/7 mock agents, all Zod parsing passed, 400s wall time (2026-04-25)
- [x] `scripts/live-close-test.ts` — Full close flow test script with CO₂ number breakdown (2026-04-25)
- [x] `scripts/inspect-last-run.ts` — DAG run inspector script showing per-agent results (2026-04-25)

## UI Bug Fixes (Ben)

- [x] `components/AssistantWorkspace.tsx` — Fixed assistant chat scroll: removed `overflow-hidden` from card shell that clipped the scrollable thread container; capped thread `maxHeight` at `60dvh` for reliable viewport-relative constraint (2026-04-25)
- [x] `components/AssistantWorkspace.tsx` + `components/ExplainModal.tsx` — Auto-scroll now checks proximity (< 80px from bottom) before snapping; users scrolled up to re-read earlier messages are no longer yanked back during streaming (2026-04-25)
- [x] `components/ExplainModal.tsx` — Added Escape key handler to focus-trap effect; pressing ESC now closes the modal as the tooltip "Close (ESC)" promised (2026-04-25)
- [x] `app/invoices/page.tsx` — Migrated all legacy design tokens (`--text`, `--text-mute`, `--text-dim`, `--text-faint`, `--border`, `--green`) to canonical tokens (`--fg-primary`, `--fg-muted`, `--fg-secondary`, `--fg-faint`, `--border-faint`, `--brand-green`); replaced `font-semibold` headers with `CodeLabel` components for design-system consistency; removed unused `fmtPct` import (2026-04-25)
- [x] `app/ledger/page.tsx` — Added `min-width: 780px` to audit table so columns maintain readable widths before horizontal scroll activates on narrow viewports (2026-04-25)

## Audit QR Verification (Ben)

- [x] `lib/audit/digest.ts` — Canonical SHA-256 digest for close runs: bundles `{runId, month, co2eKg, confidence, reserveEur, approvedAt, auditEventCount, lastHash}` into a deterministic hash (2026-04-25)
- [x] `components/AuditQR.tsx` — Client component rendering scannable QR code via `qrcode.react`; URL uses `window.location.origin` so it works behind cloudflare tunnel during demo (2026-04-25)
- [x] `app/verify/[id]/page.tsx` — Public verification landing page: runs `verifyChain()`, checks digest match, shows close summary (emissions, confidence, reserve, approval date), chain integrity status, mobile-first dark theme (2026-04-25)
- [x] `app/close/[id]/page.tsx` — Added "Proof of carbon offset" QR card in the Loop Closed section; only renders when close run is approved (2026-04-25)
- [x] `npm install qrcode.react` — QR rendering dependency (2026-04-25)

## bunq generates the report — Auto-generated CSRD PDF (2026-04-25)

> The pitch: bunq generates the company's CSRD ESRS E1-7 source artefact automatically.
> The sustainability team downloads the PDF — no spreadsheets, no consultant assembly.
> Conservative time savings for a 50-person SME: ~80% reduction in CSRD assembly hours
> and €10–30k/yr saved on consultant fees.

- [x] `lib/bunq/notes.ts` (`writeCarbonNote`, `attachReceiptToPayment`) — every bunq Payment carries a Carbo carbon stamp on the bank's side (`"kg CO2e: 8.45 ±2.96 | factor: DEFRA 2024 #travel.taxi"`) (PR #6 Phase 1, 2026-04-25)
- [x] `app/api/webhook/bunq/route.ts` — webhook handler writes the NoteText after every `tx.ingested`, audits `bunq.note.written` / `bunq.note.failed` (2026-04-25)
- [x] `scripts/bunq-backfill-notes.ts` (`npm run bunq:backfill-notes`) — paints every existing transaction with a NoteText. Idempotent. (2026-04-25)
- [x] `lib/bunq/draft-payment.ts` (`createDraftPayment`, `getDraftPayment`) + `app/api/bunq/draft-callback/route.ts` — over-threshold close runs route approval through bunq's app via DraftPayment; bank-grade signature gates the money. (PR #6 Phase 2, 2026-04-25)
- [x] `scripts/fire-draft-callback.ts` (`npm run dev:fire-draft -- --draft=<id>`) — demo shortcut that POSTs a synthetic ACCEPTED/REJECTED callback so the flow runs without a real CFO bunq user. (2026-04-25)
- [x] `lib/bunq/annual-export.ts` + `scripts/bunq-annual-export.ts` (`npm run bunq:annual-export -- --year=2026`) — generates the auditor-facing year-end pair: `data/exports/carbo-annual-{year}.csv` (every tx with the carbon column) + `data/exports/bunq-annual-{year}.pdf` (bunq's official annual overview). (PR #6 Phase 3, 2026-04-25)
- [x] `lib/reports/auto-export.ts` (`writeMonthlyReport`, `writeAnnualReport`) — reuses `buildBriefing` + `briefingDocument` (and `buildAnnualReport` + `enrichWithNarrative` + `annualReportDocument` for annual). Renders → writes → SHA-256 → audits `bunq.report.generated`. (PR #6 follow-up, 2026-04-25)
- [x] `lib/agent/close.ts approveAndExecute()` — auto-export hook fires after `close.completed`. December closes additionally fire the annual once per year (idempotent via audit-chain scan). Failure is non-fatal — `bunq.report.failed` audit, close stays `COMPLETED`. Gated by `CARBO_AUTOEXPORT` env (default true). (2026-04-25)
- [x] `lib/agent/report-agent.ts` — stable facade: `runReportAgent`, `writeMonthlyReport`, `writeAnnualReport`. JSDoc explains trigger points, outputs, failure modes. (2026-04-25)
- [x] `app/api/reports/download/route.ts` — guarded streamer for `data/exports/`. 200 for canonical paths, 403 for path traversal or any path outside `data/exports/`. (2026-04-25)
- [x] `app/page.tsx` — Reports panel between KPI strip and Trend; lists last 6 generated PDFs with one-tap download links. Empty state: "No reports yet — they auto-generate when a close completes." (2026-04-25)
- [x] `lib/queries.ts` — `getGeneratedReports()` helper reads recent `bunq.report.generated` audit rows. (2026-04-25)
- [x] **Visual upgrade** to `lib/reports/render-briefing.tsx`: dedicated cover page (period as headline, three hero KPI cards, signature line for sustainability lead), equivalency cards, share bars on tables, anomaly pills (`+239%` warn / `NEW` mint), polished swap badges, footer rewritten so it no longer contradicts the cover ("source disclosure feeding <orgName>'s annual CSRD ESRS E1 report"). PDF metadata: title "Carbon report", author "bunq Carbo". (PR #6 follow-up, 2026-04-25)
- [x] `wrap={false}` on table rows + sections — keeps Top categories and Top emitting merchants on a single page; eliminates the orphan-page-3 issue. (PR #7, 2026-04-25)
- [x] `scripts/render-mock-pdf.ts` (`npm run reports:mock`) — fixture-driven mock renderer; produces `data/exports/mock-bunq-carbo-monthly.pdf` with no DB / close-run dependency. Useful for handing the document to a stakeholder in isolation. (2026-04-25)

### Files

| Concern | Files |
|---|---|
| Agent facade | `lib/agent/report-agent.ts` |
| Render + write + hash + audit | `lib/reports/auto-export.ts` |
| PDF templates | `lib/reports/render-briefing.tsx`, `lib/reports/render-annual.tsx` |
| Triggered by | `lib/agent/close.ts` (after `close.completed`) |
| Download | `app/api/reports/download/route.ts` |
| Dashboard surface | `app/page.tsx` (Reports panel) |
| Mock | `scripts/render-mock-pdf.ts` (`npm run reports:mock`) |
| Year-end CSV pair | `scripts/bunq-annual-export.ts` (`npm run bunq:annual-export`) |

## Code Quality Audit & Bug Fixes (2026-04-25)

Full codebase audit: TypeScript compilation, API routes, core lib/ logic, UI components.
`tsc --noEmit` + `next build` both pass clean before and after all fixes.

### Critical fixes

- [x] `lib/policy/evaluate.ts` — `ruleEurForCategory()` missing switch default caused `TypeError: undefined.toFixed(2)` on unrecognized rule methods. Added exhaustive check with `never` type + fallback. (2026-04-25)
- [x] `app/api/close/[id]/answer/route.ts` — Request body was `as`-cast without validation; malformed payloads crashed downstream. Added Zod schema (`z.object({ qaId: z.number().int(), answer: z.string().min(1) })`) with proper error response. (2026-04-25)
- [x] `app/api/invoices/[id]/file/route.ts` — `Content-Disposition` header used unsanitized `invoice.fileName`; `\r\n` in filename allowed HTTP response splitting. Now strips `"`, `\r`, `\n`, `\` from filename. (2026-04-25)
- [x] `lib/agent/close.ts:372-375` — N+1 query anti-pattern: fetched each affected transaction with a separate `db.select()` via `.concat(...map())`. Replaced with single `inArray(transactions.id, affectedIds)` query. (2026-04-25)

### High-priority fixes

- [x] `lib/emissions/estimate.ts:26` — `uncertaintyPct` from factor rows was used unclamped; values > 1.0 produced negative emission estimates. Added `Math.max(0, Math.min(1, u))` bound. (2026-04-25)
- [x] `app/api/bunq/draft-callback/route.ts:39` — LIKE pattern used unsanitized `draftId` from external JSON. Added type guard (`typeof draftId !== "number"`) and `%`/`_` stripping. (2026-04-25)
- [x] `components/SwitchCard.tsx` — 5 design system violations fixed: `font-bold` (700) → `font-medium` (500); `font-serif` removed; `font-semibold` (600) → `font-medium` (500) in 3 places; hard-coded `rgba(48,192,111,...)` → `var(--brand-green-border)` token; `boxShadow` glow removed per DESIGN.md no-shadow rule. (2026-04-25)
- [x] `components/TrendChart.tsx:4-5` — Documented hard-coded hex constants as mirrors of `--brand-green` / `--status-info` (raw hex needed for SVG `stopColor` in Recharts). (2026-04-25)

### Medium-priority fixes

- [x] `lib/invoices/process.ts:50` — Date window filter only applied when >1 candidates; a single wrong-date match was accepted unchecked. Now applies window regardless of candidate count. (2026-04-25)
- [x] `lib/invoices/process.ts:68` — `candidates[0].id` could throw if all candidates were filtered out. Changed to `candidates[0]?.id ?? null`. (2026-04-25)
- [x] `lib/invoices/process.ts:113` — Non-EUR currencies silently stored as EUR with no warning. Added `console.warn` for non-EUR extractions. (2026-04-25)
- [x] `components/ClusterConstellation.tsx:666` — Drop shadow `boxShadow: "rgba(0,0,0,0.20) 0 4px 18px"` on tooltip violated DESIGN.md §6 no-shadow rule. Removed. (2026-04-25)
- [x] `app/invoices/[id]/page.tsx` — 3 instances of `font-semibold` (weight 600) → `font-normal` (weight 400) per DESIGN.md §3.3 max weight rule. (2026-04-25)

## Launch Demo Enhancements (Ben)

- [x] `app/launch/LaunchTimeline.tsx` — Background music: loads `public/launch-bg.mp3`, starts on first user interaction, pauses/resumes with demo, fades out over last 2.5s at demo end (2026-04-25)
- [x] `app/launch/LaunchTimeline.tsx` — Dancing ghost mascot (`public/ghost.gif`) pinned top-left, 120px, always visible during demo (2026-04-25)
- [x] `app/launch/scenes/S11Q.tsx` — New scene: carbon credit retirement certificate (uses existing `CreditCertificate` component with line-by-line print + RETIRED stamp) (2026-04-25)
- [x] `app/launch/scenes/S15B.tsx` — New scene: audit hash chain visualization (uses existing `AuditLedgerScroll` component with terminal-style hash reveal + green verification sweep) (2026-04-25)
- [x] `app/launch/data.ts` — S05 title updated to "Multimodal AI reads what bank text won't"; S11P caption describes RSA-SHA256 signed sub-account transfer; S11Q header "Fewer emissions means fewer credits to buy"; S15B header "Every event hashes the one before it" (2026-04-25)
- [x] `app/launch/components/AboveWindowCaption.tsx` — Caption font bumped 12px→16px, letter-spacing 0.6px→0.3px for readability (2026-04-25)
- [x] `app/launch/types.ts` — Added `S11Q` and `S15B` scene IDs to `SceneId` union (2026-04-25)
- [x] Removed S15C (QR/Proof of Green scene) — not needed for demo (2026-04-25)
