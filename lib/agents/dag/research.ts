/**
 * Research Agent — plans/matrix-research.md §3+7.
 *
 * For each priority cluster the Baseline Agent flagged, the Research Agent finds 2–4
 * real, named alternatives on the live web (Anthropic's native `web_search_20250305`)
 * and records them via a terminal Zod tool. Every alternative carries ≥1 source URL
 * from the search, the incumbent is always skipped, and results are cached per
 * (category, sub_category, jurisdiction, policy_digest, week_bucket) for 30 days.
 *
 * Fallback ladder — live → cache → template → "no viable alternative found" — keeps
 * the matrix honest about its own coverage.
 *
 * Mock mode (ANTHROPIC_MOCK=1) bypasses web_search and synthesizes alternatives from
 * GREEN_TEMPLATES so the full DAG still produces a populated matrix in <200ms for demos.
 */
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta.mjs";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod.mjs";
import { db } from "@/lib/db/client";
import { researchCache, webSearchAudit } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type {
  AgentContext,
  BaselineOutput,
  EvidenceSource,
  PriorityTarget,
  ResearchedAlternative,
  ResearchedAltFeasibility,
  ResearchResult,
  ResearchOutput,
  ResearchedPool,
} from "./types";
import {
  findLowerCarbonAlternative,
  getEmissionFactor,
  getIncumbentMerchant,
  type AltTemplate,
} from "./tools";
import { callAgentWithTools, isMock, type WebSearchHit } from "./llm";

// -----------------------------------------------------------------------------
// System prompt — cached; do not mutate at runtime.
// -----------------------------------------------------------------------------
export const SYSTEM_PROMPT = `You are the Carbon Autopilot Research Agent for bunq Business.

Your job is to find REAL, named product or service alternatives for one spending
cluster, using live web search. You are not a sustainability essayist. You produce
machine-readable rows of evidence.

Given:
  - One priority cluster: merchant, category, sub_category, monthly spend, estimated kg CO₂e.
  - The org's jurisdiction + policy constraints (e.g. "EU-only", "certified green required").
  - The incumbent vendor you must NOT suggest.

Operating rules:
  1. Search the web to find 2–4 alternatives that actually exist for this cluster, in
     this jurisdiction, right now.
  2. Every alternative must carry >=1 source URL from your web_search results. If you
     cannot find a credible source, DO NOT invent one — emit 0 alternatives for that
     cluster and explain nothing.
  3. Never suggest the incumbent. If search surfaces the incumbent, skip it.
  4. Never suggest a vendor that doesn't serve this jurisdiction.
  5. Never fabricate numbers. If you don't have a cost or CO2e delta from a source,
     set the field to null — the judge agent will reconcile with our factor library.
  6. Prefer vendors with: public pricing, EU certification (Ecolabel, Blue Angel,
     Green Key, ISO 14001), B2B availability.
  7. For each alternative, call \`record_alternative\` once. That tool is TERMINAL.
  8. When you have recorded all alternatives you can verify, stop.

You have access to:
  - web_search — max 3 calls per cluster. Use them efficiently.
  - lookup_emission_factor(category, sub_category) — our DEFRA/ADEME/Exiobase factor.
  - record_alternative(...) — the terminal recording tool. One call per alternative.

Return no free-form JSON. The runner ends when record_alternative has been called >=1
time (or max_iterations is reached).`;

