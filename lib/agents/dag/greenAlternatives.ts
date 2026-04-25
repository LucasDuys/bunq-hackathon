/**
 * Green Alternatives Agent — emissions-first proposal agent.
 * Live: Sonnet 4.6 with cached system prompt. Input = Baseline priority_targets + resolved
 *        tool results (lower-carbon alternative templates per cluster).
 * Mock: deterministic synthesis from the tool library so /impacts works with ANTHROPIC_MOCK=1.
 *
 * We resolve tool results (findLowerCarbonAlternative) in code BEFORE the Sonnet call so the
 * agent never issues unbounded tool_use turns. This keeps the critical path at one Sonnet call.
 */
import { z } from "zod";
import type {
  AgentContext,
  BaselineOutput,
  GreenAltOutput,
  PriorityTarget,
  ResearchedAlternative,
  ResearchedPool,
} from "./types";
import { findLowerCarbonAlternative, getEmissionFactor, type AltTemplate } from "./tools";
import { callAgent, isMock } from "./llm";
import { recordAgentMessage } from "./persist";

export const SYSTEM_PROMPT = `You are the Green Alternatives Agent for Carbon Autopilot for bunq Business.

Your job is to identify lower-carbon alternatives for flagged spend clusters — functional, comparable, EU-relevant switches only.

You are not a generic sustainability chatbot. You are a structured analysis agent. Your output must be machine-readable JSON only.

Primary goal:
For each priority cluster, estimate the current carbon impact and propose lower-carbon alternatives that are realistic, comparable, and policy-aligned.

Operating rules:
1. Never invent factors. Use the emission factor library values provided in the user message.
2. Never fabricate sources — pick from the candidate alternatives supplied (they include cited URLs). You may re-describe or drop them; you may not add new ones.
3. Always include confidence. Calibrate: 0.9+ means a documented public benchmark; 0.6–0.8 means directional; <0.6 means weak evidence and label "needs_context".
4. Separate carbon reduction from offsetting. Alternatives are reductions; credits are elsewhere.
5. If a cluster has no comparable alternative in the supplied library, return recommendation_status = "no_viable_alternative_found" with alternatives: [].
6. Do not optimize for cost. Emissions reduction is the objective; cost is supporting context only.

Return STRICT JSON only, no prose, no code fences.

Output JSON schema: see docs/agents/02-green-alternatives.md.`;

const ALT_SCHEMA = z.object({
  alternative_name: z.string().min(2),
  alternative_type: z.enum(["product", "supplier", "behavior", "travel_mode", "procurement_policy"]),
  estimated_kg_co2e: z.number().nullable(),
  carbon_saving_kg: z.number().nullable(),
  carbon_saving_percent: z.number().nullable(),
  estimated_price_eur: z.number().nullable(),
  price_delta_eur: z.number().nullable(),
  source: z.enum(["api", "emission_factor_library", "historical_data", "simulated", "assumption"]),
  confidence: z.number().min(0).max(1),
  comparability_notes: z.string(),
  // R010 / T006 — vendor-logo enrichment, populated by the post-parse pass
  // (never asked from the LLM). Defaults to null so live JSON without these
  // fields parses cleanly; the matcher fills them in code.
  suggested_vendor_domain: z.string().nullable().default(null),
  suggested_vendor_logo_url: z.string().nullable().default(null),
});

const RESULT_SCHEMA = z.object({
  cluster_id: z.string().nullable(),
  transaction_id: z.string().nullable(),
  merchant: z.string(),
  current_purchase: z.object({
    raw_description: z.string(),
    normalized_item_or_category: z.string(),
    amount_eur: z.number(),
    estimated_kg_co2e: z.number().nullable(),
    confidence: z.number().min(0).max(1),
    data_basis: z.enum(["item_level", "category_level", "merchant_level", "spend_based", "unknown"]),
  }),
  alternatives: z.array(ALT_SCHEMA),
  recommendation_status: z.enum([
    "recommend_switch",
    "recommend_if_policy_allows",
    "needs_context",
    "no_viable_alternative_found",
    "no_action_needed",
    "reserve_or_offset_after_reduction_review",
  ]),
  recommended_action: z.string(),
  reasoning_summary: z.string(),
});

