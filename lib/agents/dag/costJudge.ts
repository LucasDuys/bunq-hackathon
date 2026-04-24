/**
 * Cost Judge Agent — validates Cost Savings output.
 *
 * Strict on annualization (annualize recurring only), math, and business-risk hygiene.
 * Code re-checks every number the judge approves. The judge's verdict is not a license to
 * change monetary totals without evidence.
 */
import { z } from "zod";
import type { AgentContext, CostSavingsOutput, CostJudgeOutput, ResearchedPool } from "./types";
import { callAgent, isMock } from "./llm";

const TRUSTED_DOMAINS = new Set([
  "defra.gov.uk",
  "gov.uk",
  "ec.europa.eu",
  "ember-climate.org",
  "ember-energy.org",
  "ademe.fr",
  "base-carbone.ademe.fr",
  "ghgprotocol.org",
  "science.org",
  "transportenvironment.org",
  "ipcc.ch",
  "flexera.com",
  "aws.amazon.com",
]);

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
};

const evidenceQualityFor = (
  clusterId: string | null,
  pool: ResearchedPool | undefined,
): { quality: number; sourceCount: number; trustedCount: number } => {
  const sources = clusterId && pool ? pool[clusterId]?.flatMap((a) => a.sources) ?? [] : [];
  const sourceCount = sources.length;
  if (sourceCount === 0) return { quality: 0, sourceCount, trustedCount: 0 };
  const trustedCount = sources.filter((s) => TRUSTED_DOMAINS.has(domainOf(s.url))).length;
  let q = 0.3;
  q += Math.min(0.3, Math.max(0, sourceCount - 1) * 0.1);
  if (trustedCount > 0) q += 0.25;
  const nowSec = Math.floor(Date.now() / 1000);
  const freshest = Math.min(...sources.map((s) => nowSec - s.fetched_at));
  if (freshest < 30 * 86_400) q += 0.15;
  return { quality: Number(Math.min(1, q).toFixed(3)), sourceCount, trustedCount };
};

export const SYSTEM_PROMPT = `You are the Cost Judge Agent for Carbon Autopilot for bunq Business.

Your job is to evaluate, correct, approve, or reject the outputs from the Cost Savings Agent.

You are strict. You do not allow fake savings, bad annualization, weak assumptions, or recommendations that ignore business risk.

Evaluation criteria:
1. Savings calculation is mathematically correct.
2. Recurring and one-time savings are separated.
3. Annualized savings are justified.
4. Alternative is comparable.
5. Business risk is stated.
6. Confidence matches evidence.
7. No invented live pricing unless source exists.
8. Company-scale extrapolation is valid.
9. Cost recommendation does not secretly increase carbon without flagging it.
10. Missing data is explicitly stated.

Scoring:
- 90–100: strong, CFO-ready.
- 75–89: usable with minor caveats.
- 60–74: usable as directional estimate.
- 40–59: needs validation.
- 0–39: reject.

Return STRICT JSON only, no prose, no code fences.

Output JSON schema: see docs/agents/05-cost-judge.md.`;

const VERDICT = z.enum(["approved", "approved_with_caveats", "needs_context", "rejected"]);

const JUDGED_SCHEMA = z.object({
  cluster_id: z.string().nullable(),
  transaction_id: z.string().nullable(),
  cost_score: z.number().min(0).max(100),
  verdict: VERDICT,
  approved_recommendation: z.string().nullable(),
  corrected_monthly_saving_eur: z.number().nullable(),
  corrected_annual_saving_eur: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  business_risk: z.enum(["low", "medium", "high"]),
  carbon_effect: z.enum(["lower", "neutral", "higher", "unknown"]),
  issues_found: z.array(z.string()),
  audit_summary: z.string(),
});

const OUTPUT_SCHEMA = z.object({ judged_results: z.array(JUDGED_SCHEMA) });

export interface CostJudgeInput {
  costSavings: CostSavingsOutput;
  researchedPool?: ResearchedPool;
}

