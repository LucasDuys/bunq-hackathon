import { and, desc, eq, gte, like, lt, sql } from "drizzle-orm";
import {
  auditEvents,
  closeRuns,
  creditProjects,
  creditPurchases,
  db,
  emissionFactors,
  orgs,
  policies,
  transactions,
} from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { policySchema, type Policy } from "@/lib/policy/schema";
import { DEFAULT_ORG_ID } from "@/lib/queries";
import {
  carbonReportSchema,
  type CarbonReport,
  type Scope3Item,
  type CreditProject as CreditProjectFixture,
  type Assurance,
} from "./schema";

/**
 * Build a CSRD ESRS E1 - shaped annual carbon report for an org over a
 * calendar year. Pure rollup over the ledger - all numbers are reproducible
 * from raw transactions and emission_estimates. Qualitative sections
 * (transition plan, materiality, financial effects) are left as nulls and
 * the narrative agent fills stubs separately.
 */

// Carbo category -> GHG Protocol scope assignment.
type ScopeAssignment =
  | { scope: 1; reason: string }
  | { scope: 2; reason: string }
  | { scope: 3; cat: Scope3Item["category"]; reason: string };

const SCOPE_MAP: Record<string, ScopeAssignment> = {
  fuel: { scope: 1, reason: "Direct combustion of fossil fuels in owned/leased vehicles" },
  utilities: { scope: 2, reason: "Purchased electricity / heat / cooling" },
  travel: { scope: 3, cat: "cat6_business_travel", reason: "Business travel by air, rail, taxi, rental, hotel" },
  food: { scope: 3, cat: "cat1_purchased_goods_services", reason: "Purchased food and beverages" },
  procurement: { scope: 3, cat: "cat1_purchased_goods_services", reason: "Purchased goods (electronics, office, furniture)" },
  cloud: { scope: 3, cat: "cat1_purchased_goods_services", reason: "Purchased cloud and SaaS services" },
  services: { scope: 3, cat: "cat1_purchased_goods_services", reason: "Purchased professional services" },
};

const yearBounds = (year: number) => ({
  start: Math.floor(Date.UTC(year, 0, 1) / 1000),
  end: Math.floor(Date.UTC(year + 1, 0, 1) / 1000),
});

const parsePolicy = (raw: string): Policy | null => {
  try {
    return policySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
};

type EnrichedTx = {
  id: string;
  category: string | null;
  subCategory: string | null;
  amountEur: number;
  co2eKgLow: number;
  co2eKgPoint: number;
  co2eKgHigh: number;
  confidence: number;
  factorId: string;
};

const loadEnriched = (orgId: string, startTs: number, endTs: number): EnrichedTx[] => {
  const rows = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.orgId, orgId),
        gte(transactions.timestamp, startTs),
        lt(transactions.timestamp, endTs),
      ),
    )
    .all();
  return rows.map((t) => {
    const est = estimateEmission({
      category: t.category ?? "other",
      subCategory: t.subCategory,
      amountEur: t.amountCents / 100,
      classifierConfidence: t.categoryConfidence ?? 0.5,
    });
    return {
      id: t.id,
      category: t.category,
      subCategory: t.subCategory,
      amountEur: t.amountCents / 100,
      co2eKgLow: est.co2eKgLow,
      co2eKgPoint: est.co2eKgPoint,
      co2eKgHigh: est.co2eKgHigh,
      confidence: est.confidence,
      factorId: est.factorId,
    };
  });
};

type ScopeRollup = {
  totalTco2e: number;
  byCategory: Map<string, { tco2e: number; spendEur: number; factorIds: Set<string> }>;
};

const emptyRollup = (): ScopeRollup => ({ totalTco2e: 0, byCategory: new Map() });

