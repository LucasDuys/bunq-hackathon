---
domain: agentic-dag
status: approved
created: 2026-04-24
complexity: complex
linked_repos: []
design: DESIGN.md
---

# Agentic DAG + Cinematic Presentation Spec

## Overview

Carbon Autopilot currently runs a linear 12-state monthly close machine with only two LLM touchpoints (refinement Q&A in `QUESTIONS_GENERATED`, CSRD narrative in report). The target architecture is a 7-agent DAG pulled verbatim from `C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md`:

```
Spend & Emissions Baseline  →  Green Alternatives ──┐
                              Cost Savings         ─┤→ Green Judge + Cost Judge (parallel)
                                                    │     ↓
                                                    └→ Carbon Credit & Incentive Strategy
                                                          ↓
                                                   Executive Report Agent
```

**This spec scopes scaffolding + understanding, not full agent behavior.** Deliverables are typed stubs with real system prompts, per-agent planning docs, a scroll-driven cinematic presentation page, a research synthesis doc, and `.env.local` setup. Full runtime behavior of each agent is intentionally deferred to a post-scaffold spec so we can ship the demo-able presentation first.

**Demo pattern:** scroll-driven cinematic presentation inside the existing Next.js app at `app/presentation/page.tsx`. Modeled on `C:\dev\zebralegal-proposal\proposal.html` (single-page, scroll-locked narrative, agent-swatch palette per step) but styled with Carbon Autopilot's DESIGN.md tokens.

**Recorded runs, not live:** agent outputs for the presentation come from pre-baked `fixtures/demo-runs/` JSON, replayed on scroll. Live Anthropic calls are optional and sandboxed.

## Requirements

### R001: Agent DAG module scaffold

Scaffold `lib/agents/dag/` with seven typed agent stubs, a shared types file, and a thin DAG runner that executes them in the documented dependency order. Each agent exports a `SYSTEM_PROMPT` constant, an input Zod (or TypeScript) schema, an output schema matching the Carbon Autopilot md, and a `run(input, context)` function. Stubs may return a canned `fixtures/demo-runs/<agent>.json` for now; real Anthropic calls come later.

**Acceptance Criteria:**
- [ ] `lib/agents/dag/types.ts` exports `AgentInput`, `AgentOutput`, `AgentContext` TypeScript types matching the md's schemas.
- [ ] `lib/agents/dag/{spendBaseline,greenAlternatives,costSavings,greenJudge,costJudge,creditStrategy,executiveReport}.ts` each export `SYSTEM_PROMPT`, `inputSchema`, `outputSchema`, `run()`.
- [ ] `lib/agents/dag/index.ts` exports a `runDag(input, ctx)` that calls the 7 agents in the order `baseline → [greenAlt, cost] → [greenJudge, costJudge] → strategy → report`, passing each agent's output to downstream inputs.
- [ ] `runDag` returns a typed `DagRunResult` with per-agent latencies, token counts (stubbed zeros are OK for scaffold), and the final Executive Report payload.
- [ ] Running `pnpm tsc --noEmit` passes with zero errors.
- [ ] A fixture `fixtures/demo-runs/sample-run.json` contains a full realistic output for the whole DAG (can be hand-written, not from a real LLM call).

### R002: Per-agent planning docs with embedded system prompts

Create seven planning markdown files under `docs/agents/`, one per agent. Each doc must contain the full system prompt copied verbatim from the Carbon Autopilot md (sections 6–10 and 15), the I/O JSON schema, and a short "Gap vs current code" section noting what exists in `lib/agent/close.ts` today vs what this agent replaces or adds.

**Acceptance Criteria:**
- [ ] `docs/agents/00-overview.md` summarizes the DAG, links each agent doc, and shows the dependency diagram from the md.
- [ ] `docs/agents/{01-spend-baseline,02-green-alternatives,03-cost-savings,04-green-judge,05-cost-judge,06-credit-strategy,07-executive-report}.md` exist.
- [ ] Each per-agent doc contains a `## System Prompt` section with the full prompt from the md, in a ``` text ``` block.
- [ ] Each per-agent doc contains a `## Input Schema`, `## Output Schema`, and `## Gap vs current code` section.
- [ ] Each per-agent doc links to its scaffolded TypeScript file in `lib/agents/dag/`.

### R003: Cinematic presentation page

Scaffold `app/presentation/page.tsx` as a scroll-driven single-page presentation with at least six sections: hero, problem, current architecture (linear close machine), proposed architecture (7-agent DAG), live replay of a recorded DAG run, and CFO report preview. Uses DESIGN.md tokens (no raw hex), Montserrat display + Inter body + Fragment Mono numeric, confidence-bar pattern wherever CO₂e numbers appear. Scroll-lock + scroll-progress pattern inspired by `C:\dev\zebralegal-proposal\proposal.html`.

