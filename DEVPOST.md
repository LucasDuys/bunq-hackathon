# Carbo — Devpost submission

> Fill the Devpost form straight from this file. Each `##` is a form field; each
> `###` is a paste-ready variant where the field has length limits.
>
> Built for **bunq Hackathon 7.0** (April 24–25, 2026). 3-person team, 24-hour build.

---

## Project name

Carbo

## Tagline (≤ 200 chars)

### Primary
Agentic carbon accounting for bunq Business — every transaction becomes a calibrated CO₂e estimate, and one click funds an EU carbon-credit reserve.

### Backup (≤ 120 chars)
Turn bunq transactions into a CSRD-ready carbon report and an automatic Reserve transfer — in one click.

---

## Inspiration

From financial-year 2026, roughly **800,000 EU SMBs** fall under VSME / CSRD-lite carbon reporting. None of them can afford the response. Hiring a carbon accountant runs €30k+/year; existing software needs six-week onboarding plus invoice plumbing the SMB doesn't have. The predictable outcome is non-compliance, fudged numbers, or worthless offsets bought to look busy.

bunq Business is uniquely placed to fix this: every customer transaction already carries the only signal a credible carbon estimate needs — *what was bought, from whom, for how much*. We wanted to prove that with a webhook, a small DAG of agents, and disciplined math, you can ship the SMB an audit-ready carbon close in under a minute a month.

## What it does

Carbo plugs into the bunq Business webhook in minutes and runs three loops:

- **Passive ingest.** Every signed bunq webhook is verified, deduped on `bunqTxId`, classified by a rules→Haiku→cache pipeline, and turned into a per-transaction emission estimate with an explicit confidence range.
- **Monthly close.** A 12-state DB-persisted state machine walks `INGEST → CLASSIFY → ESTIMATE → CLUSTER → QUESTIONS → POLICY → READY → APPROVED → EXECUTING → COMPLETED`. Spend-weighted clustering surfaces only the **2–3 highest-leverage refinement questions** (high spend × low confidence) — not a 60-question survey.
- **Approve & transfer.** One click executes a real bunq intra-user transfer from the main account into a `Carbo Reserve` sub-account, allocates the EU-credit budget across biochar / peatland / reforestation projects, and writes a CSRD ESRS E1-6 + E1-7 report. Every step is appended to a SHA-256 hash-chained, append-only audit ledger.

Around that loop sit:

- An **8-agent reasoning DAG** (`Baseline → Research → [Green Alt ‖ Cost Savings] → [Green Judge ‖ Cost Judge] → Credit Strategy → Executive Report`) that authors the recommendations and the CFO narrative.
- A **what-if matrix** (`/impacts`) — cost-vs-carbon 2×2 with top-5 switches, peer benchmarks, and a client-side simulator.
- A **CSRD report** page with deterministic ESRS E1-6/E1-7 tables and a Sonnet-written methodology footnote.
- A **live audit ledger** (`/ledger`) that re-verifies the SHA-256 chain on every load.

## How we built it

**Stack (locked):** Next.js 16 App Router (TypeScript), Tailwind 4, Recharts, SQLite via better-sqlite3 + Drizzle ORM, Anthropic TypeScript SDK (Haiku 4.5 for classification, Sonnet 4.6 for refinement questions, narrative, and DAG agents), bunq REST API with RSA-SHA256 signing, Cloudflare Tunnel for webhook URL stability.

**Patterns we leaned on:**

- **DB-persisted state machines, not LangGraph or Temporal.** Every transition is an idempotent `UPDATE … WHERE state = ?`. Restarts and replays are free; a `SELECT state FROM close_runs` mid-run shows the row pinned at the current step.
- **LLMs author, code adjudicates.** `greenJudge` and `costJudge` re-verify the math and source-evidence in code; their verdicts can override the LLM's on hard rules (zero sources, math mismatch). Credit-strategy and executive-report numbers are computed *before* the LLM sees them, so the LLM can write prose but cannot move money or invent savings.
- **Structured tool-use everywhere.** A single `lib/agents/dag/llm.ts::callAgent` is the only DAG entry point — it wires Anthropic `tool_use`, prompt-cache (`cacheControl: ephemeral`), Zod validation on every output, mock fallback, and `agentRuns` / `agentMessages` instrumentation (tokens in/out, latency, cache-hit rate).
- **Quadrature confidence rollup.** Per-tx point + low/high half-ranges sum via quadrature; confidence rolls up spend-weighted; rendering is `ConfidenceBar` with three tiers (`high ≥ 0.85`, `medium 0.60–0.85`, `low < 0.60`). Every CO₂e number on screen pairs with confidence.
- **Append-only audit chain.** `lib/audit/append.ts` writes one row per agent step, refinement answer, and bunq call, each linked by SHA-256 to its predecessor. SQL triggers block UPDATE/DELETE; `verifyChain` runs on every render of `/ledger`.
- **bunq, properly.** Real RSA-2048 keygen, 3-leg auth (installation → device → session), sub-account creation, signed-webhook receipt, and intra-user transfer. Defaults are safe (`BUNQ_MOCK=1`, `DRY_RUN=1`); flip a single env var for live sandbox, no code changes.

