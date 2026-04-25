# Agentic DAG Overview

> Reflects post-merge reality after `matrix` landed.
> Source plan: `C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md`.
> Detailed comparison: `docs/architecture-comparison.md`.
> Per-agent details: `01-spend-baseline.md` … `07-executive-report.md`.

## Why

The legacy monthly close ran two Sonnet calls (refinement Q&A + narrative) inside a 12-state state machine. The target — and the implementation that's now live — is a structured reasoning + judging DAG that separates proposal from validation from composition, so every CFO-facing number has been proposed by a worker, validated by a judge, and composed by a reporter.

## DAG (8 agents)

```
                            ┌── greenAlternatives ──┐
   baseline ─► research ───┤                        ├──► greenJudge ──┐
  (det. only) (Sonnet      └── costSavings ────────┴──► costJudge ──┤
              + web_search)                                          │
                                                                     ▼
                                                  creditStrategy (Sonnet + math)
                                                                     │
                                                                     ▼
                                                  executiveReport (Sonnet, optional prose)
                                                                     │
                                                                     ▼
                                              CFO action plan + dashboard payload
```

## Agents

| # | Agent | Role | Model | LLM mode | Doc | File |
|---|---|---|---|---|---|---|
| 01 | Spend & Emissions Baseline | Build the baseline; identify high-impact clusters | none (deterministic) | — | [01-spend-baseline.md](./01-spend-baseline.md) | `lib/agents/dag/spendBaseline.ts` |
| 08 | Research Agent | Per-cluster live web research; populate `researchedPool` of real-citation alternatives | Sonnet 4.6 | tool_use (web_search + 2 custom Zod tools) | [08-research.md](./08-research.md) | `lib/agents/dag/research.ts` |
| 02 | Green Alternatives | Pick lower-carbon alternatives for each cluster | Sonnet 4.6 | plain JSON completion (candidates pre-resolved) | [02-green-alternatives.md](./02-green-alternatives.md) | `lib/agents/dag/greenAlternatives.ts` |
| 03 | Cost Savings | Find cost wins (recurring spend, vendor consolidation, bulk) | Sonnet 4.6 | plain JSON completion | [03-cost-savings.md](./03-cost-savings.md) | `lib/agents/dag/costSavings.ts` |
| 04 | Green Judge | Validate green recommendations + recompute math | Sonnet 4.6 | plain JSON completion (code overrides verdict on zero-sources) | [04-green-judge.md](./04-green-judge.md) | `lib/agents/dag/greenJudge.ts` |
| 05 | Cost Judge | Validate cost claims, annualization, business risk | Sonnet 4.6 | plain JSON completion (same code-override pattern) | [05-cost-judge.md](./05-cost-judge.md) | `lib/agents/dag/costJudge.ts` |
| 06 | Carbon Credit & Incentive Strategy | Compute net company-scale financial impact + credit + tax strategy | Sonnet 4.6 | prose labels only — all math deterministic | [06-credit-strategy.md](./06-credit-strategy.md) | `lib/agents/dag/creditStrategy.ts` |
| 07 | Executive Report | Compose CFO-grade dashboard JSON + matrix | Sonnet 4.6 (optional summary) | numbers deterministic | [07-executive-report.md](./07-executive-report.md) | `lib/agents/dag/executiveReport.ts` |

## Model split (current reality)

- **Baseline** — pure SQL + math. No LLM call.
- **Research** — Sonnet 4.6 + native `web_search_20250305` + Zod tools. Caches 30 days in `researchCache`.
- **Green Alt + Cost Savings + Judges + Credit Strategy + Executive Report** — Sonnet 4.6 plain JSON completion via `lib/agents/dag/llm.ts::callAgent`. Prompt cache enabled (ephemeral) on all.
- **Mock fallback** — every Sonnet-using agent has a deterministic `buildMock()` path triggered by `isMock()` (true when `ANTHROPIC_MOCK=1` or no key). Currently silent; an audit signal is on the next-round backlog.

## Authority boundaries (read this before editing a judge)

- **Proposal agents** (Green Alt, Cost Savings) — LLM is authoritative on which alternative to pick from the pre-resolved candidate set.
- **Judges** (Green Judge, Cost Judge) — LLM scores + writes audit summary; **code can override the verdict** if hard rules fail (zero-sources, math mismatch). The judges are *validators*, not *authorities*. Document this in any future agent change.
- **Credit Strategy** — LLM writes prose labels; numeric `net_financial_impact_eur` is deterministic and never touched by the LLM.
- **Executive Report** — same pattern: numbers deterministic, prose optional.

## Persistence (post-merge)

Every `runDag()` execution writes:

| Table | What | Why |
|---|---|---|
| `agentRuns` | One row: full `DagRunResult` JSON, `totalLatencyMs`, mock flag | Replay the run later for audits or demos |
| `agentMessages` | One row per agent I/O: agentRunId, agentName, role, content, tokens in/out, cached, server-tool-use count | Cost + cache-hit observability |
| `researchCache` | Research outputs keyed on `(category, jurisdiction, policyDigest, week)` | 30-day TTL, multi-tenant amortization (with leakage caveat — see architecture-comparison.md) |
| `webSearchAudit` | One row per web_search query | Evidence trail per recommendation |
| `auditEvents` (existing chain) | Per-agent run-completed events from `runDag()` | Append-only signed timeline |

## Entry points

- **Canonical DAG runner:** `POST /api/impacts/research` → `runDag()` in `lib/agents/dag/index.ts` (route name misleading; it runs the full 8-agent DAG and persists via `lib/impacts/store::persistDagRun`). This is the path for new monthly-close work.
- **What-if simulator + shared types:** `lib/agent/impacts.ts` — lightweight non-DAG path used by `app/impacts/page.tsx` (page render) and exports the `Quadrant` + `ResolvedAlternative` types consumed by `components/ImpactMatrix.tsx` and `lib/impacts/store.ts`. Intentionally retained alongside `runDag()` per R007 option B; do not delete without migrating those four call sites.
- **Dashboard category roll-up:** `lib/agent/impact-analysis.ts::buildCategoryAnalyses` — powers the dashboard at `app/page.tsx`. Sibling of `impacts.ts`, retained under the same R007 decision.
- **Standalone Baseline:** `POST /api/baseline/run` → `runBaseline()` only. Useful for fast iteration on the priority-target shape.
- **Legacy close machine:** `POST /api/close/run` → `lib/agent/close.ts` (12-state). **Does not yet call `runDag()`** — see migration order in `architecture-comparison.md`.

## What's NOT done

See `docs/architecture-comparison.md` § "Migration order — what's left" and the next-round spec at `.forge/specs/spec-dag-hardening.md`.
