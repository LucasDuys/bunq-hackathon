# TODO

> **For graders:** the criterion-by-criterion claim/evidence/verify map lives in [`JUDGE.md`](JUDGE.md). The list below is the candid post-hackathon backlog — kept transparent on purpose.

## What ships in the demo (verifiable today)

The MVP is functional end-to-end. Every claim in `JUDGE.md` §1–§5 is anchored to a file path or a runnable script. Mock-mode demo runs without keys; live-mode flips one flag (`ANTHROPIC_MOCK=0`, `BUNQ_MOCK=0`). See `JUDGE.md` §6 for the verification command list.

## Known limitations (transparent)

- **Live-mode end-to-end has not been run in CI.** Every component runs in isolation — the reproducible recipe is `scripts/dev-live.sh` plus the bunq script chain documented in `DEMO.md`. The hackathon team prioritised mock-stability for the demo over a live-mode dress rehearsal.
- **`agent_messages` per-call instrumentation** populates only on live LLM runs (`ANTHROPIC_MOCK=0`); the deterministic mock path skips logging by design. The schema + `agentRuns` rows still populate in mock mode.
- **Carbon-credit purchase is logged as a structured payment description**, not a real registry call — see "What's real vs simulated" in `README.md`. The reserve transfer that funds it *is* a real bunq intra-user transfer.
- **DAG ↔ close state machine** integration is complete (commit `187aace`). The close machine now calls `runDag()` in the `DAG_RUNNING` state, replacing the legacy `questions.ts` + `narrative.ts` LLM touchpoints.

## Backlog (post-hackathon)

The detailed engineering backlog from the team follows. It is intentionally specific so future-you (or a reviewer) can pick up exactly where we left off.

---

Everything the plan called for but we didn't ship — organized by blast radius. Hackathon MVP is functional; this is the list for anyone (or future-you) picking up after the demo.

## Matrix DAG (commit `b5b4c5e`) — follow-ups

The 7-agent DAG (`lib/agents/dag/`) now runs end-to-end behind `/impacts`. Deterministic baseline → parallel Green Alt + Cost Savings (Sonnet 4.6, cached system prompts) → parallel Green Judge + Cost Judge → Credit Strategy → Executive Report. Plan + budget in `plans/matrix-dag.md`. What this branch did **not** ship:

- [x] **Live web search (Research Agent).** Shipped in `lib/agents/dag/research.ts` via Anthropic's native `web_search_20250305` tool + `betaZodTool` terminal recorder, bounded by `RESEARCH_MAX_SEARCHES_PER_CLUSTER`. Results cache for 30 days per `(category, sub_category, jurisdiction, policy_digest, week_bucket)` in `research_cache`. Fallback ladder: live → cache → template → honest gap. Mock mode synthesizes from templates so `/impacts` stays populated with `ANTHROPIC_MOCK=1`. Plan: `plans/matrix-research.md`. Docs: `docs/agents/08-research.md`.
- [x] **Anthropic `toolRunner` loop (Research Agent).** `callAgentWithTools` in `lib/agents/dag/llm.ts` drives the research agent's `messages.toolRunner` with 3 Zod tools + native web_search. The other 6 DAG agents still use the pre-resolved-tools pattern; swap them only if we want iterative row-level lookups (`env.maxToolCalls=8` remains as the guard there).
- [x] **`agent_messages` table populated.** Populated on live runs via `recordAgentMessage` in `lib/agents/dag/persist.ts`. Token counts recorded per agent. Mock path still skips logging by design. (2026-04-25)
- [ ] **`/agents/[runId]` inspector page.** Full payload is persisted in `agent_runs.dag_payload`; no UI yet. Useful for debugging live-mode regressions.
- [ ] **PDF render of `executiveReport.pdf_render_payload`.** Stub field only; no renderer. Plumb into the existing report flow once the dashboard story is signed off.
- [x] **Hook the DAG into `lib/agent/close.ts`.** Commit `187aace` replaced `questions.ts` + `narrative.ts` with a `runDag()` call in a `DAG_RUNNING` state. The close machine now calls `runDag()` at line 283 of `close.ts`. (2026-04-25)
- [x] **Live-mode smoke test.** Successful live run with `ANTHROPIC_MOCK=false` completed: 0/7 mock agents, 400s wall time, all Zod parsing passed, green judge rejected 6/19 proposals for real issues. (2026-04-25)
- [ ] **Evidence bundle export.** ZIP: `recommendations.csv` + `sources/*.html` snapshots + `manifest.json` with SHA-256 hashes of each source page. Third-party verifier CLI (`npx carbo verify`) consumes it. §14.5 of `plans/matrix-research.md`.
- [ ] **Community cache.** Two bunq businesses in the same SIC code + jurisdiction share `research_cache` rows — the key is already policy-hashable. Needs schema flag for "public OK" before we can share across orgs. §14.6.
- [ ] **Weekly re-research cron.** If a new alternative appears with >20% better delta, notify via bunq RequestInquiry. `researchAgent.purgeExpiredCache()` already exists; just needs a scheduler + diff logic. §14.3.
- [ ] **Jurisdiction table hardcoded.** `lib/agents/dag/tools.ts::JURISDICTIONS` covers NL/DE/FR/EU with 2024 rates + a flat €80/tCO₂e ETS assumption. No sector-specific ETS exposure. Replace with a signed data source (EC ETS auction results + national tax lookup) when we move past hackathon scope.
- [ ] **Design tokens migration mostly done.** `/impacts`, `components/ImpactMatrix.tsx`, and `app/invoices/page.tsx` now use canonical `var(--fg-*)` / `var(--status-*)` / `var(--quadrant-*)` tokens. Remaining: some `components/ui.tsx` Tailwind raw color classes + a few close/dashboard remnants. Low priority — CSS aliases keep them working.
- [ ] **Recurring-spend detector is coarse.** `detectRecurringSpend` uses a month-bucket set count over 6 months (≥3 months = recurring). No variance / amount-stability check. Good enough for demo; swap for a proper periodicity detector before production.
- [ ] **Implementation cost = 0 everywhere.** `creditStrategy.ts::IMPLEMENTATION_COST_DEFAULT` is hard-coded to 0 because we don't want to invent numbers. Payback-period math consequently always returns 0. Wire a small per-alternative-type implementation-cost table when the UX calls for it.

