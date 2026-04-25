/**
 * Per-metric context builders for the Explain assistant.
 *
 * Every builder is pure: no LLM, no external services, just `lib/queries.ts` +
 * static lookup tables. Output is a small POJO that fits in <1.5 KB stringified
 * — never raw transaction rows. Aggregation discipline keeps the LLM payload
 * cheap and the prompt-cache hot.
 */

import {
  DEFAULT_ORG_ID,
  currentMonth,
  getActivePolicyRaw,
  getAllAudit,
  getAuditForRun,
  getCategorySpendForMonth,
  getCloseRun,
  getCreditProjects,
  getInvoiceStats,
  getLatestCloseRun,
  getLatestEstimatesForMonth,
  getMonthlyTrend,
  getQuestionsForRun,
  getTaxSavingsForMonth,
  getTransactionsForMonth,
} from "@/lib/queries";
import { factorFor, FACTORS } from "@/lib/factors";
import { buildCategoryAnalyses } from "@/lib/agent/impact-analysis";
import type { BuilderKey, ScopeArgs } from "./metrics";

const TOP_N = 5;

const round = (n: number, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
const pct = (n: number) => round(n * 100, 0);

const safeMonth = (s: ScopeArgs) => s.month ?? currentMonth();

const aggregateTopN = <T>(
  rows: T[],
  keyFn: (r: T) => string,
  weightFn: (r: T) => number,
  labelFn?: (r: T) => string,
): Array<{ key: string; label: string; weight: number; share: number }> => {
  const totals = new Map<string, { weight: number; label: string }>();
  let grand = 0;
  for (const r of rows) {
    const k = keyFn(r);
    const w = weightFn(r);
    grand += w;
    const cur = totals.get(k);
    if (cur) cur.weight += w;
    else totals.set(k, { weight: w, label: labelFn ? labelFn(r) : k });
  }
  if (grand === 0) return [];
  const sorted = [...totals.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const top = sorted.slice(0, TOP_N).map(([key, v]) => ({
    key,
    label: v.label,
    weight: round(v.weight),
    share: pct(v.weight / grand),
  }));
  const restWeight = sorted.slice(TOP_N).reduce((s, [, v]) => s + v.weight, 0);
  if (restWeight > 0) {
    top.push({
      key: "other",
      label: `other (${sorted.length - TOP_N})`,
      weight: round(restWeight),
      share: pct(restWeight / grand),
    });
  }
  return top;
};

// ── Builders ──────────────────────────────────────────────────────────────

const buildMonthCo2eContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const estimates = getLatestEstimatesForMonth(orgId, month);
  const spendRows = getCategorySpendForMonth(orgId, month);
  const trend = getMonthlyTrend(orgId, 2);

  const totalKg = estimates.reduce((s, e) => s + (e.co2eKgPoint ?? 0), 0);
  const totalSpend = spendRows.reduce((s, r) => s + (r.spendEur ?? 0), 0);

  const byCategory: Record<string, number> = {};
  let confNum = 0;
  let confDen = 0;
  for (const e of estimates) {
    const cat = e.category ?? "other";
    byCategory[cat] = (byCategory[cat] ?? 0) + (e.co2eKgPoint ?? 0);
    const w = Math.max(1, e.co2eKgPoint ?? 1);
    confNum += (e.confidence ?? 0) * w;
    confDen += w;
  }
  const sortedCats = Object.entries(byCategory)
    .map(([cat, kg]) => ({
      category: cat,
      kg: round(kg),
      share: pct(totalKg > 0 ? kg / totalKg : 0),
    }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, TOP_N);

  const topMerchants = aggregateTopN(
    estimates,
    (e) => e.merchantRaw ?? "unknown",
    (e) => e.co2eKgPoint ?? 0,
  );

  const priorMonth = trend[0];
  const thisMonth = trend[1] ?? trend[0];
  const priorCo2e = priorMonth?.co2eKg ?? 0;
  const deltaPct =
    priorCo2e > 0 ? round(((thisMonth?.co2eKg ?? 0) - priorCo2e) / priorCo2e, 3) : null;

  return {
    month,
    totalKg: round(totalKg),
    totalSpendEur: round(totalSpend),
    confidenceMean: confDen > 0 ? round(confNum / confDen, 3) : 0,
    byCategory: sortedCats,
    topMerchants,
    priorMonth: priorMonth
      ? { month: priorMonth.month, co2eKg: round(priorMonth.co2eKg) }
      : null,
    deltaVsPriorPct: deltaPct,
    txCount: estimates.length,
  };
};

const buildMonthConfidenceContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const estimates = getLatestEstimatesForMonth(orgId, month);

  const byMethod = new Map<string, { weight: number; conf: number; n: number }>();
  const byCategory = new Map<string, { weight: number; conf: number; n: number }>();
  let totalW = 0;
  let totalConf = 0;
  for (const e of estimates) {
    const w = Math.max(1, e.co2eKgPoint ?? 1);
    totalW += w;
    totalConf += (e.confidence ?? 0) * w;
    const m = e.method ?? "unknown";
    const mc = byMethod.get(m) ?? { weight: 0, conf: 0, n: 0 };
    mc.weight += w;
    mc.conf += (e.confidence ?? 0) * w;
    mc.n += 1;
    byMethod.set(m, mc);
    const cat = e.category ?? "other";
    const cc = byCategory.get(cat) ?? { weight: 0, conf: 0, n: 0 };
    cc.weight += w;
    cc.conf += (e.confidence ?? 0) * w;
    cc.n += 1;
    byCategory.set(cat, cc);
  }

  const overall = totalW > 0 ? totalConf / totalW : 0;
  const methodRows = [...byMethod.entries()]
    .map(([method, v]) => ({
      method,
      share: pct(v.weight / Math.max(1, totalW)),
      meanConfidence: round(v.conf / Math.max(1, v.weight), 3),
      n: v.n,
    }))
    .sort((a, b) => b.share - a.share);
  const lowestCats = [...byCategory.entries()]
    .map(([category, v]) => ({
      category,
      meanConfidence: round(v.conf / Math.max(1, v.weight), 3),
      share: pct(v.weight / Math.max(1, totalW)),
    }))
    .sort((a, b) => a.meanConfidence - b.meanConfidence)
    .slice(0, 3);

  return {
    month,
    overall: round(overall, 3),
    byMethod: methodRows,
    lowestConfidenceCategories: lowestCats,
    txCount: estimates.length,
  };
};

const parsePolicy = (raw: string | undefined | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildMonthReserveContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const policyRow = getActivePolicyRaw(orgId);
  const policy = parsePolicy(policyRow?.rules);
  const close = getLatestCloseRun(orgId);
  const projects = getCreditProjects();

  const totalKg = close?.finalCo2eKg ?? close?.initialCo2eKg ?? 0;
  const reserveEur = close?.reserveEur ?? 0;

  return {
    month,
    reserveEur: round(reserveEur),
    totalKg: round(totalKg),
    impliedPricePerTonneEur:
      totalKg > 0 ? round((reserveEur / totalKg) * 1000) : 0,
    policySummary: policy
      ? {
          ambition: policy.ambition ?? null,
          creditPreference: policy.creditPreference ?? null,
          removalMix: policy.removalMix ?? null,
          approvalThresholdEur: policy.approvalThresholdEur ?? null,
          maxReservePerMonthEur: policy.maxReservePerMonthEur ?? null,
        }
      : null,
    creditProjects: projects.slice(0, TOP_N).map((p) => ({
      name: p.name,
      type: p.type,
      country: p.country,
      pricePerTonneEur: round(p.pricePerTonneEur),
      registry: p.registry,
    })),
    closeState: close?.state ?? null,
    approved: !!close?.approved,
  };
};

const buildMonthTransactionsContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const txs = getTransactionsForMonth(orgId, month);
  const totalSpend = txs.reduce((s, t) => s + t.amountCents / 100, 0);

  const topMerchants = aggregateTopN(
    txs,
    (t) => t.merchantRaw,
    (t) => t.amountCents / 100,
  );
  const sourceMix = new Map<string, number>();
  for (const t of txs) {
    const k = t.classifierSource ?? "unclassified";
    sourceMix.set(k, (sourceMix.get(k) ?? 0) + 1);
  }
  return {
    month,
    txCount: txs.length,
    totalSpendEur: round(totalSpend),
    topMerchants,
    classifierSourceMix: [...sourceMix.entries()].map(([source, n]) => ({
      source,
      count: n,
      share: pct(n / Math.max(1, txs.length)),
    })),
  };
};

const buildCategoryContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const cat = scope.category ?? "other";
  const estimates = getLatestEstimatesForMonth(orgId, month).filter(
    (e) => (e.category ?? "other") === cat,
  );
  const txs = getTransactionsForMonth(orgId, month).filter(
    (t) => (t.category ?? "other") === cat,
  );
  const spend = txs.reduce((s, t) => s + t.amountCents / 100, 0);
  const co2eKg = estimates.reduce((s, e) => s + (e.co2eKgPoint ?? 0), 0);

  const subCounts = new Map<string, number>();
  for (const t of txs) {
    const sc = t.subCategory ?? "(none)";
    subCounts.set(sc, (subCounts.get(sc) ?? 0) + 1);
  }
  const dominantSub = [...subCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const factor = factorFor(cat, dominantSub === "(none)" ? null : dominantSub);

  let confNum = 0;
  let confDen = 0;
  for (const e of estimates) {
    const w = Math.max(1, e.co2eKgPoint ?? 1);
    confNum += (e.confidence ?? 0) * w;
    confDen += w;
  }
  const confidence = confDen > 0 ? confNum / confDen : 0;

  const topMerchants = aggregateTopN(
    estimates,
    (e) => e.merchantRaw ?? "unknown",
    (e) => e.co2eKgPoint ?? 0,
  );

  return {
    month,
    category: cat,
    spendEur: round(spend),
    co2eKg: round(co2eKg),
    confidence: round(confidence, 3),
    txCount: txs.length,
    factor: {
      key: factor.id,
      kgPerEur: factor.factorKgPerEur,
      uncertaintyPct: factor.uncertaintyPct,
      tier: factor.tier,
      source: factor.source,
    },
    topMerchants,
  };
};

