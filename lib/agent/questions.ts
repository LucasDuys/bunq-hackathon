import { z } from "zod";
import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import { SUB_CATEGORIES_BY_CATEGORY } from "@/lib/factors";
import type { Cluster } from "./close";

const QUESTION_SCHEMA = z.object({
  clusterId: z.string(),
  question: z.string(),
  options: z.array(z.object({ label: z.string(), category: z.string(), subCategory: z.string().nullable() })).min(2).max(5),
});
const OUTPUT_SCHEMA = z.object({ questions: z.array(QUESTION_SCHEMA).min(1).max(3) });

export type RefinementQuestion = z.infer<typeof QUESTION_SCHEMA>;

const mockQuestions = (clusters: Cluster[]): RefinementQuestion[] => {
  return clusters.slice(0, 3).map((c) => {
    const likely = c.likelyCategory ?? "procurement";
    const subs = SUB_CATEGORIES_BY_CATEGORY[likely] ?? ["electronics", "office_supplies"];
    return {
      clusterId: c.id,
      question: `${c.merchantLabel}: what did ${c.totalSpendEur.toFixed(0)} EUR of spend cover this month?`,
      options: subs.slice(0, 4).map((s) => ({ label: s.replace(/_/g, " "), category: likely, subCategory: s })),
    };
  });
};

export const generateRefinementQuestions = async (clusters: Cluster[]): Promise<RefinementQuestion[]> => {
  if (clusters.length === 0) return [];
  if (isAnthropicMock()) return mockQuestions(clusters);

  const client = anthropic();
  const prompt = `You are a carbon accounting assistant. You must ask AT MOST 3 high-impact multiple-choice questions to resolve emission-factor uncertainty in the following transaction clusters. Each question should target the single cluster where the answer most reduces uncertainty × spend.

Available categories and sub-categories: ${JSON.stringify(SUB_CATEGORIES_BY_CATEGORY)}.

Clusters (sorted by impact descending):
${clusters.slice(0, 6).map((c, i) => `${i + 1}. id=${c.id} merchant="${c.merchantLabel}" spend=€${c.totalSpendEur.toFixed(0)} currentCategory=${c.likelyCategory ?? "unknown"} classifierConfidence=${c.avgClassifierConfidence.toFixed(2)}`).join("\n")}

Return JSON: { "questions": [ { "clusterId": "<id>", "question": "<question text>", "options": [ {"label": "<user-friendly>", "category": "<cat>", "subCategory": "<sub or null>"} ... ] } ] }
Use plain English; each option must map to a valid (category, subCategory) pair. Maximum 3 questions. Skip clusters that won't materially change the total.`;

  const msg = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return mockQuestions(clusters);
  try {
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(m[0]));
    return parsed.questions;
  } catch {
    return mockQuestions(clusters);
  }
};