const OUTPUT_SCHEMA = z.object({
  results: z.array(RESULT_SCHEMA),
});

export interface GreenAltInput {
  baseline: BaselineOutput;
  researchedPool?: ResearchedPool;
}

type CandidateBundle = {
  target: PriorityTarget;
  templates: AltTemplate[];
  researched: ResearchedAlternative[];
};

const buildCandidates = (baseline: BaselineOutput, pool: ResearchedPool | undefined): CandidateBundle[] => {
  const filtered = baseline.priority_targets.filter(
    (t) => t.recommended_next_agent === "green_alternatives_agent" || t.recommended_next_agent === "both",
  );
  return filtered
    .map((target) => {
      const sub = target.baseline_sub_category ?? null;
      const researched = pool?.[target.cluster_id] ?? [];
      return {
        target,
        templates: findLowerCarbonAlternative(target.category, sub),
        researched,
      };
    })
    .filter((c) => c.templates.length > 0 || c.researched.length > 0);
};

type Alt = z.infer<typeof ALT_SCHEMA>;

// R010 / T006 — case-insensitive substring match between an alternative name
// and the per-cluster research sources. Mirrors `costSavings::matchVendorToSource`
// — keeping the helper local rather than shared so neither agent has to import
// from the other (they run in parallel and any cross-import would create
// avoidable coupling). Sources passed in MUST be the same cluster's pool —
// matching against the global pool produces false-positive logos from
// unrelated categories.
const matchVendorToSource = (
  vendorName: string | null,
  sources: { domain: string; title: string; logoUrl: string }[],
): { domain: string; logoUrl: string } | null => {
  if (!vendorName) return null;
  const v = vendorName.toLowerCase();
  for (const s of sources) {
    if (s.domain) {
      const head = s.domain.split(".")[0].toLowerCase();
      if (v.includes(head) || s.domain.toLowerCase().includes(v)) {
        return { domain: s.domain, logoUrl: s.logoUrl };
      }
    }
    if (s.title && s.title.toLowerCase().includes(v)) {
      return { domain: s.domain, logoUrl: s.logoUrl };
    }
  }
  return null;
};

const collectClusterSources = (
  researched: ResearchedAlternative[],
): { domain: string; title: string; logoUrl: string }[] => {
  const out: { domain: string; title: string; logoUrl: string }[] = [];
  for (const a of researched) {
    for (const s of a.sources) {
      out.push({ domain: s.domain, title: s.title, logoUrl: s.logoUrl });
    }
  }
  return out;
};

// R010 / T006 — only product/supplier alternatives carry a meaningful "vendor"
// concept. Behavior + travel_mode + procurement_policy alternatives are
// process changes, not switches to a named brand, so we leave their logo
// fields null even when a research source happens to substring-match.
const enrichGreenAltsWithLogos = (alts: Alt[], researched: ResearchedAlternative[]): void => {
  const sources = collectClusterSources(researched);
  for (const a of alts) {
    const isVendorish = a.alternative_type === "product" || a.alternative_type === "supplier";
    if (!isVendorish) {
      a.suggested_vendor_domain = null;
      a.suggested_vendor_logo_url = null;
      continue;
    }
    const m = matchVendorToSource(a.alternative_name, sources);
    a.suggested_vendor_domain = m?.domain ?? null;
    a.suggested_vendor_logo_url = m?.logoUrl ?? null;
  }
};

