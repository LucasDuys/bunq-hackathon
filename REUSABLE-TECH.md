# Reusable Tech Inventory -- Carbon Reserve

What we pull in from existing projects. Trimmed from the prior-round inventory to the pieces that actually fit the carbon loop.

## From `C:\dev\graphbot` -- the agent harness

The single biggest head-start. Fork these files into the project.

- **`core_gb/dag_executor.py`** (~67 KB) -- streaming topological dispatch with asyncio semaphores, parallel node execution, transactional rollback. Unblocks dependents as soon as a node completes. Use this as the spine of the per-transaction reasoning graph (normalize -> context -> vision -> carbon -> policy -> action -> ledger).

- **`nanobot/agent/tools/base.py`** -- Tool ABC with JSON Schema parameters, cast + validation, async `execute()`. Children cover shell, filesystem, MCP, web, cron. Add `BunqTool` subclass + `EmissionFactorTool` subclass and we are wired.

- **`nanobot/agent/loop.py`** (~25 KB) -- multi-turn context, tool invocation chains, memory consolidation. The outer loop.

- **`core_gb/autonomy.py`** -- blocks tasks exceeding an autonomy ceiling. Exactly the primitive the policy engine needs. "Agent cannot move more than EUR 25 into Reserve without a Draft Payment." Drop-in.

- **`core_gb/verification.py`** -- dual-layer output verification (sanitization + optional 3-way sampling). Use for pre-flight checks on any bunq-mutating call.

## From `C:\dev\teambrain` -- classification + structured output

- **`app/src/inference/nli.ts`** (186 lines) -- enum-constrained JSON via Ollama format. Classifies with label + confidence. Port for:
  - merchant -> spend category (food / travel / software / procurement / ...)
  - line item -> carbon category (beef / dairy / produce / fuel / office-supply / ...)
  - transaction -> personal vs business vs team

- **`app/src/inference/pipeline.ts`** -- async-generator event stream with AbortSignal. Fits the live demo: the agent streams "extracting -> estimated -> policy -> reserving" to the UI as it runs.

- **`app/src/inference/clustering.ts` + `umap.ts`** -- embedding cluster over text. Useful for grouping similar merchants for the alternative-matrix feature.

- **`app/src/inference/prompt-registry.ts`** -- centralized prompt store. Copy pattern verbatim.

## From `C:\dev\nimbus` -- connector + audit pattern

- **`lib/integrations/`** -- GitHub, Jira, Notion, OneDrive, Slack connectors. Each folder has auth + sync. `lib/integrations/bunq/` slots alongside.

- **`app/api/agent/route.ts`** -- agent tier-escalation (cheap retrieval -> agentic fallback). For Carbon Reserve: cheap emission-factor lookup -> expensive LLM reasoning for fuzzy items.

- **`logAuditEvent` + `withTracing` / `wrapWithTrace`** -- audit logging. Compliance story for the CSRD angle. Every step in the loop gets logged.

## From `C:\dev\pitchr` -- UI

- **`views/components/SiriBubble/useSiriBubble.ts`** -- animated listening orb state machine. Perfect for the voice-context capture step.

## From prior bunq-hackathon repo -- not code, but research and scaffolding

- `LEARNINGS.md` -- copied into this repo.
- `research/ravel/09-hybrid-architectures.md` -- copied as `research/10-hybrid-architectures.md`.
- `research/ravel/08-dora-dac8-gdpr.md` -- copied as `research/11-eu-regulatory-context.md` (adapted for CSRD framing).
- `research/ravel/04-privacy-preserving-rag.md` -- copied as `research/13-pseudonym-envelope.md`.
- `research/sentry/07-defensive-ux.md` -- copied as `research/12-approval-ux.md` (the warn / pause / block ladder maps cleanly to the approval ladder here).

## What we do NOT reuse

- Sentry concept code (scam detection, deepfake voice) -- unrelated.
- Ravel concept code (COI graph) -- unrelated.
- Keeper bill-splitting / VAT logic -- different problem shape.
- hackaway grocery scrapers -- no receipt vision, no banking.

## Tech stack defaults

Carried from prior projects (Pitchr, Nimbus):

- Next.js 14, TypeScript
- Supabase (Postgres) for the ledger and auth
- bun as the runtime for scripts
- tRPC or Next.js route handlers for the API
- Tailwind + shadcn/ui for the dashboard
- Anthropic SDK for Claude Opus 4.7
- OpenAI-compatible SDK for Mercury 2
