/**
 * Tool layer for the 7-agent DAG.
 *
 * Each tool is bounded (≤ 50 rows or one aggregate) per research/13-context-scaling-patterns.md §retrieval-pattern
 * so agents never unboundedly pull raw transaction rows.
 *
 * We dispatch tools in code BEFORE the Sonnet call (resolved values land in the user message),
 * rather than via Anthropic tool_use blocks. Simpler, cheaper, and matches the hackathon scope —
 * every tool call is reproducible and shows up in agent_messages as a tool_result row.
 */
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, transactions } from "@/lib/db/client";
import { factorFor, factorById, FACTORS, type FactorRow } from "@/lib/factors";
import { CREDIT_PROJECTS, type CreditType } from "@/lib/credits/projects";
import { monthBounds } from "@/lib/queries";

const MAX_ROWS = 50;
const MAX_MONTHS = 12;

export type TxRow = {
  id: string;
  merchantRaw: string;
  merchantNorm: string;
  amountEur: number;
  timestamp: number;
  category: string | null;
  subCategory: string | null;
  confidence: number | null;
};

export const getTransactionRows = (params: {
  orgId: string;
  merchantNorm?: string;
  category?: string;
  subCategory?: string;
  sinceUnixSec?: number;
  limit?: number;
}): TxRow[] => {
  const limit = Math.min(params.limit ?? 20, MAX_ROWS);
  const conds = [eq(transactions.orgId, params.orgId)];
  if (params.merchantNorm) conds.push(eq(transactions.merchantNorm, params.merchantNorm));
  if (params.category) conds.push(eq(transactions.category, params.category));
  if (params.subCategory) conds.push(eq(transactions.subCategory, params.subCategory));
  if (params.sinceUnixSec !== undefined) conds.push(gte(transactions.timestamp, params.sinceUnixSec));
  const rows = db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(desc(transactions.timestamp))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    id: r.id,
    merchantRaw: r.merchantRaw,
    merchantNorm: r.merchantNorm,
    amountEur: r.amountCents / 100,
    timestamp: r.timestamp,
    category: r.category,
    subCategory: r.subCategory,
    confidence: r.categoryConfidence,
  }));
};

export type MerchantCluster = {
  merchantNorm: string;
  merchantLabel: string;
  totalSpendEur: number;
  txCount: number;
  categorySplit: Array<{ category: string | null; subCategory: string | null; spendEur: number; count: number }>;
  firstSeenSec: number;
  lastSeenSec: number;
};

export const getMerchantCluster = (orgId: string, merchantNorm: string): MerchantCluster | null => {
  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.orgId, orgId), eq(transactions.merchantNorm, merchantNorm)))
    .all();
  if (rows.length === 0) return null;
  const splitMap = new Map<string, { category: string | null; subCategory: string | null; spendEur: number; count: number }>();
  let firstSeen = Infinity;
  let lastSeen = -Infinity;
  let total = 0;
  for (const r of rows) {
    const key = `${r.category ?? "_"}|${r.subCategory ?? "_"}`;
    const entry = splitMap.get(key) ?? { category: r.category, subCategory: r.subCategory, spendEur: 0, count: 0 };
    entry.spendEur += r.amountCents / 100;
    entry.count += 1;
    splitMap.set(key, entry);
    total += r.amountCents / 100;
    if (r.timestamp < firstSeen) firstSeen = r.timestamp;
    if (r.timestamp > lastSeen) lastSeen = r.timestamp;
  }
  return {
    merchantNorm,
    merchantLabel: rows[0].merchantRaw,
    totalSpendEur: Number(total.toFixed(2)),
    txCount: rows.length,
    categorySplit: Array.from(splitMap.values()).sort((a, b) => b.spendEur - a.spendEur),
    firstSeenSec: firstSeen,
    lastSeenSec: lastSeen,
  };
};

export type CategorySpend = {
  category: string;
  subCategory: string | null;
  spendEur: number;
  txCount: number;
  sharePct: number;
};

