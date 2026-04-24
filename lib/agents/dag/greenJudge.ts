/**
 * Green Judge Agent — validates Green Alternatives output.
 *
 * Mock mode scores each result deterministically:
 *   - evidence completeness (sources + rationale)
 *   - confidence calibration
 *   - math sanity (carbon_saving_kg vs baseline × delta)
 * Live mode (Sonnet 4.6) gets the full proposal + factor table and returns structured verdicts.
 * In both paths we re-verify math in code — the judge's verdict cannot shift numbers without
 * the code also recomputing them. This matches the "math stays deterministic" rule.
 */
import { z } from "zod";
import type { AgentContext, GreenAltOutput, GreenJudgeOutput } from "./types";
import { callAgent, isMock } from "./llm";

export const SYSTEM_PROMPT = `You are the Green Judge Agent for Carbon Autopilot for bunq Business.

Your job is to evaluate, correct, approve, or reject outputs from the Green Alternatives Agent.

You are strict. You do not reward vague sustainability claims. You only approve recommendations that are evidence-based, comparable, and useful for business action.

Evaluation criteria:
1. Correct category mapping.
2. Reasonable emission factor.
3. Clear current estimate.
4. Clear alternative estimate.
5. Valid carbon saving calculation.
6. Confidence is justified by evidence quality.
7. Alternative is functionally comparable.
8. Policy handling is correct.
9. Reduction is separated from offsetting.
10. Missing data is explicitly stated.

Scoring:
- 90–100: strong, evidence-backed, ready for report.
- 75–89: usable with minor caveats.
- 60–74: usable only as low-confidence insight.
- 40–59: needs user/context validation.
- 0–39: reject.

Return STRICT JSON only, no prose, no code fences.

Output JSON schema: see docs/agents/04-green-judge.md.`;

const VERDICT = z.enum(["approved", "approved_with_caveats", "needs_context", "rejected"]);

const JUDGED_SCHEMA = z.object({
  cluster_id: z.string().nullable(),
  transaction_id: z.string().nullable(),
  green_score: z.number().min(0).max(100),
  verdict: VERDICT,
  approved_recommendation: z.string().nullable(),
  corrected_current_kg_co2e: z.number().nullable(),
  corrected_potential_kg_co2e_saved: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  issues_found: z.array(z.string()),
  audit_summary: z.string(),
});

const OUTPUT_SCHEMA = z.object({ judged_results: z.array(JUDGED_SCHEMA) });

export interface GreenJudgeInput {
  greenAlt: GreenAltOutput;
}

const scoreResult = (r: GreenAltOutput["results"][number]): { score: number; issues: string[] } => {
  const issues: string[] = [];
  const topAlt = r.alternatives[0];
  const evidence = topAlt?.comparability_notes?.length ?? 0;
  const confidencePenalty = topAlt ? Math.max(0, 0.6 - topAlt.confidence) * 80 : 40;
  let evidenceScore = 100;
  if (!topAlt) {
    evidenceScore = 25;
    issues.push("no alternative proposed");
  } else {
    if (evidence < 20) {
      evidenceScore -= 25;
      issues.push("rationale too short");
    }
    if (topAlt.source === "assumption") {
      evidenceScore -= 20;
      issues.push("source=assumption");
    }
    if ((topAlt.carbon_saving_percent ?? 0) > 0) {
      evidenceScore -= 10;
      issues.push("positive carbon_saving_percent sign flipped");
    }
  }
  const confidenceComponent = (topAlt?.confidence ?? r.current_purchase.confidence) * 100;
  const score = Math.max(0, Math.min(100, (evidenceScore + confidenceComponent) / 2 - confidencePenalty));
  if (r.recommendation_status === "needs_context") issues.push("agent self-reported needs_context");
  return { score: Number(score.toFixed(0)), issues };
};

const verdictForScore = (score: number): z.infer<typeof VERDICT> => {
  if (score >= 85) return "approved";
  if (score >= 70) return "approved_with_caveats";
  if (score >= 50) return "needs_context";
  return "rejected";
};

const correctMath = (r: GreenAltOutput["results"][number]): { current: number | null; saved: number | null } => {
  const current = r.current_purchase.estimated_kg_co2e;
  const topAlt = r.alternatives[0];
  if (!topAlt || current === null) return { current, saved: null };
  const pct = topAlt.carbon_saving_percent ?? 0;
  const saved = pct !== 0 ? Math.abs((current * pct) / 100) : topAlt.carbon_saving_kg;
  return { current, saved: saved ?? 0 };
};

