import { DEFAULT_POLICY, type Policy, type ReserveRule } from "@/lib/policy/schema";
import type { CompanyProfile } from "./profile";

/**
 * Turns a (possibly partial) CompanyProfile into a calibrated Policy. Used as
 * a deterministic fallback when the LLM drafter fails validation and as the
 * base that the Sonnet drafter is asked to adjust. All numbers here are
 * defensible defaults — they won't embarrass us in front of an auditor.
 */

type BuiltPolicy = Policy & { notes: string[] };

const AMBITION_MULT: Record<string, number> = {
  starter: 0.5,
  balanced: 1.0,
  aggressive: 1.5,
};

const TRAVEL_MULT: Record<string, number> = {
  rare: 0.6,
  monthly: 1.0,
  weekly: 1.4,
  product: 1.8,
};

const CLOUD_MULT: Record<string, number> = {
  light_saas: 0.6,
  standard: 1.0,
  heavy_compute: 1.8,
};

const rule = (category: string, method: ReserveRule["method"], value: number): ReserveRule => ({
  category,
  method,
  value: Number(value.toFixed(4)),
});

const round2 = (n: number) => Number(n.toFixed(2));

const firstDefined = <T>(...xs: Array<T | undefined>): T | undefined => {
  for (const x of xs) if (x !== undefined) return x;
  return undefined;
};

const removalMix = (profile: CompanyProfile): number => {
  switch (profile.removalMix) {
    case "high_removal":
      return 0.8;
    case "reduction_heavy":
      return 0.4;
    case "balanced":
      return 0.6;
    default:
      return 0.7;
  }
};

const creditRegion = (profile: CompanyProfile): "EU" | "ANY" => {
  if (profile.creditPreference === "global_cheapest") return "ANY";
  return "EU";
};

const creditTypes = (profile: CompanyProfile): Policy["creditPreference"]["types"] => {
  switch (profile.creditPreference) {
    case "eu_removals_only":
      return ["removal_technical", "removal_nature"];
    case "eu_mix":
      return ["removal_technical", "removal_nature", "reduction"];
    case "global_cheapest":
      return ["removal_nature", "reduction"];
    default:
      return ["removal_technical", "removal_nature"];
  }
};

const approvalDefault = (profile: CompanyProfile): number => {
  const explicit = profile.approvalThresholdEur;
  if (explicit !== undefined) return explicit;
  switch (profile.revenueBand) {
    case "lt_1m":
      return 100;
    case "1_10m":
      return 500;
    case "10_50m":
      return 1500;
    case "50m_plus":
      return 5000;
    default:
      return 500;
  }
};

const monthlyCapDefault = (profile: CompanyProfile): number => {
  const explicit = profile.maxReservePerMonthEur;
  if (explicit !== undefined) return explicit;
  switch (profile.revenueBand) {
    case "lt_1m":
      return 1000;
    case "1_10m":
      return 5000;
    case "10_50m":
      return 20000;
    case "50m_plus":
      return 100000;
    default:
      return 5000;
  }
};