## Not yet wired to real services
Mock mode works end-to-end. Bunq live path is fully scripted but not yet exercised against the live sandbox.

- [ ] **Bunq sandbox end-to-end** — scripts exist (`bunq:sandbox-user`, `bunq:keygen`, `bunq:bootstrap`, `bunq:create-reserve`, `bunq:sugardaddy`, `bunq:register`, `dev:live`); still need to run them in order against the sandbox to confirm a real `MUTATION` lands in `transactions` and a real intra-user transfer moves balance.
- [ ] **Anthropic live mode** — hit Haiku 4.5 classifier and Sonnet 4.6 question generator / CSRD narrative for real. Verify JSON output compliance; handle Anthropic rate limits. Currently: `ANTHROPIC_MOCK=1` by default; live path exists, untested under load.
- [x] **Cloudflare Tunnel in front of `/api/webhook/bunq`** — `npm run dev:live` boots the tunnel + dev server and prints the public URL. Still need to (a) install cloudflared on the demo laptop, (b) run it, (c) paste URL into `BUNQ_WEBHOOK_URL`, (d) `npm run bunq:register`.
- [x] **`sugardaddy@bunq.com` seeding** — `scripts/bunq-sugardaddy.ts` sends a RequestInquiry; default amount EUR 500 (override with `SUGARDADDY_AMOUNT`).

## Tax Savings & CO₂ Analysis Agent (Ben — next phase)

Tax incentive data layer is shipped (`lib/tax/`). Next steps to make it demo-ready and impressive:

- [x] **CO₂ environment impact analysis agent** — Claude Sonnet agent: benchmark comparison, switch ranking, AI narrative. `lib/agent/impact-analysis.ts` (2026-04-24)
- [x] **"What if" simulator UI** — `/impact` page with client-side toggle simulator (2026-04-24)
- [x] **Industry benchmark comparison** — bar chart "you vs. industry" per category from Exiobase averages (2026-04-24)
- [ ] **Tax savings integration into monthly close** — add a `CALCULATE_TAX_SAVINGS` step after `APPLY_POLICY` in the close state machine. Store `taxSavingsEur` on the `close_runs` row. Include in the CSRD narrative.
- [ ] **Annual tax savings report page** — `/tax-savings/annual`: aggregate 12 months, show total EIA/MIA/Vamil deductions claimable, with "how to claim" links to RVO.nl portals.
- [ ] **Per-transaction tax badge on categories page** — on `/categories`, show a small "€X saveable" tag next to categories that have green alternatives.
- [ ] **Concrete demo scenario** — seed data that tells a story: company spending €200k/month, show €30k+ annual savings. Pre-compute the "€300M across bunq business base" extrapolation for the pitch slide.