const scoreResult = (
  r: CostSavingsOutput["results"][number],
  pool: ResearchedPool | undefined,
): { score: number; issues: string[]; evidenceQuality: number; sourceCount: number } => {
  const issues: string[] = [];
  const topOpt = r.cost_saving_options[0];
  if (!topOpt) {
    issues.push("no option proposed");
    return { score: 20, issues, evidenceQuality: 0, sourceCount: 0 };
  }
  let base = 100;
  if (topOpt.source === "assumption") {
    base -= 25;
    issues.push("source=assumption");
  }
  if (topOpt.source === "simulated") {
    base -= 15;
    issues.push("source=simulated");
  }
  if ((topOpt.estimated_annual_saving_eur ?? 0) <= 0 && (topOpt.one_time_saving_eur ?? 0) <= 0) {
    base -= 40;
    issues.push("no dollar saving asserted");
  }
  if (topOpt.business_risk === "high") {
    base -= 20;
    issues.push("business_risk=high");
  }
  if (r.current_spend.data_basis === "assumption") {
    base -= 15;
    issues.push("spend basis is an assumption");
  }
  const { quality, sourceCount, trustedCount } = evidenceQualityFor(r.cluster_id, pool);
  if (sourceCount === 0) {
    base -= 35;
    issues.push("zero_sources");
  } else if (sourceCount === 1) {
    issues.push("single_source_only");
  }
  if (trustedCount === 0 && sourceCount > 0) issues.push("no_trusted_source");
  const confidenceComponent = topOpt.confidence * 100;
  const score = Math.max(0, Math.min(100, (base + confidenceComponent) / 2));
  return { score: Number(score.toFixed(0)), issues, evidenceQuality: quality, sourceCount };
};

const verdictForScore = (score: number, sourceCount: number): z.infer<typeof VERDICT> => {
  if (sourceCount === 0) return "rejected";
  if (score >= 85) return "approved";
  if (score >= 70) return "approved_with_caveats";
  if (score >= 50) return "needs_context";
  return "rejected";
};

const correctMath = (r: CostSavingsOutput["results"][number]): { monthly: number | null; annual: number | null; recurring: boolean } => {
  const topOpt = r.cost_saving_options[0];
  if (!topOpt) return { monthly: null, annual: null, recurring: false };
  const annual = topOpt.estimated_annual_saving_eur ?? 0;
  const monthly = topOpt.estimated_monthly_saving_eur ?? (annual > 0 ? annual / 12 : 0);
  const recurring = r.current_spend.data_basis === "recurring_pattern";
  return {
    monthly: monthly > 0 ? Number(monthly.toFixed(0)) : null,
    annual: recurring ? Number(annual.toFixed(0)) : topOpt.one_time_saving_eur ?? Number(annual.toFixed(0)),
    recurring,
  };
};

const buildMock = (costSavings: CostSavingsOutput, pool: ResearchedPool | undefined): CostJudgeOutput => {
  const judged = costSavings.results.map((r) => {
    const { score, issues, evidenceQuality, sourceCount } = scoreResult(r, pool);
    const verdict = verdictForScore(score, sourceCount);
    const { monthly, annual } = correctMath(r);
    const topOpt = r.cost_saving_options[0];
    return {
      cluster_id: r.cluster_id,
      transaction_id: r.transaction_id,
      cost_score: score,
      verdict,
      approved_recommendation: verdict === "rejected" ? null : topOpt?.option_name ?? r.recommended_action,
      corrected_monthly_saving_eur: verdict === "rejected" ? 0 : monthly,
      corrected_annual_saving_eur: verdict === "rejected" ? 0 : annual,
      confidence: Number(((topOpt?.confidence ?? 0.5) * (score / 100)).toFixed(3)),
      business_risk: topOpt?.business_risk ?? "medium",
      carbon_effect: topOpt?.carbon_effect ?? "unknown",
      issues_found: issues,
      audit_summary: `${verdict} (${score}/100, evidence=${evidenceQuality}): ${issues.length ? issues.join("; ") : "passes checks"}`,
    };
  });

  const approved = judged.filter((j) => j.verdict === "approved" || j.verdict === "approved_with_caveats");
  return {
    agent: "cost_judge_agent",
    company_id: costSavings.company_id,
    analysis_period: costSavings.analysis_period,
    judged_results: judged,
    summary: {
      approved_total_monthly_saving_eur: Number(
        approved.reduce((s, j) => s + (j.corrected_monthly_saving_eur ?? 0), 0).toFixed(0),
      ),
      approved_total_annual_saving_eur: Number(
        approved.reduce((s, j) => s + (j.corrected_annual_saving_eur ?? 0), 0).toFixed(0),
      ),
      high_confidence_cost_opportunities: approved
        .filter((j) => j.cost_score >= 85)
        .map((j) => j.approved_recommendation)
        .filter((s): s is string => !!s),
      rejected_or_uncertain_items: judged
        .filter((j) => j.verdict === "rejected" || j.verdict === "needs_context")
        .map((j) => j.approved_recommendation ?? j.cluster_id ?? "unknown"),
    },
  };
};