export const buildPolicyFromProfile = (profile: CompanyProfile): BuiltPolicy => {
  const amb = AMBITION_MULT[profile.ambition ?? "balanced"] ?? 1.0;
  const travelMult = TRAVEL_MULT[profile.travelIntensity ?? "monthly"] ?? 1.0;
  const cloudMult = CLOUD_MULT[profile.cloudIntensity ?? "standard"] ?? 1.0;
  const notes: string[] = [];

  const base = {
    travel: 0.03,
    food: 0.02,
    procurement: 0.015,
    cloud: 0.01,
    services: 0.01,
  };

  const reserveRules: ReserveRule[] = [];

  // Travel
  const travelV = base.travel * amb * travelMult;
  reserveRules.push(rule("travel", "pct_spend", travelV));
  if (travelMult > 1.3) notes.push(`Travel reserve lifted for high travel intensity (${(travelV * 100).toFixed(1)}%).`);

  // Food
  reserveRules.push(rule("food", "pct_spend", base.food * amb));

  // Procurement — retail / e-commerce sells physical goods so procurement hits harder
  let procV = base.procurement * amb;
  if (profile.sector === "retail_ecommerce" || profile.sector === "manufacturing") {
    procV *= 1.3;
    notes.push("Procurement reserve raised 30% for physical-goods sector.");
  }
  reserveRules.push(rule("procurement", "pct_spend", procV));

  // Cloud
  let cloudV = base.cloud * amb * cloudMult;
  if (profile.sector === "software_saas") cloudV *= 1.2;
  reserveRules.push(rule("cloud", "pct_spend", cloudV));
  if (cloudMult > 1.5) notes.push(`Cloud reserve tuned for heavy compute workload (${(cloudV * 100).toFixed(1)}%).`);

  // Services
  reserveRules.push(rule("services", "pct_spend", base.services * amb));

  // Utilities + fuel — only if the company actually has physical presence
  if (profile.physicalFootprint && profile.physicalFootprint !== "fully_remote") {
    reserveRules.push(rule("utilities", "eur_per_kg_co2e", 0.10));
    notes.push("Added utilities rule (EUR per kg CO₂e) for offices / facilities.");
  } else {
    notes.push("Fully remote — no utilities or fuel rule added.");
  }
  if (profile.ownedVehicles && profile.ownedVehicles !== "none") {
    reserveRules.push(rule("fuel", "eur_per_kg_co2e", 0.10));
    notes.push("Added fuel rule for owned vehicles — ties reserve to Scope 1 combustion.");
  }

  // Catch-all fallback — always present
  reserveRules.push(rule("*", "eur_per_kg_co2e", 0.08 * amb));

  const policy: Policy = {
    reserveRules,
    approvalThresholdEur: round2(approvalDefault(profile)),
    creditPreference: {
      region: creditRegion(profile),
      types: creditTypes(profile),
      minRemovalPct: Number(removalMix(profile).toFixed(2)),
    },
    maxReservePerMonthEur: round2(monthlyCapDefault(profile)),
  };

  return { ...policy, notes };
};

export const creditShortlistFromProfile = (profile: CompanyProfile): string[] => {
  const region = creditRegion(profile);
  const mix = removalMix(profile);
  if (region === "ANY") {
    return ["reforestation-ee-baltic", "peatland-ie-midlands"];
  }
  if (mix >= 0.7) {
    return ["biochar-nl-gelderland", "peatland-ie-midlands", "reforestation-ee-baltic"];
  }
  return ["peatland-ie-midlands", "reforestation-ee-baltic", "biochar-nl-gelderland"];
};

/**
 * Merges an uploaded partial policy onto a calibrated baseline. Fields the user
 * uploaded override the calibration. Used by the drafter when track="upload" or
 * track="mix" so the user's document is respected.
 */
export const mergePartialPolicy = (
  base: Policy,
  partial: Partial<Policy> & { reserveRules?: Array<Partial<ReserveRule> & { category?: string }> },
): Policy => {
  const merged: Policy = {
    ...base,
    approvalThresholdEur: firstDefined(partial.approvalThresholdEur, base.approvalThresholdEur) ?? base.approvalThresholdEur,
    maxReservePerMonthEur:
      firstDefined(partial.maxReservePerMonthEur, base.maxReservePerMonthEur) ?? base.maxReservePerMonthEur,
    creditPreference: {
      region: firstDefined(partial.creditPreference?.region, base.creditPreference.region) ?? "EU",
      types: partial.creditPreference?.types ?? base.creditPreference.types,
      minRemovalPct:
        firstDefined(partial.creditPreference?.minRemovalPct, base.creditPreference.minRemovalPct) ??
        base.creditPreference.minRemovalPct,
    },
    reserveRules: base.reserveRules,
  };

  if (partial.reserveRules && partial.reserveRules.length > 0) {
    const byCat = new Map<string, ReserveRule>();
    for (const r of base.reserveRules) byCat.set(r.category, r);
    for (const r of partial.reserveRules) {
      if (!r.category || !r.method || r.value === undefined) continue;
      const method = r.method as ReserveRule["method"];
      if (method !== "pct_spend" && method !== "eur_per_kg_co2e" && method !== "flat_eur") continue;
      byCat.set(r.category, { category: r.category, method, value: r.value });
    }
    merged.reserveRules = Array.from(byCat.values());
  }
  return merged;
};

export const POLICY_FALLBACK = DEFAULT_POLICY;