**Emission factors** are hardcoded from DEFRA 2024 / ADEME Base Carbone / Exiobase — no external EF API calls. Each row carries its `source` string and uncertainty.

## Challenges we ran into

- **Confidence rollup is not a sum.** Naively adding category emissions over-states certainty. We switched to quadrature on the half-ranges and spend-weighted the confidence — variance-correct, and the headline number stops lying.
- **Refine-question explosion.** Early prototypes asked the user 30+ questions. Spend-weighted clustering on `spend × (1 − confidence)` collapses that to 2–3 questions covering ~80% of the uncertainty budget.
- **Agent authority discipline.** It is tempting to let the judge LLM "just decide." We wrote the judges as code-side validators that re-verify math and source quality, so a hallucinated approval can still be flipped to `rejected` on hard rules.
- **bunq signing details.** Getting RSA-SHA256 body signing, header canonicalisation, and 3-leg auth right against a real sandbox took longer than the rest of the bunq integration combined. Once it worked, the same client serves both production-shaped sandbox calls and a faithful mock layer.
- **Node 25 wedged a 18 GB MacBook** rebuilding `better-sqlite3` natives. We pinned Node 22 LTS in `.nvmrc` and added a loud warning in `CLAUDE.md`. Lesson: native deps + new Node minors = read the changelog.
- **Next.js 16 breaking changes.** Route params became Promises (`params: Promise<{id: string}>` + `await params`). Several inherited patterns from Next 14 needed rewriting on the fly.

## Accomplishments that we're proud of

- A monthly carbon close that takes a busy founder **under a minute** — and produces a defensible report at the other end.
- An **8-agent DAG** where the LLM writes recommendations and prose, but **code adjudicates the math and the money**. We think this is the right authority pattern for any agent that touches financial state.
- **Real bunq end-to-end.** RSA-SHA256 signing, 3-leg auth, sub-accounts, signed webhooks, intra-user transfers — not a screen-scrape, not a fake. Seven bunq automation scripts (`scripts/bunq-*.ts`) cover keygen → bootstrap → reserve creation → faucet seeding → webhook registration → live tunnel.
- **A SHA-256 hash-chained audit ledger** enforced by SQL triggers — tampering breaks `verifyChain` on the next read. The `/ledger` page renders a live "Chain valid" badge.
- A **CSRD ESRS E1-6 + E1-7 report** with deterministic tables and a Sonnet-written methodology footnote citing factor sources (DEFRA / ADEME / Exiobase).
- A **design system** (`DESIGN.md`, 14 sections) — Supabase-inspired dark-mode-native, weight-restrained typography, border-as-depth, every CO₂e number paired with a confidence indicator within 8px.

## What we learned

- **State machines beat orchestrators for hackathon scope.** A 12-state close machine in SQL with `WHERE state = ?` guards beats spinning up Temporal or LangGraph. It is debuggable with `SELECT *`.
- **Tool-use is the bare minimum for agent reliability.** Anthropic structured tool-use + Zod at every LLM I/O boundary eliminated free-text JSON parsing entirely. The DAG never had a "the model said something weird" failure in 24 hours.
- **Hardcode the emission factors.** External EF APIs introduce latency, dependency, and provenance ambiguity. Hardcoding DEFRA / ADEME / Exiobase rows with `source` strings made the report defensible and the close fast.
- **Mock-first, live-flag-second.** `ANTHROPIC_MOCK=1`, `BUNQ_MOCK=1`, `DRY_RUN=1` as defaults meant we could keep shipping without burning budget or sandbox credits, and demo without network risk.
- **Authority boundaries belong in code, not prompts.** No prompt makes an LLM stop spending money it shouldn't. Code does.

## What's next for Carbo

- **Live EU carbon-credit registry settlement.** Swap the seeded biochar / peatland / reforestation projects for a real registry partner so the reserve transfer actually retires credits with serial numbers.
- **CSRD PDF export.** Today the report renders to screen; an auditor wants a sealed PDF with the audit-chain hash on the cover.
- **Annual export pipeline → bank-statement-as-CSRD-source.** Phase 3 lands a year-roll-up that reconciles to the bunq statement, so the report is provably consistent with the books.
- **Onboarding via bunq invite.** Today onboarding is an interview + statement upload. With a registered partner, an SMB could onboard in one OAuth-style click.
- **Invoice-grounded refinement.** When invoice OCR is available (`lib/invoices/`), refinement questions can be answered by the document itself, not the user — confidence climbs without human input.
- **A `Reserve → Credits` settlement leg.** Today the reserve transfer is intra-user; the next leg is a partner payout that retires the EU credit.

