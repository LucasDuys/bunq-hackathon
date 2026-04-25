# Carbo — pitch

> *"We turn bunq transactions into a monthly, audit-ready carbon report — and automatically fund your EU carbon reserve."*

## The problem

The EU **Omnibus Directive** (Council, Feb 2026) cut mandatory CSRD scope by ~85% — only companies with **>1,000 employees** and **>€450M turnover** must report, applicable for financial years starting **Jan 2027**.[^1] But the work didn't disappear; it shifted onto the supply chain. SMEs now face an avalanche of carbon-data requests from large customers and banks, capped at the **VSME** (Voluntary SME Standard, EFRAG → European Commission, July 2025).[^2]

The current options are bad. Light-tier SaaS is **€1k–€5k/year**, in-depth consulting **starts at €10k+**, enterprise platforms run **€2k–€25k+/year**.[^3] Manual VSME drafts take weeks; purpose-built tools advertise "hours instead of weeks."[^4]

bunq Business is uniquely placed to fix this. Its customers' transactions already carry the only signal a credible carbon estimate needs: **what was bought, from whom, for how much**.

[^1]: [Council of the EU — Omnibus simplification press release](https://www.consilium.europa.eu/en/press/press-releases/2026/02/24/council-signs-off-simplification-of-sustainability-reporting-and-due-diligence-requirements-to-boost-eu-competitiveness/) · [BDO — CSRD post-Omnibus revised scope](https://www.bdo.com/insights/sustainability-and-esg/csrd-post-omnibus-revised-scope-and-requirements)
[^2]: [European Commission — VSME recommendation](https://finance.ec.europa.eu/publications/commission-presents-voluntary-sustainability-reporting-standard-ease-burden-smes_en) · [EFRAG — SMEs and Sustainability Reporting](https://www.efrag.org/en/smes-and-sustainability-reporting)
[^3]: [D-Carbonize — Carbon accounting cost breakdown](https://d-carbonize.eu/blog/carbon-accounting-cost/) · [EcoHedge — Cost of carbon accounting for SMEs](https://www.ecohedge.com/blog/how-much-does-carbon-accounting-cost-for-smes/)
[^4]: [GoClimate — Comparing the Top 5 VSME Tools](https://www.goclimate.com/knowledge/articles/comparing-the-top-5-vsme-tools)

## The solution

**Carbo plugs into the bunq webhook in minutes.** Every transaction becomes a calibrated emissions estimate with an explicit confidence range. Once a month, an **8-agent DAG** runs:

1. A deterministic baseline aggregates spend and emissions with quadrature confidence rollup.
2. A research agent looks up green alternatives via live web search (Anthropic's native `web_search_20250305` tool, 30-day cached).
3. **Two parallel proposers** generate green and cost-saving recommendations.
4. **Two parallel judges** re-validate the math and source-evidence in code — they can override the LLM verdict on hard rules.
5. A credit strategy module deterministically allocates a reserve budget across EU carbon-credit projects (biochar / peatland / reforestation).
6. An executive-report agent writes the CFO narrative on top of frozen numbers.

The user opens the dashboard, answers **2–3 refinement questions** (only the high-spend, low-confidence clusters surface), and clicks **Approve & transfer €X**. Money moves from the main bunq account to a **bunq Reserve sub-account**, recorded on a **SHA-256 hash-chained audit ledger** that satisfies an external auditor.

## What's different

- **LLMs author, code adjudicates.** Recommendations are written by Sonnet 4.6, but `greenJudge` and `costJudge` re-verify math and source quality in code; the credit-strategy and report numbers are computed *before* the LLM sees them. The LLM cannot move money or invent savings.
- **DB-persisted state machines.** No LangGraph, no Temporal, no external orchestrator. Every transition is an idempotent SQL update guarded by `WHERE state = ...`. Restarts and replays are free.
- **Append-only hash chain.** Every agent step, refinement answer, and bunq call writes to `audit_events` with a SHA-256 link to the previous row. SQL triggers block UPDATE/DELETE. The `/ledger` page renders a live "Chain valid" badge.

## bunq generates the report

> **The big behavioural shift: bunq generates the CSRD report; the company just downloads it.**

Every monthly close auto-renders a CSRD ESRS E1-7 source PDF, bunq-branded, with a cover page (period as headline, hero KPIs, signature line for the sustainability lead), share-bar tables, anomaly pills, and the recommended carbon-credit mix. Files land at `data/exports/carbo-{orgId}-{YYYY}-{MM}.pdf`; the dashboard's **Reports** panel lists them as one-click downloads. December closes also auto-fire the annual report once per year (idempotent via audit-chain scan). Entry point: `lib/agent/report-agent.ts`. Renderer: `lib/reports/render-briefing.tsx`. Mock without a DB: `npm run reports:mock`.

### What this saves

A 50-person EU mid-cap currently spends **6–12 weeks of Q1 staff time** plus **€15–40k/year in external consultant fees** assembling the CSRD ESRS E1 disclosure by hand — Excel-stitching invoices to emission factors, writing the methodology narrative, attaching evidence (sources: Cushman & Wakefield Amsterdam offices, Carbo `research/14-realistic-seed-data.md`).

Carbo automates the **assembly**; the company still owns limited-assurance review (auditor sign-off can't be automated), but the heavy lifting drops to a download. Conservative estimate for a 50-person SME: **~80% reduction in CSRD assembly hours and €10–30k/yr saved on consultant fees**, while raising audit quality (deterministic factor citation per row vs hand-keyed spreadsheets).

## bunq fit

- Native bunq Business primitives end-to-end: **signed API client (RSA-SHA256), 3-leg auth (installation → device → session), sub-accounts, webhook with signature verification, intra-user transfer, NoteText carbon stamps on every Payment, DraftPayment for over-threshold CFO approvals, ExportAnnualOverview for the year-end pair**.
- 8+ bunq automation scripts (`scripts/bunq-*.ts`): keygen, sandbox bootstrap, reserve creation, sugardaddy seeding, NoteText backfill, annual-export pair, webhook registration, live-mode tunnel.
- Defaults are safe (`BUNQ_MOCK=1`, `DRY_RUN=1`); flip one flag for live sandbox, no code changes.

## Demo

3-minute click-by-click in [`DEMO.md`](DEMO.md). Or open `/presentation` in the running app for the interactive scroll-sync deck.

## Ask

This is a 24-hour 3-person hackathon build. To ship to bunq Business: a sandbox slot for live testing, a registry partner for real EU carbon-credit settlement, and design feedback on the close-and-approve flow.