const buildMock = (greenAlt: GreenAltOutput): GreenJudgeOutput => {
  const judged = greenAlt.results.map((r) => {
    const { score, issues } = scoreResult(r);
    const verdict = verdictForScore(score);
    const { current, saved } = correctMath(r);
    return {
      cluster_id: r.cluster_id,
      transaction_id: r.transaction_id,
      green_score: score,
      verdict,
      approved_recommendation:
        verdict === "rejected" ? null : r.alternatives[0]?.alternative_name ?? r.recommended_action,
      corrected_current_kg_co2e: current,
      corrected_potential_kg_co2e_saved: verdict === "rejected" ? 0 : saved,
      confidence: Number(((r.alternatives[0]?.confidence ?? 0.5) * (score / 100)).toFixed(3)),
      issues_found: issues,
      audit_summary: `${verdict} (${score}/100): ${issues.length ? issues.join("; ") : "passes checks"}`,
    };
  });

  const approved = judged.filter((j) => j.verdict === "approved" || j.verdict === "approved_with_caveats");
  return {
    agent: "green_judge_agent",
    company_id: greenAlt.company_id,
    analysis_period: greenAlt.analysis_period,
    judged_results: judged,
    summary: {
      approved_total_current_kg_co2e: Number(
        approved.reduce((s, j) => s + (j.corrected_current_kg_co2e ?? 0), 0).toFixed(1),
      ),
      approved_total_potential_kg_co2e_saved: Number(
        approved.reduce((s, j) => s + (j.corrected_potential_kg_co2e_saved ?? 0), 0).toFixed(1),
      ),
      high_confidence_green_opportunities: approved
        .filter((j) => j.green_score >= 85)
        .map((j) => j.approved_recommendation)
        .filter((s): s is string => !!s),
      rejected_or_uncertain_items: judged
        .filter((j) => j.verdict === "rejected" || j.verdict === "needs_context")
        .map((j) => j.approved_recommendation ?? j.cluster_id ?? "unknown"),
    },
  };
};

const buildUserMessage = (greenAlt: GreenAltOutput): string => {
  return [
    `Green Alternatives output to judge:`,
    JSON.stringify(greenAlt, null, 2),
    "",
    "Return strict JSON: { judged_results: [...] }. One judged_results entry per agent result, in the same order.",
  ].join("\n");
};

export async function run(input: GreenJudgeInput, ctx: AgentContext): Promise<GreenJudgeOutput> {
  if (isMock()) {
    const out = buildMock(input.greenAlt);
    for (const j of out.judged_results) {
      await ctx.auditLog({ type: "agent.green_judge.verdict", payload: { cluster_id: j.cluster_id, verdict: j.verdict, score: j.green_score } });
    }
    return out;
  }
  try {
    const { jsonText } = await callAgent({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(input.greenAlt),
      maxTokens: 3000,
    });
    if (!jsonText) return buildMock(input.greenAlt);
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonText));
    // Even when Sonnet returns verdicts, we recompute math from the original proposal —
    // the judge cannot invent numbers. We keep Sonnet's score + verdict + issues + summary text.
    const rebuilt = parsed.judged_results.map((j, i) => {
      const source = input.greenAlt.results[i];
      if (!source) return j;
      const { current, saved } = correctMath(source);
      return {
        ...j,
        corrected_current_kg_co2e: current,
        corrected_potential_kg_co2e_saved: j.verdict === "rejected" ? 0 : saved,
      };
    });
    const approved = rebuilt.filter((j) => j.verdict === "approved" || j.verdict === "approved_with_caveats");
    for (const j of rebuilt) {
      await ctx.auditLog({ type: "agent.green_judge.verdict", payload: { cluster_id: j.cluster_id, verdict: j.verdict, score: j.green_score } });
    }
    return {
      agent: "green_judge_agent",
      company_id: input.greenAlt.company_id,
      analysis_period: input.greenAlt.analysis_period,
      judged_results: rebuilt,
      summary: {
        approved_total_current_kg_co2e: Number(
          approved.reduce((s, j) => s + (j.corrected_current_kg_co2e ?? 0), 0).toFixed(1),
        ),
        approved_total_potential_kg_co2e_saved: Number(
          approved.reduce((s, j) => s + (j.corrected_potential_kg_co2e_saved ?? 0), 0).toFixed(1),
        ),
        high_confidence_green_opportunities: approved
          .filter((j) => j.green_score >= 85)
          .map((j) => j.approved_recommendation)
          .filter((s): s is string => !!s),
        rejected_or_uncertain_items: rebuilt
          .filter((j) => j.verdict === "rejected" || j.verdict === "needs_context")
          .map((j) => j.approved_recommendation ?? j.cluster_id ?? "unknown"),
      },
    };
  } catch {
    return buildMock(input.greenAlt);
  }
}
