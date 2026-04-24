/**
 * Anthropic call helper for the 7-agent DAG.
 * - Injects the agent's system prompt as a cache_control ephemeral block (5-min prompt cache).
 * - Extracts JSON from the response (robust to code fences).
 * - Records cached-read / creation token counts so the caller can log to agent_messages.
 *
 * Every DAG agent goes through this wrapper so caching + parsing live in one place.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";

export type LlmCallResult = {
  jsonText: string | null;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
  cached: boolean;
};

export type LlmCallOptions = {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export const isMock = () => isAnthropicMock();

export const callAgent = async (opts: LlmCallOptions): Promise<LlmCallResult> => {
  const client = anthropic();
  const systemBlock = {
    type: "text" as const,
    text: opts.system,
    cache_control: { type: "ephemeral" as const },
  };
  const msg = (await client.messages.create({
    model: opts.model ?? MODEL_SONNET,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.2,
    system: [systemBlock] as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming["system"],
    messages: [{ role: "user", content: opts.user }],
  })) as Anthropic.Messages.Message & {
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };

  const rawText = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  const match = rawText.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : null;

  const usage = msg.usage ?? {};
  const tokensIn = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const cached = (usage.cache_read_input_tokens ?? 0) > 0;
  const tokensOut = usage.output_tokens ?? 0;

  return { jsonText, rawText, tokensIn, tokensOut, cached };
};