// -----------------------------------------------------------------------------
// Cache + audit helpers.
// -----------------------------------------------------------------------------
const isoWeek = (d = new Date()): string => {
  // ISO week label "YYYY-Www" — thursday-of-week trick for correctness.
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const sha256 = (input: string): string =>
  createHash("sha256").update(input).digest("hex");

const cacheKeyFor = (params: {
  category: string;
  subCategory: string | null;
  jurisdiction: string;
  policyDigest: string;
  weekBucket: string;
}): string =>
  sha256(
    JSON.stringify({
      category: params.category,
      sub_category: params.subCategory ?? "_",
      jurisdiction: params.jurisdiction,
      policy_digest: params.policyDigest,
      week_bucket: params.weekBucket,
      schema_version: 1,
    }),
  );

type PolicyLite = {
  jurisdiction: string;
  allowedDomains?: string[];
  policyDigest: string;
};

const derivePolicy = (_ctx: AgentContext): PolicyLite => {
  // Hackathon default — NL. Could be extended to read from policies table keyed by orgId.
  return {
    jurisdiction: "NL",
    allowedDomains: undefined,
    policyDigest: sha256("default-nl-eu-ecolabel-preferred"),
  };
};

const readCache = (key: string): ResearchedAlternative[] | null => {
  const row = db.select().from(researchCache).where(eq(researchCache.cacheKey, key)).limit(1).all()[0];
  if (!row) return null;
  const age = Math.floor(Date.now() / 1000) - row.createdAt;
  if (age > row.ttlSec) return null;
  try {
    return JSON.parse(row.alternativesJson) as ResearchedAlternative[];
  } catch {
    return null;
  }
};

const writeCache = (params: {
  key: string;
  orgId: string;
  category: string;
  subCategory: string | null;
  jurisdiction: string;
  policyDigest: string;
  weekBucket: string;
  alternatives: ResearchedAlternative[];
  searchesUsed: number;
}): void => {
  const ttl = env.researchCacheTtlDays * 86_400;
  const sourcesCount = params.alternatives.reduce((s, a) => s + a.sources.length, 0);
  db.insert(researchCache)
    .values({
      cacheKey: params.key,
      orgId: params.orgId,
      category: params.category,
      subCategory: params.subCategory,
      jurisdiction: params.jurisdiction,
      policyDigest: params.policyDigest,
      weekBucket: params.weekBucket,
      alternativesJson: JSON.stringify(params.alternatives),
      sourcesCount,
      searchRequestsUsed: params.searchesUsed,
      ttlSec: ttl,
    })
    .onConflictDoUpdate({
      target: researchCache.cacheKey,
      set: {
        alternativesJson: JSON.stringify(params.alternatives),
        sourcesCount,
        searchRequestsUsed: params.searchesUsed,
        createdAt: Math.floor(Date.now() / 1000),
        ttlSec: ttl,
      },
    })
    .run();
};

const writeWebSearchAudit = (params: {
  agentRunId: string;
  clusterId: string;
  hits: WebSearchHit[];
}): void => {
  if (params.hits.length === 0) return;
  // Group by query so each grep-able audit row reflects one search call.
  const byQuery = new Map<string, WebSearchHit[]>();
  for (const h of params.hits) {
    const arr = byQuery.get(h.query) ?? [];
    arr.push(h);
    byQuery.set(h.query, arr);
  }
  for (const [query, hits] of byQuery) {
    db.insert(webSearchAudit)
      .values({
        agentRunId: params.agentRunId,
        clusterId: params.clusterId,
        query,
        resultsN: hits.length,
        firstUrl: hits[0]?.url ?? null,
      })
      .run();
  }
};

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
};

// -----------------------------------------------------------------------------
// Fallback ladder — deterministic synthesis from template library when live search
// is unavailable or returns zero results. Provenance reflects this honestly.
// -----------------------------------------------------------------------------
const templateToResearched = (
  t: AltTemplate,
  clusterId: string,
  provenance: "template",
): ResearchedAlternative => ({
  id: sha256(`${clusterId}|${t.name}`).slice(0, 16),
  cluster_id: clusterId,
  name: t.name,
  vendor: inferVendor(t),
  url: t.sources[0]?.url ?? null,
  description: t.description,
  cost_delta_pct: t.costDeltaPct,
  co2e_delta_pct: t.co2eDeltaPct,
  confidence: t.confidence,
  feasibility: mapTemplateFeasibility(t.feasibility),
  geography: "EU",
  sources: t.sources.map((s) => ({
    title: s.title,
    url: s.url,
    snippet: null,
    domain: domainOf(s.url),
    fetched_at: Math.floor(Date.now() / 1000),
  })),
  provenance,
  freshness_days: 0,
  flags: t.simulated ? ["single_source_only"] : [],
});