const buildCategoryConfidenceContext = (orgId: string, scope: ScopeArgs) => {
  const cat = scope.category ?? "other";
  const month = safeMonth(scope);
  const estimates = getLatestEstimatesForMonth(orgId, month).filter(
    (e) => (e.category ?? "other") === cat,
  );

  const methodMix = new Map<string, { n: number; weight: number; conf: number }>();
  let confNum = 0;
  let confDen = 0;
  for (const e of estimates) {
    const w = Math.max(1, e.co2eKgPoint ?? 1);
    confNum += (e.confidence ?? 0) * w;
    confDen += w;
    const m = e.method ?? "unknown";
    const cur = methodMix.get(m) ?? { n: 0, weight: 0, conf: 0 };
    cur.n += 1;
    cur.weight += w;
    cur.conf += (e.confidence ?? 0) * w;
    methodMix.set(m, cur);
  }
  const factor = factorFor(cat, null);
  return {
    month,
    category: cat,
    confidence: round(confDen > 0 ? confNum / confDen : 0, 3),
    txCount: estimates.length,
    factor: {
      key: factor.id,
      uncertaintyPct: factor.uncertaintyPct,
      tier: factor.tier,
      source: factor.source,
    },
    methodMix: [...methodMix.entries()].map(([method, v]) => ({
      method,
      n: v.n,
      meanConfidence: round(v.conf / Math.max(1, v.weight), 3),
    })),
  };
};

const buildTrendContext = (orgId: string, _scope: ScopeArgs) => {
  const series = getMonthlyTrend(orgId, 6).map((p) => ({
    month: p.month,
    co2eKg: round(p.co2eKg),
    spendEur: round(p.spendEur),
  }));
  const last = series[series.length - 1];
  const first = series[0];
  const momPct =
    series.length > 1 && series[series.length - 2].co2eKg > 0
      ? round(
          (last.co2eKg - series[series.length - 2].co2eKg) /
            series[series.length - 2].co2eKg,
          3,
        )
      : null;
  const sixMonthChangePct =
    first?.co2eKg > 0 ? round((last.co2eKg - first.co2eKg) / first.co2eKg, 3) : null;
  return { series, momPct, sixMonthChangePct };
};