## Features in the spec but de-scoped for MVP

- [x] **Invoice upload + ingestion pipeline** — multimodal (PDF + image) Claude Sonnet extraction → Zod-validated structured data → DB storage + file persistence. Upload API, list/detail API, manual linking API, drag-and-drop UI, `/invoices` page. (2026-04-25)
- [x] **Gmail invoice forwarding** — `googleapis` polling client, OAuth2, attachment download, dedup via `gmail_message_id`. Poll trigger API + env vars. Mock mode works without credentials. (2026-04-25)
- [ ] **Gmail OAuth setup script** — one-time browser-based flow to get refresh token. Gmail account created: `carbo.invoices@gmail.com`. Google Cloud project + OAuth client set up. Needs: consent flow in incognito browser → exchange code → save refresh token to `.env.local`. See `docs/invoices.md`.
- [ ] **Voice refinement** — "this was a team dinner." Claude voice → text → treat as a free-text refinement. Nice-to-have.
- [ ] **Visual/narrative dashboard summary** — an LLM-written paragraph at the top of `/` contextualizing the month. Share a prompt with `generateCsrdNarrative` but target the overview reader, not auditors.
- [x] **Onboarding flow** — agentic onboarding lives at `/onboarding`. Three tracks: generate (short interview), upload existing policy (PDF/DOCX/MD/YAML/JSON), or mix (upload + fill gaps). Activates policy, creates Carbo Reserve + Credits sub-accounts, seeds a first close. See `lib/agent/onboarding.ts`. Remaining v2 polish: pressure-test live-mode Sonnet PDF parsing on real ESG docs; add a `/settings/policy` re-edit flow so a completed onboarding can be tweaked without starting a new run; wire authentication so the `DEFAULT_ORG_ID` assumption goes away.
- [ ] **Multi-entity consolidation** — a parent org with many bunq users → single CSRD report. Requires multi-tenant rework of queries. Out of hackathon scope.
- [ ] **Policy editor UI** — `/settings/policy`: form-based edit of the JSON policy, validated by the same Zod schema. Right now policies live in DB only; editing means SQL.
- [ ] **Approval workflow via bunq RequestInquiry** — instead of an in-app approve button, fire a RequestInquiry to the CFO's bunq user so approval is bank-native. Spec mentions this as an option.

## Close/accuracy improvements

- [ ] **Lognormal uncertainty model** — current `point × (1 ± u)` is symmetric; real factor distributions are lognormal, so the high end under-states. Swap in when it matters for audit claims.
- [ ] **Pedigree matrix data quality scoring** — GHG Protocol Chapter 7 formalism. Replaces our ad-hoc confidence score. Mostly UI relabelling plus a dimension table.
- [ ] **Year-of-factor drift** — our factors are pegged to 2024 (DEFRA) / 2022 (Exiobase). Inflation-adjust per year. Small multiplier.
- [ ] **Correlated-error handling in rollup** — our quadrature sum assumes factor errors are independent. In practice, factors sharing a parent sector are correlated. Bounded fix: group by top-level category and use a covariance matrix.

## Carbon-credit integrations (currently simulated)

- [ ] **Patch or Supercritical API** for real credit quotes (drop-in on `lib/credits/projects.ts`).
- [ ] **Puro.earth / Gold Standard / Peatland Code registry links** — live project pages behind each seeded project.
- [ ] **Credit retirement flow** — actual "I bought X tonnes" retirement certificate, stored against `credit_purchases`. Currently just a bunq transfer with a description.
- [ ] **CRCF compliance check** — once the EU Carbon Removal Certification Framework registries go live (expected 2025–2026), verify the projects against CRCF methodology. Watch EC announcements.

## CSRD / audit

- [ ] **Scope 1 + 2 channels** — bank data doesn't cover owned vehicles (Scope 1) or grid-electricity purchase details (Scope 2 market-based). Need a CSV upload for utility bills + vehicle log. Meaningful but separate surface.
- [ ] **Intensity metric (tCO₂e / EUR revenue)** — E1-6 requires it. We compute tCO₂e per month and the user knows their own revenue — small addition.
- [ ] **Annual rollup page** — `/report/[year]` that aggregates 12 monthly closes. Straightforward DB query.
- [ ] **PDF print stylesheet** — right now the report is browser-print-styleable but we haven't made the A4 layout precise. Add `@media print` CSS.
- [ ] **External assurance flow** — auditor review UI, with comments on individual factor choices, sign-off on a close.
- [ ] **OpenTimestamps / chain anchoring** — periodic SHA-256 commit of latest audit hash to a public chain for third-party tamper evidence.

