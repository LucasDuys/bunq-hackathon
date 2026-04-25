import { NextResponse, type NextRequest } from "next/server";
import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import { DEFAULT_ORG_ID, getActivePolicyRaw, getOrg } from "@/lib/queries";
import { buildContextForMetric } from "@/lib/explain/context";
import { mockNarrate } from "@/lib/explain/mock";
import { METRIC_REGISTRY, isMetricKey, type MetricKey } from "@/lib/explain/metrics";
import { buildSystemPrelude, buildUserMessage } from "@/lib/explain/prompt";
import {
  explainRequestSchema,
  type ExplainEvent,
  type ExplainMessage,
} from "@/lib/explain/schema";
import { sseFrame, sseHeaders, streamTextChunks } from "@/lib/explain/sse";

export const runtime = "nodejs";

const parsePolicy = (raw: string | undefined | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export async function POST(req: NextRequest) {
  let parsed;
  try {
    const body = await req.json();
    parsed = explainRequestSchema.safeParse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { metric, scope, messages } = parsed.data;
  if (!isMetricKey(metric)) {
    return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
  }

  const orgId = DEFAULT_ORG_ID;
  const entry = METRIC_REGISTRY[metric as MetricKey];
  const context = buildContextForMetric(entry.builder, scope, orgId);
  const headline = entry.headline(scope, context);

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const isFollowUp = messages.filter((m) => m.role === "user").length > 1;
  const userQuestion = lastUser?.content ?? "Explain this.";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (event: ExplainEvent) => {
        try {
          controller.enqueue(sseFrame(event));
        } catch {
          // controller may already be closed if the client aborted
        }
      };

      const aborted = req.signal;
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      aborted.addEventListener("abort", onAbort);

      try {
        // Always emit the headline first so the panel paints instantly.
        safeEnqueue({ type: "headline", value: headline });

        if (isAnthropicMock()) {
          const narrative = mockNarrate(entry.builder, context, scope, userQuestion, isFollowUp);
          for await (const chunk of streamTextChunks(narrative)) {
            if (aborted.aborted) break;
            safeEnqueue({ type: "delta", value: chunk });
          }
          safeEnqueue({ type: "meta", tokensIn: 0, tokensOut: 0, cached: false });
          safeEnqueue({ type: "done" });
          return;
        }

        const org = getOrg(orgId) ?? null;
        const policy = parsePolicy(getActivePolicyRaw(orgId)?.rules ?? null);
        const prelude = buildSystemPrelude(org, policy);

        const conversation: ExplainMessage[] = messages;
        const userMessage = buildUserMessage({
          metric,
          scope,
          context,
          history: conversation,
          question: userQuestion,
        });

        const client = anthropic();
        const live = client.messages.stream({
          model: MODEL_SONNET,
          max_tokens: 800,
          temperature: 0.3,
          system: [
            { type: "text", text: prelude, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userMessage }],
        });

        let tokensIn = 0;
        let tokensOut = 0;
        let cached = false;

        for await (const event of live) {
          if (aborted.aborted) break;
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta" && delta.text) {
              safeEnqueue({ type: "delta", value: delta.text });
            }
          } else if (event.type === "message_delta") {
            const usage = event.usage as
              | {
                  output_tokens?: number;
                  input_tokens?: number;
                  cache_read_input_tokens?: number;
                  cache_creation_input_tokens?: number;
                }
              | undefined;
            if (usage) {
              tokensOut = usage.output_tokens ?? tokensOut;
              tokensIn =
                (usage.input_tokens ?? 0) +
                (usage.cache_read_input_tokens ?? 0) +
                (usage.cache_creation_input_tokens ?? 0);
              cached = (usage.cache_read_input_tokens ?? 0) > 0;
            }
          }
        }

        safeEnqueue({ type: "meta", tokensIn, tokensOut, cached });
        safeEnqueue({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[explain] stream error:", message);
        safeEnqueue({ type: "error", message });
      } finally {
        aborted.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
