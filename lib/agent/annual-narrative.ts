import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import type { CarbonReport } from "@/lib/reports/schema";

/**
 * Generates qualitative narrative for sections Carbo's ledger cannot fill
 * deterministically (E1-1 transition plan, materiality framing). Mock
 * fallback emits a clearly-labelled stub so the report renders without
 * silently passing fabricated targets off as the company's own.
 */

const FALLBACK_TRANSITION = (r: CarbonReport): string => {
  const lines: string[] = [
    `STUB - requires human review and approval before publication.`,
    "",
    `${r.company} is in the process of formalising its climate transition plan.`,
    `Based on ${r.reportingYear} ledger data (${r.emissions.totalTco2e ?? "unknown"} tCO2e total), the largest reduction levers are:`,
  ];
  const cat1 = r.emissions.scope3.find((s) => s.category === "cat1_purchased_goods_services" && s.tco2e !== null);
  const cat6 = r.emissions.scope3.find((s) => s.category === "cat6_business_travel" && s.tco2e !== null);
  const scope1Tco2e = r.emissions.scope1.totalTco2e;
  if (cat1?.tco2e) lines.push(`- Scope 3 Cat 1 (purchased goods & services): ${cat1.tco2e.toFixed(1)} tCO2e. Lever: supplier engagement, refurbished electronics, lower-carbon cloud regions.`);
  if (cat6?.tco2e) lines.push(`- Scope 3 Cat 6 (business travel): ${cat6.tco2e.toFixed(1)} tCO2e. Lever: short-haul flights to rail, rideshare to public transport.`);
  if (scope1Tco2e && scope1Tco2e > 0) lines.push(`- Scope 1 (combustion): ${scope1Tco2e.toFixed(1)} tCO2e. Lever: fleet electrification, renewable contract for charging.`);
  lines.push("", "No SBTi-validated reduction targets are in place. The Carbon Reserve sub-account funds removal-weighted EU credits while reduction levers are deployed.");
  return lines.join("\n");
};

export const generateAnnualTransitionPlan = async (r: CarbonReport): Promise<string> => {
  if (isAnthropicMock() || !process.env.ANTHROPIC_API_KEY) return FALLBACK_TRANSITION(r);

  const cat1 = r.emissions.scope3.find((s) => s.category === "cat1_purchased_goods_services" && s.tco2e !== null);
  const cat6 = r.emissions.scope3.find((s) => s.category === "cat6_business_travel" && s.tco2e !== null);

  const prompt = `Write a 120-180 word climate transition plan stub for the ${r.reportingYear} annual report of "${r.company}". This is a stub the company will edit. Open with the line: "STUB - requires human review and approval before publication."

Then describe the climate transition plan in plain English, organised around the largest reduction levers given the data:
- Total: ${r.emissions.totalTco2e ?? "unknown"} tCO2e (${r.emissions.totalScope1And2Tco2e ?? "unknown"} Scope 1+2)
- Scope 1 fuel: ${r.emissions.scope1.totalTco2e ?? 0} tCO2e
- Scope 3 Cat 1 (purchased goods/services): ${cat1?.tco2e ?? 0} tCO2e
- Scope 3 Cat 6 (business travel): ${cat6?.tco2e ?? 0} tCO2e

Mention concrete levers per category (refurb electronics, low-carbon cloud regions, rail vs short-haul flights, fleet electrification). State that no SBTi-validated targets are in place yet. Reference the Carbon Reserve mechanism for funding EU-registered removal credits while reduction is in flight. No emoji. No motivational closers.`;

  try {
    const client = anthropic();
    const msg = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")
      .trim();
    return text || FALLBACK_TRANSITION(r);
  } catch {
    return FALLBACK_TRANSITION(r);
  }
};

export const enrichWithNarrative = async (r: CarbonReport): Promise<CarbonReport> => {
  // If a prior-year fixture already carried a transition plan forward, keep it
  // (carried-forward content takes precedence over a freshly generated stub).
  if (r.transitionPlanSummary) return r;
  const transitionPlanSummary = await generateAnnualTransitionPlan(r);
  return { ...r, transitionPlanSummary };
};