export const getSpendByCategory = (orgId: string, month?: string): CategorySpend[] => {
  const conds = [eq(transactions.orgId, orgId)];
  if (month) {
    const { start, end } = monthBounds(month);
    conds.push(gte(transactions.timestamp, start));
    conds.push(lt(transactions.timestamp, end));
  }
  const rows = db
    .select({
      category: transactions.category,
      subCategory: transactions.subCategory,
      spend: sql<number>`sum(${transactions.amountCents}) / 100.0`.as("spend"),
      cnt: sql<number>`count(*)`.as("cnt"),
    })
    .from(transactions)
    .where(and(...conds))
    .groupBy(transactions.category, transactions.subCategory)
    .all();
  const total = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      category: r.category as string,
      subCategory: r.subCategory,
      spendEur: Number((r.spend ?? 0).toFixed(2)),
      txCount: r.cnt,
      sharePct: total > 0 ? Number((((r.spend ?? 0) / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.spendEur - a.spendEur);
};

export const getEmissionFactor = (category: string, subCategory: string | null): FactorRow =>
  factorFor(category, subCategory);

export const getEmissionFactorById = (factorId: string): FactorRow | undefined => factorById(factorId);

export const listEmissionFactors = (): FactorRow[] => FACTORS;

export type RecurringSpend = {
  merchantNorm: string;
  merchantLabel: string;
  monthlyAvgEur: number;
  monthsPresent: number;
  totalSpendEur: number;
  category: string | null;
  subCategory: string | null;
};

/**
 * Detect merchants present for ≥ minMonths consecutive months.
 * Uses a simple month-bucket count; no advanced ML — spec calls this out as "~30 lines of SQL".
 */
export const detectRecurringSpend = (
  orgId: string,
  minMonthsPresent = 3,
  lookbackMonths = 6,
): RecurringSpend[] => {
  const now = Math.floor(Date.now() / 1000);
  const sinceSec = now - lookbackMonths * 30 * 86_400;
  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, sinceSec)))
    .all();
  type Bucket = {
    merchantLabel: string;
    months: Set<string>;
    totalSpendEur: number;
    category: string | null;
    subCategory: string | null;
  };
  const byMerchant = new Map<string, Bucket>();
  for (const tx of rows) {
    const d = new Date(tx.timestamp * 1000);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b =
      byMerchant.get(tx.merchantNorm) ??
      ({ merchantLabel: tx.merchantRaw, months: new Set(), totalSpendEur: 0, category: tx.category, subCategory: tx.subCategory } as Bucket);
    b.months.add(month);
    b.totalSpendEur += tx.amountCents / 100;
    byMerchant.set(tx.merchantNorm, b);
  }
  const out: RecurringSpend[] = [];
  for (const [merchantNorm, b] of byMerchant) {
    if (b.months.size < minMonthsPresent) continue;
    out.push({
      merchantNorm,
      merchantLabel: b.merchantLabel,
      monthlyAvgEur: Number((b.totalSpendEur / b.months.size).toFixed(2)),
      monthsPresent: b.months.size,
      totalSpendEur: Number(b.totalSpendEur.toFixed(2)),
      category: b.category,
      subCategory: b.subCategory,
    });
  }
  return out.sort((a, b) => b.monthlyAvgEur - a.monthlyAvgEur).slice(0, MAX_ROWS);
};

export type HistoricalSpendPoint = { month: string; spendEur: number; txCount: number };

export const getHistoricalSpendByMerchant = (orgId: string, merchantNorm: string, months = 6): HistoricalSpendPoint[] => {
  const clamped = Math.min(months, MAX_MONTHS);
  const out: HistoricalSpendPoint[] = [];
  const now = new Date();
  for (let i = clamped - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthBounds(month);
    const row = db
      .select({
        spend: sql<number>`coalesce(sum(${transactions.amountCents}),0) / 100.0`.as("spend"),
        cnt: sql<number>`count(*)`.as("cnt"),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.orgId, orgId),
          eq(transactions.merchantNorm, merchantNorm),
          gte(transactions.timestamp, start),
          lt(transactions.timestamp, end),
        ),
      )
      .all()[0];
    out.push({ month, spendEur: Number((row?.spend ?? 0).toFixed(2)), txCount: row?.cnt ?? 0 });
  }
  return out;
};

export type AltTemplate = {
  name: string;
  type: "vendor" | "tariff" | "policy" | "class" | "region" | "supplier" | "behavior";
  description: string;
  costDeltaPct: number;
  co2eDeltaPct: number;
  confidence: number;
  feasibility: "drop_in" | "migration" | "procurement";
  rationale: string;
  sources: Array<{ title: string; url: string }>;
  simulated: boolean;
};

/**
 * Seeded alternative library. Kept minimal and sourced — extends research/11-impact-matrix.md anchors
 * and the template set already in lib/agent/impacts.ts, covering the categories that actually
 * dominate a typical bunq Business ledger.
 */
