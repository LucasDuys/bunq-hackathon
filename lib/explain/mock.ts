/**
 * Deterministic mock narrator. Runs whenever `isAnthropicMock()` is true so
 * the demo works without an Anthropic key and CI never burns budget. Mock and
 * live diverge only in token source — both pull from real context builders
 * and stream over the same SSE pipe.
 */

import { fmtEur, fmtKg } from "@/lib/utils";
import type { BuilderKey, ScopeArgs } from "./metrics";

type Ctx = Record<string, unknown>;

const num = (v: unknown, fb = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;
const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);

const detectIntent = (q: string): "why" | "how" | "what-drove" | "trade-off" | "general" => {
  const t = q.toLowerCase();
  if (/why/.test(t)) return "why";
  if (/how (do|is|are|was|did)|how (do you )?calculate/.test(t)) return "how";
  if (/drove|drive|increase|decrease|change|jump/.test(t)) return "what-drove";
  if (/trade.?off|cost|risk|downside|worth/.test(t)) return "trade-off";
  return "general";
};

const narrators: Record<BuilderKey, (ctx: Ctx, scope: ScopeArgs, intent: ReturnType<typeof detectIntent>, q: string) => string> = {
  "month-co2e": (ctx, scope, intent) => {
    const total = num(ctx.totalKg);
    const conf = num(ctx.confidenceMean);
    const band = Math.round((1 - conf) * total);
    const cats = (ctx.byCategory as Array<{ category: string; kg: number; share: number }>) ?? [];
    const top = cats[0];
    const second = cats[1];
    const delta = ctx.deltaVsPriorPct as number | null;
    const month = scope.month ?? "this month";

    if (intent === "why" || intent === "how") {
      return [
        `Confidence is ${Math.round(conf * 100)}% because each transaction's emission factor carries a tier-specific uncertainty (DEFRA factors ~25%, Exiobase economy-wide ~50–60%) and the classifier's confidence layers on top.`,
        `Rollup is spend-weighted: large categories pull the mean.`,
        top
          ? `${top.category} is the heaviest weight here at ${fmtKg(top.kg)} (${top.share}%).`
          : "",
      ].filter(Boolean).join(" ");
    }
    if (intent === "what-drove") {
      const dir = delta === null ? "no prior month to compare" : delta > 0 ? `up ${(delta * 100).toFixed(0)}%` : `down ${Math.abs(delta * 100).toFixed(0)}%`;
      return [
        `Versus last month, your footprint is ${dir}.`,
        top ? `The biggest contributor right now is ${top.category} at ${fmtKg(top.kg)}.` : "",
        second ? `${second.category} follows at ${fmtKg(second.kg)} (${second.share}%).` : "",
      ].filter(Boolean).join(" ");
    }
    return [
      `Your ${month} footprint is **${fmtKg(total)}** ± ${band} kg.`,
      top
        ? `Largest contributor: ${top.category} at ${fmtKg(top.kg)} (${top.share}%).`
        : "",
      second ? `Then ${second.category} (${second.share}%).` : "",
      `Confidence is ${Math.round(conf * 100)}% — typical for spend-based estimates with mostly tier-3 factors.`,
    ].filter(Boolean).join(" ");
  },

  "month-confidence": (ctx, _scope, intent) => {
    const overall = num(ctx.overall);
    const methods = (ctx.byMethod as Array<{ method: string; share: number; meanConfidence: number }>) ?? [];
    const lows = (ctx.lowestConfidenceCategories as Array<{ category: string; meanConfidence: number; share: number }>) ?? [];
    if (intent === "why") {
      const lines = [`Overall confidence is **${Math.round(overall * 100)}%**.`];
      if (lows[0])
        lines.push(
          `It's pulled down most by ${lows[0].category} at ${Math.round(lows[0].meanConfidence * 100)}%.`,
        );
      if (methods[0])
        lines.push(
          `${Math.round(methods[0].share)}% of weight is classified by ${methods[0].method}.`,
        );
      return lines.join(" ");
    }
    return [
      `Overall confidence is **${Math.round(overall * 100)}%**.`,
      methods[0]
        ? `Method mix: ${methods.map((m) => `${m.method} ${m.share}%`).join(", ")}.`
        : "",
      lows[0] ? `Weakest category is ${lows[0].category} at ${Math.round(lows[0].meanConfidence * 100)}%.` : "",
    ].filter(Boolean).join(" ");
  },

  "month-reserve": (ctx, _scope) => {
    const eur = num(ctx.reserveEur);
    const total = num(ctx.totalKg);
    const ppt = num(ctx.impliedPricePerTonneEur);
    const policy = ctx.policySummary as Record<string, unknown> | null;
    return [
      `Reserve proposed: **${fmtEur(eur, 0)}** to cover ${fmtKg(total)} (~${fmtEur(ppt, 0)}/tonne implied).`,
      policy
        ? `Policy: ${str(policy.ambition, "?")} ambition, ${str(policy.creditPreference, "?")} credits, ${str(policy.removalMix, "?")} removal mix.`
        : "No policy is set yet — finish onboarding to calibrate.",
      `Math: monthly CO₂e × policy buffer × weighted credit price.`,
    ].join(" ");
  },

  "month-transactions": (ctx) => {
    const count = num(ctx.txCount);
    const spend = num(ctx.totalSpendEur);
    const top = (ctx.topMerchants as Array<{ label: string; share: number }>)?.[0];
    const sources = (ctx.classifierSourceMix as Array<{ source: string; share: number }>) ?? [];
    return [
      `**${count}** transactions for ${fmtEur(spend, 0)} of spend.`,
      top ? `${top.label} is the heaviest merchant at ${top.share}% of spend.` : "",
      sources[0] ? `Most are classified via ${sources[0].source} (${sources[0].share}%).` : "",
    ].filter(Boolean).join(" ");
  },

  category: (ctx) => {
    const cat = str(ctx.category, "this category");
    const co2e = num(ctx.co2eKg);
    const spend = num(ctx.spendEur);
    const conf = num(ctx.confidence);
    const factor = ctx.factor as { key: string; kgPerEur: number; uncertaintyPct: number; tier: number; source: string };
    const top = (ctx.topMerchants as Array<{ label: string; share: number }>)?.[0];
    return [
      `**${cat}** contributes ${fmtKg(co2e)} on ${fmtEur(spend, 0)} (${Math.round(conf * 100)}% sure).`,
      factor
        ? `Factor: ${factor.key} = ${factor.kgPerEur} kg/€, tier ${factor.tier}, ±${Math.round(factor.uncertaintyPct * 100)}% (${factor.source}).`
        : "",
      top ? `Top merchant: ${top.label} (${top.share}%).` : "",
    ].filter(Boolean).join(" ");
  },

  "category-confidence": (ctx) => {
    const cat = str(ctx.category);
    const conf = num(ctx.confidence);
    const factor = ctx.factor as { uncertaintyPct: number; tier: number; source: string } | undefined;
    return [
      `${cat} sits at **${Math.round(conf * 100)}%** confidence.`,
      factor
        ? `That's bounded by a tier-${factor.tier} factor (${factor.source}) at ±${Math.round(factor.uncertaintyPct * 100)}%.`
        : "",
      `Lifting it requires either a higher-tier factor or merchant-level invoice data.`,
    ].filter(Boolean).join(" ");
  },

  trend: (ctx) => {
    const series = (ctx.series as Array<{ month: string; co2eKg: number }>) ?? [];
    const last = series[series.length - 1];
    const first = series[0];
    const mom = ctx.momPct as number | null;
    if (!last) return "No trend data yet.";
    return [
      `${last.month} stands at ${fmtKg(last.co2eKg)}.`,
      mom !== null
        ? `${mom > 0 ? "Up" : mom < 0 ? "Down" : "Flat"} ${Math.abs(mom * 100).toFixed(0)}% MoM.`
        : "",
      first && first !== last
        ? `Six months ago you were at ${fmtKg(first.co2eKg)}.`
        : "",
    ].filter(Boolean).join(" ");
  },

  "impact-summary": (ctx) => {
    const annualKg = num(ctx.annualAvoidableKg);
    const annualEur = num(ctx.annualSavingsEur);
    const top = (ctx.topSwitches as Array<{ label: string; annualCo2eSavingKg: number; annualCostSavingEur: number }>)?.[0];
    return [
      `Top switches could avoid **${fmtKg(annualKg)}/yr** at ${fmtEur(annualEur, 0)}/yr saved.`,
      top
        ? `Biggest single lever: ${top.label}, worth ${fmtKg(top.annualCo2eSavingKg)}/yr (${fmtEur(top.annualCostSavingEur, 0)}/yr).`
        : "",
    ].filter(Boolean).join(" ");
  },

  "impact-alternative": (ctx) => {
    const name = str(ctx.altName, "this alternative");
    const co2eDelta = num(ctx.altCo2eDeltaKgYear);
    const costDelta = num(ctx.altCostDeltaEurYear);
    const rationale = str(ctx.rationale);
    return [
      `**${name}** ${co2eDelta < 0 ? "saves" : "adds"} ${fmtKg(Math.abs(co2eDelta))}/yr ${costDelta < 0 ? `and saves ${fmtEur(Math.abs(costDelta), 0)}/yr` : `and costs ${fmtEur(Math.abs(costDelta), 0)}/yr extra`}.`,
      rationale,
    ].filter(Boolean).join(" ");
  },

  "close-phase": (ctx, scope) => {
    const phase = scope.phase ?? "the current phase";
    const events = num(ctx.auditEventCount);
    const eventTypes = (ctx.eventTypes as Array<{ type: string; n: number }>) ?? [];
    return [
      `Phase **${phase}** recorded ${events} audit ${events === 1 ? "event" : "events"}.`,
      eventTypes[0]
        ? `Most common: ${eventTypes[0].type} (×${eventTypes[0].n}).`
        : "",
    ].filter(Boolean).join(" ");
  },

  "close-summary": (ctx) => {
    const month = str(ctx.month, "this month");
    const finalCo2e = num(ctx.finalCo2eKg);
    const finalConf = num(ctx.finalConfidence);
    const reserve = num(ctx.reserveEur);
    const approved = !!ctx.approved;
    const answered = num(ctx.questionsAnswered);
    const total = num(ctx.questionsTotal);
    return [
      `${month} close: **${fmtKg(finalCo2e)}** at ${Math.round(finalConf * 100)}% confidence.`,
      `Reserve: ${fmtEur(reserve, 0)} (${approved ? "transferred" : "pending approval"}).`,
      total > 0 ? `Refinement Q&A: ${answered}/${total} answered.` : "",
    ].filter(Boolean).join(" ");
  },

  ledger: (ctx) => {
    const len = num(ctx.length);
    const broken = num(ctx.brokenLinks);
    const head = str(ctx.chainHead, "—");
    const actors = (ctx.actors as Array<{ actor: string; n: number }>) ?? [];
    return [
      `The ledger has **${len}** events, head ${head}.`,
      broken === 0
        ? `Hash chain is intact — every event references its predecessor's SHA-256.`
        : `**${broken}** broken links — the chain has been tampered with or rewritten.`,
      actors[0] ? `Most events from ${actors[0].actor} (×${actors[0].n}).` : "",
    ].filter(Boolean).join(" ");
  },

  "invoice-stats": (ctx) => {
    const total = num(ctx.total);
    const linked = num(ctx.linked);
    const rate = num(ctx.linkRate);
    const amount = num(ctx.totalAmountEur);
    return [
      `**${linked}/${total}** invoices link to a transaction (${Math.round(rate * 100)}%).`,
      `Total invoiced: ${fmtEur(amount, 0)}.`,
      `Linked invoices override the spend-based factor with line-item categorisation, lifting confidence on those transactions.`,
    ].join(" ");
  },

  "tax-savings": (ctx) => {
    const total = num(ctx.totalSavingsEur);
    const annual = num(ctx.annualProjection);
    const cats = (ctx.categories as Array<{ category: string; potentialSavingsEur: number; topAlternative: string | null }>) ?? [];
    return [
      `Total potential savings this month: **${fmtEur(total, 0)}** (${fmtEur(annual, 0)}/yr).`,
      cats[0]
        ? `${cats[0].category} leads at ${fmtEur(cats[0].potentialSavingsEur, 0)}${cats[0].topAlternative ? ` via ${cats[0].topAlternative}` : ""}.`
        : "",
    ].filter(Boolean).join(" ");
  },

  "free-form": (ctx) => {
    const month = str(ctx.month, "this month");
    const run = ctx.latestRun as { state?: string; finalCo2eKg?: number; finalConfidence?: number } | null;
    if (!run) return `Nothing closed yet for ${month}. Run a close to get a footprint, confidence, and reserve recommendation.`;
    return [
      `${month}: **${fmtKg(num(run.finalCo2eKg))}** at ${Math.round(num(run.finalConfidence) * 100)}% confidence (${str(run.state)}).`,
      `Ask about a specific category, the reserve, or a cluster — I'll pull the numbers.`,
    ].join(" ");
  },
};

export const mockNarrate = (
  builder: BuilderKey,
  ctx: Record<string, unknown>,
  scope: ScopeArgs,
  question: string,
  isFollowUp: boolean,
): string => {
  const intent = isFollowUp ? detectIntent(question) : "general";
  const fn = narrators[builder] ?? narrators["free-form"];
  const out = fn(ctx, scope, intent, question);
  if (!out)
    return "I can answer that in a moment — try one of the suggested questions for now (mock mode).";
  return out;
};
