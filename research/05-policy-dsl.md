# 05 — Policy DSL

## Problem
Companies need to express "how much money goes into the Carbon Reserve per transaction / per category / per kg of CO₂e" without writing code. The policy needs to be auditable, versionable, and enforce safety (no runaway transfers).

## Key facts
- **Declarative rules** beat imperative code for audit. Auditors can read "travel @ 3% of spend" and check the math; they can't read TypeScript.
- Three common allocation methods in voluntary carbon-market tooling:
  - **% of spend** (`pct_spend`) — simple, scales with spend, popular with SaaS products like Watershed.
  - **EUR per kg CO₂e** (`eur_per_kg_co2e`) — scales with emissions, better reflects actual abatement cost. Typical range: €0.05–€0.20 per kg of CO₂e.
  - **Flat EUR** (`flat_eur`) — predictable budget, weakest signal. Useful as a fallback.
- **Approval thresholds**: common pattern is "anything above €X needs a human click". Prevents the agent from transferring huge sums autonomously. bunq's RequestInquiry primitive would be used here in production; in MVP we use an in-app modal.
- **EU-only filter**: part of the credit-recommendation logic, not the reserve allocation. Policy says "at least N% of credits must be EU-based"; recommendation engine enforces.
- **Removal vs reduction**: SBTi guidance and emerging EU CRCF prefer removals (permanent storage) for net-zero claims. Policy lets companies require `minRemovalPct`.

## Design
Policy is stored as JSON blob in `policies.rules`, validated by Zod (`lib/policy/schema.ts`).

```json
{
  "reserveRules": [
    { "category": "travel", "method": "pct_spend", "value": 0.03 },
    { "category": "*", "method": "eur_per_kg_co2e", "value": 0.08 }
  ],
  "approvalThresholdEur": 500,
  "creditPreference": {
    "region": "EU",
    "types": ["removal_technical", "removal_nature"],
    "minRemovalPct": 0.7
  },
  "maxReservePerMonthEur": 5000
}
```

Evaluator in `lib/policy/evaluate.ts`:
- For each `CategoryAggregate` (spend, CO₂e), pick the most-specific matching rule (category exact > wildcard `*`).
- Compute reserve EUR for that category.
- Sum across categories, cap at `maxReservePerMonthEur`, flag `requiresApproval` if total > `approvalThresholdEur`.

## Safety invariants
- Monthly cap is hard — even if rules over-allocate, the total can't exceed the cap.
- Wildcard `*` is required as a fallback so no category is ever ungoverned.
- Rule method values are non-negative (Zod `.nonnegative()`).

## Decisions for this build
- JSON policy, Zod-validated.
- Three rule methods: `pct_spend`, `eur_per_kg_co2e`, `flat_eur`.
- Default policy (`DEFAULT_POLICY`) installed on first run.
- Approval gate surfaces in UI when total > threshold.
- Credit preference applied in `lib/credits/projects.ts` `totalBudgetMix` — not re-filtered per close; extend later.
- Future: per-rule approval (not just total), and cross-currency (we're EUR-only for now).