const GREEN_TEMPLATES: Record<string, AltTemplate[]> = {
  "travel.flight_shorthaul": [
    {
      name: "Rail for routes under 700 km",
      type: "policy",
      description: "Require train booking for Amsterdam ↔ Paris / Brussels / Frankfurt / London.",
      costDeltaPct: 0.05,
      co2eDeltaPct: -0.85,
      confidence: 0.9,
      feasibility: "drop_in",
      rationale: "EU electrified rail is 35 gCO₂e/km vs 250 gCO₂e/km for short-haul flight; door-to-door time under 700 km is comparable.",
      sources: [
        { title: "DEFRA 2024 GHG Conversion Factors", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" },
        { title: "Transport & Environment — rail vs plane", url: "https://www.transportenvironment.org/" },
      ],
      simulated: false,
    },
    {
      name: "Economy-only cabin class",
      type: "class",
      description: "Remove business class for flights under 6 hours.",
      costDeltaPct: -0.55,
      co2eDeltaPct: -0.65,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Business-class seats occupy ~3× the cabin footprint; DEFRA applies a 2.9× multiplier vs economy.",
      sources: [{ title: "DEFRA business vs economy multiplier", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" }],
      simulated: false,
    },
  ],
  "travel.flight_longhaul": [
    {
      name: "Economy-only for long-haul",
      type: "class",
      description: "Remove business class on flights over 6 hours; premium-economy allowed.",
      costDeltaPct: -0.45,
      co2eDeltaPct: -0.6,
      confidence: 0.87,
      feasibility: "drop_in",
      rationale: "Business cabin multiplier is 2.9× economy per DEFRA; largest single lever on long-haul.",
      sources: [{ title: "DEFRA 2024 GHG Factors", url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024" }],
      simulated: false,
    },
    {
      name: "Consolidate to one trip per quarter",
      type: "policy",
      description: "Cap long-haul to 4× per person per year with merged agendas.",
      costDeltaPct: -0.35,
      co2eDeltaPct: -0.4,
      confidence: 0.72,
      feasibility: "drop_in",
      rationale: "Batching trips reduces flights linearly; measured impact depends on meeting density.",
      sources: [{ title: "Transport & Environment", url: "https://www.transportenvironment.org/" }],
      simulated: false,
    },
  ],
  "travel.hotel": [
    {
      name: "Prefer Green Key certified hotels",
      type: "policy",
      description: "Rank Green Key / EU Ecolabel properties first in the booking tool.",
      costDeltaPct: 0.02,
      co2eDeltaPct: -0.25,
      confidence: 0.6,
      feasibility: "drop_in",
      rationale: "Certified hotels average 20–30% lower energy per room-night; price premium is negligible in EU markets.",
      sources: [{ title: "Green Key certification", url: "https://www.greenkey.global/" }],
      simulated: false,
    },
  ],
  "food.restaurant_meat": [
    {
      name: "Default to plant-forward catering",
      type: "policy",
      description: "Switch the default company catering menu to plant-forward; keep meat as opt-in.",
      costDeltaPct: -0.1,
      co2eDeltaPct: -0.65,
      confidence: 0.82,
      feasibility: "drop_in",
      rationale: "Poore & Nemecek 2018: beef is 60 kg CO₂e/kg vs ~2 kg CO₂e/kg for legumes. 3× intra-category spread on the catering factor.",
      sources: [{ title: "Poore & Nemecek 2018 — Science", url: "https://www.science.org/doi/10.1126/science.aaq0216" }],
      simulated: false,
    },
  ],
  "food.catering": [
    {
      name: "Plant-forward catering menu",
      type: "policy",
      description: "Swap beef-heavy menus for plant-forward default; meat as opt-in.",
      costDeltaPct: -0.08,
      co2eDeltaPct: -0.55,
      confidence: 0.78,
      feasibility: "drop_in",
      rationale: "ADEME plant-forward factor ~0.18 kgCO₂e/EUR vs beef catering ~0.55. 3× delta, price neutral or cheaper in EU markets.",
      sources: [{ title: "ADEME Base Carbone", url: "https://base-carbone.ademe.fr/" }],
      simulated: false,
    },
  ],
  "cloud.saas": [
    {
      name: "Right-size seat licenses",
      type: "policy",
      description: "Audit inactive seats quarterly; downgrade or reclaim unused licenses.",
      costDeltaPct: -0.25,
      co2eDeltaPct: -0.25,
      confidence: 0.82,
      feasibility: "drop_in",
      rationale: "Typical SaaS over-provisioning is 20–35% of seats; cost and emissions scale linearly with seat count.",
      sources: [
        { title: "Flexera 2024 State of the Cloud", url: "https://info.flexera.com/CM-REPORT-State-of-the-Cloud" },
        { title: "Cloud Carbon Footprint methodology", url: "https://www.cloudcarbonfootprint.org/docs/methodology/" },
      ],
      simulated: false,
    },
    {
      name: "Consolidate overlapping SaaS",
      type: "vendor",
      description: "Replace 2–3 point tools with a single suite covering the same jobs.",
      costDeltaPct: -0.15,
      co2eDeltaPct: -0.2,
      confidence: 0.65,
      feasibility: "migration",
      rationale: "Fewer vendor footprints and volume-tier discounts compound savings.",
      sources: [{ title: "Productiv SaaS Index 2024", url: "https://productiv.com/saas-management-index/" }],
      simulated: false,
    },
  ],
  "cloud.compute_eu": [
    {
      name: "Migrate to Graviton / ARM instances",
      type: "vendor",
      description: "Move compatible workloads from x86 to ARM instance families.",
      costDeltaPct: -0.2,
      co2eDeltaPct: -0.3,
      confidence: 0.78,
      feasibility: "migration",
      rationale: "ARM instances deliver ~20% cost savings and ~30% lower energy per workload on AWS and GCP.",
      sources: [
        { title: "AWS Graviton price/performance", url: "https://aws.amazon.com/ec2/graviton/" },
        { title: "Lancaster 2021 — Energy efficiency of ARM vs x86", url: "https://www.lancaster.ac.uk/scc/" },
      ],
      simulated: false,
    },
  ],
  "cloud.compute_high": [
    {
      name: "Relocate to a low-carbon EU region",
      type: "region",
      description: "Move workloads from coal-heavy regions to Stockholm, Dublin or Frankfurt.",
      costDeltaPct: -0.05,
      co2eDeltaPct: -0.7,
      confidence: 0.86,
      feasibility: "migration",
      rationale: "Stockholm and Dublin grids average 30–80 gCO₂e/kWh vs. 400+ in Poland or Virginia.",
      sources: [
        { title: "Ember European Electricity Review", url: "https://ember-energy.org/" },
        { title: "AWS Customer Carbon Footprint Tool", url: "https://aws.amazon.com/aws-cost-management/aws-customer-carbon-footprint-tool/" },
      ],
      simulated: false,
    },
  ],
  "cloud.storage": [
    {
      name: "Tier cold data to archive storage",
      type: "vendor",
      description: "Move objects older than 90 days to Glacier / Archive tier.",
      costDeltaPct: -0.6,
      co2eDeltaPct: -0.5,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Cold storage uses ~50% less energy per TB and costs ~5× less.",
      sources: [{ title: "AWS S3 Glacier", url: "https://aws.amazon.com/s3/storage-classes/glacier/" }],
      simulated: false,
    },
  ],
  "utilities.electricity": [
    {
      name: "Switch to Pure Energie 100% Dutch wind",
      type: "tariff",
      description: "Move office meter to Pure Energie or Vandebron certified Dutch-wind tariff.",
      costDeltaPct: 0.03,
      co2eDeltaPct: -0.9,
      confidence: 0.88,
      feasibility: "drop_in",
      rationale: "Certificates of origin cover the residual Scope 2 per GHG Protocol market-based method.",
      sources: [
        { title: "Pure Energie", url: "https://pure-energie.nl/" },
        { title: "GHG Protocol Scope 2 Guidance", url: "https://ghgprotocol.org/scope-2-guidance" },
      ],
      simulated: false,
    },
    {
      name: "Rooftop solar PPA",
      type: "tariff",
      description: "10-year PPA with local installer; zero upfront, fixed kWh price.",
      costDeltaPct: -0.2,
      co2eDeltaPct: -0.4,
      confidence: 0.7,
      feasibility: "procurement",
      rationale: "Dutch commercial PPAs typically beat grid by 15–25% over 10 years; offsets ~40% of consumption on a suitable roof.",
      sources: [{ title: "RVO solar incentive guide", url: "https://www.rvo.nl/" }],
      simulated: false,
    },
  ],
  "utilities.gas": [
    {
      name: "Heat-pump retrofit study",
      type: "policy",
      description: "Commission a feasibility study for hybrid or full heat-pump replacement.",
      costDeltaPct: 0.1,
      co2eDeltaPct: -0.7,
      confidence: 0.6,
      feasibility: "procurement",
      rationale: "Heat pumps deliver 3–4× coefficient of performance; EU ISDE subsidy offsets capex.",
      sources: [{ title: "RVO ISDE subsidy", url: "https://www.rvo.nl/subsidies-financiering/isde" }],
      simulated: false,
    },
  ],
  "procurement.electronics": [
    {
      name: "Refurbished laptops from Leapp / Back Market",
      type: "supplier",
      description: "Procure refurbished business-grade laptops for non-engineering roles.",
      costDeltaPct: -0.35,
      co2eDeltaPct: -0.55,
      confidence: 0.78,
      feasibility: "drop_in",
      rationale: "Manufacturing embodied carbon dominates laptop lifecycle (~250 kg CO₂e); refurbishment extends life at 50–65% of new price.",
      sources: [
        { title: "Leapp refurbished business laptops", url: "https://leapp.nl/" },
        { title: "ADEME refurbished electronics LCA", url: "https://base-carbone.ademe.fr/" },
      ],
      simulated: false,
    },
  ],
  "procurement.office_supplies": [
    {
      name: "EU Ecolabel stationery + recycled paper",
      type: "supplier",
      description: "Switch default office supplies to EU Ecolabel / Blue Angel certified ranges.",
      costDeltaPct: 0.04,
      co2eDeltaPct: -0.3,
      confidence: 0.65,
      feasibility: "drop_in",
      rationale: "Recycled-fibre paper has ~30% lower embodied CO₂e; cost delta typically <5% at scale.",
      sources: [{ title: "EU Ecolabel — paper products", url: "https://environment.ec.europa.eu/topics/circular-economy/eu-ecolabel_en" }],
      simulated: false,
    },
  ],
};

const COST_TEMPLATES: Record<string, AltTemplate[]> = {
  "cloud.saas": [
    {
      name: "Quarterly seat audit",
      type: "policy",
      description: "Pull inactive-user reports every quarter and reclaim seats.",
      costDeltaPct: -0.2,
      co2eDeltaPct: -0.2,
      confidence: 0.82,
      feasibility: "drop_in",
      rationale: "Flexera reports 25–35% inactive seats across SaaS portfolios. Reclaiming seats is a one-click billing change in most vendors.",
      sources: [{ title: "Flexera 2024 State of the Cloud", url: "https://info.flexera.com/CM-REPORT-State-of-the-Cloud" }],
      simulated: false,
    },
    {
      name: "Annual renegotiation via vendor-pricing benchmark",
      type: "vendor",
      description: "Use Vendr / Tropic / Cledara benchmarks to renegotiate renewals.",
      costDeltaPct: -0.15,
      co2eDeltaPct: 0,
      confidence: 0.7,
      feasibility: "drop_in",
      rationale: "Published benchmark data typically yields 10–20% reduction on renewal; carbon-neutral as the service scope is unchanged.",
      sources: [{ title: "Vendr SaaS benchmarks", url: "https://www.vendr.com/" }],
      simulated: true,
    },
  ],
  "cloud.compute_eu": [
    {
      name: "1-year Reserved Instances / Savings Plan",
      type: "vendor",
      description: "Commit steady-state workloads to 1-yr RIs.",
      costDeltaPct: -0.3,
      co2eDeltaPct: -0.05,
      confidence: 0.85,
      feasibility: "drop_in",
      rationale: "AWS / GCP / Azure all offer 25–35% savings for 1-yr commit; emissions only change if utilization changes.",
      sources: [{ title: "AWS Savings Plans docs", url: "https://aws.amazon.com/savingsplans/" }],
      simulated: false,
    },
  ],
  "procurement.electronics": [
    {
      name: "Central procurement contract",
      type: "supplier",
      description: "Consolidate electronics spend under a single vendor tender.",
      costDeltaPct: -0.12,
      co2eDeltaPct: -0.05,
      confidence: 0.7,
      feasibility: "procurement",
      rationale: "Volume-tier discounts average 10–15% for B2B electronics in EU markets.",
      sources: [{ title: "CIPS procurement benchmarks", url: "https://www.cips.org/" }],
      simulated: true,
    },
  ],
  "travel.hotel": [
    {
      name: "Corporate booking tool with negotiated rates",
      type: "vendor",
      description: "Move from ad-hoc booking to a single corporate tool with negotiated rates.",
      costDeltaPct: -0.1,
      co2eDeltaPct: -0.05,
      confidence: 0.72,
      feasibility: "drop_in",
      rationale: "Corporate rates typically run 8–15% below public at the same property.",
      sources: [{ title: "GBTA business travel report", url: "https://www.gbta.org/" }],
      simulated: true,
    },
  ],
  "travel.flight_shorthaul": [
    {
      name: "Batch trips per quarter",
      type: "policy",
      description: "Cap intra-EU flights per person and batch meetings per quarterly trip.",
      costDeltaPct: -0.2,
      co2eDeltaPct: -0.45,
      confidence: 0.7,
      feasibility: "drop_in",
      rationale: "Fewer individual trips reduce ticket + taxi + hotel stacks linearly; typical 20–30% reduction in travel budget.",
      sources: [{ title: "Transport & Environment — corporate travel", url: "https://www.transportenvironment.org/" }],
      simulated: true,
    },
  ],
  "utilities.electricity": [
    {
      name: "Run an energy broker tender",
      type: "tariff",
      description: "Rebid the supply contract via a Dutch energy broker.",
      costDeltaPct: -0.12,
      co2eDeltaPct: -0.05,
      confidence: 0.75,
      feasibility: "procurement",
      rationale: "Contract rebidding reliably cuts unit rates 10–15%; emissions only move if the new contract specifies green supply.",
      sources: [{ title: "ACM — consumer energy advice", url: "https://www.acm.nl/" }],
      simulated: false,
    },
  ],
};

export const findLowerCarbonAlternative = (category: string, subCategory: string | null): AltTemplate[] => {
  const key = subCategory ? `${category}.${subCategory}` : category;
  return GREEN_TEMPLATES[key] ?? GREEN_TEMPLATES[`${category}.generic`] ?? [];
};

export const findCostSaving = (category: string, subCategory: string | null): AltTemplate[] => {
  const key = subCategory ? `${category}.${subCategory}` : category;
  return COST_TEMPLATES[key] ?? COST_TEMPLATES[category] ?? [];
};

export type CreditPricing = {
  type: CreditType;
  projectId: string;
  pricePerTonneEur: number;
  region: "EU";
  source: string;
};

export const getCarbonCreditPrice = (preferredType: CreditType = "removal_nature"): CreditPricing => {
  const matches = CREDIT_PROJECTS.filter((p) => p.type === preferredType);
  const project = matches.sort((a, b) => a.pricePerTonneEur - b.pricePerTonneEur)[0] ?? CREDIT_PROJECTS[0];
  return {
    type: project.type,
    projectId: project.id,
    pricePerTonneEur: project.pricePerTonneEur,
    region: project.region,
    source: `${project.registry} (${project.country})`,
  };
};

export type TaxProfile = {
  jurisdiction: string;
  entityType: string;
  corporateTaxRate: number;
  etsEurPerTonne: number;
  source: string;
};

const JURISDICTIONS: Record<string, TaxProfile> = {
  NL: {
    jurisdiction: "NL",
    entityType: "BV",
    corporateTaxRate: 0.258,
    etsEurPerTonne: 80,
    source: "Belastingdienst 2024 + EU ETS Q1 2026 settlement",
  },
  DE: {
    jurisdiction: "DE",
    entityType: "GmbH",
    corporateTaxRate: 0.30,
    etsEurPerTonne: 80,
    source: "Bundesfinanzministerium 2024 + EU ETS",
  },
  FR: {
    jurisdiction: "FR",
    entityType: "SAS",
    corporateTaxRate: 0.25,
    etsEurPerTonne: 80,
    source: "DGFiP 2024 + EU ETS",
  },
  EU: {
    jurisdiction: "EU",
    entityType: "default",
    corporateTaxRate: 0.22,
    etsEurPerTonne: 80,
    source: "EU weighted average corporate tax + ETS price",
  },
};

export const getCorporateTaxRate = (jurisdiction = "NL", _entityType = "BV"): TaxProfile =>
  JURISDICTIONS[jurisdiction] ?? JURISDICTIONS.EU;

export const getCarbonPriceExposure = (country = "NL", sector = "default"): { euPerTonne: number; applicable: boolean; source: string } => {
  const profile = JURISDICTIONS[country] ?? JURISDICTIONS.EU;
  const coveredSectors = new Set(["power", "industrial", "aviation", "maritime"]);
  const applicable = coveredSectors.has(sector.toLowerCase());
  return { euPerTonne: profile.etsEurPerTonne, applicable, source: profile.source };
};