## Built With

> Devpost expects short tags. Paste any subset.

next.js · typescript · tailwindcss · sqlite · drizzle-orm · better-sqlite3 · anthropic · claude-haiku-4.5 · claude-sonnet-4.6 · bunq · rsa · sha-256 · zod · recharts · cloudflare-tunnel · csrd-esrs-e1 · defra · ademe · exiobase

## Try it out

> Replace the placeholders with the live URLs you create when submitting.

- **Code:** https://github.com/LucasDuys/bunq-hackathon
- **Live demo:** *(Cloudflare Tunnel public URL printed by `npm run dev:live`, if hosting during judging)*
- **Video walkthrough:** *(YouTube/Loom link — record from `DEMO.md`'s 3-minute click-by-click)*

### Run locally (judges)

```bash
nvm use            # Node 22 LTS — do NOT run on Node 25
npm install
npm run reset      # wipe + migrate + seed (61 sandbox tx over 90 days)
npm run dev        # http://localhost:3000
```

Defaults are safe: `ANTHROPIC_MOCK=1`, `BUNQ_MOCK=1`, `DRY_RUN=1`. No external keys needed.

### Live LLM run

```bash
ANTHROPIC_MOCK=0 ANTHROPIC_API_KEY=sk-... npm run dev
npx tsx scripts/dag-smoke.ts
```

### Live bunq sandbox

```bash
npm run bunq:keygen
npm run bunq:sandbox-user
BUNQ_MOCK=0 npm run bunq:bootstrap
BUNQ_MOCK=0 npm run bunq:create-reserve
BUNQ_MOCK=0 npm run bunq:sugardaddy
npm run dev:live
BUNQ_MOCK=0 BUNQ_WEBHOOK_URL=<tunnel-url> npm run bunq:register
```

---

## Cover image / thumbnail

Use a screenshot of `/` (dashboard hero with the CO₂e number + ConfidenceBar) on dark background, or the `/presentation` deck title slide. Both should fit Devpost's 1280×720 cover slot; the dashboard reads better as a thumbnail.

## Demo video script (≤ 3 min)

Follow [`DEMO.md`](DEMO.md) end-to-end:

1. `/` dashboard — 61 tx, €39k spend, hero CO₂e + ConfidenceBar (~20 s).
2. **Run Carbon Close** → `/close/[id]` — pipeline animates `INGEST → CLASSIFY → ESTIMATE → CLUSTER → QUESTIONS` (~30 s).
3. Answer 3 refinement questions; confidence rises as method flips `spend_based → refined` (~30 s).
4. **Approve & transfer €X** — reserve transfer + 4.8 t EU credits across biochar / peatland / reforestation; state goes `EXECUTING → COMPLETED` (~20 s).
5. `/report/2026-04` — ESRS E1-6 + E1-7 tables (~20 s).
6. `/ledger` — SHA-256 chain valid badge (~15 s).
7. `/impacts` — cost-vs-carbon 2×2 + top-5 switches + benchmark + simulator (~25 s).
8. `/presentation` — interactive DAG deck (~20 s).

## Judging-criterion crosswalk (paste into the form's notes)

| bunq HTFDI criterion | Weight | Where it shows up in Carbo |
|---|---|---|
| Creativity & Innovation | 25% | 8-agent DAG with code-adjudicated judges; refine-question clustering on `spend × (1 − confidence)`; SHA-256 hash-chained ledger; DB-persisted state machines |
| Impact & Usefulness | 30% | CSRD ESRS E1-6/E1-7 report, tax-savings + reserve loop, real bunq Reserve transfer, switch recommendations with €/CO₂ deltas |
| Technical Execution | 20% | Idempotent state transitions, quadrature confidence math, Zod-validated `tool_use`, prompt-cached system prompts, append-only audit chain enforced by SQL trigger |
| bunq Integration | 15% | RSA-SHA256 signing, 3-leg auth, sub-accounts, signed-webhook ingest, intra-user transfer, 7 automation scripts |
| Presentation / Pitch | 10% | `PITCH.md`, `DEMO.md`, in-app `/presentation` deck, design system in `DESIGN.md` |

## Team

3 contributors, 24-hour build window during bunq Hackathon 7.0 (24–25 April 2026, Amsterdam).

## Acknowledgements

- bunq for the sandbox + the cleanest signed-webhook contract in fintech.
- Anthropic for Claude Sonnet 4.6, Haiku 4.5, and the native `web_search_20250305` tool.
- DEFRA 2024, ADEME Base Carbone, Exiobase — every emission factor in `lib/factors/` is sourced from one of these and labelled in-row.
- Supabase — design-system inspiration for the dark-mode-native, border-as-depth aesthetic captured in `DESIGN.md`.
