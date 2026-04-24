import { z } from "zod";
import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import type { BaselineItem } from "@/lib/impacts/aggregate";

export type Quadrant = "win_win" | "pay_to_decarbonize" | "status_quo_trap" | "avoid";
export type Feasibility = "drop_in" | "migration" | "procurement";
export type AltType = "vendor" | "tariff" | "policy" | "class" | "region";

export type ResolvedAlternative = {
  baselineKey: string;
  name: string;
  type: AltType;
  description: string;
  costDeltaPct: number;
  co2eDeltaPct: number;
  costDeltaEurYear: number;
  co2eDeltaKgYear: number;
  confidence: number;
  feasibility: Feasibility;
  rationale: string;
  sources: Array<{ title: string; url: string }>;
  quadrant: Quadrant;
};

const ALT_TYPE = z.enum(["vendor", "tariff", "policy", "class", "region"]);
const FEASIBILITY = z.enum(["drop_in", "migration", "procurement"]);
const SOURCE = z.object({ title: z.string().min(2), url: z.string().url() });

const ALT_SCHEMA = z.object({
  baselineKey: z.string(),
  name: z.string().min(2),
  type: ALT_TYPE,
  description: z.string().min(4),
  costDeltaPct: z.number().min(-1).max(5),
  co2eDeltaPct: z.number().min(-1).max(2),
  confidence: z.number().min(0).max(1),
  feasibility: FEASIBILITY,
  rationale: z.string().min(4),
  sources: z.array(SOURCE).min(1).max(4),
});
const OUTPUT_SCHEMA = z.object({ alternatives: z.array(ALT_SCHEMA).min(1) });

type AltTemplate = {
  name: string;
  type: AltType;
  description: string;
  costDeltaPct: number;
  co2eDeltaPct: number;
  confidence: number;
  feasibility: Feasibility;
  rationale: string;
  sources: Array<{ title: string; url: string }>;
};

