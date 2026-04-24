---
phase: executing
spec: dag-hardening
autonomy: full
depth: thorough
tokens_budget: 500000
iteration: 2
tokens_used: 0
review_iterations: 0
debug_attempts: 0
task_status: complete
current_task: T002
completed_tasks: [T001, T002]
blocked_reason: null
---

---
phase: idle
spec: spec-dag-hardening
current_task: null
task_status: null
iteration: 0
tokens_used: 0
tokens_budget: 500000
depth: thorough
autonomy: gated
handoff_requested: false
review_iterations: 0
debug_attempts: 0
blocked_reason: null
lock_holder: null
checkpoint_id: null
frontier:.forge/plans/spec-dag-hardening-frontier.md
tasks_total: 14
tiers_total: 6
est_tokens: 157000
---

<!--
caveman form (R013). fragments, dropped articles, arrows.
parser only reads frontmatter + section headers. body is opaque.
old verbose state.md still works -> backward compat.
token savings: phase doc 2200 -> 1195 chars (~46% cut). total 3263 -> 2000 (~21%).
-->

## done

- T001 complete. projector.test.ts (6 failing tests, R006 AC2-AC7) + projector.ts stub (type contract + throwing impl). typecheck green. commit a078b77.
- T002 complete. mock-fallback observability R002.AC1-AC5: usedMock on LlmCallResult+ToolRunResult, mock_path col on agent_messages, recordAgentMessage helper in persist.ts, runDag aggregates mock_agent_count + emits agent.<name>.fallback_to_mock with intended/degradation flag. 6/6 tests green. typecheck + dag-smoke + smoke-research green. audit chain valid.

## in-flight

<!-- T002 done. Tier 1 closed. Tier 2 unblocks: T003, T004 (already unblocked via T001.R006.AC1), T005, T007. -->

## next

- Tier 2 dispatch: T003 (research cache leakage), T004 (projector impl), T005 (credit audit event), T007 (baseline harness). Up to 3 concurrent per parallelism cap.

## decisions

- Added stub `lib/agents/dag/projector.ts` in T001 so typecheck stays green while TDD tests fail at runtime. T004 replaces the throwing impl.
- task-classify flagged T001 as UI (false positive — spec globally mentions .tsx + app/). Skipped frontend-design skill invocation; T001 is a pure data test file.
- T002: chose central recordAgentMessage helper in lib/agents/dag/persist.ts called from each LLM-using agent's mock + live branches; runDag queries agent_messages.mock_path back to compute mock_agent_count instead of threading return shapes through every agent. Keeps agent run() signatures stable. agentRunId added as optional field on AgentContext (additive, backward compat).
- T002: spendBaseline (deterministic, no LLM) excluded from mock_path tracking. creditStrategy zero-cluster path counted as live (no Sonnet call would have run anyway).
- T002: intended-vs-degradation distinction in audit event payload, NOT in DB column (per task brief reading of R002.AC5). mock_path col stays 0|1.

---

## phases

`phase` = state machine pointer. stop hook reads -> routes. agents never write phase. engine writes atomic.

### stable

- `idle` -> nothing flight. `/forge execute` -> executing.
- `executing` -> commit -> reviewing_branch. no review -> verifying. frontier empty -> idle.
- `reviewing_branch` -> pass -> verifying. fail -> executing + notes.
- `verifying` -> pass -> executing (next). fail -> reviewing_branch.

### new

- `budget_exhausted` -> tokens gone. write handoff.md, stop. trig: tokens_used >= budget. exit: resume only.
- `conflict_resolution` -> worktree merge conflict. fallback sequential. trig: merge conflict markers. exit: linearize -> executing.
- `recovering` -> resume rebuilding from lock + checkpoint + git. trig: state missing/stale. exit: routes to reconstructed phase.
- `lock_conflict` -> other forge holds lock. trig: lock + PID alive. exit: lock free -> idle. else stuck til user clears.

### rules

1. phase atomic. agents never touch.
2. back compat: missing lock_holder/checkpoint_id = null. legacy unchanged.
3. new phases terminal per iter. need trigger (budget, lock, resume) or fallback (sequential).

full diagram -> `references/state-machine.md`.
