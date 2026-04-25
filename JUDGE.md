# Carbo — judge guide

> One-page mapping from grading criteria → claims → file evidence → run-to-verify.
> Built for **bunq Hackathon 7.0** (April 24–25, 2026). 3-person team, 24-hour build.

## TL;DR

**Carbo turns every bunq Business transaction into a calibrated carbon estimate, then runs an 8-agent DAG once a month to propose a CSRD-ready report and an automatic bunq Reserve transfer to fund EU carbon credits — approved with one click and recorded on a SHA-256 hash-chained audit ledger.**

- Run locally: `npm install && npm run reset && npm run dev` → http://localhost:3000.
- Pitch (60s read): [`PITCH.md`](PITCH.md)
- Click-by-click demo: [`DEMO.md`](DEMO.md)
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/agents/00-overview.md`](docs/agents/00-overview.md)
- Live-LLM / live-bunq verification: [§6](#6-live-mode-verification) below.

---

## §1 Impact & usefulness — 30%

The problem is real: ≥800k EU SMBs now fall under VSME / CSRD-lite reporting from FY 2026. Hiring a carbon accountant costs €30k+/year; existing software requires 6-week onboarding. Carbo plugs into bunq's existing webhook in minutes and produces a defensible report in one click.

| Claim | Evidence | How to verify |
|---|---|---|
| Produces a CSRD ESRS E1-6 + E1-7 monthly report | `app/report/[month]/page.tsx`, `lib/agent/narrative.ts` (Sonnet 4.6 narrative) | After seed, open `/report/2026-04` |
| Quantified ROI for the user — tax savings + reserve allocation | `lib/tax/index.ts`, `lib/tax/incentives.ts`, `app/tax-savings/page.tsx` | `/tax-savings` shows EIA/MIA/Vamil + EU ETS math |
| Closes the loop: tx → measure → fund offset (real bunq transfer) | `lib/agent/close.ts:442` (`intraUserTransfer`), `lib/bunq/payments.ts` | `BUNQ_MOCK=0 DRY_RUN=0 npm run dev:live` then approve a close |
| Concrete switch recommendations w/ €/CO₂ deltas (not platitudes) | `app/impacts/page.tsx`, `lib/agents/dag/greenAlternatives.ts`, `lib/agents/dag/costSavings.ts` | Open `/impacts` — 2×2 matrix + top 5 switches |
| Industry benchmark — *you vs. peers* | `lib/benchmarks.ts`, `app/impacts/page.tsx` | `/impacts` benchmark bar chart |

---

## §2 Creativity & innovation — 25%

This is not a chatbot wrapped around an emissions API. It is an **8-agent DAG with code-adjudicated authority** running on top of **DB-persisted state machines** (no LangGraph, no Temporal, no external orchestrator).

| Claim | Evidence | How to verify |
|---|---|---|
| 8-agent DAG (linear-then-parallel) | `lib/agents/dag/index.ts` (orchestrator); 8 nodes: `spendBaseline`, `research`, `greenAlternatives`, `costSavings`, `greenJudge`, `costJudge`, `creditStrategy`, `executiveReport` | `npx tsx scripts/dag-smoke.ts` |
| Judge agents have **code override authority** on hard rules | `lib/agents/dag/greenJudge.ts`, `lib/agents/dag/costJudge.ts` — verdict re-checked in code (zero-source rejection, math mismatch flips approved → rejected) | Read judge files; the LLM's verdict is *re-validated*, not trusted |
| Live web-search via Anthropic native tool, w/ 30-day cache + fallback ladder | `lib/agents/dag/research.ts` (`web_search_20250305`), `lib/agents/dag/llm.ts` (`callAgentWithTools`), `research_cache` table | Live: `npx tsx scripts/smoke-research.ts` (needs `ANTHROPIC_API_KEY`) |
| Refine-question clustering on `spend × (1 − confidence)` | `lib/agent/close.ts` (states: `CLUSTER_UNCERTAINTY` → `QUESTIONS_GENERATED`) | Run a close; only high-spend / low-confidence clusters get questions |
| DB-persisted state machines (12-state close, 10-state onboarding) — not LangGraph/Temporal | `lib/db/schema.ts` (`closeRuns`, `onboardingRuns`); transitions guarded by `WHERE state = ...` | After a run, `SELECT state FROM close_runs` shows the row |
| Hash-chained audit ledger (SHA-256, append-only via SQL trigger) | `lib/audit/append.ts:11` (`getLatest`), `:20` (`appendAudit`), `:47` (`verifyChain`); UPDATE/DELETE blocked by trigger | Open `/ledger` — chain-valid badge |
| Multi-agent onboarding (interviewer / drafter / parser, three real LLM agents w/ deterministic fallbacks) | `lib/agent/onboarding-interviewer.ts`, `onboarding-drafter.ts`, `onboarding-parser.ts` | `/onboarding` flow |

The deeper "wow" mechanism: **LLMs author, code adjudicates.** Sonnet writes recommendations, but `greenJudge` and `costJudge` re-verify the math and source-evidence in code; the credit-strategy and executive-report numbers are computed deterministically *before* the LLM sees them, so the LLM can only write prose, not move money.

---

## §3 Technical execution — 20%

| Claim | Evidence | How to verify |
|---|---|---|
| Idempotent state transitions guarded by `WHERE state = ...` | `lib/agent/close.ts`, `lib/agent/onboarding.ts` | `grep -n "WHERE state =" lib/agent/*.ts` |
| Quadrature confidence rollup (not naive sum) — variance-correct | `lib/emissions/estimate.ts` (point + low/high; quadrature-summed half-ranges; spend-weighted confidence) | Read function `rollupRange` |
| Append-only audit chain enforced by SQL trigger | `scripts/migrate.ts` (creates trigger), `lib/audit/append.ts` | UPDATE/DELETE on `audit_events` raises trigger |
| Anthropic structured tool-use w/ Zod validation (no free-text JSON) | `lib/agents/dag/llm.ts` (`callAgent`, `callAgentWithTools`), Zod schemas in `types.ts` | Read `callAgentWithTools`; outputs are Zod-validated before persist |
| Prompt-cache wired (`cacheControl: ephemeral`) for system prompts | `lib/agents/dag/llm.ts` | Inspect agent calls; system blocks cache; observe `cache_read_input_tokens` in live mode |
| Per-call instrumentation: tokens in/out, latency, cache-hit rate | `lib/db/schema.ts` (`agentRuns`, `agentMessages`); `lib/impacts/store.ts` (`persistDagRun`) | After live DAG run, `agentRuns` table populates |
| Webhook idempotency (dedup on `bunqTxId`) | `app/api/webhook/bunq/route.ts:36-40` | Re-fire same event with `npm run dev:fire`; one DB row |
| Type-safety end-to-end: TS strict, Zod at every LLM I/O boundary, Drizzle for DB | `tsconfig.json`, `lib/agents/dag/types.ts`, `lib/db/schema.ts` | `npm run typecheck` |
| Input sanitization: HTTP header injection guard, LIKE-pattern escaping, Zod on all POST bodies | `app/api/invoices/[id]/file/route.ts:31`, `app/api/bunq/draft-callback/route.ts:35`, `app/api/close/[id]/answer/route.ts:5-8` | Read the routes; no raw `as` casts on user input |
| Emissions math bounded: `uncertaintyPct` clamped to [0,1], exhaustive switch in policy eval | `lib/emissions/estimate.ts:26`, `lib/policy/evaluate.ts:22` | Factor with `uncertaintyPct > 1` cannot produce negative kgCO₂e |
| 9 per-agent docs with system prompt + I/O schema | `docs/agents/00-overview.md` … `08-research.md` | Read the directory |

---

## §4 bunq integration — 15%

This isn't a screen-scrape. Carbo uses bunq's real APIs end-to-end with cryptographic signing.

| Claim | Evidence | How to verify |
|---|---|---|
| RSA-2048 keygen + RSA-SHA256 body signing on outbound calls | `lib/bunq/signing.ts`, `scripts/bunq-keygen.ts` | `npm run bunq:keygen` writes a real PEM keypair |
| Real 3-leg authentication: Installation → Device → Session | `scripts/bunq-bootstrap.ts:40-52` | Live: `BUNQ_MOCK=0 npm run bunq:bootstrap` |
| Sub-account creation for "Carbo Reserve" + Credits | `lib/bunq/accounts.ts` (`createSubAccount`), `scripts/bunq-create-reserve.ts` | `npm run bunq:create-reserve` |
| Webhook signature verification (RSA-SHA256, server public key) | `app/api/webhook/bunq/route.ts:23` (`verifyWebhook`), `lib/bunq/webhook.ts`, `lib/bunq/signing.ts` | Send unsigned event → 401 |
| Idempotent webhook ingestion (dedup on `bunqTxId`) | `app/api/webhook/bunq/route.ts:36-40` | Re-fire same event; one DB row |
| Intra-user transfer with `DRY_RUN` gate + audit log | `lib/bunq/payments.ts` (`intraUserTransfer`), `lib/agent/close.ts:442` | Approve a close; `audit_events` gets `action.reserve_transfer` |
| Webhook URL registration via notification-filter-url | `scripts/register-webhook.ts` | `npm run bunq:register` |
| Sandbox-faucet seeding (sugardaddy RequestInquiry) | `scripts/bunq-sugardaddy.ts` | `npm run bunq:sugardaddy` |
| Persistent bunq session/context (installation, device, session, account IDs) | `lib/bunq/context.ts` (`.bunq-context.json`) | After bootstrap, file exists with tokens + main account ID |
| `MAX_TOOL_CALLS=8` cap per close run, dry-run-default for safety | `ARCHITECTURE.md` §invariants, `lib/env.ts` | Defaults: `BUNQ_MOCK=1`, `DRY_RUN=1` |

**Surface area:** 7 bunq scripts (`scripts/bunq-*.ts`), 6 lib files (`lib/bunq/{client, signing, webhook, accounts, payments, context}.ts`), 1 webhook route, 1 reserve UI route. Mock layer is realistic, not stubbed; flip one flag for live.

---

## §5 Pitch — ~10%

- **One-page narrative** (60-second read): [`PITCH.md`](PITCH.md).
- **3-minute click-by-click demo**: [`DEMO.md`](DEMO.md).
- **In-app interactive deck**: route `/presentation` (see `app/presentation/page.tsx`) — scroll-sync 7 sections including a replay of the 8-agent DAG with evidence sources.
- **Static deck**: `presentation.html` at the repo root.
- **Visual design system**: [`DESIGN.md`](DESIGN.md) — 14 sections covering tokens, type, motion, accessibility (Supabase-inspired dark mode).

---

## §6 Live-mode verification

For the AI grader who runs code, or the human judge who wants to confirm a claim end-to-end.

| Command | Proves |
|---|---|
| `npm install && npm run reset && npm run dev` | App boots; seed data; routes render |
| `npm run typecheck` | TS compiles clean |
| `npx tsx scripts/dag-smoke.ts` | All 8 DAG agents run end-to-end (mock or live) |
| `npx tsx scripts/smoke-research.ts` | Research agent runs w/ live web search if `ANTHROPIC_API_KEY` is set |
| `npx tsx scripts/llm-probe.ts` | Anthropic SDK reachable; model IDs (Haiku 4.5 / Sonnet 4.6) correct |
| `npx tsx scripts/env-check.ts` | Env wiring sanity (mocks vs live) |
| `npm run reports:coverage` | CSRD coverage % per category |
| `npm run invoice:test` (mock) / `npm run invoice:test:live` | Invoice OCR + classification |
| `npm run dev:live` | Cloudflare Tunnel + dev server, prints public webhook URL |
| `npm run dev:fire` | Fires a synthetic webhook event into the running app |
| `BUNQ_MOCK=0 npm run bunq:bootstrap` (needs `BUNQ_API_KEY` + private key) | Real 3-leg sandbox auth; persists `.bunq-context.json` |

**Mock-vs-live flag map** (defaults are safe / mock):

| Var | Default | Effect when `0` |
|---|---|---|
| `ANTHROPIC_MOCK` | `1` | Live Sonnet/Haiku calls; cache + token instrumentation populate |
| `BUNQ_MOCK` | `1` | Live bunq sandbox; signing + webhook verify enforced |
| `DRY_RUN` | `1` | Real money moves on close approval |

What an AI grader can verify *without running anything* (read-only):

```
README.md  ─►  pitch + demo flow + cut list
PITCH.md   ─►  one-page narrative
DEMO.md    ─►  click-by-click with expected screen text
JUDGE.md   ─►  this file (claim → evidence → verify)
ARCHITECTURE.md  ─►  state machine + 8-agent DAG diagram
docs/agents/0N-*.md  ─►  per-agent system prompt + I/O schema
PROGRESS.md / todo.md  ─►  done log + transparent limitations
```
