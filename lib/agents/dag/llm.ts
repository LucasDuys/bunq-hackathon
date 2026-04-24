/**
 * Anthropic call helpers for the 7-agent DAG.
 * - `callAgent` — JSON-only agents with cached system prompt (5-min prompt cache).
 * - `callAgentWithTools` — toolRunner loop (native web_search + custom Zod tools), returns
 *   collected server-tool-use counts, citation blocks, and any data dropped into a
 *   recorder-style terminal tool. Used by the Research Agent (plans/matrix-research.md §3).
 */
import type Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolUnion,
  BetaWebSearchResultBlock,
} from "@anthropic-ai/sdk/resources/beta.mjs";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool.mjs";
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

export type WebSearchHit = {
  query: string;
  title: string;
  url: string;
  snippet: string | null;
  fetchedAt: number;
};

export type ToolRunResult = {
  finalMessage: Anthropic.Beta.Messages.BetaMessage;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
  cached: boolean;
  webSearchRequests: number;
  serverToolUseCount: number;
  webSearchHits: WebSearchHit[]; // harvested from web_search_tool_result blocks
};

export type ToolCallOptions = {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
  /** Native server tools (web_search, web_fetch) + custom tools made with betaZodTool(). */
  tools: Array<BetaToolUnion | BetaRunnableTool<any>>;
};

/**
 * Execute a tool-using agent loop via Anthropic's BetaToolRunner. The caller wires the
 * tools (native + custom) and supplies the cached system prompt; we harvest citation +
 * server-tool-use metadata out of the final message so every research call is auditable.
 */
export const callAgentWithTools = async (opts: ToolCallOptions): Promise<ToolRunResult> => {
  const client = anthropic();
  const systemBlock: BetaTextBlockParam = {
    type: "text",
    text: opts.system,
    cache_control: { type: "ephemeral" },
  };
  const userMessage: BetaMessageParam = {
    role: "user",
    content: [{ type: "text", text: opts.user }],
  };

  const runner = client.beta.messages.toolRunner({
    model: opts.model ?? MODEL_SONNET,
    max_tokens: opts.maxTokens ?? 4000,
    max_iterations: opts.maxIterations ?? 6,
    temperature: opts.temperature ?? 0.15,
    system: [systemBlock],
    tools: opts.tools,
    messages: [userMessage],
  });

  const finalMessage = await runner.done();
  const usage = (finalMessage.usage ?? {}) as {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };

  const rawText = finalMessage.content
    .filter((c): c is Extract<BetaContentBlock, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Pull evidence out of server web_search_tool_result blocks.
  const webSearchHits: WebSearchHit[] = [];
  // Map tool_use_id → originating query so we can label each hit.
  const queryById = new Map<string, string>();
  for (const block of finalMessage.content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string } | null)?.query;
      if (q) queryById.set(block.id, q);
    }
  }
  for (const block of finalMessage.content) {
    if (block.type !== "web_search_tool_result") continue;
    const q = queryById.get(block.tool_use_id) ?? "";
    const content = block.content as BetaWebSearchResultBlock[] | { error_code: string };
    if (!Array.isArray(content)) continue;
    for (const r of content) {
      webSearchHits.push({
        query: q,
        title: r.title,
        url: r.url,
        snippet: null,
        fetchedAt: Math.floor(Date.now() / 1000),
      });
    }
  }

  const tokensIn =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  const cached = (usage.cache_read_input_tokens ?? 0) > 0;
  const tokensOut = usage.output_tokens ?? 0;
  const webSearchRequests = usage.server_tool_use?.web_search_requests ?? 0;
  const serverToolUseCount = finalMessage.content.filter((c) => c.type === "server_tool_use").length;

  return {
    finalMessage,
    rawText,
    tokensIn,
    tokensOut,
    cached,
    webSearchRequests,
    serverToolUseCount,
    webSearchHits,
  };
};
