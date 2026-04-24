import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { MODEL_HAIKU, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import { db, merchantCategoryCache } from "@/lib/db/client";
import { ALL_CATEGORIES, SUB_CATEGORIES_BY_CATEGORY } from "@/lib/factors";
import { normalizeMerchant, tryRules } from "./rules";

export type Classification = {
  category: string;
  subCategory: string | null;
  confidence: number;
  source: "rule" | "llm" | "cache" | "fallback";
};

const OUTPUT_SCHEMA = z.object({
  category: z.enum(ALL_CATEGORIES as [string, ...string[]]),
  subCategory: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

const llmClassify = async (merchant: string, description: string | null): Promise<Classification> => {
  if (isAnthropicMock()) {
    return { category: "other", subCategory: null, confidence: 0.4, source: "fallback" };
  }
  const client = anthropic();
  const prompt = `You classify business transaction merchants into carbon-accounting categories.
Categories: ${ALL_CATEGORIES.join(", ")}.
Sub-categories per category: ${JSON.stringify(SUB_CATEGORIES_BY_CATEGORY)}.
Return JSON: { "category": "<one of>", "subCategory": "<one of sub-cats or null>", "confidence": 0..1, "rationale": "<short>" }.
If unsure, use category "other", subCategory null, confidence <0.5.

Merchant: "${merchant}"
Description: "${description ?? ""}"`;

  const msg = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "other", subCategory: null, confidence: 0.3, source: "fallback" };
  try {
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonMatch[0]));
    return { category: parsed.category, subCategory: parsed.subCategory, confidence: parsed.confidence, source: "llm" };
  } catch {
    return { category: "other", subCategory: null, confidence: 0.3, source: "fallback" };
  }
};

export const classifyMerchant = async (rawMerchant: string, description: string | null = null): Promise<Classification> => {
  const norm = normalizeMerchant(rawMerchant);

  // Cache
  const cached = db.select().from(merchantCategoryCache).where(eq(merchantCategoryCache.merchantNorm, norm)).all();
  if (cached.length > 0) {
    const c = cached[0];
    return { category: c.category, subCategory: c.subCategory, confidence: c.confidence, source: "cache" };
  }

  // Rules
  const ruled = tryRules(norm);
  if (ruled && ruled.confidence >= 0.85) {
    db.insert(merchantCategoryCache)
      .values({ merchantNorm: norm, category: ruled.category, subCategory: ruled.subCategory, confidence: ruled.confidence, source: "rule" })
      .run();
    return { ...ruled, source: "rule" };
  }

  // LLM
  const llm = await llmClassify(norm, description);
  db.insert(merchantCategoryCache)
    .values({ merchantNorm: norm, category: llm.category, subCategory: llm.subCategory, confidence: llm.confidence, source: llm.source })
    .run();
  return llm;
};

export const reclassifyMerchant = async (norm: string, newCategory: string, newSubCategory: string | null, confidence = 0.95) => {
  db.insert(merchantCategoryCache)
    .values({ merchantNorm: norm, category: newCategory, subCategory: newSubCategory, confidence, source: "refinement" })
    .onConflictDoUpdate({
      target: merchantCategoryCache.merchantNorm,
      set: { category: newCategory, subCategory: newSubCategory, confidence, source: "refinement" },
    })
    .run();
};