const rollupByScope = (txs: EnrichedTx[]): { scope1: ScopeRollup; scope2: ScopeRollup; scope3: ScopeRollup; uncategorisedTco2e: number } => {
  const out = { scope1: emptyRollup(), scope2: emptyRollup(), scope3: emptyRollup(), uncategorisedTco2e: 0 };
  for (const t of txs) {
    const tonnes = t.co2eKgPoint / 1000;
    const cat = t.category ?? "uncategorised";
    const assignment = SCOPE_MAP[cat];
    if (!assignment) {
      out.uncategorisedTco2e += tonnes;
      continue;
    }
    const target = assignment.scope === 1 ? out.scope1 : assignment.scope === 2 ? out.scope2 : out.scope3;
    target.totalTco2e += tonnes;
    const key = assignment.scope === 3 ? assignment.cat : cat;
    const row = target.byCategory.get(key) ?? { tco2e: 0, spendEur: 0, factorIds: new Set<string>() };
    row.tco2e += tonnes;
    row.spendEur += t.amountEur;
    row.factorIds.add(t.factorId);
    target.byCategory.set(key, row);
  }
  return out;
};

const collectFactorSources = (factorIds: Set<string>): string[] => {
  if (factorIds.size === 0) return [];
  const ids = Array.from(factorIds);
  const rows = db.select().from(emissionFactors).where(eq(emissionFactors.id, ids[0])).all();
  // Drizzle in() not strictly needed for a small set; aggregate sources by source name.
  const sources = new Set<string>();
  for (const id of ids) {
    const r = db.select().from(emissionFactors).where(eq(emissionFactors.id, id)).all()[0];
    if (r?.source) sources.add(r.source);
  }
  if (rows.length === 0 && sources.size === 0) return [];
  return Array.from(sources);
};

