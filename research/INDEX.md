# Research briefs

Practical briefs (400–800 words each) that inform the Carbon Autopilot build.
Each brief ends with a **Decisions for this build** list that the code references.

| # | Topic | Maps to |
|---|---|---|
| 01 | [Spend-based emissions](./01-spend-based-emissions.md) | `lib/factors/index.ts` |
| 02 | [Confidence methodology](./02-confidence-methodology.md) | `lib/emissions/estimate.ts` |
| 03 | [Merchant classification](./03-merchant-classification.md) | `lib/classify/*` |
| 04 | [Uncertainty clustering](./04-uncertainty-clustering.md) | `lib/agent/close.ts` CLUSTER step |
| 05 | [Policy DSL](./05-policy-dsl.md) | `lib/policy/*` |
| 06 | [CSRD ESRS E1](./06-csrd-esrs-e1.md) | `app/report/[month]/page.tsx` |
| 07 | [EU carbon credits](./07-eu-carbon-credits.md) | `lib/credits/projects.ts` |
| 08 | [bunq primitives](./08-bunq-primitives.md) | `lib/bunq/*` |
| 09 | [Agent state machine](./09-agent-state-machine.md) | `lib/agent/close.ts` |
| 10 | [Append-only ledger](./10-append-only-ledger.md) | `lib/audit/append.ts` + migrate triggers |
| 11 | [Impact matrix](./11-impact-matrix.md) | `app/categories/page.tsx` |
| 12 | [Demo choreography](./12-demo-choreography.md) | `scripts/reset-demo.ts` |