const buildImpactSummaryContext = (orgId: string, _scope: ScopeArgs) => {
  const month = currentMonth();
  const taxSavings = getTaxSavingsForMonth(orgId, month);
  const categories = buildCategoryAnalyses(taxSavings);
  const switches = categories
    .flatMap((c) =>
      c.switchOpportunities.map((s) => ({
        category: c.category,
        label: s.switchLabel,
        annualCo2eSavingKg: s.annualCo2eSavingKg,
        annualCostSavingEur: s.annualCostSavingEur,
      })),
    )
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg)
    .slice(0, TOP_N);
  const annualAvoidableKg = switches.reduce((s, x) => s + x.annualCo2eSavingKg, 0);
  const annualSavingsEur = switches.reduce((s, x) => s + x.annualCostSavingEur, 0);
  const aboveAvg = categories.filter((c) => c.vsAvgPct > 10).map((c) => ({
    category: c.category,
    vsAvgPct: round(c.vsAvgPct, 0),
  }));

  return {
    month,
    topSwitches: switches.map((s) => ({
      ...s,
      annualCo2eSavingKg: round(s.annualCo2eSavingKg),
      annualCostSavingEur: round(s.annualCostSavingEur),
    })),
    annualAvoidableKg: round(annualAvoidableKg),
    annualSavingsEur: round(annualSavingsEur),
    categoriesAboveAverage: aboveAvg,
  };
};

const buildImpactAlternativeContext = (orgId: string, scope: ScopeArgs) => {
  const month = currentMonth();
  const cat = scope.category ?? null;
  const taxSavings = getTaxSavingsForMonth(orgId, month);
  const categories = buildCategoryAnalyses(taxSavings);
  const summary = cat
    ? categories.find((c) => c.category === cat)
    : categories[0];
  const sw = summary?.switchOpportunities[0] ?? null;
  return {
    category: summary?.category ?? cat,
    altName: sw?.switchLabel ?? null,
    altCo2eDeltaKgYear: sw ? -round(sw.annualCo2eSavingKg) : 0,
    altCostDeltaEurYear: sw ? -round(sw.annualCostSavingEur) : 0,
    fromFactorId: sw?.fromFactorId ?? null,
    toFactorId: sw?.toFactorId ?? null,
    co2eReductionPct: sw ? round(sw.co2eReductionPct, 0) : 0,
    vsAvgPct: summary ? round(summary.vsAvgPct, 0) : 0,
  };
};

const buildClosePhaseContext = (orgId: string, scope: ScopeArgs) => {
  const runId = scope.runId;
  if (!runId) {
    const latest = getLatestCloseRun(orgId);
    if (!latest) return { runId: null, phase: scope.phase ?? null, auditEventCount: 0 };
    return {
      runId: latest.id,
      month: latest.month,
      state: latest.state,
      phase: scope.phase ?? null,
      auditEventCount: getAuditForRun(latest.id).length,
    };
  }
  const run = getCloseRun(runId);
  if (!run) return { runId, phase: scope.phase ?? null, auditEventCount: 0 };
  const audits = getAuditForRun(runId);
  const phaseEvents = scope.phase
    ? audits.filter((a) => (a.type ?? "").toUpperCase().includes(scope.phase!.toUpperCase()))
    : audits;
  const types = new Map<string, number>();
  for (const a of phaseEvents) {
    types.set(a.type, (types.get(a.type) ?? 0) + 1);
  }
  return {
    runId,
    month: run.month,
    state: run.state,
    status: run.status,
    phase: scope.phase ?? null,
    auditEventCount: phaseEvents.length,
    eventTypes: [...types.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([type, n]) => ({ type, n })),
    initialCo2eKg: round(run.initialCo2eKg ?? 0),
    finalCo2eKg: round(run.finalCo2eKg ?? 0),
    initialConfidence: round(run.initialConfidence ?? 0, 3),
    finalConfidence: round(run.finalConfidence ?? 0, 3),
  };
};

const buildCloseSummaryContext = (orgId: string, scope: ScopeArgs) => {
  const runId = scope.runId;
  const run = runId ? getCloseRun(runId) : getLatestCloseRun(orgId);
  if (!run) return { runId: null };
  const qa = getQuestionsForRun(run.id);
  const answered = qa.filter((q) => !!q.answer).length;
  const audits = getAuditForRun(run.id);
  return {
    runId: run.id,
    month: run.month,
    state: run.state,
    status: run.status,
    initialCo2eKg: round(run.initialCo2eKg ?? 0),
    finalCo2eKg: round(run.finalCo2eKg ?? 0),
    initialConfidence: round(run.initialConfidence ?? 0, 3),
    finalConfidence: round(run.finalConfidence ?? 0, 3),
    reserveEur: round(run.reserveEur ?? 0),
    approved: !!run.approved,
    questionsAnswered: answered,
    questionsTotal: qa.length,
    auditEventCount: audits.length,
  };
};

