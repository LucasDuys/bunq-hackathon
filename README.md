# Carbon Autopilot

Monthly carbon-close system for bunq Business. Webhook-ingested transactions → spend-based emission estimates with confidence ranges → agent-driven refinement (2–3 questions) → policy-driven allocation to a bunq Carbon Reserve sub-account → simulated EU carbon-credit purchase → CSRD ESRS E1 report.

Built for the bunq hackathon. Best API Integration track.

## Pitch
> "We turn bunq transactions into a monthly, audit-ready carbon report — and automatically fund your EU carbon reserve."

## Stack
- **Next.js 15 App Router** (TypeScript), Tailwind 4, Recharts.
- **SQLite** via better-sqlite3 + **Drizzle ORM**; append-only `audit_events` hash-chain via trigger.
- **Anthropic TS SDK** — Haiku 4.5 for merchant classification, Sonnet 4.6 for refinement questions + CSRD narrative.
- **bunq** thin client with RSA-SHA256 signing + webhook verify. Mock-first; flip `BUNQ_MOCK=0` for live sandbox.
- **Cloudflare Tunnel** is the recommended deploy for webhook URL stability.

## Quickstart

```bash
pnpm install
pnpm run migrate   # creates ./data/carbon.db
pnpm run seed      # 61 sandbox transactions across 90 days
pnpm dev
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
pnpm run reset    # wipes + re-seeds. Restart `pnpm dev` afterward so the DB handle isn't stale.
```

## Demo flow (3 minutes)
1. `/` — overview, 61 tx, €39k spend, no CO₂e yet. Click **Run Carbon Close**.
2. `/close/[id]` — pipeline animates; pauses at 3 refinement questions. Answer each → confidence rises.
3. Proposed actions — reserve transfer + 4.8 t of EU credits across biochar / peatland / reforestation. Click **Approve & execute**.
4. `/report/2026-04` — CSRD ESRS E1 extract (E1-6 + E1-7 tables + methodology footnote).
5. `/ledger` — SHA-256 hash chain; chain-valid badge.
6. `/categories` — impact matrix: train vs flight is 16× difference.

See `research/12-demo-choreography.md` for the full script.

## Directory map
- `app/` — Next routes (pages + 4 API routes).
- `lib/bunq/` — signed HTTP client, webhook verify, sub-account + payment helpers.
- `lib/agent/close.ts` — explicit state machine for the monthly close.
- `lib/classify/` — rule-first + LLM-fallback merchant classifier, merchant cache.
- `lib/factors/` — hard-coded spend-based emission factors (DEFRA/ADEME/Exiobase-derived).
- `lib/emissions/estimate.ts` — per-tx point + low/high + confidence; quadrature-sum rollup.
- `lib/policy/` — Zod-validated policy DSL + evaluator.
- `lib/credits/` — simulated EU carbon-credit projects (biochar / reforestation / peatland).
- `lib/audit/` — SHA-256 hash-chained append-only audit ledger.
- `research/` — 12 practical briefs (the "why" behind every design choice).
- `scripts/` — migrate / seed / reset / bunq bootstrap.

## Architecture
See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for data flow + state machine diagram + design rationale.
See [`research/INDEX.md`](./research/INDEX.md) for the 12 research briefs.

## What's real vs simulated in the demo
| Real | Simulated |
|---|---|
| Next.js app, DB, audit chain, policy evaluator, confidence methodology | `ANTHROPIC_MOCK=1` → question gen is a deterministic mock |
| Emission-factor math, range computation, CSRD report structure | `BUNQ_MOCK=1` → bunq API returns canned responses |
| Webhook handler + signature verification | 3 EU credit projects (seeded, not fetched from a real registry) |
| RSA signing for real bunq calls (turn on via `BUNQ_MOCK=0`) | "Credit purchase" = a bunq intra-user transfer with a structured description |

## Cut list (scope controls)
Under time pressure, cut in this order: CSRD PDF print styling → impact matrix → ledger UI → optional invoice upload. Non-negotiable: webhook ingest, classifier, close state machine, refinement, policy eval, reserve transfer, credit recommendation.