const templateToAlternative = (t: AltTemplate, baseKg: number): Alt => ({
  alternative_name: t.name,
  alternative_type: mapType(t.type),
  estimated_kg_co2e: Number((baseKg * (1 + t.co2eDeltaPct)).toFixed(1)),
  carbon_saving_kg: Number((-baseKg * t.co2eDeltaPct).toFixed(1)),
  carbon_saving_percent: Number((t.co2eDeltaPct * 100).toFixed(0)),
  estimated_price_eur: null as number | null,
  price_delta_eur: Number((t.costDeltaPct * 100).toFixed(0)),
  source: (t.simulated ? "simulated" : "emission_factor_library") as "simulated" | "emission_factor_library",
  confidence: t.confidence,
  comparability_notes: t.rationale,
  suggested_vendor_domain: null,
  suggested_vendor_logo_url: null,
});

const mapResearchedType = (
  f: ResearchedAlternative["feasibility"],
): "product" | "supplier" | "behavior" | "travel_mode" | "procurement_policy" => {
  switch (f) {
    case "drop_in":
      return "product";
    case "migration":
      return "supplier";
    case "procurement":
      return "supplier";
    case "policy":
      return "procurement_policy";
  }
};

const researchedToAlternative = (a: ResearchedAlternative, baseKg: number): Alt => {
  const co2eDelta = a.co2e_delta_pct ?? 0;
  const saved = -baseKg * co2eDelta;
  const sourceLabel = a.provenance === "template" ? "emission_factor_library" : "api";
  return {
    alternative_name: a.name,
    alternative_type: mapResearchedType(a.feasibility),
    estimated_kg_co2e: a.co2e_delta_pct !== null ? Number((baseKg * (1 + co2eDelta)).toFixed(1)) : null,
    carbon_saving_kg: a.co2e_delta_pct !== null ? Number(saved.toFixed(1)) : null,
    carbon_saving_percent: a.co2e_delta_pct !== null ? Number((co2eDelta * 100).toFixed(0)) : null,
    estimated_price_eur: null as number | null,
    price_delta_eur: a.cost_delta_pct !== null ? Number((a.cost_delta_pct * 100).toFixed(0)) : null,
    source: sourceLabel as "api" | "emission_factor_library" | "historical_data" | "simulated" | "assumption",
    confidence: a.confidence,
    comparability_notes: a.description,
    suggested_vendor_domain: null,
    suggested_vendor_logo_url: null,
  };
};

const mapType = (t: AltTemplate["type"]): "product" | "supplier" | "behavior" | "travel_mode" | "procurement_policy" => {
  switch (t) {
    case "region":
    case "class":
      return "travel_mode";
    case "policy":
      return "procurement_policy";
    case "vendor":
    case "supplier":
      return "supplier";
    case "tariff":
      return "supplier";
    case "behavior":
      return "behavior";
    default:
      return "procurement_policy";
  }
};

