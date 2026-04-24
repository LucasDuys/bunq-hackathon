---
spec: baseline-agent
total_tasks: 8
estimated_tokens: 41000
depth: standard
---

# Baseline Agent Frontier

## Tier 1 (parallel -- no dependencies)
- [T001] Category routing table | est: ~3k tokens | repo: bunq--hackathon | provides: routing-table, R004.AC8 | files: lib/agents/dag/routing.ts
- [T002] Reason-for-priority detail lookup table | est: ~3k tokens | repo: bunq--hackathon | provides: reasons-table, R005.AC3 | files: lib/agents/dag/reasons.ts
- [T003] Extend seed script to load bunq fixture into transactions table | est: ~4k tokens | repo: bunq--hackathon | provides: seeded-transactions, R001.AC3 | files: scripts/seed.ts

## Tier 2 (depends on Tier 1)
- [T004] Implement deterministic spendBaseline.run (aggregation + clustering + scoring) | est: ~11k tokens | repo: bunq--hackathon | depends: T001.R004.AC8, T002.R005.AC3, T003.R001.AC3 | provides: baseline-run, R001.AC1, R001.AC2, R001.AC4, R002, R003, R004, R005.AC1, R008.AC3 | consumes: routing-table, reasons-table, seeded-transactions | files: lib/agents/dag/spendBaseline.ts, lib/agents/dag/types.ts

## Tier 3 (depends on Tier 2)
- [T005] Wire optional enhanceWithLlm hook behind anthropicMock flag | est: ~5k tokens | repo: bunq--hackathon | depends: T004 | provides: llm-hook, R005.AC2, R005.AC4, R005.AC5 | consumes: baseline-run | files: lib/agents/dag/spendBaseline.ts
- [T006] Standalone POST /api/baseline/run route with audit event | est: ~5k tokens | repo: bunq--hackathon | depends: T004 | provides: baseline-route, R006 | consumes: baseline-run | files: app/api/baseline/run/route.ts
- [T007] Unit tests against seeded fixture (7 acceptance cases) | est: ~7k tokens | repo: bunq--hackathon | depends: T004 | provides: baseline-tests, R007 | consumes: baseline-run, seeded-transactions | files: lib/agents/dag/__tests__/spendBaseline.test.ts

## Tier 4 (depends on Tier 3)
- [T008] Typecheck + lint gate | est: ~3k tokens | repo: bunq--hackathon | depends: T005, T006, T007 | provides: typecheck-green, R008.AC1, R008.AC2 | consumes: llm-hook, baseline-route, baseline-tests | files: lib/agents/dag/spendBaseline.ts, lib/agents/dag/types.ts, app/api/baseline/run/route.ts, lib/agents/dag/__tests__/spendBaseline.test.ts

## Coverage
- R001 -> T003 (AC3), T004 (AC1, AC2, AC4)
- R002 -> T004
- R003 -> T004
- R004 -> T001 (AC8 routing table), T004 (scoring + policy override)
- R005 -> T002 (AC3 static lookup), T004 (AC1 deterministic default), T005 (AC2, AC4, AC5 LLM path)
- R006 -> T006
- R007 -> T007
- R008 -> T004 (AC3 additive-only type changes), T008 (AC1 typecheck, AC2 lint)

## File-contention audit
- Tier 1: T001 (routing.ts new), T002 (reasons.ts new), T003 (scripts/seed.ts) — no overlap
- Tier 2: T004 alone
- Tier 3: T005 (spendBaseline.ts), T006 (new route file), T007 (new test file) — no overlap. T005 is the only Tier 3 task that touches spendBaseline.ts; T004 already completed in Tier 2
- Tier 4: T008 is read-only (typecheck + lint), only writes surface-level fixes if needed
