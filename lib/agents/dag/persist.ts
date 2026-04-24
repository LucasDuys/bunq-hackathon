/**
 * Per-agent observability writes — R002 / T002.
 *
 * Each LLM-using DAG agent records exactly one `agent_messages` row at the
 * end of its run summarising whether it took the live API path or its
 * `buildMock()` fallback, plus token usage. `runDag` reads these rows back
 * to compute `mock_agent_count` and to emit one `agent.<name>.fallback_to_mock`
 * audit event per mocked agent (intended in `ANTHROPIC_MOCK=1`, degradation
 * otherwise — the distinction lives in the audit payload, not the column).
 */
import { db, agentMessages } from "@/lib/db/client";
import type { AgentContext, AgentName } from "./types";

export interface RecordAgentMessageInput {
  agentName: AgentName;
  /** `false` when the agent reached the Anthropic API; `true` when it fell back to or chose `buildMock()`. */
  usedMock: boolean;
  tokensIn?: number;
  tokensOut?: number;
  cached?: boolean;
  serverToolUseCount?: number;
  webSearchRequests?: number;
  /**
   * Optional rendered content snippet for human inspection. Kept short — most
   * agents persist a one-line tag rather than the full LLM payload.
   */
  content?: string;
}

/**
 * Record a single agent_messages row. No-op when `ctx.agentRunId` is missing,
 * which keeps spendBaseline (the deterministic, no-LLM agent) and standalone
 * unit tests free of orphan rows.
 */
export const recordAgentMessage = (ctx: AgentContext, input: RecordAgentMessageInput): void => {
  if (!ctx.agentRunId) return;
  db.insert(agentMessages)
    .values({
      agentRunId: ctx.agentRunId,
      agentName: input.agentName,
      role: "assistant",
      content: input.content ?? (input.usedMock ? "[mock_path]" : "[live_path]"),
      tokensIn: input.tokensIn ?? null,
      tokensOut: input.tokensOut ?? null,
      cached: input.cached ?? false,
      serverToolUseCount: input.serverToolUseCount ?? null,
      webSearchRequests: input.webSearchRequests ?? null,
      mockPath: input.usedMock ? 1 : 0,
    })
    .run();
};
