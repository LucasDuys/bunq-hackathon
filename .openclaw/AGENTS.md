# AGENTS — operating procedure for Carbo

> What to do, when, and where things live. `SOUL.md` is the character; this file is the playbook.
> Mirrors the canonical project context in `../CLAUDE.md`. If the two diverge, `../CLAUDE.md` wins
> (it's loaded by Claude Code on every turn; this file is the OpenClaw equivalent).
> Convention: https://agents.md/.

## Read order at session start

1. `SOUL.md` — identity + hard rules.
2. `IDENTITY.md` — metadata.
3. This file (`AGENTS.md`).
4. `../CLAUDE.md` — canonical project context.
5. `../README.md` for product framing; `../ARCHITECTURE.md` for system diagram.
6. `../todo.md` to see what's open; `../PROGRESS.md` to see what's already shipped.
7. The per-agent doc you're touching: `../docs/agents/00-overview.md` then `../docs/agents/0X-*.md`.

## File map (where things live)

```
app/                          Next.js 16 App Router
├── api/
│   ├── webhook/bunq/         signed webhook receiver (idempotent on bunqTxId)
│   ├── close/{run,[id]/...}  close state machine endpoints
│   ├── bunq/draft-callback/  DraftPayment ACCEPTED/REJECTED webhook
│   ├── reports/download/     guarded streamer for data/exports/
│   ├── impacts/research/     8-agent DAG entry point
│   └── invoices/...          invoice ingestion (upload, list, link, gmail poll)
├── briefing/                 monthly briefing UI + PDF route
├── close/[id]/               close run detail + animated DAG flow
├── report/                   monthly + annual CSRD report pages
└── page.tsx                  dashboard (KPI strip + Reports panel + trend chart)

lib/
├── agent/
│   ├── close.ts              12-state close machine; auto-export hook fires here
│   ├── report-agent.ts       FACADE: runReportAgent / writeMonthlyReport / writeAnnualReport
│   ├── onboarding.ts         11-state onboarding flow
│   ├── impact-analysis.ts    benchmark + switch-opportunity ranking
│   └── narrative.ts          CSRD narrative generator (Sonnet, deterministic fallback)
├── agents/dag/               8-agent DAG: spendBaseline → research → green/cost → judges → credit → executive
├── reports/
│   ├── auto-export.ts        IMPLEMENTATION: writeMonthlyReport / writeAnnualReport
│   ├── render-briefing.tsx   monthly PDF (cover page, KPI cards, share bars, swap badges)
│   ├── render-annual.tsx     annual CSRD ESRS E1 PDF (teammate-owned, do not edit)
│   ├── briefing.ts           buildBriefing() — feeds the renderer
│   └── annual.ts             buildAnnualReport()
├── bunq/
│   ├── client.ts             RSA-SHA256 signed HTTP client + mock mode
│   ├── notes.ts              writeCarbonNote — every Payment carries a carbon stamp
│   ├── draft-payment.ts      createDraftPayment — over-threshold approvals via bunq app
│   ├── annual-export.ts      requestAnnualOverview — bunq's official year-end PDF
│   ├── payments.ts           intraUserTransfer (DRY_RUN-gated)
│   ├── accounts.ts           createSubAccount
│   └── webhook.ts / signing.ts / context.ts
├── classify/                 rule-first → cache → Haiku-fallback merchant classifier
├── factors/                  hardcoded DEFRA / ADEME / Exiobase emission factors
├── emissions/estimate.ts     per-tx point + low + high + confidence; quadrature rollup
├── policy/                   YAML/JSON policy DSL + evaluator (deterministic)
├── credits/projects.ts       3 simulated EU carbon-credit projects
├── tax/                      Dutch EIA/MIA/Vamil + EU ETS math
├── audit/append.ts           SHA-256 hash-chained append-only ledger
├── invoices/                 invoice ingestion pipeline (upload, OCR, link)
└── db/{schema,client}.ts     SQLite + Drizzle

scripts/
├── migrate.ts                raw DDL (kept in sync with Drizzle schema by hand)
├── seed.ts / seed-realistic.ts  60 hand-crafted vs 600 procedural Acme BV transactions
├── reset-demo.ts             rm + migrate + seed
├── bunq-keygen.ts            RSA keypair for signing
├── bunq-sandbox-user.ts      mint a fresh sandbox user + API key
├── bunq-bootstrap.ts         installation → device-server → session-server
├── bunq-create-reserve.ts    creates the Carbo Reserve sub-account
├── bunq-sugardaddy.ts        seed sandbox EUR via sugardaddy@bunq.com
├── bunq-backfill-notes.ts    paint historical txns with NoteText carbon stamps
├── bunq-annual-export.ts     year-end CSV + bunq PDF pair
├── render-mock-pdf.ts        one-shot mock PDF (no DB required)
├── fire-test-event.ts        synthesise a bunq webhook event
├── fire-draft-callback.ts    synthesise a DRAFT_PAYMENT ACCEPTED/REJECTED event
└── dag-{smoke,baseline,e2e-live}.ts  DAG harnesses

data/                         SQLite DB (gitignored) + exports/ (generated PDFs, gitignored)
fixtures/                     synthetic txs + 3 demo invoices + emission factors
research/                     14 numbered domain briefs (start at INDEX.md)
docs/agents/                  per-agent system prompts + I/O schemas
.forge/                       shared specs and task frontiers
```

## Common workflows

### "Run the full demo loop"

```
npm install
npm run reset           # wipes + migrates + seeds (61 tx)
npm run dev             # localhost:3000, mock-default
# → click Run carbon close → answer 3 questions → approve
# Generated PDF lands at data/exports/carbo-org_acme_bv-{YYYY}-{MM}.pdf
```

### "Render the monthly PDF without a DB"

```
npm run reports:mock
# → data/exports/mock-bunq-carbo-monthly.pdf
```

### "Live sandbox bunq"

```
npm run bunq:sandbox-user        # mints sandbox API key, paste into .env.local
npm run bunq:keygen              # RSA keypair, paste into .env.local
# Set BUNQ_MOCK=0 in .env.local
npm run bunq:bootstrap           # install + device-server + session
npm run bunq:create-reserve      # the Carbo Reserve sub-account
./scripts/dev-live.sh            # cloudflared tunnel + npm run dev
npm run bunq:register            # registers the webhook URL with bunq
```

### "Run the 8-agent DAG end-to-end with real Claude"

```
ANTHROPIC_MOCK=0 ANTHROPIC_API_KEY=sk-ant-... npm run dev
# in another shell:
curl -X POST http://localhost:3000/api/impacts/research \
  -H 'content-type: application/json' \
  -d '{"month":"2026-03"}' | jq
```

## Workflow rules

- **Always pull `merge-branch` before starting work.** It's the canonical integration branch; `daniel`, `lucasduys`, `matrix`, `ben/*`, `new-ui` all merge into it.
- **Branch from `merge-branch`, PR back to `merge-branch`.** Never push to `main`.
- **Open one PR per logical unit.** Don't batch unrelated changes.
- **Commit messages: `<area>: <one-line summary>` + a short paragraph.** No emojis.
- **`npm run typecheck` before pushing.** The unrelated `googleapis` error in `lib/invoices/gmail.ts` is pre-existing — ignore unless you touched that file.
- **After `npm run reset`, restart `npm run dev`.** Otherwise the Node process holds a stale SQLite handle.
- **Never commit `.env*`, `.bunq-context.json`, `*.pem`.** Already gitignored — but be paranoid.

## Multi-agent coordination

Several agents work in parallel (Daniel = bunq + reports; Ben = invoices, tax, UI; Lucas = baseline + DAG infra; matrix branch = impact matrix + research agent). Avoid editing files outside your lane unless the change is essential and small. The teammate-owned files most likely to bite you:

- `lib/reports/render-annual.tsx` — Daniel does NOT edit.
- `lib/agent/close.ts` — multi-owner; tread carefully, prefer additive hooks at the end of `approveAndExecute`.
- `lib/agents/dag/*.ts` — Lucas + matrix; touch only with their sign-off.
- `app/page.tsx` — anyone can add a panel; coordinate the layout.

## When in doubt

- Read `../CLAUDE.md` (this file's canonical Claude Code mirror).
- Read `../docs/agents/00-overview.md` for the DAG.
- Read `../research/INDEX.md` for domain context.
- Ask the human in the loop. The cost of a quick check is low; the cost of a mis-merge is hours.
