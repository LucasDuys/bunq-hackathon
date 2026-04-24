---
spec: spec-dag-hardening
tasks: 14
tiers: 6
est_tokens: ~157k
depth: thorough
design: DESIGN.md
autonomy: gated
auto_backprop: true
parallelism_cap: 3
---

# DAG Hardening + Annual Savings Forecaster Frontier

Decomposed from `spec-dag-hardening.md` (11 R-requirements, thorough depth).

**TDD ordering**: R006 tests authored in Tier 1 BEFORE R004 projector impl in Tier 2; tests re-run green in Tier 4 (T009) to prove the contract.

**Contention resolution** (forge-self-fixes R005) — simulated Tier-1 parallel dispatch for same-file overlap:

- `lib/agents/dag/research.ts` is touched by R002 (all-agents mock_path plumbing), R003 (cache URL stripping), R010 (domain+logoUrl enrichment). Resolution: serialize via tiers. T002 Tier 1 → T003 Tier 2 → T006 Tier 3.
- `lib/agents/dag/index.ts` is touched by R001 (credit audit event), R002 (mock_agent_count metric + fallback audit events). Resolution: T002 Tier 1 → T005 Tier 2, T005 depends on T002.
- `lib/agents/dag/types.ts` is touched by R002 (DagRunResult.metrics), R001 (audit event type). Resolution: T002 Tier 1 → T005 Tier 2.
- `docs/architecture-comparison.md` is appended by R003 (imbalance #1) and R007 (imbalance #2). Resolution: T003 Tier 2 → T011 Tier 4.
- `app/presentation/page.tsx` is edited by R009 (lazy-fetch) and R013 design verification. Resolution: T010 Tier 4 → T013 Tier 6.
- `lib/agents/dag/__tests__/projector.test.ts` authored in T001 Tier 1, re-run + fine-tuned in T009 Tier 4.
- Migration files: three distinct timestamped additive migrations (T002 mock_path, T003 research_cache_orgneutral, T012 close_runs_dag_run_id) — no file overlap.

**Risk gating**: R007 (T011) and R008 (T012) are deletion-heavy. Gated to Tiers 4/5 after core new pieces land on green (T002-T009). Auto-backprop will catch regressions from legacy callsites.

**User-requested ordering** (mock baseline early): T007 (R011) lands in Tier 2 immediately after T002 (R002.AC1) so the harness can measure mock-path usage before later tiers extend the DAG.

## Tier 1 (parallel — no dependencies)

- [T001] Author projector unit tests (failing skeleton) | est: ~8k tokens | provides: R006.AC1, projector-test-spec | files: lib/agents/dag/__tests__/projector.test.ts | req: R006 | test_strategy: TDD-first; six failing tests per spec AC table locked in before impl; establishes ForecastInput/ForecastOutput type contract
- [T002] Mock-fallback observability end-to-end | est: ~16k tokens | provides: R002.AC1, R002.AC2, R002.AC3, R002.AC4, R002.AC5, mock-path-visible, used-mock-flag, mock-agent-count-metric | files: lib/agents/dag/llm.ts, lib/agents/dag/index.ts, lib/agents/dag/types.ts, db/migrations/NNNN_mock_path.sql, lib/agents/dag/costJudge.ts, lib/agents/dag/greenJudge.ts, lib/agents/dag/costSavings.ts, lib/agents/dag/greenAlternatives.ts, lib/agents/dag/research.ts, lib/agents/dag/executiveReport.ts, lib/agents/dag/spendBaseline.ts, lib/agents/dag/creditStrategy.ts | req: R002 | test_strategy: unit test for `callAgent` returning `usedMock`; integration test that `mock_agent_count` surfaces in DagRunResult.metrics when ANTHROPIC_MOCK=1; intended-vs-degradation flag verified

## Tier 2 (depends on Tier 1)

- [T003] Research cache leakage fix (pick option + ship) | est: ~14k tokens | provides: R003.AC1, R003.AC2, R003.AC3, R003.AC4, cache-multi-tenant-safe, arch-comparison-imbalance-1 | consumes: used-mock-flag | files: lib/agents/dag/research.ts, db/migrations/NNNN_research_cache_orgneutral.sql, docs/architecture-comparison.md | req: R003 | depends: T002 | test_strategy: two-org same-policy same-week cache-hit assertion; sources returned are org-neutral (option B) OR fresh live run (option A); verifies T002 mock_path recording not broken
- [T004] Deterministic annual-savings projector | est: ~12k tokens | provides: R004.AC1, R004.AC2, R004.AC3, R004.AC4, forecast-helper | consumes: projector-test-spec | files: lib/agents/dag/projector.ts | req: R004 | depends: T001.R006.AC1 | test_strategy: impl against failing T001 suite; <50ms latency budget; reuses tools.ts + lib/factors + lib/tax/incentives; zero-adoption + zero-spend sanity checks
- [T005] Credit Strategy signed audit event | est: ~10k tokens | provides: R001.AC1, R001.AC2, R001.AC3, R001.AC4, credit-audit-event | consumes: used-mock-flag, mock-agent-count-metric | files: lib/agents/dag/index.ts, lib/agents/dag/creditStrategy.ts, lib/agents/dag/types.ts | req: R001 | depends: T002 | test_strategy: verifyChain round-trip test; identical-input digest equality test; no change to creditStrategy module signature
- [T007] Mock baseline harness | est: ~10k tokens | provides: R011.AC1, R011.AC2, R011.AC3, R011.AC4, R011.AC5, R011.AC6, R011.AC7, baseline-report-initial | consumes: used-mock-flag | files: scripts/dag-baseline.ts, .forge/reports/.gitkeep | req: R011 | depends: T002.R002.AC1 | test_strategy: 5-run mock batch completes <30s; report file written with per-agent latency p50/p95 + token totals + mock-path count + parse-failure count + run[0] dump

## Tier 3 (depends on Tier 2)

- [T006] Logo + vendor enrichment (research + recs) | est: ~10k tokens | provides: R010.AC1, R010.AC2, R010.AC3, R010.AC4, R010.AC5, R010.AC6, R010.AC7, logos-in-payload | consumes: cache-multi-tenant-safe | files: lib/agents/dag/research.ts, lib/agents/dag/costSavings.ts, lib/agents/dag/greenAlternatives.ts | req: R010 | depends: T003 | design: DESIGN.md | test_strategy: research single-category-2-URLs returns non-empty domain+logoUrl; costSavings match/no-match vendor-logo test; buildMock populates deterministic values; no new LLM calls
- [T008] Forecaster API route | est: ~8k tokens | provides: R005.AC1, R005.AC2, R005.AC3, R005.AC4, R005.AC5, R005.AC6, forecast-route | consumes: forecast-helper | files: app/api/forecast/annual/route.ts | req: R005 | depends: T004 | test_strategy: 200 happy path, 400 invalid jurisdiction, 400 non-summing distribution, forecast.annual.completed audit event persisted, <200ms; no DB writes except audit
- [T009] Projector tests green verification | est: ~4k tokens | provides: R006.AC2, R006.AC3, R006.AC4, R006.AC5, R006.AC6, R006.AC7, projector-test-green | consumes: forecast-helper | files: lib/agents/dag/__tests__/projector.test.ts | req: R006 | depends: T004 | test_strategy: `pnpm exec tsx --test lib/agents/dag/__tests__/projector.test.ts` passes all six; linearity within +-5% on spend doubling; confidence drops on wildcard-heavy distribution; sensitivity monotonicity

## Tier 4 (depends on Tier 3)

- [T010] Presentation page lazy-wires real data | est: ~12k tokens | provides: R009.AC1, R009.AC2, R009.AC3, R009.AC4, R009.AC5, presentation-live | consumes: logos-in-payload, credit-audit-event, used-mock-flag | files: app/presentation/page.tsx | req: R009 | depends: T006, T005 | design: DESIGN.md | test_strategy: IntersectionObserver lazy-fetch test; 500-fallback shows "demo replay (live unavailable)" badge; typecheck clean; reuses existing DagReplay component
- [T011] Path consolidation decision + wiring | est: ~14k tokens | provides: R007.AC1, R007.AC2, R007.AC3, R007.AC4, arch-comparison-imbalance-2, impacts-path-canonical | consumes: logos-in-payload, credit-audit-event | files: docs/architecture-comparison.md, docs/agents/00-overview.md, lib/agent/impacts.ts, lib/agent/impact-analysis.ts, app/impacts/page.tsx | req: R007 | depends: T006, T005 | test_strategy: typecheck + `pnpm exec tsx scripts/dag-smoke.ts` green after path change; if option A, impacts.ts + impact-analysis.ts deleted and app/impacts/page.tsx calls /api/impacts/research

## Tier 5 (depends on Tier 4 — high-risk serial)

- [T012] Legacy close-machine surgery (runDag integration) | est: ~18k tokens | provides: R008.AC1, R008.AC2, R008.AC3, R008.AC4, R008.AC5, close-machine-dag-wired | consumes: impacts-path-canonical, credit-audit-event | files: lib/agent/close.ts, lib/agent/questions.ts, lib/agent/narrative.ts, db/migrations/NNNN_close_runs_dag_run_id.sql, app/api/close/run/route.ts | req: R008 | depends: T011, T005 | test_strategy: 7 baseline tests + typecheck green; `POST /api/close/run` still 200 on seeded fixture; questions.ts + narrative.ts deleted; AWAITING_ANSWERS preserved only when required_context_question != null; DAG_RUNNING state replaces QUESTIONS_GENERATED

## Tier 6 (verification + design consistency)

- [T013] Design consistency verification (presentation + impacts surfaces) | est: ~8k tokens | provides: design-verified | consumes: presentation-live, impacts-path-canonical | files: app/presentation/page.tsx, app/impacts/page.tsx, DESIGN.md | req: R009, R010, R007 | depends: T010, T011 | design: DESIGN.md | test_strategy: DESIGN.md token audit across live surfaces; brand-guidelines skill pass; no regression on existing UI; vendor logos render correctly on executive matrix
- [T014] End-to-end verification + baseline rerun | est: ~13k tokens | provides: spec-complete, baseline-final | consumes: close-machine-dag-wired, forecast-route, projector-test-green, baseline-report-initial, design-verified | files: scripts/dag-smoke.ts, scripts/dag-baseline.ts, .forge/reports/ | req: R001, R002, R003, R004, R005, R006, R007, R008, R009, R010, R011 | depends: T012, T008, T009, T013, T007 | test_strategy: full smoke run + `pnpm exec tsx scripts/dag-baseline.ts --runs 5` (mock) + `--live` single-run spot-check; diff baseline-final vs baseline-report-initial to confirm no latency regressions; typecheck + full test suite green; audit chain verifies end-to-end

## Coverage

Every R-number covered; every acceptance criterion mapped to a `provides:` token.

- R001 (Credit Strategy audit) -> T005 [AC1-AC4]
- R002 (Mock-fallback observability) -> T002 [AC1-AC5]
- R003 (Research cache leakage) -> T003 [AC1-AC4]
- R004 (Projector helper) -> T004 [AC1-AC4]
- R005 (Forecaster API route) -> T008 [AC1-AC6]
- R006 (Projector tests) -> T001 [AC1 scaffold] + T009 [AC2-AC7 green]
- R007 (Path consolidation) -> T011 [AC1-AC4]
- R008 (Legacy close machine) -> T012 [AC1-AC5]
- R009 (Presentation page) -> T010 [AC1-AC5]
- R010 (Logo enrichment) -> T006 [AC1-AC7]
- R011 (Baseline harness) -> T007 [AC1-AC7]

Final verification at T014 re-checks all R-numbers end-to-end.

## Tier summary

| Tier | Tasks | Parallelism | Critical Path Files |
|------|-------|-------------|---------------------|
| 1    | T001, T002                     | 2-way parallel              | projector.test.ts (T001); llm.ts + index.ts + types.ts + 8 agents + mock_path migration (T002) |
| 2    | T003, T004, T005, T007         | up to 3 at once (max cap)   | research.ts (T003); projector.ts (T004); index.ts + creditStrategy.ts (T005); dag-baseline.ts (T007) |
| 3    | T006, T008, T009               | 3-way parallel              | research.ts + costSavings.ts + greenAlternatives.ts (T006); route.ts (T008); projector.test.ts (T009) |
| 4    | T010, T011                     | 2-way parallel              | presentation/page.tsx (T010); impacts.ts deletion + docs (T011) |
| 5    | T012                           | serialized (high risk)      | close.ts + questions.ts/narrative.ts deletion + close_runs migration |
| 6    | T013, T014                     | 2-way parallel              | DESIGN.md audit (T013); dag-smoke.ts + dag-baseline.ts rerun (T014) |

## Streaming-DAG hints

- `T004 depends: T001.R006.AC1` — projector impl can start as soon as the test file exists with type-contract stubs (ForecastInput/ForecastOutput exported), no need to wait for T001 review-green.
- `T007 depends: T002.R002.AC1` — baseline harness can start as soon as `callAgent` returns `usedMock`, doesn't need full agentMessages migration or metrics surfacing.

Back-compat: all other edges are plain task-level (`depends: T00N`), scheduler treats them as "wait for final AC".

## Risk register

- T002: touches 8 agent files for mock_path plumbing. Mitigation: keep edits additive (one new column write per agent); no behavior changes.
- T003: migration changes research cache key OR row shape. Mitigation: document choice in architecture-comparison.md BEFORE code change; option B (strip URLs) is lower-risk than option A (change PK).
- T011: option A path deletes lib/agent/impacts.ts + impact-analysis.ts. Mitigation: run `pnpm exec tsx scripts/dag-smoke.ts` before AND after; if smoke fails, fall back to option B (keep both, document use cases).
- T012: 12-state machine surgery with column migration. Mitigation: 7 baseline tests must pass; seeded fixture close-run smoke must return 200; rollback plan = revert commit (additive column is a no-op if code reverts).
