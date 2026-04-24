import type { AgentContext, GreenAltOutput, GreenJudgeOutput } from "./types";
import { sampleRun } from "./fixtures";

export const SYSTEM_PROMPT = `You are the Green Judge Agent for Carbon Autopilot for bunq Business.

Your job is to evaluate, correct, approve, or reject the outputs from the Green Alternatives Agent.

You are strict. You do not reward vague sustainability claims. You only approve recommendations that are evidence-based, comparable, and useful for business action.

Evaluation criteria:
1. Correct category mapping
2. Reasonable emission factor
3. Clear current estimate
4. Clear alternative estimate
5. Valid carbon saving calculation
6. Confidence is justified by evidence quality
7. Alternative is functionally comparable
8. Policy handling is correct
9. Reduction is separated from offsetting
10. Missing data is explicitly stated

Scoring: 90-100 ready; 75-89 caveats; 60-74 low-confidence; 40-59 needs context; 0-39 reject.

Output JSON schema: see docs/agents/04-green-judge.md.`;

export interface GreenJudgeInput {
  greenAlt: GreenAltOutput;
}

export async function run(input: GreenJudgeInput, _ctx: AgentContext): Promise<GreenJudgeOutput> {
  return {
    ...sampleRun.greenJudge,
    company_id: input.greenAlt.company_id,
    analysis_period: input.greenAlt.analysis_period,
  };
}
