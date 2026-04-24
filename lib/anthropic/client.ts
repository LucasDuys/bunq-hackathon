import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let _client: Anthropic | null = null;
export const anthropic = () => {
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicKey });
  return _client;
};

export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";
export const isAnthropicMock = () => env.anthropicMock || !env.anthropicKey;
