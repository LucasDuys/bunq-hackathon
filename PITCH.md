# Carbo — pitch

> *"We turn bunq transactions into a monthly, audit-ready carbon report — and automatically fund your EU carbon reserve."*

## The problem

Around **800,000 EU SMBs** now fall under VSME / CSRD-lite reporting from financial-year 2026. They have to disclose carbon emissions but cannot afford the response: hiring a carbon accountant runs **€30k+/year**, and existing software requires **6-week onboarding** plus invoice plumbing the SMB doesn't have. Most will fail to comply, fudge the numbers, or buy worthless offsets to look busy.

bunq Business is uniquely placed to fix this. Its customers' transactions already carry the only signal a credible carbon estimate needs: **what was bought, from whom, for how much**.

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

## bunq fit

- Native bunq Business primitives end-to-end: **signed API client (RSA-SHA256), 3-leg auth (installation → device → session), sub-accounts, webhook with signature verification, intra-user transfer**.
- 7 bunq automation scripts (`scripts/bunq-*.ts`): keygen, sandbox bootstrap, reserve creation, sugardaddy seeding, webhook registration, live-mode tunnel.
- Defaults are safe (`BUNQ_MOCK=1`, `DRY_RUN=1`); flip one flag for live sandbox, no code changes.

## Demo

3-minute click-by-click in [`DEMO.md`](DEMO.md). Or open `/presentation` in the running app for the interactive scroll-sync deck.

## Ask

This is a 24-hour 3-person hackathon build. To ship to bunq Business: a sandbox slot for live testing, a registry partner for real EU carbon-credit settlement, and design feedback on the close-and-approve flow.
