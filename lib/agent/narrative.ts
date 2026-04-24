import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";

export const generateCsrdNarrative = async (params: {
  month: string;
  totalCo2eKg: number;
  confidence: number;
  topCategories: Array<{ category: string; co2eKg: number; spendEur: number }>;
  reserveEur: number;
  creditTonnes: number;
  euPct: number;
}): Promise<string> => {
  if (isAnthropicMock() || !process.env.ANTHROPIC_API_KEY) {
    const { month, totalCo2eKg, confidence, topCategories, reserveEur, creditTonnes, euPct } = params;
    return [
      `In ${month}, reported Scope 3 emissions were estimated at ${(totalCo2eKg / 1000).toFixed(2)} tCO₂e with ${(confidence * 100).toFixed(0)}% data-quality confidence (spend-based method, Exiobase/DEFRA 2024 factors).`,
      `Top emission drivers: ${topCategories.slice(0, 3).map((c) => `${c.category} (${(c.co2eKg / 1000).toFixed(2)} tCO₂e)`).join(", ")}.`,
      `A Carbo Reserve of €${reserveEur.toFixed(2)} was allocated, funding ${creditTonnes.toFixed(2)} tCO₂e of carbon credits (${euPct.toFixed(0)}% EU-based, removal-weighted).`,
      `Methodology: GHG Protocol Scope 3 Category 1/6; data-quality Tier 3 unless refined; uncertainty quantified per category. Credit recommendations exclude non-EU offsets per policy.`,
    ].join(" ");
  }
  const client = anthropic();
  const msg = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Write a 4-sentence CSRD ESRS E1 narrative summary for ${params.month}. Inputs: totalCo2eKg=${params.totalCo2eKg}, confidence=${params.confidence}, topCategories=${JSON.stringify(params.topCategories)}, reserveEur=${params.reserveEur}, creditTonnes=${params.creditTonnes}, euPct=${params.euPct}. Be factual, cite methodology (spend-based, GHG Protocol, DEFRA/Exiobase), state uncertainty.`,
    }],
  });
  return msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
};
