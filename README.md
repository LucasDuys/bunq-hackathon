# Carbo

Agentic carbon accounting for bunq Business accounts. Webhook-ingested transactions → spend-based emission estimates with confidence ranges → agent-driven refinement (2–3 questions) → policy-driven allocation to a bunq Carbo Reserve sub-account → simulated EU carbon-credit purchase → CSRD ESRS E1 report.

Built for **bunq Hackathon 7.0** (April 24-25, 2026). 3-person team, 24-hour build.

## Pitch
> "We turn bunq transactions into a monthly, audit-ready carbon report — and automatically fund your EU carbon reserve."

## Judge guide

| Criterion | Where it shows up | Anchor |
|---|---|---|
| **Impact & usefulness** (30%) | CSRD report, tax-savings + reserve loop, real bunq transfer, switch recommendations | [JUDGE §1](JUDGE.md#1-impact--usefulness--30) |
| **Creativity & innovation** (25%) | 8-agent DAG with code-adjudicated judges, refine-Q clustering, hash-chained ledger, DB-persisted state machines | [JUDGE §2](JUDGE.md#2-creativity--innovation--25) |
| **Technical execution** (20%) | Idempotent state transitions, quadrature confidence math, Zod-validated tool_use, prompt-cached system prompts | [JUDGE §3](JUDGE.md#3-technical-execution--20) |
| **bunq integration** (15%) | RSA-SHA256 signing, 3-leg OAuth, sub-accounts, signed-webhook ingest, intra-user transfer | [JUDGE §4](JUDGE.md#4-bunq-integration--15) |
| **Pitch** (~10%) | One-pager `PITCH.md`, click-by-click `DEMO.md`, in-app `/presentation` deck | [JUDGE §5](JUDGE.md#5-pitch--10) |

[`JUDGE.md`](JUDGE.md) is the single-page claim → file evidence → run-to-verify map. [`PITCH.md`](PITCH.md) is the 60-second narrative. [`DEMO.md`](DEMO.md) is the click-by-click demo with expected screen output.

## What's novel here

- **8-agent DAG, not a chatbot.** `lib/agents/dag/` — Baseline → Research → [Green Alt ‖ Cost Savings] → [Green Judge ‖ Cost Judge] → Credit Strategy → Executive Report. See [`docs/agents/00-overview.md`](docs/agents/00-overview.md).
- **LLMs author, code adjudicates.** `greenJudge` and `costJudge` re-verify math and source-evidence in code; their verdicts can flip the LLM's. Credit-strategy and report numbers are computed *before* the LLM sees them.
- **DB-persisted state machines** (12-state close, 10-state onboarding). No LangGraph, no Temporal. Every transition is `WHERE state = ...` — idempotent, replayable, restart-safe.
- **SHA-256 hash-chained audit ledger** (`lib/audit/append.ts`). Append-only via SQL trigger. Tampering breaks `verifyChain` on the next read.
- **Quadrature confidence rollup** (`lib/emissions/estimate.ts`). Variance-correct, spend-weighted, refine-Q clustering on `spend × (1 − confidence)`.

## Stack
- **Next.js 16 App Router** (TypeScript), Tailwind 4, Recharts.
- **SQLite** via better-sqlite3 + **Drizzle ORM**; append-only `audit_events` hash-chain via trigger.
- **Anthropic TS SDK** — Haiku 4.5 for merchant classification, Sonnet 4.6 for refinement questions + CSRD narrative. No external emission factor APIs (factors hardcoded from DEFRA 2024 / ADEME / Exiobase).
- **bunq** thin client with RSA-SHA256 signing + webhook verify. Mock-first; flip `BUNQ_MOCK=0` for live sandbox.
- **Cloudflare Tunnel** is the recommended deploy for webhook URL stability.

## Quickstart

Requires **Node 22 LTS** (`.nvmrc` pins it). If you're on nvm/fnm: `nvm use` or `fnm use`. Do **not** run this on Node 25 — its higher memory baseline plus `better-sqlite3`'s native rebuild has been observed to wedge 18GB MacBooks during install.

```bash
npm install
npm run migrate   # creates ./data/carbon.db
npm run seed      # 61 sandbox transactions across 90 days
npm run dev
```

Open http://localhost:3000 → click **Run Carbon Close**.

### Env
Copy `.env.example` to `.env.local`. Defaults are mock-only (no external API needed).

```
ANTHROPIC_MOCK=1    # 1 = stub LLM. 0 = real (needs ANTHROPIC_API_KEY).
BUNQ_MOCK=1         # 1 = stub bunq. 0 = real (needs API key + signing key).
DRY_RUN=1           # 1 = don't actually move money via bunq.
```

### Reset the demo
```bash
npm run reset    # wipes + re-seeds. Restart `npm run dev` afterward so the DB handle isn't stale.
```

## Demo flow (3 minutes)

**TL;DR:** Run Carbon Close → answer 3 refinement questions → approve → see CSRD report + signed audit chain. Full click-by-click with expected screen text in [`DEMO.md`](DEMO.md).

1. `/` — dashboard, 61 tx, €39k spend, click **Run Carbon Close**.
2. `/close/[id]` — pipeline animates through `INGEST → CLASSIFY → ESTIMATE → CLUSTER`; pauses at 3 refinement questions surfaced by spend-weighted uncertainty.
3. Answer each → confidence rises (method flips `spend_based → refined`).
4. Proposed actions — reserve transfer + 4.8 t of EU credits across biochar / peatland / reforestation. Click **Approve & execute**.
5. `/report/2026-04` (ESRS E1-6 + E1-7) → `/ledger` (SHA-256 chain valid) → `/impacts` (cost-vs-carbon 2×2 matrix) → `/presentation` (interactive DAG deck).

## Emission Estimation Approach

Spend-based emission factors (GHG Protocol Scope 3, Category 1). Each transaction's EUR amount × category-specific factor (kg CO₂e per EUR). Factors from DEFRA 2024, ADEME Base Carbone, and Exiobase — all hardcoded in `lib/factors/index.ts`, no external API calls.

The Claude API handles the intelligence layer: classifying merchants into the right emission category, generating refinement questions to reduce uncertainty, and writing CSRD-compliant narratives.

## Architecture & agent docs (read first)

The reasoning layer is an **8-agent DAG** under `lib/agents/dag/` (Baseline → Research → [Green Alt ‖ Cost Savings] → [Green Judge ‖ Cost Judge] → Credit Strategy → Executive Report). Entry point: `POST /api/impacts/research`.

Read in this order before editing any agent:

1. [`docs/agents/00-overview.md`](docs/agents/00-overview.md) — DAG diagram, model split, authority boundaries, persistence tables, entry-point routes.
2. [`docs/architecture-comparison.md`](docs/architecture-comparison.md) — original-plan-vs-reality, drift section, parallel-path inventory, migration order.
3. The per-agent doc you're touching: [`docs/agents/01-spend-baseline.md`](docs/agents/01-spend-baseline.md) … [`07-executive-report.md`](docs/agents/07-executive-report.md), plus [`08-research.md`](docs/agents/08-research.md). Each contains the agent's full system prompt + I/O schema + gap-vs-current-code.
4. The relevant Forge spec under [`.forge/specs/`](.forge/specs/): `spec-baseline-agent.md` (shipped), `spec-dag-hardening.md` (next round — credit-strategy audit, mock-fallback observability, researchCache leakage fix, Annual Savings Forecaster, path consolidation, close-machine integration).
5. Cross-cutting research briefs in [`research/`](research/) — especially [`research/13-context-scaling-patterns.md`](research/13-context-scaling-patterns.md) (token budgets, chunking, prompt caching) and [`research/13-tax-savings-incentives.md`](research/13-tax-savings-incentives.md) (Dutch EIA/MIA/Vamil + EU ETS math feeding the credit strategy).

To run a real DAG end-to-end after you have an `ANTHROPIC_API_KEY`:

```bash
npm run seed   # loads fixtures/bunq-transactions.json + 61 synthetic txs
npm run dev
# in another shell:
curl -X POST http://localhost:3000/api/impacts/research -H 'content-type: application/json' -d '{"month":"2026-03"}' | jq
```

## Directory map
- `app/` — Next routes (pages + API routes incl. `/api/impacts/research` = canonical DAG runner).
- `lib/agents/dag/` — **8-agent DAG** (Baseline → Research → Green Alt ‖ Cost Savings → Green Judge ‖ Cost Judge → Credit Strategy → Executive Report). Shared `llm.ts` + `tools.ts` + `types.ts`.
- `lib/agent/` — onboarding suite (`onboarding-*.ts`), legacy 12-state close machine (`close.ts`), parallel impact-analysis path (`impacts.ts`, `impact-analysis.ts`).
- `lib/bunq/` — signed HTTP client, webhook verify, sub-account + payment helpers.
- `lib/classify/` — rule-first + LLM-fallback merchant classifier, merchant cache.
- `lib/factors/` — hard-coded spend-based emission factors (DEFRA/ADEME/Exiobase-derived).
- `lib/emissions/estimate.ts` — per-tx point + low/high + confidence; quadrature-sum rollup.
- `lib/policy/` — Zod-validated policy DSL + evaluator.
- `lib/credits/` — simulated EU carbon-credit projects (biochar / reforestation / peatland).
- `lib/tax/` — EIA/MIA/Vamil + EU ETS math feeding credit strategy.
- `lib/audit/` — SHA-256 hash-chained append-only audit ledger.
- `lib/anthropic/` — Anthropic SDK wrapper + mock mode.
- `lib/impacts/` — `persistDagRun()`: writes `agentRuns` + `agentMessages` after each DAG execution.
- `docs/` — `architecture-comparison.md`, `agents/00-overview.md`, per-agent docs.
- `.forge/specs/` + `.forge/plans/` — shared specs and task frontiers (per-machine state stays gitignored).
- `research/` — domain briefs that feed the agents (numbered 01..13).
- `scripts/` — migrate / seed / reset / bunq bootstrap / DAG smoke / LLM probe.

## What's real vs simulated in the demo
| Real | Simulated |
|---|---|
| Next.js app, DB, audit chain, policy evaluator, confidence methodology | `ANTHROPIC_MOCK=1` → question gen is a deterministic mock |
| Emission-factor math, range computation, CSRD report structure | `BUNQ_MOCK=1` → bunq API returns canned responses |
| Webhook handler + signature verification | 3 EU credit projects (seeded, not fetched from a real registry) |
| RSA signing for real bunq calls (turn on via `BUNQ_MOCK=0`) | "Credit purchase" = a bunq intra-user transfer with a structured description |

## Cut list (scope controls)
Under time pressure, cut in this order: CSRD PDF print styling → impact matrix → ledger UI → optional invoice upload. Non-negotiable: webhook ingest, classifier, close state machine, refinement, policy eval, reserve transfer, credit recommendation.
