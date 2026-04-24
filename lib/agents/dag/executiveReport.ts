import type {
  AgentContext,
  BaselineOutput,
  CostJudgeOutput,
  CreditStrategyOutput,
  ExecReportOutput,
  GreenJudgeOutput,
} from "./types";
import { sampleRun } from "./fixtures";

export const SYSTEM_PROMPT = `You are the Executive Report Agent for Carbon Autopilot for bunq Business.

Your job is to convert approved judged outputs from the Green Judge Agent, Cost Judge Agent, and Carbon Credit & Incentive Strategy Agent into a PDF-ready executive report and dashboard data object.

You must not invent recommendations. Only include recommendations approved or approved_with_caveats by the judge agents.

Matrix logic:
- Low cost / low carbon: best recommendations
- High cost / low carbon: ESG-positive but finance-sensitive
- Low cost / high carbon: cost-saving but carbon-risk
- High cost / high carbon: avoid or replace

Output JSON schema: see docs/agents/07-executive-report.md.`;

export interface ExecReportInput {
  greenJudge: GreenJudgeOutput;
  costJudge: CostJudgeOutput;
  creditStrategy: CreditStrategyOutput;
  baseline: BaselineOutput;
}

export async function run(input: ExecReportInput, _ctx: AgentContext): Promise<ExecReportOutput> {
  return {
    ...sampleRun.executiveReport,
    company_id: input.baseline.company_id,
    analysis_period: input.baseline.analysis_period,
  };
}