**Acceptance Criteria:**
- [ ] `app/presentation/page.tsx` renders six labelled `<section>` blocks with `data-section="{id}"` attributes.
- [ ] A `PresentationNav` component renders a floating right-side rail listing all section labels; clicking jumps via `scrollIntoView({ behavior: 'smooth' })`.
- [ ] The "Proposed architecture" section renders a 7-node DAG diagram (static SVG or CSS grid, no external libs required for scaffold) using the category-rainbow colors from `DESIGN.md §2.5` so each agent gets a unique tier color.
- [ ] The "Live replay" section renders a `DagReplay` component that consumes `fixtures/demo-runs/sample-run.json` and steps through agent outputs one by one with a visible progress indicator.
- [ ] The page respects `prefers-reduced-motion` (swaps transform-based animation for opacity).
- [ ] Pages pass `pnpm lint` and `pnpm tsc --noEmit`.
- [ ] No raw hex values in components; every color reads a CSS var from DESIGN.md.

### R004: Context-scaling research synthesis

Produce `research/13-context-scaling-patterns.md` that synthesizes the four files under `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\` (context_window_management, large_dataset_chunking_strategies, RAG_and_retrieval_patterns, scale_tradeoffs) into concrete guidance for the 7-agent DAG. The doc must answer: "How does each of the 7 agents avoid blowing its context when a company uploads 10,000 transactions?"

**Acceptance Criteria:**
- [ ] The file `research/13-context-scaling-patterns.md` exists and follows the same heading style as the existing `research/01-..12-*.md` files.
- [ ] The doc cites each of the four source files at least once using relative path references.
- [ ] A "Per-agent context budget" table maps each of the 7 agents to: expected input size, chunking strategy, retrieval pattern (if any), and context-window headroom.
- [ ] The doc ends with a "Applied to Carbon Autopilot" section giving 5 concrete rules (e.g., "Baseline agent sees only schema + summary stats + top 20 by spend, never raw rows").

### R005: Environment + Anthropic SDK setup

Add the Anthropic SDK as a dependency, create a typed client wrapper, and add a `.env.local.example` with a placeholder for `ANTHROPIC_API_KEY`. The wrapper must not throw at import time if the key is missing — only when a real call is attempted — so scaffolding and the replay presentation work without the key.

**Acceptance Criteria:**
- [ ] `@anthropic-ai/sdk` is installed (`package.json` dependency).
- [ ] `.env.local.example` exists at repo root with `ANTHROPIC_API_KEY=` and a short comment.
- [ ] `.env.local` is in `.gitignore` (it already should be; verify).
- [ ] `lib/anthropic/client.ts` exports `getAnthropicClient()` which lazily reads `process.env.ANTHROPIC_API_KEY` and returns an `Anthropic` instance; throws a clear error only when called without the key, never at module import.
- [ ] `lib/anthropic/client.ts` exports a `callWithSystemPrompt(systemPrompt, userPayload, { model?, maxTokens? })` helper that defaults to `claude-sonnet-4-6` (Sonnet for cost in a 24h window) and returns `{ text, inputTokens, outputTokens, latencyMs }`.

### R006: Current-vs-proposed architecture comparison doc

Create `docs/architecture-comparison.md` that sits alongside `ARCHITECTURE.md` and directly compares the current linear close machine (Sections in ARCHITECTURE.md) with the proposed 7-agent DAG. Visually structured as a side-by-side table of the same concerns (ingest, classification, estimation, refinement, policy, credits, report, audit) showing "today" vs "proposed". This is the backing doc behind the presentation's "current vs proposed" section.

**Acceptance Criteria:**
- [ ] `docs/architecture-comparison.md` exists with a title, a one-paragraph summary, and a `## Side-by-side` table covering at minimum: ingest, classification, emission estimation, uncertainty handling, policy + reserve, credit strategy, reporting, audit.
- [ ] Each row names the files or functions currently handling the concern, and the proposed agent(s) taking it over.
- [ ] A "Migration order" section proposes the sequence of when each agent replaces or augments current code (data model first, then agents, then UI, then audit hook-in).
- [ ] A "What stays the same" section names: `lib/audit/*`, `lib/bunq/*`, `lib/db/schema.ts`, the 12-state orchestrator, DESIGN.md.

## Future Considerations

- Real Anthropic runtime behavior for each agent (post-scaffold spec).
- Multimodal ingest (receipt camera + voice note) — deferred; current ingest is bunq webhook + spreadsheet upload only.
- Bunq hackathon_toolkit fork/merge — rejected; we keep our own stack and cite their patterns in research notes if relevant.
- Full 7-agent live demo run with streaming SSE — the scaffold exposes hooks for it but v1 uses recorded replays only.
- Note: no research file available -- approaches above are drawn from the Q&A only and the existing planning docs.