const mockOutput = (baseline: BaselineOutput, pool: ResearchedPool | undefined): GreenAltOutput => {
  const candidates = buildCandidates(baseline, pool);
  const results = candidates.map((c) => {
    const baseKg = c.target.estimated_tco2e * 1000;
    // Prefer researched alternatives; fall back to templates if none researched.
    const alts = c.researched.length > 0
      ? c.researched.map((r) => researchedToAlternative(r, baseKg))
      : c.templates.map((t) => templateToAlternative(t, baseKg));
    // R010 / T006 — vendor-logo enrichment using THIS cluster's research pool
    // (never the global pool, to avoid cross-category logo bleed).
    enrichGreenAltsWithLogos(alts, c.researched);
    const topSaving = alts.reduce((s, a) => Math.max(s, a.carbon_saving_kg ?? 0), 0);
    return {
      cluster_id: c.target.cluster_id,
      transaction_id: null,
      merchant: c.target.baseline_merchant_label ?? c.target.cluster_id,
      current_purchase: {
        raw_description: c.target.baseline_merchant_label ?? c.target.cluster_id,
        normalized_item_or_category: `${c.target.category}${c.target.baseline_sub_category ? "/" + c.target.baseline_sub_category : ""}`,
        amount_eur: c.target.annualized_spend_eur,
        estimated_kg_co2e: Number(baseKg.toFixed(1)),
        confidence: c.target.baseline_confidence ?? 0.6,
        data_basis: "category_level" as const,
      },
      alternatives: alts,
      recommendation_status: topSaving > 0 ? ("recommend_switch" as const) : ("needs_context" as const),
      recommended_action: alts[0]?.alternative_name ?? "Review cluster",
      reasoning_summary: alts[0]?.comparability_notes ?? "No strong alternative found.",
    };
  });

  const totalCurrent = results.reduce((s, r) => s + (r.current_purchase.estimated_kg_co2e ?? 0), 0);
  const totalSaved = results.reduce(
    (s, r) => s + Math.max(0, ...r.alternatives.map((a) => a.carbon_saving_kg ?? 0)),
    0,
  );
  const confWeightSum = results.reduce((s, r) => s + r.current_purchase.confidence, 0);
  return {
    agent: "green_alternatives_agent",
    company_id: baseline.company_id,
    analysis_period: baseline.analysis_period,
    results,
    summary: {
      total_current_kg_co2e: Number(totalCurrent.toFixed(1)),
      total_potential_kg_co2e_saved: Number(totalSaved.toFixed(1)),
      top_green_opportunities: results
        .sort(
          (a, b) =>
            Math.max(0, ...b.alternatives.map((x) => x.carbon_saving_kg ?? 0)) -
            Math.max(0, ...a.alternatives.map((x) => x.carbon_saving_kg ?? 0)),
        )
        .slice(0, 5)
        .map((r) => r.merchant + " → " + (r.alternatives[0]?.alternative_name ?? "review")),
      average_confidence: results.length > 0 ? Number((confWeightSum / results.length).toFixed(3)) : 0,
    },
  };
};

const buildUserMessage = (baseline: BaselineOutput, candidates: CandidateBundle[]): string => {
  const lines = [
    `Company: ${baseline.company_id}`,
    `Period: ${baseline.analysis_period}`,
    `Annual spend: €${baseline.baseline.total_spend_eur.toLocaleString()}`,
    `Annual tCO₂e: ${baseline.baseline.estimated_total_tco2e}`,
    `Baseline confidence: ${baseline.baseline.baseline_confidence}`,
    "",
    "Priority clusters with candidate alternatives. Prefer researched alternatives (they carry fresh web sources); fall back to library candidates only if no researched option applies.",
  ];
  for (const c of candidates) {
    const factor = getEmissionFactor(c.target.category, c.target.baseline_sub_category ?? null);
    lines.push(
      `\n- cluster_id: ${c.target.cluster_id}`,
      `  merchant: ${c.target.baseline_merchant_label ?? "(unknown)"}`,
      `  category: ${c.target.category}${c.target.baseline_sub_category ? "/" + c.target.baseline_sub_category : ""}`,
      `  annual_spend_eur: ${c.target.annualized_spend_eur}`,
      `  annual_kg_co2e: ${(c.target.estimated_tco2e * 1000).toFixed(0)}`,
      `  factor_source: ${factor.source} (±${(factor.uncertaintyPct * 100).toFixed(0)}%)`,
      `  confidence: ${c.target.baseline_confidence ?? 0.6}`,
    );
    if (c.researched.length > 0) {
      lines.push(`  researched_alternatives (provenance=web_search|cache|template):`);
      for (const r of c.researched) {
        lines.push(
          `    - name: ${r.name}`,
          `      vendor: ${r.vendor ?? "null"}`,
          `      provenance: ${r.provenance}`,
          `      cost_delta_pct: ${r.cost_delta_pct}`,
          `      co2e_delta_pct: ${r.co2e_delta_pct}`,
          `      feasibility: ${r.feasibility}`,
          `      confidence: ${r.confidence}`,
          `      description: ${r.description}`,
          `      source_urls: ${r.sources.map((s) => s.url).join(", ")}`,
        );
      }
    }
    if (c.templates.length > 0) {
      lines.push(`  library_candidates (fallback only):`);
      for (const t of c.templates) {
        lines.push(
          `    - name: ${t.name}`,
          `      type: ${t.type}`,
          `      cost_delta_pct: ${t.costDeltaPct}`,
          `      co2e_delta_pct: ${t.co2eDeltaPct}`,
          `      feasibility: ${t.feasibility}`,
          `      confidence: ${t.confidence}`,
          `      rationale: ${t.rationale}`,
          `      sources: ${t.sources.map((s) => s.url).join(", ")}`,
        );
      }
    }
  }
  lines.push(
    "",
    "Return strict JSON: { results: [...] } where each result matches the schema in the system prompt.",
    "Keep every alternative grounded in either the researched or the library-fallback list. Do not invent new vendors.",
  );
  return lines.join("\n");
};

