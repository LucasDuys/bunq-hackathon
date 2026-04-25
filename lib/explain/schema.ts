import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant"]);

export const explainMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1).max(4000),
});

export const explainScopeSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    category: z.string().min(1).max(64).optional(),
    runId: z.string().min(1).max(128).optional(),
    phase: z.string().min(1).max(64).optional(),
    alternativeId: z.string().min(1).max(128).optional(),
    baselineKey: z.string().min(1).max(256).optional(),
    topic: z.string().min(1).max(128).optional(),
  })
  .strict();

export const explainRequestSchema = z.object({
  metric: z.string().min(1).max(64),
  scope: explainScopeSchema.default({}),
  messages: z.array(explainMessageSchema).max(32).default([]),
});

export type ExplainRequest = z.infer<typeof explainRequestSchema>;
export type ExplainMessage = z.infer<typeof explainMessageSchema>;
export type ExplainScope = z.infer<typeof explainScopeSchema>;

/**
 * SSE event envelope sent over `text/event-stream`.
 * Wire format per event: `data: <json>\n\n`.
 *  - `headline`  fired once at the start with the server-rendered first line
 *  - `delta`     incremental text from the LLM (or templated mock)
 *  - `done`      end of stream (client closes the reader)
 *  - `error`     fatal error; client should surface as a toast
 *  - `meta`      tokens/cache info, fired before `done`
 */
export type ExplainEvent =
  | { type: "headline"; value: string }
  | { type: "delta"; value: string }
  | { type: "meta"; tokensIn?: number; tokensOut?: number; cached?: boolean }
  | { type: "done" }
  | { type: "error"; message: string };
