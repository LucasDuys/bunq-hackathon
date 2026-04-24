import { and, desc, eq, gte, lt } from "drizzle-orm";
import { closeRuns, db, orgs, transactions } from "@/lib/db/client";
import { totalBudgetMix } from "@/lib/credits/projects";
import { estimateEmission } from "@/lib/emissions/estimate";
import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import { carbonBriefingSchema, type CarbonBriefing, type Anomaly, type SwapSuggestion, type Period } from "./briefing-schema";
import { DEFAULT_ORG_ID, monthBounds, currentMonth } from "@/lib/queries";

type EnrichedTx = {
  id: string;
  merchantNorm: string;
  merchantRaw: string;
  category: string | null;
  subCategory: string | null;
  amountEur: number;
  co2eKg: number;
  confidence: number;
};

type Aggregate = {
  totalCo2eKg: number;
  totalSpendEur: number;
  txCount: number;
  weightedConfidence: number;
};

type MerchantRow = {
  merchantNorm: string;
  merchantRaw: string;
  category: string | null;
  txCount: number;
  spendEur: number;
  co2eKg: number;
};

type CategoryRow = {
  category: string;
  spendEur: number;
  co2eKg: number;
};

const periodFor = (kind: "month", label: string): Period => {
  const { start, end } = monthBounds(label);
  const [y, m] = label.split("-").map(Number);
  const priorDate = new Date(Date.UTC(y, m - 2, 1));
  const priorLabel = `${priorDate.getUTCFullYear()}-${String(priorDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return { kind, label, startTs: start, endTs: end, priorLabel };
};

/**
 * Fetch transactions for the period and compute emissions inline (does not depend on close_runs).
 * This makes the briefing meaningful for any month even if no close has been executed.
 */
const loadEnriched = (orgId: string, startTs: number, endTs: number): EnrichedTx[] => {
  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, startTs), lt(transactions.timestamp, endTs)))
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
      merchantNorm: t.merchantNorm,
      merchantRaw: t.merchantRaw,
      category: t.category,
      subCategory: t.subCategory,
      amountEur: t.amountCents / 100,
      co2eKg: est.co2eKgPoint,
      confidence: est.confidence,
    };
  });
};

const aggregate = (txs: EnrichedTx[]): Aggregate => {
  const totalCo2eKg = txs.reduce((s, t) => s + t.co2eKg, 0);
  const totalSpendEur = txs.reduce((s, t) => s + t.amountEur, 0);
  const sumWeighted = txs.reduce((s, t) => s + t.confidence * t.amountEur, 0);
  const weightedConfidence = totalSpendEur > 0 ? sumWeighted / totalSpendEur : 0;
  return { totalCo2eKg, totalSpendEur, txCount: txs.length, weightedConfidence };
};

const topMerchants = (txs: EnrichedTx[], limit = 5): MerchantRow[] => {
  const byMerchant = new Map<string, MerchantRow>();
  for (const t of txs) {
    const row = byMerchant.get(t.merchantNorm) ?? {
      merchantNorm: t.merchantNorm,
      merchantRaw: t.merchantRaw,
      category: t.category,
      txCount: 0,
      spendEur: 0,
      co2eKg: 0,
    };
    row.txCount += 1;
    row.spendEur += t.amountEur;
    row.co2eKg += t.co2eKg;
    byMerchant.set(t.merchantNorm, row);
  }
  return Array.from(byMerchant.values())
    .sort((a, b) => b.co2eKg - a.co2eKg)
    .slice(0, limit);
};

const topCategories = (txs: EnrichedTx[], limit = 5): CategoryRow[] => {
  const byCategory = new Map<string, CategoryRow>();
  for (const t of txs) {
    const cat = t.category ?? "uncategorised";
    const row = byCategory.get(cat) ?? { category: cat, spendEur: 0, co2eKg: 0 };
    row.spendEur += t.amountEur;
    row.co2eKg += t.co2eKg;
    byCategory.set(cat, row);
  }
  return Array.from(byCategory.values())
    .sort((a, b) => b.co2eKg - a.co2eKg)
    .slice(0, limit);
};

const detectAnomalies = (current: MerchantRow[], priorAll: MerchantRow[]): Anomaly[] => {
  const priorByMerchant = new Map(priorAll.map((p) => [p.merchantNorm, p]));
  const out: Anomaly[] = [];
  for (const c of current) {
    const p = priorByMerchant.get(c.merchantNorm);
    if (!p) {
      if (c.co2eKg >= 50) {
        out.push({
          kind: "new_high_emitter",
          subject: c.merchantRaw,
          deltaPct: null,
          currentCo2eKg: c.co2eKg,
          priorCo2eKg: 0,
          message: `${c.merchantRaw} is new this period — ${Math.round(c.co2eKg)} kg CO₂e on ${c.txCount} tx.`,
        });
      }
      continue;
    }
    if (p.co2eKg < 5) continue;
    const deltaPct = ((c.co2eKg - p.co2eKg) / p.co2eKg) * 100;
    if (deltaPct >= 50 && c.co2eKg - p.co2eKg >= 20) {
      out.push({
        kind: "merchant_surge",
        subject: c.merchantRaw,
        deltaPct,
        currentCo2eKg: c.co2eKg,
        priorCo2eKg: p.co2eKg,
        message: `${c.merchantRaw} CO₂e up ${Math.round(deltaPct)}% vs ${priorByMerchant.size > 0 ? "last period" : "prior"} (${Math.round(p.co2eKg)} → ${Math.round(c.co2eKg)} kg).`,
      });
    }
  }
  return out.slice(0, 5);
};

/**
 * Category-keyed swap rules. Categories match Carbo's classifier output
 * (lib/factors/index.ts + lib/classify/rules.ts).
 */
const SWAP_RULES: Record<string, (row: CategoryRow) => SwapSuggestion | null> = {
  food: (r) => ({
    from: r.category,
    to: "Plant-forward menu choice on team meals",
    expectedSavingKg: r.co2eKg * 0.4,
    expectedSavingPct: 40,
    rationale: "Beef-heavy meals carry ~25 kg CO₂e/kg vs ~3-5 kg for plant-based equivalents. Reducing red-meat share to 50% on team meals cuts category footprint by ~40%.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
  travel: (r) => ({
    from: r.category,
    to: "Rail for AMS-FRA / AMS-BCN / AMS-CDG / AMS-BRU; rideshare → public transport > 30 km",
    expectedSavingKg: r.co2eKg * 0.55,
    expectedSavingPct: 55,
    rationale: "Short-haul flights (<1500 km) emit 8-10× rail per pax-km. Switching < 1500 km legs to rail saves ~85% on those flights; rideshare per pax-km is ~5× rail.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
  fuel: (r) => ({
    from: r.category,
    to: "Electrify fleet, contract renewable charging",
    expectedSavingKg: r.co2eKg * 0.7,
    expectedSavingPct: 70,
    rationale: "EVs charged on Dutch grid emit ~70% less per km than diesel. Lease electrification typically pays back in 24 months at current TCO.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
  utilities: (r) => ({
    from: r.category,
    to: "Switch electricity contract to 100% renewable (Greenchoice / Pure Energie)",
    expectedSavingKg: r.co2eKg * 0.85,
    expectedSavingPct: 85,
    rationale: "Market-based Scope 2 drops to ~0 when matched with EU-issued GoOs; cost delta is typically <5% on commercial contracts.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
  procurement: (r) => ({
    from: r.category,
    to: "Refurbished electronics + consolidated bulk orders",
    expectedSavingKg: r.co2eKg * 0.45,
    expectedSavingPct: 45,
    rationale: "Manufacturing dominates electronics Cat-1 emissions (>70%). Refurb units have 60-70% lower embodied CO₂e per device; bulk consolidation cuts logistics emissions further.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
  cloud: (r) => ({
    from: r.category,
    to: "Move primary AWS workload to eu-north-1 (Stockholm) or eu-central-1 carbon-neutral",
    expectedSavingKg: r.co2eKg * 0.5,
    expectedSavingPct: 50,
    rationale: "AWS Stockholm and Frankfurt are >95% renewable per AWS sustainability disclosures vs ~60% for ireland and us-east-1.",
    currentCo2eKg: r.co2eKg,
    currentSpendEur: r.spendEur,
  }),
};

const buildSwaps = (categories: CategoryRow[], maxOut = 3): SwapSuggestion[] => {
  const out: SwapSuggestion[] = [];
  for (const c of categories) {
    if (out.length >= maxOut) break;
    const rule = SWAP_RULES[c.category];
    if (!rule) continue;
    const swap = rule(c);
    if (swap && swap.expectedSavingKg >= 5) out.push(swap);
  }
  return out;
};

const buildNarrative = async (briefing: Omit<CarbonBriefing, "narrative">): Promise<string> => {
  const { period, summary, topCategories: cats, anomalies, swaps } = briefing;
  if (isAnthropicMock() || !process.env.ANTHROPIC_API_KEY) {
    const deltaText = summary.deltaCo2ePct === null
      ? "no prior-period baseline"
      : `${summary.deltaCo2ePct >= 0 ? "+" : ""}${summary.deltaCo2ePct.toFixed(0)}% vs ${period.priorLabel}`;
    const topCat = cats[0];
    const lines: string[] = [
      `In ${period.label}, ${summary.txCount} transactions produced ${summary.totalCo2eKg.toFixed(0)} kg CO₂e (${deltaText}) at ${(summary.confidence * 100).toFixed(0)}% confidence.`,
    ];
    if (topCat) lines.push(`${topCat.category} is the largest driver at ${topCat.co2eKg.toFixed(0)} kg (${topCat.sharePct.toFixed(0)}% of total).`);
    if (anomalies.length > 0) lines.push(`${anomalies.length} ${anomalies.length === 1 ? "anomaly" : "anomalies"} flagged this period.`);
    if (swaps.length > 0) lines.push(`Top swap opportunity: ${swaps[0].to} (saves ~${swaps[0].expectedSavingKg.toFixed(0)} kg).`);
    return lines.join(" ");
  }
  const client = anthropic();
  const prompt = `Write a single-paragraph (60-90 words) plain-English carbon briefing for ${period.label}. Tone: confident, neutral, slightly forward-looking. No emoji. Inputs:
- Total: ${summary.totalCo2eKg.toFixed(0)} kg CO2e from ${summary.txCount} transactions, EUR ${summary.totalSpendEur.toFixed(0)} spend
- Confidence: ${(summary.confidence * 100).toFixed(0)}%
- Change vs ${period.priorLabel}: ${summary.deltaCo2ePct === null ? "no prior baseline" : `${summary.deltaCo2ePct.toFixed(0)}%`}
- Top categories: ${cats.slice(0, 3).map((c) => `${c.category} (${c.co2eKg.toFixed(0)} kg, ${c.sharePct.toFixed(0)}%)`).join(", ")}
- Anomalies (${anomalies.length}): ${anomalies.slice(0, 2).map((a) => a.message).join(" | ") || "none"}
- Top swap: ${swaps[0]?.rationale ?? "no obvious swap"}`;
  const msg = await client.messages.create({ model: MODEL_SONNET, max_tokens: 300, messages: [{ role: "user", content: prompt }] });
  return msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim();
};

export const buildBriefing = async (opts: { orgId?: string; month?: string } = {}): Promise<CarbonBriefing> => {
  const orgId = opts.orgId ?? DEFAULT_ORG_ID;
  const month = opts.month ?? currentMonth();
  const period = periodFor("month", month);

  const org = db.select().from(orgs).where(eq(orgs.id, orgId)).all()[0];
  const orgName = org?.name ?? orgId;

  const currentTxs = loadEnriched(orgId, period.startTs, period.endTs);
  const cur = aggregate(currentTxs);

  const priorBounds = period.priorLabel ? monthBounds(period.priorLabel) : null;
  const priorTxs = priorBounds ? loadEnriched(orgId, priorBounds.start, priorBounds.end) : [];
  const prior = priorTxs.length > 0 ? aggregate(priorTxs) : null;

  const merchants = topMerchants(currentTxs);
  const priorMerchants = topMerchants(priorTxs, 50);
  const cats = topCategories(currentTxs);

  const totalCo2 = cur.totalCo2eKg || 1;

  const reserve = db
    .select()
    .from(closeRuns)
    .where(and(eq(closeRuns.orgId, orgId), eq(closeRuns.status, "completed")))
    .orderBy(desc(closeRuns.startedAt))
    .limit(1)
    .all()[0];
  const reserveBalanceEur = reserve?.reserveEur ?? 0;

  const tonnes = cur.totalCo2eKg / 1000;
  const mix = totalBudgetMix(tonnes);

  const anomalies = detectAnomalies(merchants, priorMerchants);
  const swaps = buildSwaps(cats);

  const skeleton: Omit<CarbonBriefing, "narrative"> = {
    orgId,
    orgName,
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalCo2eKg: cur.totalCo2eKg,
      totalSpendEur: cur.totalSpendEur,
      txCount: cur.txCount,
      confidence: cur.weightedConfidence,
      deltaCo2ePct: prior && prior.totalCo2eKg > 0 ? ((cur.totalCo2eKg - prior.totalCo2eKg) / prior.totalCo2eKg) * 100 : null,
      deltaSpendPct: prior && prior.totalSpendEur > 0 ? ((cur.totalSpendEur - prior.totalSpendEur) / prior.totalSpendEur) * 100 : null,
      reserveBalanceEur,
    },
    topMerchants: merchants.map((m) => ({
      merchantNorm: m.merchantNorm,
      merchantRaw: m.merchantRaw,
      txCount: m.txCount,
      spendEur: m.spendEur,
      co2eKg: m.co2eKg,
      sharePct: (m.co2eKg / totalCo2) * 100,
      category: m.category,
    })),
    topCategories: cats.map((c) => ({
      category: c.category,
      spendEur: c.spendEur,
      co2eKg: c.co2eKg,
      sharePct: (c.co2eKg / totalCo2) * 100,
    })),
    anomalies,
    swaps,
    reserve: {
      recommendedTonnes: tonnes,
      recommendedSpendEur: mix.reduce((s, m) => s + m.eur, 0),
      projectMix: mix.map((m) => ({ projectId: m.project.id, projectName: m.project.name, tonnes: m.tonnes, eur: m.eur })),
    },
  };

  const narrative = await buildNarrative(skeleton);
  return carbonBriefingSchema.parse({ ...skeleton, narrative });
};
