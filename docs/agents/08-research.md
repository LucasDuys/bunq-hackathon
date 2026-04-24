# Agent 08 — Research Agent

> Sits between Baseline and the proposal agents. For each priority cluster, performs
> live web research (Anthropic's native `web_search_20250305`) to find 2–4 real, named
> alternatives — with source URLs, feasibility, geography, and (optional) cost/CO₂e
> deltas. Emits a cluster-keyed `ResearchedPool` that Green Alternatives and Cost
> Savings consume in preference to the hardcoded templates.
>
> Source: [`plans/matrix-research.md`](../../plans/matrix-research.md).

## Role

- **In:** `BaselineOutput.priority_targets` + agent run id + org context.
- **Out:** `ResearchOutput` → `ResearchedPool` keyed by `cluster_id`.
- **Tooling:** `web_search_20250305` (bounded by `RESEARCH_MAX_SEARCHES_PER_CLUSTER`)
  + two custom Zod tools (`lookup_emission_factor`, `record_alternative`).
- **Model:** `claude-sonnet-4-6` via `messages.toolRunner`.
- **Not LLM math.** Numbers stay in deterministic code downstream; the judge reconciles.

## Flow

```
for each target in baseline.priority_targets (≤ RESEARCH_MAX_CLUSTERS):
  cache_key = sha256(category, sub_category, jurisdiction, policy_digest, week_bucket)
  alts = readCache(cache_key)
  if alts:
    audit(agent.research.cache_hit)
    continue
  else:
    toolRunner(
      model = sonnet-4-6,
      tools = [web_search_20250305, lookup_emission_factor, record_alternative],
      max_iterations = 6,
      max_uses on web_search = 3,
    )
    # agent calls record_alternative 0..N times — terminal.
    if recorded.length == 0:
      alts = templateFallback(target)   # provenance=template
    writeCache(cache_key, alts)
audit(agent.research.run, { clusters, alternatives, sources, searches, cache_hits })
```

## Fallback ladder

Per cluster, falls down this ladder until ≥1 alternative is recorded:

1. **Live web_search + Sonnet** (default in live mode).
2. **Cache read** (if fresh under `RESEARCH_CACHE_TTL_DAYS`).
3. **`GREEN_TEMPLATES` fallback** — provenance = `template`.
4. **Empty** — the matrix row is honest about the gap; the `limitations[]` array in
   the executive report surfaces each step-4 cluster with a reason.

## System prompt

Stored in `lib/agents/dag/research.ts` → `SYSTEM_PROMPT`; cached via `cache_control: ephemeral`.
Hard rules the prompt enforces:

1. Every alternative must carry ≥1 source URL from the web_search run.
2. Never suggest the incumbent (resolved via `getIncumbentMerchant(orgId, merchantNorm)`).
3. Never suggest vendors that don't serve `policy.jurisdiction`.
4. Never fabricate numeric deltas — `null` is valid; the judge reconciles.
5. `record_alternative` is the terminal tool. Free-form text in the final message is ignored.

## Output type

```ts
type ResearchedAlternative = {
  id: string;                         // stable hash, dedupes across runs
  cluster_id: string;
  name: string;
  vendor: string | null;
  url: string | null;                 // canonical product page
  description: string;
  cost_delta_pct: number | null;      // -0.35 = 35% cheaper
  co2e_delta_pct: number | null;      // -0.9  = 90% less
  confidence: number;                 // 0..1
  feasibility: "drop_in" | "migration" | "procurement" | "policy";
  geography: string;
  sources: EvidenceSource[];          // ≥1 in provenance=web_search
  provenance: "web_search" | "cache" | "template" | "hybrid";
  freshness_days: number;
  flags: ResearchedAltFlag[];
};
```

## Cache

Table: `research_cache`. Keyed on the sha256 digest of
`{category, sub_category, jurisdiction, policy_digest, week_bucket, schema_version}`.

| Age | Behavior |
|---|---|
| < 7 days | Use as-is |
| 7–30 days | Use, mark `freshness_days` in UI |
| > 30 days | Stale; re-search, prefer same vendors if still live |

Nightly cron: `researchAgent.purgeExpiredCache()` → `DELETE WHERE created_at + ttl_sec < unixepoch()`.

## Audit events

- `agent.research.run` — once per DAG run; aggregate totals.
- `agent.research.cache_hit` — once per cluster served from cache.
- `agent.research.error` — swallowed live failure (falls to template).

Also writes one row per `web_search` query to `web_search_audit`.

## Budget

- `RESEARCH_MAX_SEARCHES_PER_CLUSTER` (default 3) × `RESEARCH_MAX_CLUSTERS` (default 20).
- Billed at $10 / 1k search requests → ~€0.56 for a cold-start monthly close.
- With an 80% cache hit rate in steady state, ~€0.12 / close.
- `RESEARCH_DISABLED=1` short-circuits to templates at zero cost.

## Mock mode

`ANTHROPIC_MOCK=1` skips `toolRunner` and synthesizes `ResearchedAlternative[]` from
`GREEN_TEMPLATES`. Deterministic, <200 ms per cluster, keeps the demo matrix populated.

## Failure semantics

- Anthropic outage → `agent.research.error` audit; each cluster falls to template.
- `web_search` returns zero results → terminal tool never fires → template fallback kicks in.
- Prompt injection in a search result → blocked by Zod validation on `record_alternative`.
- API key missing → `isMock()` returns true → mock path.
