/**
 * Metric registry for the Explain assistant.
 *
 * Each entry binds a stable `MetricKey` to:
 *  - `label`     — eyebrow shown in the modal header
 *  - `headline`  — server-rendered first line, computed from real data, shown
 *                  before the LLM stream begins so the panel never feels empty
 *  - `builder`   — dispatcher key into `context.ts`
 *  - `followUps` — three deterministic suggested questions
 *
 * Registry is the single source of truth — every `<ExplainButton metric=...>`
 * in the UI must reference a key declared here.
 */

import { fmtEur, fmtKg } from "@/lib/utils";

const fmtBand = (kg: number): string => {
  if (!Number.isFinite(kg) || kg <= 0) return "0 kg";
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${Math.round(kg)} kg`;
};

export type MetricKey =
  | "month-co2e"
  | "month-confidence"
  | "month-reserve"
  | "month-transactions"
  | "category"
  | "category-confidence"
  | "trend"
  | "impact-summary"
  | "impact-alternative"
  | "close-phase"
  | "close-summary"
  | "ledger"
  | "invoice-stats"
  | "tax-savings"
  | "free-form";

export type ScopeArgs = {
  month?: string;
  category?: string;
  runId?: string;
  phase?: string;
  alternativeId?: string;
  baselineKey?: string;
  topic?: string;
};

export type ContextLike = Record<string, unknown>;

export type MetricEntry = {
  label: string;
  /** Compute from a context object; safe to call before any LLM call. */
  headline: (scope: ScopeArgs, ctx: ContextLike) => string;
  builder: BuilderKey;
  followUps: [string, string, string];
  /** Short scope chips shown in the modal header. */
  scopeChips: (scope: ScopeArgs) => Array<{ label: string; value: string }>;
};

export type BuilderKey =
  | "month-co2e"
  | "month-confidence"
  | "month-reserve"
  | "month-transactions"
  | "category"
  | "category-confidence"
  | "trend"
  | "impact-summary"
  | "impact-alternative"
  | "close-phase"
  | "close-summary"
  | "ledger"
  | "invoice-stats"
  | "tax-savings"
  | "free-form";

const monthChip = (s: ScopeArgs) =>
  s.month ? [{ label: "MONTH", value: s.month }] : [];
const categoryChip = (s: ScopeArgs) =>
  s.category ? [{ label: "CATEGORY", value: s.category }] : [];

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export const METRIC_REGISTRY: Record<MetricKey, MetricEntry> = {
  "month-co2e": {
    label: "CO₂e this month",
    builder: "month-co2e",
    headline: (s, c) => {
      const total = num((c as { totalKg?: number }).totalKg);
      const conf = num((c as { confidenceMean?: number }).confidenceMean);
      if (!total) return `No CO₂e estimate yet for ${s.month ?? "this month"}.`;
      const band = Math.max(0, (1 - conf) * total);
      return `Your ${s.month ?? "this month"} footprint is **${fmtKg(total)}** ± ${fmtBand(band)}.`;
    },
    followUps: [
      "What drove the change vs last month?",
      "Why is confidence in this number what it is?",
      "How was this calculated?",
    ],
    scopeChips: monthChip,
  },
  "month-confidence": {
    label: "Confidence",
    builder: "month-confidence",
    headline: (s, c) => {
      const overall = num((c as { overall?: number }).overall);
      return `We're **${Math.round(overall * 100)}%** sure about ${s.month ?? "this month"}'s footprint.`;
    },
    followUps: [
      "What's pulling confidence down?",
      "Which categories are weakest?",
      "How do you compute confidence?",
    ],
    scopeChips: monthChip,
  },
  "month-reserve": {
    label: "Reserve",
    builder: "month-reserve",
    headline: (s, c) => {
      const eur = num((c as { reserveEur?: number }).reserveEur);
      if (!eur) return `No reserve proposed yet for ${s.month ?? "this month"}.`;
      return `Carbo proposes **${fmtEur(eur, 0)}** to reserve for ${s.month ?? "this month"}.`;
    },
    followUps: [
      "How is the reserve amount derived?",
      "Which credit projects would be retired?",
      "What does the policy require?",
    ],
    scopeChips: monthChip,
  },
  "month-transactions": {
    label: "Transactions",
    builder: "month-transactions",
    headline: (s, c) => {
      const count = num((c as { txCount?: number }).txCount);
      const spend = num((c as { totalSpendEur?: number }).totalSpendEur);
      return `**${count}** transactions ingested for ${s.month ?? "this month"} (${fmtEur(spend, 0)}).`;
    },
    followUps: [
      "Which merchants are biggest?",
      "How are transactions classified?",
      "Are any flagged for review?",
    ],
    scopeChips: monthChip,
  },
  category: {
    label: "Category breakdown",
    builder: "category",
    headline: (s, c) => {
      const cat = s.category ?? "this category";
      const co2e = num((c as { co2eKg?: number }).co2eKg);
      const spend = num((c as { spendEur?: number }).spendEur);
      return `**${cat}** contributes ${fmtKg(co2e)} on ${fmtEur(spend, 0)} of spend.`;
    },
    followUps: [
      "Which merchants drive this?",
      "What emission factor is applied?",
      "What's the lower-carbon alternative?",
    ],
    scopeChips: (s) => [...monthChip(s), ...categoryChip(s)],
  },
  "category-confidence": {
    label: "Category confidence",
    builder: "category-confidence",
    headline: (s, c) => {
      const cat = s.category ?? "this category";
      const conf = num((c as { confidence?: number }).confidence);
      return `We're **${Math.round(conf * 100)}%** sure about ${cat} this month.`;
    },
    followUps: [
      "Why isn't confidence higher?",
      "Which merchants are unclassified?",
      "What would lift confidence?",
    ],
    scopeChips: (s) => [...monthChip(s), ...categoryChip(s)],
  },
  trend: {
    label: "6-month trend",
    builder: "trend",
    headline: (_s, c) => {
      const series = (c as { series?: Array<{ co2eKg: number }> }).series ?? [];
      if (series.length === 0) return "No trend data yet.";
      const latest = series[series.length - 1].co2eKg;
      const prev = series[series.length - 2]?.co2eKg ?? latest;
      const delta = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
      const dir = delta > 1 ? "up" : delta < -1 ? "down" : "flat";
      return `Footprint is **${dir}** ${Math.abs(delta).toFixed(0)}% MoM (${fmtKg(latest)}).`;
    },
    followUps: [
      "What's driving the trend?",
      "Is this seasonal?",
      "How does this compare to peers?",
    ],
    scopeChips: () => [],
  },
  "impact-summary": {
    label: "Impact workspace",
    builder: "impact-summary",
    headline: (_s, c) => {
      const annualKg = num((c as { annualAvoidableKg?: number }).annualAvoidableKg);
      const annualEur = num((c as { annualSavingsEur?: number }).annualSavingsEur);
      if (!annualKg) return "No alternatives surfaced yet.";
      return `Top switches could avoid **${fmtKg(annualKg)}/yr** at ${fmtEur(annualEur, 0)}/yr saved.`;
    },
    followUps: [
      "Which switches give the biggest win?",
      "What are the trade-offs?",
      "Where do these alternatives come from?",
    ],
    scopeChips: () => [],
  },
  "impact-alternative": {
    label: "Alternative",
    builder: "impact-alternative",
    headline: (_s, c) => {
      const name = (c as { altName?: string }).altName ?? "Alternative";
      const co2eDelta = num((c as { altCo2eDeltaKgYear?: number }).altCo2eDeltaKgYear);
      const costDelta = num((c as { altCostDeltaEurYear?: number }).altCostDeltaEurYear);
      const savesCo2e = co2eDelta < 0;
      const savesCost = costDelta < 0;
      const label = savesCo2e
        ? `saves ${fmtKg(Math.abs(co2eDelta))}/yr`
        : `adds ${fmtKg(co2eDelta)}/yr`;
      const cost = savesCost
        ? `saves ${fmtEur(Math.abs(costDelta), 0)}/yr`
        : `costs ${fmtEur(Math.abs(costDelta), 0)}/yr`;
      return `**${name}** ${label}, ${cost}.`;
    },
    followUps: [
      "How feasible is this switch?",
      "What sources support this?",
      "What's the payback period?",
    ],
    scopeChips: (s) => categoryChip(s),
  },
  "close-phase": {
    label: "Close phase",
    builder: "close-phase",
    headline: (s, c) => {
      const phase = s.phase ?? "this phase";
      const events = num((c as { auditEventCount?: number }).auditEventCount);
      return `Phase **${phase}**: ${events} audit ${events === 1 ? "event" : "events"} recorded.`;
    },
    followUps: [
      "What did this phase do?",
      "Why did it transition next?",
      "Were there any errors?",
    ],
    scopeChips: (s) => [
      ...(s.runId ? [{ label: "RUN", value: s.runId.slice(0, 8) }] : []),
      ...(s.phase ? [{ label: "PHASE", value: s.phase }] : []),
    ],
  },
  "close-summary": {
    label: "Close run",
    builder: "close-summary",
    headline: (_s, c) => {
      const co2e = num((c as { finalCo2eKg?: number }).finalCo2eKg);
      const conf = num((c as { finalConfidence?: number }).finalConfidence);
      const reserve = num((c as { reserveEur?: number }).reserveEur);
      const month = (c as { month?: string }).month ?? "this month";
      return `${month} closed at **${fmtKg(co2e)}** (${Math.round(conf * 100)}% sure), ${fmtEur(reserve, 0)} reserved.`;
    },
    followUps: [
      "What did the agent decide?",
      "How were uncertainty clusters resolved?",
      "What's in the audit chain?",
    ],
    scopeChips: (s) =>
      s.runId ? [{ label: "RUN", value: s.runId.slice(0, 8) }] : [],
  },
  ledger: {
    label: "Audit ledger",
    builder: "ledger",
    headline: (_s, c) => {
      const len = num((c as { length?: number }).length);
      const broken = num((c as { brokenLinks?: number }).brokenLinks);
      if (broken === 0) {
        return `Hash chain has **${len}** events — chain is intact.`;
      }
      return `Hash chain has **${len}** events with **${broken}** broken ${broken === 1 ? "link" : "links"}.`;
    },
    followUps: [
      "How is the chain verified?",
      "What can break a chain?",
      "Which actor writes most events?",
    ],
    scopeChips: () => [],
  },
  "invoice-stats": {
    label: "Invoices",
    builder: "invoice-stats",
    headline: (_s, c) => {
      const total = num((c as { total?: number }).total);
      const linked = num((c as { linked?: number }).linked);
      const rate = total > 0 ? (linked / total) * 100 : 0;
      return `**${linked}/${total}** invoices linked to a transaction (${rate.toFixed(0)}%).`;
    },
    followUps: [
      "What does linking unlock?",
      "Why don't all invoices link?",
      "How is line-item categorisation done?",
    ],
    scopeChips: () => [],
  },
  "tax-savings": {
    label: "Tax savings",
    builder: "tax-savings",
    headline: (s, c) => {
      const savings = num((c as { totalSavingsEur?: number }).totalSavingsEur);
      return `Available incentives total **${fmtEur(savings, 0)}** for ${s.month ?? "this month"}.`;
    },
    followUps: [
      "Which incentives apply to me?",
      "How do I claim them?",
      "What categories qualify?",
    ],
    scopeChips: (s) => [...monthChip(s), ...categoryChip(s)],
  },
  "free-form": {
    label: "Ask the assistant",
    builder: "free-form",
    headline: (_s) =>
      "Ask anything about your carbon accounting — categories, factors, policy, credits.",
    followUps: [
      "What's the biggest lever I have right now?",
      "Walk me through how a close run works.",
      "Which factors are tier-A vs tier-B?",
    ],
    scopeChips: () => [],
  },
};

export const isMetricKey = (v: unknown): v is MetricKey =>
  typeof v === "string" && v in METRIC_REGISTRY;