## Ops & resilience

- [ ] **Real migrations via drizzle-kit** — currently raw DDL in `scripts/migrate.ts`. Works for hackathon; breaks as soon as schema drifts.
- [ ] **Single-process DB handle after reset** — `pnpm reset` deletes the SQLite file while the dev server holds a stale handle, so the next write goes to the deleted inode. Fix either by restarting dev server automatically or by closing + re-opening the handle on each API call (expensive; bad for hot path). Current workaround documented in CLAUDE.md.
- [ ] **Unit tests** — zero written. Priority targets: `lib/audit/append.ts` (hash chain), `lib/policy/evaluate.ts` (policy eval), `lib/emissions/estimate.ts` (rollup math), `lib/bunq/signing.ts` (sign/verify roundtrip).
- [ ] **E2E tests** — Playwright: "run close → answer questions → approve → verify ledger". Would catch the stale-DB-handle issue automatically.
- [ ] **Observability** — console logs only right now. Anthropic SDK call logging, bunq call logging, close-run timing.
- [ ] **Error pages** — `/close/[id]/page.tsx` calls `notFound()` but we don't have a nice 404 in the layout.

## UI / UX polish

DESIGN.md is written (14-section spec). Dark theme, design tokens, section dividers, and core component overhaul are done. Remaining polish:

- [x] **DESIGN.md** — 14-section Stitch-format visual design spec: Wise + bunq-inspired, dark-first, full token system (2026-04-24)
- [x] **Brand-aware palette** — near-black + forest-green + bunq Easy Green accents, with blue/purple bunq plan accents (2026-04-24)
- [x] **Dark mode audit** — all pages converted to CSS variable dark theme, section dividers added throughout (2026-04-24)
- [ ] **Typography migration** — DESIGN.md specifies Montserrat + Inter + Fragment Mono (bunq stack). Currently using Geist + Instrument Serif. Needs one PR to swap fonts.
- [ ] **Micro-interactions on the close pipeline** — when a state transitions, animate the step icon. Right now it just re-renders.
- [ ] **Refinement-question UX polish** — option cards with the sub-category's typical emission range, so user sees the consequence of their answer before clicking.
- [ ] **Impact matrix interactivity** — click a row to expand into the month's actual spend spread across the spectrum. Visual hook is half there.
- [ ] **Chart accessibility** — Recharts needs aria-labels + keyboard navigation + non-colour differentiation.
- [ ] **Mobile layout** — no explicit mobile work done. Overview breaks at <600px.
- [ ] **Confidence range visual** — show the low/point/high as a range bar, not just a point number. Users understand bars faster than ±uncertainty strings.
- [ ] **Observability / logging** — console logs only right now. Anthropic SDK call logging, bunq call logging, close-run timing. Low priority but noted.

## Demo / go-live

- [ ] **Rehearse the 3-minute demo twice** with `npm run reset` between. Time each step. See `research/12-demo-choreography.md`.
- [ ] **Deploy to Vercel OR run locally behind Cloudflare Tunnel** during the demo. Confirm webhook URL stability. (Skippable if we commit to mock-only demo — see below.)
- [x] **Backup story for "mock mode"** — `ANTHROPIC_MOCK=1 BUNQ_MOCK=1 DRY_RUN=1` is the safe default; `npm run dev:fire` injects synthetic webhook events so the close has fresh data to chew on without any real bunq involvement.

## Ingestion (parked — needs team decision)

- [ ] **Email-forward ingestion of receipts + invoices** — `receipts@<domain>` mailbox, inbound provider POSTs to `/api/inbound/email`, attachments hashed and stored in a new `receipts` table, batch-OCR'd at close. Replaces the upload UI entirely. Blocked on: provider choice (Postmark vs Cloudflare Email Routing) + domain ownership.

## References & follow-ups

- Wise-style design.md (visual spec): https://getdesign.md/wise/design-md
- CSRD ESRS E1 standard text (EFRAG): https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FESRS%2520E1%2520Climate%2520change.pdf
- EU CRCF regulation: https://climate.ec.europa.eu/eu-action/carbon-removals-and-carbon-farming_en
- GHG Protocol Scope 3 Standard: https://ghgprotocol.org/standards/scope-3-standard
- bunq API docs (re-verify before live integration): https://doc.bunq.com
- bunq hackathon toolkit: https://github.com/bunq/hackathon_toolkit
