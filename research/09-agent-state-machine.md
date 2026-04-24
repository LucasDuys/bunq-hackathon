# 09 — Agent state machine

## Problem
The monthly close has 10+ steps with human-in-the-loop pauses, external bunq calls, and partial failure modes. We need a structure that's debuggable, testable, and survives process restarts.

## Key facts
- **Single-prompt agents** (send everything to one Sonnet call, let it orchestrate) fail at the "await human input" step — the agent would have to pause, which LLMs can't do inside one call.
- **LangGraph / Temporal / Inngest / similar durable-execution frameworks** are overkill for a hackathon. They add dependencies, learning curve, and deployment complexity.
- **Explicit state machine with DB-persisted state** is the sweet spot:
  - State in `close_runs.state`.
  - Each transition is an idempotent step guarded by `WHERE state = 'PREVIOUS'`.
  - Pauses are just "stop and wait for the next API call".
  - Audit event appended at every transition — both agent-side and user-side.

## The states
```
AGGREGATE → ESTIMATE_INITIAL → CLUSTER_UNCERTAINTY → QUESTIONS_GENERATED
  → AWAITING_ANSWERS           ← stops here, waits for POST /close/[id]/answer
  → APPLY_ANSWERS → ESTIMATE_FINAL → APPLY_POLICY
  → PROPOSED
  → AWAITING_APPROVAL          ← stops here if reserve > threshold
  → EXECUTING → COMPLETED
```
Plus `FAILED` as terminal error state.

## Per-state discipline
- Each state has one job. No "and also…" side effects.
- Each state either completes (move forward) or throws (move to FAILED with error in audit payload).
- LLM calls happen in QUESTIONS_GENERATED (Sonnet 4.6) and CSRD narrative (Sonnet 4.6). Never inside a loop over txs.
- Structured output (Zod) on every LLM call — no raw-JSON prayer-parsing.

## Guardrails
- `DRY_RUN=1` default: execute step logs the intent but skips the real bunq call. Flip to 0 only on demo stage.
- `MAX_TOOL_CALLS=8`: total bunq calls per run capped.
- Approval gate: if `reserveEur > policy.approvalThresholdEur`, state goes to `AWAITING_APPROVAL` and execute is blocked until `POST /close/[id]/approve`.
- Policy eval result is fully deterministic given (txs, policy) — LLM is not in the decision path for money movement.

## Why not LangGraph
- Extra dep; Python-first; graph DSL is another thing to debug at 2 AM.
- Our state machine has ~10 nodes and no branching — a `switch` on state is clearer than a graph.

## Why not Temporal / Inngest
- Deployment complexity. Durable execution is valuable when jobs span hours and must survive worker crashes. Our close runs a few seconds end-to-end (plus human think-time on questions). DB-persisted state is enough.

## Decisions for this build
- State machine in `lib/agent/close.ts` with three entry points: `startCloseRun`, `answerQuestion`, `approveAndExecute`.
- State persisted in `close_runs.state`; verified on every transition.
- Audit event on every state change plus every action.
- Sonnet 4.6 only for question generation and CSRD narrative — nowhere in the decision path for allocation amounts.
- `DRY_RUN` + `MAX_TOOL_CALLS` env guards on by default.
