# Agentic DAG Overview

> Proposed 7-agent DAG replacing the linear LLM touchpoints in `lib/agent/close.ts`.
> Source: `C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md` §15.
> Spec: `.forge/specs/spec-agentic-dag.md`.

## Why

Today the monthly close runs one Sonnet call for refinement questions and one for the CSRD narrative — a state machine with two LLM touchpoints. The target is a structured reasoning + judging DAG that separates proposal agents (Green Alternatives, Cost Savings) from judge agents (Green Judge, Cost Judge) from strategy + reporting, so every number the CFO sees has been proposed, validated, and composed by a dedicated role.

## DAG

```
Spend & Emissions ──► Research Agent ──► Green Alternatives ─┐
  Baseline Agent          │              Cost Savings ───────┤
                          │                                  ▼
                          │                          Green Judge ──┐
                          │                          Cost Judge ───┤
                          │                                        ▼
                          └────────► ResearchedPool ────► Carbon Credit & Incentive Strategy
                                                                   │
                                                                   ▼
                                                         Executive Report Agent
                                                                   │
                                                                   ▼
                                                 PDF + dashboard + CFO action plan
```

## Agents

| # | Agent | Role | Doc | Scaffold |
|---|---|---|---|---|
| 01 | Spend & Emissions Baseline | Build the baseline; identify high-impact clusters | [01-spend-baseline.md](./01-spend-baseline.md) | `lib/agents/dag/spendBaseline.ts` |
| 08 | Research | Live web_search → named alternatives + citations | [08-research.md](./08-research.md) | `lib/agents/dag/research.ts` |
| 02 | Green Alternatives | Find lower-carbon alternatives per cluster | [02-green-alternatives.md](./02-green-alternatives.md) | `lib/agents/dag/greenAlternatives.ts` |
| 03 | Cost Savings | Find cheaper alternatives, vendor consolidation, recurring-spend waste | [03-cost-savings.md](./03-cost-savings.md) | `lib/agents/dag/costSavings.ts` |
| 04 | Green Judge | Validate green recommendations; correct or reject | [04-green-judge.md](./04-green-judge.md) | `lib/agents/dag/greenJudge.ts` |
| 05 | Cost Judge | Validate cost claims, annualization, business risk | [05-cost-judge.md](./05-cost-judge.md) | `lib/agents/dag/costJudge.ts` |
| 06 | Carbon Credit & Incentive Strategy | Compute company-scale financial impact, credit + tax strategy | [06-credit-strategy.md](./06-credit-strategy.md) | `lib/agents/dag/creditStrategy.ts` |
| 07 | Executive Report | Compose CFO-grade PDF + dashboard JSON | [07-executive-report.md](./07-executive-report.md) | `lib/agents/dag/executiveReport.ts` |

## Model split (hybrid)

- **Haiku 4.5** (`claude-haiku-4-5-20251001`) — Baseline clustering + merchant normalization + small structured extractions.
- **Sonnet 4.6** (`claude-sonnet-4-6`) — Green Alternatives, Cost Savings, Credit Strategy, Executive Report. These are the judgment-heavy calls.
- **Judges** — Sonnet 4.6 (same tier as the agents they review — we don't want a weaker judge passing weaker claims).
- **Deterministic code** — all math: aggregation, annualization, reserve math, policy thresholds, PDF rendering. The agents propose; code calculates; judges verify.

## Gap vs current code

| Concern | Today | Proposed |
|---|---|---|
| Emission estimation | `lib/emissions/estimate.ts` — spend × factor + uncertainty | Spend-Baseline feeds aggregates; cluster-level refinement unchanged |
| Refinement questions | `lib/agent/questions.ts` — one Sonnet call | Replaced by Green/Cost agents; judges are new |
| Recommendations | None | Green Alternatives + Cost Savings agents generate them |
| Validation | None | Green Judge + Cost Judge |
| Credit strategy | `lib/credits/projects.ts` — 3 seeded projects, no recommendation logic | Carbon Credit & Incentive Strategy agent |
| Report | `lib/agent/narrative.ts` — one Sonnet call | Executive Report agent with structured KPI block + matrix |

## Scaffold scope

Per `spec-agentic-dag.md`, this round ships **stubs with real system prompts and typed schemas**, not full runtime behavior. Each stub returns from `fixtures/demo-runs/<agent>.json`. Real Anthropic calls are wired behind `env.anthropicMock` (already exists in `lib/env.ts`) — flip the flag and set `ANTHROPIC_API_KEY` to go live.
