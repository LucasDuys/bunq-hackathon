<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design is specified

`DESIGN.md` at repo root is the **single source of truth** for how Carbon Autopilot looks, feels, and speaks. Read it before touching anything visual (components, pages, Tailwind tokens, CSS, copy, motion, a11y). It inherits Wise's friendly-fintech primitives and bunq's Easy Green palette + Montserrat/Inter/Fragment Mono typography.

Hard rules agents must honor on every UI change:
- Use design tokens from `DESIGN.md` §2 — never hard-code hex or raw Tailwind color names like `emerald-600`/`zinc-*` in components.
- Every CO₂e number pairs with a confidence indicator (bar or ± range). See `ConfidenceBar` in `components/ui.tsx`.
- Sentence-case headlines, `tabular-nums` on every number, pill CTAs, ring-shadows only (no blurred drop shadows), and dark + light parity.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

If `DESIGN.md` and code disagree, fix the code. If you learned something the doc doesn't cover, update `DESIGN.md` in the same PR.

# Agentic DAG is specified

The reasoning layer is an 8-agent DAG under `lib/agents/dag/` driven by `runDag()` (entry point: `POST /api/impacts/research`). Before adding, modifying, or judging any agent:

1. **Read [`docs/agents/00-overview.md`](docs/agents/00-overview.md)** — DAG diagram, model split (Baseline deterministic; Research + others Sonnet), authority boundaries, persistence tables.
2. **Read [`docs/architecture-comparison.md`](docs/architecture-comparison.md)** — original-plan-vs-reality, drift section, parallel-path inventory, migration order.
3. **Read the per-agent doc** for the agent you're touching (`docs/agents/0N-*.md`). It contains the canonical system prompt + I/O JSON schema + gap-vs-current-code.
4. **Check [`.forge/specs/`](.forge/specs/)** for an approved spec covering the change. If none exists, run `/forge:brainstorm` to create one before coding.

Hard rules agents must honor on every DAG change:
- Authority discipline: judges (`greenJudge`, `costJudge`) are **validators**, not authorities. Code may override their LLM verdict on hard rules (zero-sources, math mismatch). Credit strategy and executive report numbers are **deterministic** — LLM writes prose only.
- Every Sonnet-using agent has a `buildMock()` deterministic path triggered by `isMock()`. Keep both paths in sync; if you add a field, deterministic must populate it too.
- `lib/agents/dag/llm.ts::callAgent` is the only sanctioned LLM entry point for DAG agents. Don't import `@anthropic-ai/sdk` directly — the helper handles prompt cache, mock fallback, and `agentMessages` instrumentation.
- Bound every tool you add to `lib/agents/dag/tools.ts`. No unbounded `SELECT * FROM transactions`.
- Never pass raw transaction rows into a per-call LLM payload. Aggregate first. See `research/13-context-scaling-patterns.md` for the budget rules.

If `docs/agents/*` and code disagree, fix the code. If you learned something the docs don't cover, update both `docs/agents/0N-*.md` and `docs/architecture-comparison.md` in the same PR.