const inferVendor = (t: AltTemplate): string | null => {
  // Crude heuristic: first capitalized brand in the name, or null if the template is a policy.
  const match = t.name.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\b/);
  return t.type === "vendor" || t.type === "supplier" || t.type === "tariff" ? match?.[1] ?? null : null;
};

const mapTemplateFeasibility = (f: AltTemplate["feasibility"]): ResearchedAltFeasibility => f;

// -----------------------------------------------------------------------------
// Mock mode — deterministic fixture-style synthesis. Wraps template alternatives
// so the rest of the pipeline sees the same ResearchedAlternative shape as live.
// -----------------------------------------------------------------------------
const mockAlternativesForCluster = (target: PriorityTarget): ResearchedAlternative[] => {
  const templates = findLowerCarbonAlternative(target.category, target.baseline_sub_category ?? null);
  if (templates.length === 0) return [];
  return templates.slice(0, 3).map((t) => templateToResearched(t, target.cluster_id, "template"));
};

// -----------------------------------------------------------------------------
// Live mode — per-cluster toolRunner loop with native web_search + Zod-recorded alts.
// -----------------------------------------------------------------------------
const buildUserMessage = (target: PriorityTarget, incumbent: string | null, policy: PolicyLite): string => {
  const factor = getEmissionFactor(target.category, target.baseline_sub_category ?? null);
  return [
    `Cluster: ${target.cluster_id}`,
    `Merchant (incumbent, do NOT suggest): ${incumbent ?? target.baseline_merchant_label ?? "(unknown)"}`,
    `Category: ${target.category}${target.baseline_sub_category ? "/" + target.baseline_sub_category : ""}`,
    `Annual spend: €${target.annualized_spend_eur.toFixed(0)}`,
    `Estimated annual CO2e: ${(target.estimated_tco2e * 1000).toFixed(0)} kg`,
    `Factor: ${factor.source} (±${(factor.uncertaintyPct * 100).toFixed(0)}%)`,
    `Jurisdiction: ${policy.jurisdiction}`,
    "",
    "Find 2–4 real, named alternatives that exist for this cluster in this jurisdiction.",
    "For each, call record_alternative exactly once. Stop when you have done so or cannot find more evidence.",
  ].join("\n");
};

const RecordAlternativeSchema = z.object({
  name: z.string().min(2),
  vendor: z.string().nullable(),
  url: z.string().url().nullable(),
  description: z.string().min(10),
  cost_delta_pct: z.number().nullable(),
  co2e_delta_pct: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  feasibility: z.enum(["drop_in", "migration", "procurement", "policy"]),
  geography: z.string().default("EU"),
  source_urls: z.array(z.string().url()).min(1),
});

