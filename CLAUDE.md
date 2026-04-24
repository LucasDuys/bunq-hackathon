# CLAUDE.md

Context for Claude Code sessions in this repo. Kept short on purpose -- this file is loaded on every turn.

## Orientation

This is the bunq Hackathon 7.0 planning + build workspace for **Carbon Reserve**: an agentic loop that turns every bunq transaction into a carbon estimate, moves money into a Carbon Reserve sub-account by policy, and produces CSRD E1-7 ready audit evidence. Hackathon is April 24-25 2026, 24 hours, 3-person team.

Right now the repo is **docs-first** -- code scaffold lives in `src/` but is empty. Build starts at the hackathon kickoff. Prefer updating existing docs over creating new ones.

## Routing -- read this file before answering, then jump

| Working on... | Start at |
|---|---|
| What is this product? | `CONCEPT.md` |
| High-level pitch / team plan / timeline | `README.md` |
| Which bunq endpoints do we call and how | `BUNQ-API.md` |
| System diagram, policy engine, ledger schema | `ARCHITECTURE.md` |
| What are we porting from other repos | `REUSABLE-TECH.md` |
| Research navigation (emission factors, CSRD, credits, UX) | `RESEARCH-INDEX.md` |
| Cross-project lessons from the prior round | `LEARNINGS.md` |
| Planned code layout + bootstrap command | `src/README.md` |

Research files are numbered. `research/01-09` are carbon-specific stubs (pre-filled preliminary views). `research/10-13` are portable files copied verbatim from the prior bunq-hackathon round -- framing still applies.

## Stack

- Next.js 14 (App Router), TypeScript
- Supabase (Postgres) for the ledger + auth
- bun as runtime + package manager
- Anthropic SDK (`@anthropic-ai/sdk`) for Claude Opus 4.7 -- judgment layer
- OpenAI-compatible SDK for Mercury 2 -- reflex layer
- `zod` for schema validation on tool-use outputs
- `js-yaml` for the policy DSL
- Tailwind + shadcn/ui for the dashboard
- bunq API sandbox; OAuth for any public deploy, API key for private / solo

Ported code comes from `C:\dev\graphbot` (DAG + autonomy), `C:\dev\teambrain` (NLI + pipeline), `C:\dev\nimbus` (connector pattern + audit), `C:\dev\pitchr` (SiriBubble for voice UI). See `REUSABLE-TECH.md`.

## Known constraints -- do NOT re-investigate

- Claude Opus 4.7 (judgment) + Mercury 2 (reflex) hybrid is decided.
- EU data residency: prefer `eu-central-1`.
- Grammar-constrained structured output via tool-use + zod.
- bunq callback source IPs are variable in sandbox -- do NOT IP-filter.
- `monetary-account-savings` is the right primitive for the Carbon Reserve sub-account (not tags, not a full separate monetary account).
- Removal credits > avoidance credits (Oxford Principles 2024, VCMI).
- The hackathon does NOT need a real carbon-credit marketplace; simulate with three mock EU projects (biochar / reforestation / peatland).

## Style + conventions

- **No emojis.** Anywhere. Not in code, not in docs, not in UI copy. Hard rule.
- Plain voice in docs. No motivational closers, no slogans, no "let's build the future" lines.
- Technical hyphens are fine in code + docs (not a personal-essay context).
- Default to writing no comments in code; only comment when the *why* is non-obvious.
- Append-only ledger. No UPDATEs to `carbon_events`. Corrections = new rows referencing the corrected row.
- Hash receipts on ingest; store hash in ledger, image in object storage with hash as filename.
- Snapshot the emission factor value + source version into the ledger row -- do not store a pointer that could later change.
- Snapshot the policy file hash into every decision.

## When working on UI / frontend

Invoke the `frontend-design` and `brand-guidelines` skills **before** writing UI code. Do not approximate brand tokens from memory. This is a standing user preference.

## When writing code

- Type with `zod` at every boundary (bunq callback, user upload, tool-use output).
- Idempotency: the webhook handler must tolerate 5 retries at 1-minute intervals from bunq.
- Autonomy ceiling is the safety net. Any new tool that moves money must respect `src/agent/autonomy.ts` (to be ported from graphbot).
- Reasoning summaries are capped at 80 words. Enforce this in the prompt, not post-hoc.

## Commands

```bash
# bootstrap the Next.js app (hour 0)
cd src && bunx create-next-app@latest . --typescript --tailwind --app --src-dir
bun add @anthropic-ai/sdk openai zod js-yaml sharp @supabase/supabase-js

# dev server
bun run dev

# Supabase local (optional, we can also use a hosted project)
bunx supabase start
bunx supabase migration up
```

## Research agent tasking (Day 0, hour 1)

Dispatch in parallel. See `RESEARCH-INDEX.md` -> Research agent tasking. The five open questions are: emission factor source, CSRD E1-7 minimum fields, EU CRCF credit verification, receipt OCR model choice, VCMI / ICVCM claim levels.

## What lives outside this repo

- Prior bunq-hackathon concept docs (Keeper, Sentry, Ravel, Stitch, Tab): `C:\dev\bunq-hackathon\` -- reference only, do not copy further.
- Shared compliance + prompting research: `C:\dev\zebralegal-proposal\research\` (see `RESEARCH-INDEX.md` -> Shared research from Zebra).
- User memory index: `C:\Users\20243455\.claude\projects\C--Users-20243455\memory\MEMORY.md` -- project-level preferences still apply.

## Do not

- Do not commit the `.bunq-context.json` file or any `.pem`. See `.gitignore`.
- Do not commit the `.policy.local.yaml` (company-specific overrides).
- Do not create documentation files beyond what is listed above unless explicitly asked.
- Do not re-pitch the concept in commit messages or PR descriptions; `CONCEPT.md` is the canonical copy.