const MOCK_BY_SUBCATEGORY: Record<string, AltTemplate[]> = {
  "cloud.saas": [
    {
      name: "Right-size seat licenses",
      type: "policy",
      description: "Audit inactive seats quarterly; downgrade or reclaim unused licenses.",
      costDeltaPct: -0.25,
      co2eDeltaPct: -0.25,
      confidence: 0.82,
      feasibility: "drop_in",
      rationale: "Typical SaaS over-provisioning is 20–35% of seats; cost and emissions scale linearly.",
      sources: [
        { title: "Flexera 2024 State of the Cloud", url: "https://info.flexera.com/CM-REPORT-State-of-the-Cloud" },
        { title: "Cloud Carbon Footprint methodology", url: "https://www.cloudcarbonfootprint.org/docs/methodology/" },
      ],
    },
    {
      name: "Consolidate overlapping SaaS",
      type: "vendor",
      description: "Replace 2–3 point tools with a single suite covering the same jobs.",
      costDeltaPct: -0.15,
      co2eDeltaPct: -0.20,
      confidence: 0.65,
      feasibility: "migration",
      rationale: "Fewer vendor footprints and volume-tier discounts compound savings.",
      sources: [
        { title: "Productiv SaaS Index 2024", url: "https://productiv.com/saas-management-index/" },
      ],
    },
  ],
  "cloud.compute_eu": [
    {
      name: "Migrate to Graviton / ARM instances",
      type: "vendor",
      description: "Move compatible workloads from x86 to ARM instance families.",
      costDeltaPct: -0.20,
      co2eDeltaPct: -0.30,
      confidence: 0.78,
      feasibility: "migration",
      rationale: "ARM instances deliver ~20% cost savings and ~30% lower energy per workload on AWS and GCP.",
      sources: [
        { title: "AWS Graviton price/performance", url: "https://aws.amazon.com/ec2/graviton/" },
        { title: "Lancaster 2021 — Energy efficiency of ARM vs x86", url: "https://www.lancaster.ac.uk/scc/" },
      ],
    },
    {
      name: "Commit to 1-yr reserved capacity",
      type: "vendor",
      description: "Lock steady-state workloads into 1-yr RIs or Savings Plans.",
      costDeltaPct: -0.30,
      co2eDeltaPct: -0.05,
      confidence: 0.85,
      feasibility: "drop_in",
      rationale: "Cost savings are large; emissions reduction is small because utilization is the lever.",
      sources: [
        { title: "AWS Savings Plans docs", url: "https://aws.amazon.com/savingsplans/" },
      ],
    },
  ],
  "cloud.compute_high": [
    {
      name: "Relocate to a low-carbon EU region",
      type: "region",
      description: "Move workloads from coal-heavy regions to Stockholm, Dublin or Frankfurt.",
      costDeltaPct: -0.05,
      co2eDeltaPct: -0.70,
      confidence: 0.86,
      feasibility: "migration",
      rationale: "Stockholm and Dublin grids average 30–80 gCO₂e/kWh vs. 400+ in Poland or Virginia.",
      sources: [
        { title: "Ember European Electricity Review", url: "https://ember-energy.org/" },
        { title: "AWS Customer Carbon Footprint Tool", url: "https://aws.amazon.com/aws-cost-management/aws-customer-carbon-footprint-tool/" },
      ],
    },
    {
      name: "Schedule non-urgent jobs off-peak",
      type: "policy",
      description: "Shift batch jobs to low-grid-intensity hours using time-of-use schedulers.",
      costDeltaPct: -0.08,
      co2eDeltaPct: -0.25,
      confidence: 0.68,
      feasibility: "drop_in",
      rationale: "Grid carbon intensity varies 2–4× within a day; batch schedulers exploit this automatically.",
      sources: [
        { title: "Electricity Maps API", url: "https://www.electricitymap.org/" },
      ],
    },
  ],
  "cloud.storage": [
    {
      name: "Tier cold data to archive storage",
      type: "vendor",
      description: "Move objects older than 90 days to Glacier / Archive tier.",
      costDeltaPct: -0.60,
      co2eDeltaPct: -0.50,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Cold storage uses ~50% less energy per TB and costs ~5× less.",
      sources: [
        { title: "AWS S3 Glacier", url: "https://aws.amazon.com/s3/storage-classes/glacier/" },
      ],
    },
  ],
  "travel.flight_shorthaul": [
    {
      name: "Rail for routes under 700 km",
      type: "policy",
      description: "Require train booking for Amsterdam ↔ Paris/Brussels/Frankfurt/London.",
      costDeltaPct: 0.05,
      co2eDeltaPct: -0.85,
      confidence: 0.90,
      feasibility: "drop_in",
      rationale: "EU electrified rail at 35 gCO₂e/km vs. 250 for short-haul flight; total-door-to-door time comparable under 700 km.",
      sources: [
        { title: "DEFRA 2024 GHG Conversion Factors", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" },
        { title: "Transport & Environment — Rail vs plane", url: "https://www.transportenvironment.org/" },
      ],
    },
    {
      name: "Economy-only travel policy",
      type: "class",
      description: "Remove business class for flights under 6 hours.",
      costDeltaPct: -0.55,
      co2eDeltaPct: -0.65,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Business-class seats occupy ~3× the cabin footprint; DEFRA factors apply 2.9× multiplier.",
      sources: [
        { title: "DEFRA business vs economy multiplier", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" },
      ],
    },
  ],
  "travel.flight_longhaul": [
    {
      name: "Economy-only for long-haul",
      type: "class",
      description: "Remove business class on flights over 6 hours; premium-economy allowed.",
      costDeltaPct: -0.45,
      co2eDeltaPct: -0.60,
      confidence: 0.87,
      feasibility: "drop_in",
      rationale: "Business cabin multiplier is 2.9× economy per DEFRA; largest single lever on long-haul.",
      sources: [
        { title: "DEFRA 2024 GHG Factors", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" },
      ],
    },
    {
      name: "Consolidate to one trip per quarter",
      type: "policy",
      description: "Cap long-haul to 4× per person per year with merged agendas.",
      costDeltaPct: -0.35,
      co2eDeltaPct: -0.40,
      confidence: 0.72,
      feasibility: "drop_in",
      rationale: "Batching trips reduces flights linearly; measured impact depends on meeting density.",
      sources: [
        { title: "Transport & Environment", url: "https://www.transportenvironment.org/" },
      ],
    },
  ],
  "travel.hotel": [
    {
      name: "Prefer Green Key certified hotels",
      type: "policy",
      description: "Rank Green Key / EU Ecolabel properties first in booking tool.",
      costDeltaPct: 0.02,
      co2eDeltaPct: -0.25,
      confidence: 0.60,
      feasibility: "drop_in",
      rationale: "Certified hotels average 20–30% lower energy per room-night; price premium is negligible in EU markets.",
      sources: [
        { title: "Green Key certification", url: "https://www.greenkey.global/" },
      ],
    },
  ],
  "utilities.electricity": [
    {
      name: "Switch to Pure Energie 100% Dutch wind",
      type: "tariff",
      description: "Move office meter to Pure Energie or Vandebron certified Dutch-wind tariff.",
      costDeltaPct: 0.03,
      co2eDeltaPct: -0.90,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Certificates of origin cover the residual Scope 2 per GHG Protocol market-based method.",
      sources: [
        { title: "Pure Energie", url: "https://pure-energie.nl/" },
        { title: "GHG Protocol Scope 2 Guidance", url: "https://ghgprotocol.org/scope-2-guidance" },
      ],
    },
    {
      name: "Rooftop solar PPA",
      type: "tariff",
      description: "10-year PPA with local installer; zero upfront, fixed kWh price.",
      costDeltaPct: -0.20,
      co2eDeltaPct: -0.40,
      confidence: 0.70,
      feasibility: "procurement",
      rationale: "Dutch commercial PPAs typically beat grid by 15–25% over 10 years; offsets ~40% of consumption on a suitable roof.",
      sources: [
        { title: "RVO solar incentive guide", url: "https://www.rvo.nl/" },
      ],
    },
    {
      name: "Run an energy broker tender",
      type: "tariff",
      description: "Rebid the supply contract via a Dutch energy broker.",
      costDeltaPct: -0.12,
      co2eDeltaPct: -0.05,
      confidence: 0.75,
      feasibility: "procurement",
      rationale: "Contract rebidding reliably cuts unit rates; emissions only move if the new contract specifies green supply.",
      sources: [
        { title: "ACM — consumer energy advice", url: "https://www.acm.nl/" },
      ],
    },
  ],
  "utilities.gas": [
    {
      name: "Heat-pump retrofit study",
      type: "policy",
      description: "Commission a feasibility study for hybrid or full heat-pump replacement.",
      costDeltaPct: 0.10,
      co2eDeltaPct: -0.70,
      confidence: 0.60,
      feasibility: "procurement",
      rationale: "Heat pumps deliver 3–4× coefficient of performance; EU ISDE subsidy offsets capex.",
      sources: [
        { title: "RVO ISDE subsidy", url: "https://www.rvo.nl/subsidies-financiering/isde" },
      ],
    },
    {
      name: "Building insulation audit",
      type: "policy",
      description: "Thermal imaging audit to identify and seal the top 3 heat-loss points.",
      costDeltaPct: -0.15,
      co2eDeltaPct: -0.20,
      confidence: 0.65,
      feasibility: "procurement",
      rationale: "Typical EU commercial buildings lose 20–30% of heating energy through envelope gaps; payback under 5 years.",
      sources: [
        { title: "EU Energy Efficiency Directive", url: "https://energy.ec.europa.eu/topics/energy-efficiency_en" },
      ],
    },
  ],
};

const MOCK_BY_CATEGORY: Record<string, AltTemplate[]> = {
  cloud: MOCK_BY_SUBCATEGORY["cloud.saas"],
  travel: MOCK_BY_SUBCATEGORY["travel.flight_shorthaul"],
  utilities: MOCK_BY_SUBCATEGORY["utilities.electricity"],
};

const templatesFor = (cat: string, sub: string | null): AltTemplate[] => {
  const key = sub ? `${cat}.${sub}` : cat;
  return MOCK_BY_SUBCATEGORY[key] ?? MOCK_BY_CATEGORY[cat] ?? [];
};

const computeQuadrant = (costDeltaPct: number, co2eDeltaPct: number): Quadrant => {
  const cost = costDeltaPct;
  const co2 = co2eDeltaPct;
  if (cost <= 0 && co2 <= 0) return "win_win";
  if (cost > 0 && co2 < 0) return "pay_to_decarbonize";
  if (cost < 0 && co2 > 0) return "status_quo_trap";
  return "avoid";
};

const resolve = (baseline: BaselineItem, t: AltTemplate): ResolvedAlternative => ({
  baselineKey: baseline.key,
  name: t.name,
  type: t.type,
  description: t.description,
  costDeltaPct: t.costDeltaPct,
  co2eDeltaPct: t.co2eDeltaPct,
  costDeltaEurYear: Number((baseline.annualSpendEur * t.costDeltaPct).toFixed(2)),
  co2eDeltaKgYear: Number((baseline.annualCo2eKg * t.co2eDeltaPct).toFixed(3)),
  confidence: t.confidence,
  feasibility: t.feasibility,
  rationale: t.rationale,
  sources: t.sources,
  quadrant: computeQuadrant(t.costDeltaPct, t.co2eDeltaPct),
});

const mockAlternatives = (baselines: BaselineItem[]): ResolvedAlternative[] => {
  const out: ResolvedAlternative[] = [];
  for (const b of baselines) {
    for (const t of templatesFor(b.category, b.subCategory)) {
      out.push(resolve(b, t));
    }
  }
  return out;
};

const buildPrompt = (baselines: BaselineItem[]) => `You are a senior sustainability analyst advising a Dutch enterprise on Scope 2 and Scope 3 carbon reductions. For each baseline spend item below, propose 2–3 realistic lower-carbon alternatives that EU business buyers can actually adopt.

Rules for every alternative:
- Ground claims in public sources — DEFRA 2024, GHG Protocol, Ember, RVO, ACM, or reputable vendor sustainability pages.
- costDeltaPct and co2eDeltaPct are expressed as signed fractions vs the baseline (e.g. -0.30 = 30% lower). Never fabricate numeric deltas — use typical ranges documented in your cited sources.
- feasibility: "drop_in" = can change this quarter, "migration" = needs engineering work, "procurement" = needs RFP or legal.
- At least one source URL per alternative, real and public.
- Prefer switches where cost and CO₂ both drop; do not fabricate win-wins when the real lever is cost-only or CO₂-only.

Baselines (annualized):
${baselines
  .map(
    (b, i) =>
      `${i + 1}. key="${b.key}" merchant="${b.merchantLabel}" cat=${b.category}${b.subCategory ? "/" + b.subCategory : ""} annualSpend=€${b.annualSpendEur.toFixed(0)} annualCO2e=${b.annualCo2eKg.toFixed(1)}kg baselineConfidence=${b.confidence.toFixed(2)}`,
  )
  .join("\n")}

Return STRICT JSON:
{ "alternatives": [ { "baselineKey": "<key from above>", "name": "...", "type": "vendor|tariff|policy|class|region", "description": "one sentence", "costDeltaPct": -0.2, "co2eDeltaPct": -0.3, "confidence": 0.75, "feasibility": "drop_in|migration|procurement", "rationale": "one sentence grounded in the cited source", "sources": [{"title":"...","url":"https://..."}] } ] }

Do not include alternatives for baselines you cannot ground. Prefer fewer, better-cited alternatives over many speculative ones.`;

export const researchAlternatives = async (baselines: BaselineItem[]): Promise<ResolvedAlternative[]> => {
  if (baselines.length === 0) return [];
  if (isAnthropicMock()) return mockAlternatives(baselines);

  const prompt = buildPrompt(baselines);
  const client = anthropic();
  try {
    const msg = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return mockAlternatives(baselines);
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(m[0]));
    const byKey = new Map(baselines.map((b) => [b.key, b]));
    const resolved: ResolvedAlternative[] = [];
    for (const a of parsed.alternatives) {
      const baseline = byKey.get(a.baselineKey);
      if (!baseline) continue;
      resolved.push({
        baselineKey: baseline.key,
        name: a.name,
        type: a.type,
        description: a.description,
        costDeltaPct: a.costDeltaPct,
        co2eDeltaPct: a.co2eDeltaPct,
        costDeltaEurYear: Number((baseline.annualSpendEur * a.costDeltaPct).toFixed(2)),
        co2eDeltaKgYear: Number((baseline.annualCo2eKg * a.co2eDeltaPct).toFixed(3)),
        confidence: a.confidence,
        feasibility: a.feasibility,
        rationale: a.rationale,
        sources: a.sources,
        quadrant: computeQuadrant(a.costDeltaPct, a.co2eDeltaPct),
      });
    }
    return resolved.length > 0 ? resolved : mockAlternatives(baselines);
  } catch {
    return mockAlternatives(baselines);
  }
};
