# src/ -- code goes here

Empty scaffold. Bootstrap with:

```bash
bunx create-next-app@latest . --typescript --tailwind --app --src-dir
bun add @anthropic-ai/sdk openai zod js-yaml sharp
bun add @supabase/supabase-js
bun add -d @types/js-yaml
```

## Planned layout (see `../ARCHITECTURE.md`)

```
src/
  app/                    Next.js app router
    api/
      webhook/            bunq callback handler (idempotent)
      upload/             receipt upload endpoint
      approve/            draft-payment approval webhook
    dashboard/            main UI
    ledger/               audit + CSRD export view
  agent/
    dag.ts                ported from graphbot dag_executor
    tools/
      bunq.ts             BunqTool subclass
      emission.ts         EmissionFactorTool subclass
      vision.ts           Claude Vision tool
    autonomy.ts           ported from graphbot autonomy.py
    loop.ts               outer agent loop
  policy/
    engine.ts             YAML loader + rule evaluator
    policy.yaml           rules (see ARCHITECTURE.md)
  carbon/
    estimator.ts          per-item kg CO2e
    factors.ts            Climatiq client + fallback dict
  ledger/
    schema.sql            Supabase migrations
    csrd-export.ts        E1-7 CSV generator
  data/
    emission-factors-fallback.json
    mock-credit-projects.json
```

## Env vars (`.env.local`)

```
ANTHROPIC_API_KEY=
MERCURY_API_KEY=
MERCURY_BASE_URL=
BUNQ_API_KEY=
BUNQ_ENV=sandbox
CLIMATIQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## First end-to-end test (hour 0-2)

```bash
bun run dev
# register sandbox callback against http://localhost:3000/api/webhook
# trigger a sandbox payment
# expect: webhook fires -> log row appears in ledger
```
