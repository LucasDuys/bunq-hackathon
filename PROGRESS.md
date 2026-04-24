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