export async function run(input: CostJudgeInput, ctx: AgentContext): Promise<CostJudgeOutput> {
  if (isMock()) {
    const out = buildMock(input.costSavings, input.researchedPool);
    for (const j of out.judged_results) {
      await ctx.auditLog({ type: "agent.cost_judge.verdict", payload: { cluster_id: j.cluster_id, verdict: j.verdict, score: j.cost_score } });
    }
    return out;
  }
  try {
    const { jsonText } = await callAgent({
      system: SYSTEM_PROMPT,
      user: [
        "Cost Savings output to judge:",
        JSON.stringify(input.costSavings, null, 2),
        "",
        "Return strict JSON: { judged_results: [...] }. One judged_results entry per agent result, in the same order.",
      ].join("\n"),
      maxTokens: 3000,
    });
    if (!jsonText) return buildMock(input.costSavings, input.researchedPool);
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonText));
    const rebuilt = parsed.judged_results.map((j, i) => {
      const source = input.costSavings.results[i];
      if (!source) return j;
      const { monthly, annual } = correctMath(source);
      const { sourceCount, quality: evidenceQuality } = evidenceQualityFor(source.cluster_id, input.researchedPool);
      const finalVerdict: z.infer<typeof VERDICT> = sourceCount === 0 ? "rejected" : j.verdict;
      const extraIssues = sourceCount === 0 ? [...j.issues_found, "zero_sources"] : j.issues_found;
      return {
        ...j,
        verdict: finalVerdict,
        corrected_monthly_saving_eur: finalVerdict === "rejected" ? 0 : monthly,
        corrected_annual_saving_eur: finalVerdict === "rejected" ? 0 : annual,
        issues_found: extraIssues,
        audit_summary: `${j.audit_summary} | evidence=${evidenceQuality}`,
      };
    });
    const approved = rebuilt.filter((j) => j.verdict === "approved" || j.verdict === "approved_with_caveats");
    for (const j of rebuilt) {
      await ctx.auditLog({ type: "agent.cost_judge.verdict", payload: { cluster_id: j.cluster_id, verdict: j.verdict, score: j.cost_score } });
    }
    return {
      agent: "cost_judge_agent",
      company_id: input.costSavings.company_id,
      analysis_period: input.costSavings.analysis_period,
      judged_results: rebuilt,
      summary: {
        approved_total_monthly_saving_eur: Number(
          approved.reduce((s, j) => s + (j.corrected_monthly_saving_eur ?? 0), 0).toFixed(0),
        ),
        approved_total_annual_saving_eur: Number(
          approved.reduce((s, j) => s + (j.corrected_annual_saving_eur ?? 0), 0).toFixed(0),
        ),
        high_confidence_cost_opportunities: approved
          .filter((j) => j.cost_score >= 85)
          .map((j) => j.approved_recommendation)
          .filter((s): s is string => !!s),
        rejected_or_uncertain_items: rebuilt
          .filter((j) => j.verdict === "rejected" || j.verdict === "needs_context")
          .map((j) => j.approved_recommendation ?? j.cluster_id ?? "unknown"),
      },
    };
  } catch {
    return buildMock(input.costSavings, input.researchedPool);
  }
}
