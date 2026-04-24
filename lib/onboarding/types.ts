import { z } from "zod";
import { policySchema } from "@/lib/policy/schema";
import { companyProfileSchema } from "./profile";

export const questionKindEnum = z.enum(["multiple_choice", "free_text", "numeric", "confirm"]);
export type QuestionKind = z.infer<typeof questionKindEnum>;

/**
 * The interviewer picks the next question. It also tells us whether we can
 * draft yet (done=true) and, when done, whether a couple of free-text answers
 * should be re-parsed into structured profile fields first.
 */
export const interviewerOutputSchema = z.object({
  done: z.boolean(),
  nextQuestion: z
    .object({
      topic: z.string().min(1),
      kind: questionKindEnum,
      question: z.string().min(3),
      options: z.array(z.string()).max(5).optional(),
      required: z.boolean().default(true),
      rationale: z.string().min(1),
    })
    .nullable(),
  profileDelta: companyProfileSchema.partial().optional(),
});
export type InterviewerOutput = z.infer<typeof interviewerOutputSchema>;

export const drafterOutputSchema = z.object({
  policy: policySchema,
  markdown: z.string().min(200),
  creditShortlist: z.array(z.string()).max(3),
  calibrationNotes: z.string().min(10),
});
export type DrafterOutput = z.infer<typeof drafterOutputSchema>;

/**
 * The parser reads an uploaded policy document and produces:
 *   - `partial`: whatever parts of the schema it could fill
 *   - `profile`: any company profile fields it inferred
 *   - `gaps`: schema fields it couldn't fill (interviewer will target these)
 *   - `unsupported`: concepts in the source doc that don't map to our schema
 */
export const parserGapSchema = z.object({
  field: z.string(),
  reason: z.string(),
  suggested: z.unknown().optional(),
});
export type ParserGap = z.infer<typeof parserGapSchema>;

export const parserUnsupportedSchema = z.object({
  found: z.string(),
  severity: z.enum(["warn", "error"]),
  note: z.string(),
});
export type ParserUnsupported = z.infer<typeof parserUnsupportedSchema>;

/**
 * We accept a very loose "partial" policy from the LLM and only strictly
 * validate during draft. This keeps the parser resilient to hallucinated
 * shapes while still writing useful structured data.
 */
export const partialPolicySchema = z
  .object({
    reserveRules: z
      .array(
        z.object({
          category: z.string(),
          method: z.string(),
          value: z.number(),
        }),
      )
      .optional(),
    approvalThresholdEur: z.number().optional(),
    creditPreference: z
      .object({
        region: z.string().optional(),
        types: z.array(z.string()).optional(),
        minRemovalPct: z.number().optional(),
      })
      .optional(),
    maxReservePerMonthEur: z.number().optional(),
  })
  .partial();
export type PartialPolicy = z.infer<typeof partialPolicySchema>;

export const parserOutputSchema = z.object({
  partial: partialPolicySchema,
  profile: companyProfileSchema,
  gaps: z.array(parserGapSchema),
  unsupported: z.array(parserUnsupportedSchema),
});
export type ParserOutput = z.infer<typeof parserOutputSchema>;

export const EMPTY_PARSER_OUTPUT: ParserOutput = {
  partial: {},
  profile: {},
  gaps: [],
  unsupported: [],
};