const buildLedgerContext = (orgId: string, _scope: ScopeArgs) => {
  const events = getAllAudit(orgId, 200);
  let broken = 0;
  for (let i = 1; i < events.length; i++) {
    if (events[i].prevHash !== events[i - 1].hash) broken += 1;
  }
  const actorMix = new Map<string, number>();
  const typeMix = new Map<string, number>();
  for (const e of events) {
    actorMix.set(e.actor, (actorMix.get(e.actor) ?? 0) + 1);
    typeMix.set(e.type, (typeMix.get(e.type) ?? 0) + 1);
  }
  return {
    length: events.length,
    brokenLinks: broken,
    chainHead: events[0]?.hash?.slice(0, 12) ?? null,
    actors: [...actorMix.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([actor, n]) => ({ actor, n })),
    eventTypes: [...typeMix.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([type, n]) => ({ type, n })),
  };
};

const buildInvoiceStatsContext = (orgId: string, _scope: ScopeArgs) => {
  const stats = getInvoiceStats(orgId);
  const total = stats?.total ?? 0;
  const linked = stats?.linked ?? 0;
  const totalAmountCents = stats?.totalAmountCents ?? 0;
  return {
    total,
    linked,
    linkRate: total > 0 ? round(linked / total, 3) : 0,
    totalAmountEur: round(totalAmountCents / 100),
  };
};

const buildTaxSavingsContext = (orgId: string, scope: ScopeArgs) => {
  const month = safeMonth(scope);
  const summary = getTaxSavingsForMonth(orgId, month);
  const rows = summary.byCategory
    .filter((c) => !scope.category || c.category === scope.category)
    .map((c) => ({
      category: c.category,
      potentialSavingsEur: round(c.potentialSavingsEur),
      spendEur: round(c.spendEur),
      co2eKg: round(c.co2eKg),
      topAlternative: c.topAlternative?.alternative?.switchLabel ?? null,
    }))
    .slice(0, TOP_N);
  const schemes = summary.byScheme.slice(0, TOP_N).map((s) => ({
    schemeId: s.schemeId,
    schemeName: s.schemeName,
    totalEur: round(s.totalEur),
  }));
  return {
    month,
    category: scope.category ?? null,
    totalSavingsEur: round(summary.totalPotentialSavingsEur),
    annualProjection: round(summary.annualProjection),
    schemes,
    categories: rows,
  };
};

const buildFreeFormContext = (orgId: string, _scope: ScopeArgs) => {
  const close = getLatestCloseRun(orgId);
  const policyRow = getActivePolicyRaw(orgId);
  const policy = parsePolicy(policyRow?.rules);
  return {
    month: currentMonth(),
    latestRun: close
      ? {
          state: close.state,
          finalCo2eKg: round(close.finalCo2eKg ?? close.initialCo2eKg ?? 0),
          finalConfidence: round(close.finalConfidence ?? close.initialConfidence ?? 0, 3),
          reserveEur: round(close.reserveEur ?? 0),
          approved: !!close.approved,
        }
      : null,
    policySummary: policy
      ? {
          ambition: policy.ambition ?? null,
          creditPreference: policy.creditPreference ?? null,
        }
      : null,
    factorSources: Array.from(new Set(FACTORS.map((f) => f.source))).slice(0, TOP_N),
  };
};

// ── Dispatcher ────────────────────────────────────────────────────────────

const BUILDERS: Record<BuilderKey, (orgId: string, scope: ScopeArgs) => unknown> = {
  "month-co2e": buildMonthCo2eContext,
  "month-confidence": buildMonthConfidenceContext,
  "month-reserve": buildMonthReserveContext,
  "month-transactions": buildMonthTransactionsContext,
  category: buildCategoryContext,
  "category-confidence": buildCategoryConfidenceContext,
  trend: buildTrendContext,
  "impact-summary": buildImpactSummaryContext,
  "impact-alternative": buildImpactAlternativeContext,
  "close-phase": buildClosePhaseContext,
  "close-summary": buildCloseSummaryContext,
  ledger: buildLedgerContext,
  "invoice-stats": buildInvoiceStatsContext,
  "tax-savings": buildTaxSavingsContext,
  "free-form": buildFreeFormContext,
};

export const buildContextForMetric = (
  builder: BuilderKey,
  scope: ScopeArgs,
  orgId: string = DEFAULT_ORG_ID,
): Record<string, unknown> => {
  const fn = BUILDERS[builder];
  if (!fn) return {};
  return (fn(orgId, scope) ?? {}) as Record<string, unknown>;
};