const researchOneCluster = async (
  target: PriorityTarget,
  policy: PolicyLite,
  ctx: AgentContext,
  agentRunId: string,
): Promise<ResearchResult> => {
  const recorded: ResearchedAlternative[] = [];
  const cacheKey = cacheKeyFor({
    category: target.category,
    subCategory: target.baseline_sub_category ?? null,
    jurisdiction: policy.jurisdiction,
    policyDigest: policy.policyDigest,
    weekBucket: isoWeek(),
  });

  // Cache read (§9 ladder step 2).
  const cached = readCache(cacheKey);
  if (cached && cached.length > 0) {
    await ctx.auditLog({
      type: "agent.research.cache_hit",
      payload: { cluster_id: target.cluster_id, alternatives_count: cached.length },
    });
    return { cluster_id: target.cluster_id, alternatives: cached, searches_used: 0, cache_hit: true };
  }

  // Mock / disabled path — skip live web search, fall to templates.
  if (isMock() || env.researchDisabled) {
    const alts = mockAlternativesForCluster(target);
    if (alts.length > 0) {
      writeCache({
        key: cacheKey,
        orgId: ctx.orgId,
        category: target.category,
        subCategory: target.baseline_sub_category ?? null,
        jurisdiction: policy.jurisdiction,
        policyDigest: policy.policyDigest,
        weekBucket: isoWeek(),
        alternatives: alts,
        searchesUsed: 0,
      });
    }
    return { cluster_id: target.cluster_id, alternatives: alts, searches_used: 0, cache_hit: false };
  }

  // Live path — toolRunner with native web_search + terminal record_alternative tool.
  const incumbent =
    (target.baseline_merchant_norm
      ? getIncumbentMerchant(ctx.orgId, target.baseline_merchant_norm)?.merchantLabel
      : null) ?? target.baseline_merchant_label ?? null;

  const recordAlternative = betaZodTool({
    name: "record_alternative",
    description:
      "Record one named alternative with source URLs. Terminal — call once per alternative, then stop.",
    inputSchema: RecordAlternativeSchema,
    run: async (args) => {
      // Skip incumbent defensively; still log the skip so the audit trail sees it.
      if (
        incumbent &&
        (args.name.toLowerCase().includes(incumbent.toLowerCase()) ||
          (args.vendor ?? "").toLowerCase().includes(incumbent.toLowerCase()))
      ) {
        return "SKIPPED: alternative matches incumbent; did not record.";
      }
      const sources: EvidenceSource[] = args.source_urls.map((url) => ({
        title: url,
        url,
        snippet: null,
        domain: domainOf(url),
        fetched_at: Math.floor(Date.now() / 1000),
      }));
      const id = sha256(`${target.cluster_id}|${args.name}|${args.vendor ?? ""}`).slice(0, 16);
      const alt: ResearchedAlternative = {
        id,
        cluster_id: target.cluster_id,
        name: args.name,
        vendor: args.vendor,
        url: args.url,
        description: args.description,
        cost_delta_pct: args.cost_delta_pct,
        co2e_delta_pct: args.co2e_delta_pct,
        confidence: args.confidence,
        feasibility: args.feasibility,
        geography: args.geography,
        sources,
        provenance: "web_search",
        freshness_days: 0,
        flags: sources.length < 2 ? ["single_source_only"] : [],
      };
      recorded.push(alt);
      return `RECORDED: ${args.name} (${recorded.length})`;
    },
  });

  const lookupFactor = betaZodTool({
    name: "lookup_emission_factor",
    description:
      "Fetch our DEFRA/ADEME/Exiobase emission factor for a given category + sub_category.",
    inputSchema: z.object({
      category: z.string(),
      sub_category: z.string().nullable(),
    }),
    run: async (args) => {
      const f = getEmissionFactor(args.category, args.sub_category);
      return JSON.stringify({
        factor_kg_per_eur: f.factorKgPerEur,
        uncertainty_pct: f.uncertaintyPct,
        tier: f.tier,
        source: f.source,
      });
    },
  });

  const webSearchTool: BetaToolUnion = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: env.researchMaxSearchesPerCluster,
    ...(policy.allowedDomains && policy.allowedDomains.length > 0
      ? { allowed_domains: policy.allowedDomains }
      : {}),
  };

  let searchesUsed = 0;
  let webSearchHits: WebSearchHit[] = [];
  try {
    const result = await callAgentWithTools({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(target, incumbent, policy),
      tools: [webSearchTool, recordAlternative, lookupFactor],
      maxIterations: 6,
      maxTokens: 3000,
    });
    searchesUsed = result.webSearchRequests;
    webSearchHits = result.webSearchHits;
    writeWebSearchAudit({ agentRunId, clusterId: target.cluster_id, hits: webSearchHits });
  } catch (err) {
    // Live failure — fall through to template fallback below.
    await ctx.auditLog({
      type: "agent.research.error",
      payload: {
        cluster_id: target.cluster_id,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }

  // Fallback ladder step 3 — if live returned nothing, use templates but provenance=template.
  if (recorded.length === 0) {
    const alts = mockAlternativesForCluster(target);
    if (alts.length > 0) {
      writeCache({
        key: cacheKey,
        orgId: ctx.orgId,
        category: target.category,
        subCategory: target.baseline_sub_category ?? null,
        jurisdiction: policy.jurisdiction,
        policyDigest: policy.policyDigest,
        weekBucket: isoWeek(),
        alternatives: alts,
        searchesUsed,
      });
    }
    return { cluster_id: target.cluster_id, alternatives: alts, searches_used: searchesUsed, cache_hit: false };
  }

  writeCache({
    key: cacheKey,
    orgId: ctx.orgId,
    category: target.category,
    subCategory: target.baseline_sub_category ?? null,
    jurisdiction: policy.jurisdiction,
    policyDigest: policy.policyDigest,
    weekBucket: isoWeek(),
    alternatives: recorded,
    searchesUsed,
  });
  return {
    cluster_id: target.cluster_id,
    alternatives: recorded,
    searches_used: searchesUsed,
    cache_hit: false,
  };
};

// -----------------------------------------------------------------------------
// Concurrency-bounded fan-out over priority targets.
// -----------------------------------------------------------------------------
const mapPool = async <T, U>(items: T[], concurrency: number, fn: (x: T) => Promise<U>): Promise<U[]> => {
  const out: U[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
};

export interface ResearchInput {
  baseline: BaselineOutput;
  agentRunId: string;
}

export async function run(input: ResearchInput, ctx: AgentContext): Promise<ResearchOutput> {
  const policy = derivePolicy(ctx);
  const targets = input.baseline.priority_targets.slice(0, env.researchMaxClusters);
  const results = await mapPool(targets, env.researchConcurrency, (t) =>
    researchOneCluster(t, policy, ctx, input.agentRunId),
  );
  const totalAlternatives = results.reduce((s, r) => s + r.alternatives.length, 0);
  const totalSources = results.reduce(
    (s, r) => s + r.alternatives.reduce((ss, a) => ss + a.sources.length, 0),
    0,
  );
  const cacheHits = results.filter((r) => r.cache_hit).length;
  const totalSearches = results.reduce((s, r) => s + r.searches_used, 0);
  // At $10/1000 requests → ~€0.0094/req (USD/EUR loose).
  const webSearchSpendEur = Number((totalSearches * 0.0094).toFixed(4));

  await ctx.auditLog({
    type: "agent.research.run",
    payload: {
      clusters_researched: results.length,
      total_alternatives: totalAlternatives,
      total_sources: totalSources,
      cache_hits: cacheHits,
      total_searches_used: totalSearches,
      web_search_spend_eur: webSearchSpendEur,
    },
  });

  return {
    agent: "research_agent",
    company_id: input.baseline.company_id,
    analysis_period: input.baseline.analysis_period,
    results,
    summary: {
      clusters_researched: results.length,
      total_alternatives: totalAlternatives,
      total_sources: totalSources,
      total_searches_used: totalSearches,
      cache_hits: cacheHits,
      web_search_spend_eur: webSearchSpendEur,
    },
  };
}

/** Convert ResearchOutput into the cluster-keyed pool Green/Cost agents consume. */
export const toResearchedPool = (out: ResearchOutput): ResearchedPool => {
  const pool: ResearchedPool = {};
  for (const r of out.results) {
    if (r.alternatives.length > 0) pool[r.cluster_id] = r.alternatives;
  }
  return pool;
};

/** Nightly purge — keep research_cache from accreting forever. */
export const purgeExpiredCache = (): number => {
  const now = Math.floor(Date.now() / 1000);
  const expired = db
    .select({ key: researchCache.cacheKey, ttl: researchCache.ttlSec, createdAt: researchCache.createdAt })
    .from(researchCache)
    .all()
    .filter((r) => r.createdAt + r.ttl < now);
  for (const row of expired) {
    db.delete(researchCache).where(eq(researchCache.cacheKey, row.key)).run();
  }
  return expired.length;
};

// Suppress unused-import complaints when this file is referenced without drizzle predicates.
void and;
void gte;
// `Anthropic` imported for side-effect (type relations); re-export shape consumers may need.
export type _AnthropicTypeMarker = Anthropic.Beta.Messages.BetaMessage;