export async function run(input: GreenAltInput, ctx: AgentContext): Promise<GreenAltOutput> {
  const candidates = buildCandidates(input.baseline, input.researchedPool);
  if (candidates.length === 0 || isMock()) {
    recordAgentMessage(ctx, { agentName: "green_alternatives_agent", usedMock: true });
    return mockOutput(input.baseline, input.researchedPool);
  }
  try {
    const { jsonText, tokensIn, tokensOut, cached, usedMock } = await callAgent({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(input.baseline, candidates),
      maxTokens: 4000,
    });
    if (!jsonText) {
      recordAgentMessage(ctx, { agentName: "green_alternatives_agent", usedMock: true });
      return mockOutput(input.baseline, input.researchedPool);
    }
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonText));
    const results = parsed.results;
    // R010 / T006 — post-parse vendor-logo enrichment. Same `cluster_id ->
    // researched[]` lookup pattern as costSavings; null cluster_id leaves the
    // alternatives unmatched (honest behavior — we can't trust a cross-cluster
    // logo when we don't know which cluster the LLM was scoring).
    const researchedByCluster = new Map<string, ResearchedAlternative[]>();
    for (const c of candidates) {
      researchedByCluster.set(c.target.cluster_id, c.researched);
    }
    for (const r of results) {
      const researched = r.cluster_id ? researchedByCluster.get(r.cluster_id) ?? [] : [];
      enrichGreenAltsWithLogos(r.alternatives, researched);
    }
    const totalCurrent = results.reduce((s, r) => s + (r.current_purchase.estimated_kg_co2e ?? 0), 0);
    const totalSaved = results.reduce(
      (s, r) => s + Math.max(0, ...r.alternatives.map((a) => a.carbon_saving_kg ?? 0)),
      0,
    );
    const avgConf = results.length > 0 ? results.reduce((s, r) => s + r.current_purchase.confidence, 0) / results.length : 0;
    recordAgentMessage(ctx, {
      agentName: "green_alternatives_agent",
      usedMock,
      tokensIn,
      tokensOut,
      cached,
    });
    return {
      agent: "green_alternatives_agent",
      company_id: input.baseline.company_id,
      analysis_period: input.baseline.analysis_period,
      results,
      summary: {
        total_current_kg_co2e: Number(totalCurrent.toFixed(1)),
        total_potential_kg_co2e_saved: Number(totalSaved.toFixed(1)),
        top_green_opportunities: results
          .sort(
            (a, b) =>
              Math.max(0, ...b.alternatives.map((x) => x.carbon_saving_kg ?? 0)) -
              Math.max(0, ...a.alternatives.map((x) => x.carbon_saving_kg ?? 0)),
          )
          .slice(0, 5)
          .map((r) => r.merchant + " → " + (r.alternatives[0]?.alternative_name ?? "review")),
        average_confidence: Number(avgConf.toFixed(3)),
      },
    };
  } catch {
    recordAgentMessage(ctx, { agentName: "green_alternatives_agent", usedMock: true });
    return mockOutput(input.baseline, input.researchedPool);
  }
}