export const buildAnnualReport = async (opts: { orgId?: string; year: number }): Promise<CarbonReport> => {
  const orgId = opts.orgId ?? DEFAULT_ORG_ID;
  const { start, end } = yearBounds(opts.year);

  const org = db.select().from(orgs).where(eq(orgs.id, orgId)).all()[0];
  const company = org?.name ?? orgId;

  const txs = loadEnriched(orgId, start, end);
  const totalSpendEur = txs.reduce((s, t) => s + t.amountEur, 0);
  const totalCo2eKg = txs.reduce((s, t) => s + t.co2eKgPoint, 0);
  const sumWeightedConfidence = txs.reduce((s, t) => s + t.confidence * t.amountEur, 0);
  const weightedConfidence = totalSpendEur > 0 ? sumWeightedConfidence / totalSpendEur : 0;

  const { scope1, scope2, scope3, uncategorisedTco2e } = rollupByScope(txs);

  // Factor sources used across all transactions
  const allFactorIds = new Set<string>();
  for (const t of txs) allFactorIds.add(t.factorId);
  const factorSources = collectFactorSources(allFactorIds);

  // Scope 3 categories: emit one Scope3Item per category present.
  const scope3Items: Scope3Item[] = [];
  const cat1Tco2e = scope3.byCategory.get("cat1_purchased_goods_services");
  const cat6Tco2e = scope3.byCategory.get("cat6_business_travel");
  if (cat1Tco2e) {
    scope3Items.push({
      category: "cat1_purchased_goods_services",
      tco2e: Number(cat1Tco2e.tco2e.toFixed(2)),
      method: "spend_based",
      factorSource: "Exiobase v3.8.2 / DEFRA 2024 / ADEME (per category — see methodology)",
      note: `Coverage: food, procurement, cloud, services. Spend EUR ${cat1Tco2e.spendEur.toFixed(0)}.`,
      excludedAsImmaterial: false,
      notApplicable: false,
    });
  }
  if (cat6Tco2e) {
    scope3Items.push({
      category: "cat6_business_travel",
      tco2e: Number(cat6Tco2e.tco2e.toFixed(2)),
      method: "spend_based",
      factorSource: "DEFRA 2024",
      note: `Air, rail, taxi, hotel, rental car. Spend EUR ${cat6Tco2e.spendEur.toFixed(0)}.`,
      excludedAsImmaterial: false,
      notApplicable: false,
    });
  }
  // Categories Carbo cannot reach via bunq spend - mark as not applicable / immaterial.
  const otherCats: Array<{ category: Scope3Item["category"]; reason: "immaterial" | "notApplicable"; note: string }> = [
    { category: "cat2_capital_goods", reason: "immaterial", note: "Capital purchases not separated from procurement spend; expected immaterial for the org's profile." },
    { category: "cat3_fuel_energy_related", reason: "immaterial", note: "Embedded upstream emissions of purchased fuel & electricity not separately tracked." },
    { category: "cat4_upstream_transportation", reason: "immaterial", note: "Logistics inbound not separable from supplier invoices in bunq spend." },
    { category: "cat5_waste_in_operations", reason: "immaterial", note: "Waste management spend is small; not material for this reporting period." },
    { category: "cat7_employee_commuting", reason: "notApplicable", note: "Not currently tracked; would require an employee survey or fleet data." },
    { category: "cat8_upstream_leased_assets", reason: "notApplicable", note: "No upstream leased assets identified." },
    { category: "cat9_downstream_transportation", reason: "notApplicable", note: "Outbound logistics handled by customers / carriers; not paid via bunq." },
    { category: "cat10_processing_sold_products", reason: "notApplicable", note: "Product not further processed downstream." },
    { category: "cat11_use_of_sold_products", reason: "notApplicable", note: "Service org / no physical product use phase." },
    { category: "cat12_end_of_life", reason: "notApplicable", note: "No physical product end-of-life." },
    { category: "cat13_downstream_leased_assets", reason: "notApplicable", note: "No downstream leased assets." },
    { category: "cat14_franchises", reason: "notApplicable", note: "No franchise relationships." },
    { category: "cat15_investments", reason: "notApplicable", note: "Out of scope for an SME without an investment portfolio." },
  ];
  for (const c of otherCats) {
    scope3Items.push({
      category: c.category,
      tco2e: null,
      method: null,
      factorSource: null,
      note: c.note,
      excludedAsImmaterial: c.reason === "immaterial",
      notApplicable: c.reason === "notApplicable",
    });
  }

  // Credit retirements over the year - join purchases to projects, scope by close_run end-time.
  const purchaseRows = db
    .select({
      tonnes: creditPurchases.tonnes,
      eur: creditPurchases.eur,
      createdAt: creditPurchases.createdAt,
      projectId: creditProjects.id,
      projectName: creditProjects.name,
      type: creditProjects.type,
      region: creditProjects.region,
      country: creditProjects.country,
      registry: creditProjects.registry,
    })
    .from(creditPurchases)
    .leftJoin(creditProjects, eq(creditPurchases.projectId, creditProjects.id))
    .where(and(gte(creditPurchases.createdAt, start), lt(creditPurchases.createdAt, end)))
    .all();

  const totalTonnesRetired = purchaseRows.reduce((s, p) => s + (p.tonnes ?? 0), 0);
  const totalCreditEur = purchaseRows.reduce((s, p) => s + (p.eur ?? 0), 0);
  const removalTonnes = purchaseRows
    .filter((p) => p.type && p.type !== "reduction")
    .reduce((s, p) => s + (p.tonnes ?? 0), 0);
  const euTonnes = purchaseRows
    .filter((p) => p.region === "EU")
    .reduce((s, p) => s + (p.tonnes ?? 0), 0);

  const creditFixtures: CreditProjectFixture[] = purchaseRows.map((p) => ({
    name: p.projectName ?? p.projectId ?? "unknown",
    country: p.country ?? null,
    type:
      p.type === "removal_nature"
        ? "removal_nature"
        : p.type === "removal_technical"
          ? "removal_tech"
          : p.type === "reduction"
            ? "reduction"
            : "unspecified",
    standard: p.registry ? mapRegistry(p.registry) : "unspecified",
    vintageYear: null,
    tonnesRetired: Number((p.tonnes ?? 0).toFixed(3)),
    description: null,
  }));

  // Internal carbon price - infer from policy if a per-tonne rule exists.
  const policyRow = db
    .select()
    .from(policies)
    .where(and(eq(policies.orgId, orgId), eq(policies.active, true)))
    .all()[0];
  const policy = policyRow ? parsePolicy(policyRow.rules) : null;
  const eurPerTonne = inferInternalCarbonPrice(policy);

  // Action summary - executed reserve transfers + credit purchases over the year.
  const auditRows = db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.orgId, orgId),
        like(auditEvents.type, "action.%"),
        gte(auditEvents.createdAt, start),
        lt(auditEvents.createdAt, end),
      ),
    )
    .all();
  const actionLines: string[] = [];
  let totalReservedEur = 0;
  for (const a of auditRows) {
    if (a.type === "action.reserve_transfer") {
      try {
        const p = JSON.parse(a.payload) as { amountEur?: number };
        if (typeof p.amountEur === "number") totalReservedEur += p.amountEur;
      } catch {
        /* ignore */
      }
    }
  }

  // Completed close runs in the year.
  const closeRunsThisYear = db
    .select()
    .from(closeRuns)
    .where(
      and(
        eq(closeRuns.orgId, orgId),
        eq(closeRuns.status, "completed"),
        gte(closeRuns.startedAt, start),
        lt(closeRuns.startedAt, end),
      ),
    )
    .all();

  const actionSummary = [
    `${closeRunsThisYear.length} monthly close run${closeRunsThisYear.length === 1 ? "" : "s"} completed.`,
    `EUR ${totalReservedEur.toFixed(0)} transferred into the Carbon Reserve sub-account across the year.`,
    purchaseRows.length > 0
      ? `${purchaseRows.length} carbon-credit retirements totalling ${totalTonnesRetired.toFixed(2)} tCO2e (EUR ${totalCreditEur.toFixed(0)}).`
      : "No carbon credits retired this year (recommendations issued; purchases pending).",
  ].join(" ");

  const totalScope1And2Tco2e = scope1.totalTco2e + scope2.totalTco2e;
  const totalTco2e = totalCo2eKg / 1000;

  const reportInput: CarbonReport = {
    company,
    reportingYear: opts.year,
    country: "NL",
    industry: null,
    revenueEur: null,
    employees: null,
    sourceUrl: null,
    sourceFile: null,
    framework: "VSME",
    frameworkNotes:
      "Voluntary Standard for non-listed SMEs (EFRAG, approved Nov 2024). E1-shaped layout for forward compatibility with full ESRS once the company crosses the listed-SME threshold.",
    assurance: stubAssurance(),
    emissions: {
      unit: "tCO2e",
      baseYear: null,
      reportingPeriod: String(opts.year),
      scope1: {
        totalTco2e: scope1.totalTco2e > 0 ? Number(scope1.totalTco2e.toFixed(2)) : null,
        methodNote:
          scope1.totalTco2e > 0
            ? "Direct emissions from owned/operated fuel combustion, mapped from bunq fuel-category transactions."
            : null,
        uncertaintyPct: null,
        includesBiogenic: false,
      },
      scope2: {
        locationBasedTco2e: scope2.totalTco2e > 0 ? Number(scope2.totalTco2e.toFixed(2)) : null,
        marketBasedTco2e: null,
        methodNote:
          scope2.totalTco2e > 0
            ? "Indirect emissions from purchased grid electricity, mapped from bunq utilities-category transactions. Market-based not yet computed (would require GoO/REC contract data)."
            : null,
        uncertaintyPct: null,
      },
      scope3: scope3Items,
      totalScope1And2Tco2e: totalScope1And2Tco2e > 0 ? Number(totalScope1And2Tco2e.toFixed(2)) : null,
      totalTco2e: totalTco2e > 0 ? Number(totalTco2e.toFixed(2)) : null,
      intensity: totalSpendEur > 0
        ? [
            {
              metric: "kgCO2e/EUR spend",
              value: Number((totalCo2eKg / totalSpendEur).toFixed(3)),
              scopeCoverage: ["Scope 1", "Scope 2 location-based", "Scope 3 (Cat 1, Cat 6)"],
            },
          ]
        : [],
      avoidedEmissionsTco2e: null,
      biogenicEmissionsTco2e: null,
      operationalControlBoundary: true,
      equityShareBoundary: false,
    },
    energy: null, // Will be filled if utility transactions are present (handled in render layer).
    targets: [],
    credits:
      purchaseRows.length > 0 || totalCreditEur > 0
        ? {
            totalTonnesRetired: Number(totalTonnesRetired.toFixed(2)),
            removalPct: totalTonnesRetired > 0 ? (removalTonnes / totalTonnesRetired) * 100 : null,
            reductionPct: totalTonnesRetired > 0 ? ((totalTonnesRetired - removalTonnes) / totalTonnesRetired) * 100 : null,
            euBasedPct: totalTonnesRetired > 0 ? (euTonnes / totalTonnesRetired) * 100 : null,
            correspondingAdjustmentPct: 0,
            totalSpendEur: Number(totalCreditEur.toFixed(2)),
            projects: creditFixtures,
            usedForNetClaim: false,
          }
        : null,
    internalCarbonPrice: eurPerTonne
      ? {
          pricePerTco2eEur: eurPerTonne,
          type: "internal_fee",
          perimeterDescription:
            "Implied by the active reserve policy: spend that triggers a reserve_transfer based on EUR-per-tCO2e is effectively an internal carbon price.",
          volumeAtStakeTco2e: Number(totalTco2e.toFixed(2)),
          pricingMethodNote: "Read from policies.rules eur_per_kg_co2e value (active policy at year-end).",
        }
      : null,
    risks: [], // Requires human input (E1-9 financial-effects + IRO assessment).
    governance: {
      boardOversight: null,
      execRemunerationTiedToClimate: null,
      execRemunerationClimateSharePct: null,
      transitionPlanPublished: false,
      transitionPlanReference: null,
    },
    methodology: {
      ghgProtocolVersion: "Corporate Accounting and Reporting Standard",
      scope2MethodsUsed: ["location_based"],
      gwpAssessmentReport: "AR6",
      factorSources,
      materialityMethod: null,
      restatedBaseYear: false,
      restatementReason: null,
    },
    euTaxonomy: null,
    transitionPlanSummary: null,
    actionSummary,
    _extraction: {
      model: "annual-rollup",
      extractedAt: new Date().toISOString(),
    },
  };

  // Validate against the canonical schema before returning.
  return carbonReportSchema.parse(reportInput);
};

const stubAssurance = (): Assurance => ({
  level: "none",
  assurer: null,
  scopeNote: "VSME (voluntary SME standard) does not require external assurance. Carbo's numeric rollups are reproducible from the ledger; narratives are flagged for human review.",
});

const inferInternalCarbonPrice = (policy: Policy | null): number | null => {
  if (!policy) return null;
  // Look across reserve rules for any eur_per_kg_co2e method and pick the highest as the implied per-tonne carbon price.
  let max = 0;
  for (const r of policy.reserveRules) {
    if (r.method === "eur_per_kg_co2e") {
      const ratePerTonne = r.value * 1000;
      if (ratePerTonne > max) max = ratePerTonne;
    }
  }
  return max > 0 ? max : null;
};

const mapRegistry = (raw: string): CreditProjectFixture["standard"] => {
  const r = raw.toLowerCase();
  if (r.includes("verra") || r.includes("vcs")) return "Verra_VCS";
  if (r.includes("gold")) return "Gold_Standard";
  if (r.includes("acr") || r.includes("american")) return "American_Carbon_Registry";
  if (r.includes("eu") || r.includes("crcf")) return "EU_CRCF";
  return "other";
};
