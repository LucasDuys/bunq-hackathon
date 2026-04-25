/**
 * Single-shot E2E live run with deep per-agent introspection.
 *
 * Forces real Anthropic calls (no mock), runs the 8-agent DAG once, queries
 * agent_messages for per-agent tokens + mock-path, then writes a markdown
 * report at .forge/reports/e2e-live-<timestamp>.md so future runs can be
 * diffed against this snapshot.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/dag-e2e-live.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Force live mode for THIS process only — never mutate .env.local.
process.env.ANTHROPIC_MOCK = "0";

process.on("uncaughtException", (err) => {
  process.stderr.write(`[e2e] UNCAUGHT EXCEPTION: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(13);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[e2e] UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}\n`);
  process.exit(14);
});
process.on("exit", (code) => {
  process.stderr.write(`[e2e] process.exit fired with code ${code}\n`);
});
// Cap research scope so a single E2E run doesn't fire 360 web_search calls.
// Baseline produces ~20 priority targets; 2 clusters with 1 search each keeps
// total wall time reasonable while exercising the live web_search path.
process.env.RESEARCH_MAX_CLUSTERS = process.env.RESEARCH_MAX_CLUSTERS ?? "2";
process.env.RESEARCH_MAX_SEARCHES_PER_CLUSTER = process.env.RESEARCH_MAX_SEARCHES_PER_CLUSTER ?? "1";

// Research is now LIVE by default (the SDK 0.91.0 toolRunner silent-exit bug
// was resolved by switching `runner.done()` -> `runner.runUntilDone()` in
// lib/agents/dag/llm.ts). Override with RESEARCH_DISABLED=1 if you want the
// deterministic template fallback for cost/latency reasons.
process.env.RESEARCH_DISABLED = process.env.RESEARCH_DISABLED ?? "0";

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const REPORTS_DIR = join(process.cwd(), ".forge", "reports");
const REPORT_PATH = join(REPORTS_DIR, `e2e-live-${TIMESTAMP}.md`);

const ORG_ID = "org_acme_bv";
const MONTH = "2026-03";

const STAGE_ORDER = [
  "spend_emissions_baseline_agent",
  "research_agent",
  "green_alternatives_agent",
  "cost_savings_agent",
  "green_judge_agent",
  "cost_judge_agent",
  "carbon_credit_incentive_strategy_agent",
  "executive_report_agent",
] as const;

type AgentName = (typeof STAGE_ORDER)[number];

const STAGE_DESCRIPTION: Record<AgentName, { input: string; role: string }> = {
  spend_emissions_baseline_agent: {
    input: "orgId, month — pulls transactions from sqlite",
    role: "Deterministic SQL agg + factor lookup. No LLM. Produces baseline + priority targets.",
  },
  research_agent: {
    input: "baseline.priority_targets, agentRunId",
    role: "Sonnet + native web_search. Finds 2-4 real alternatives per cluster with source URLs. 30-day cache.",
  },
  green_alternatives_agent: {
    input: "baseline + researchedPool",
    role: "Sonnet (plain JSON). Ranks lower-carbon alternatives per cluster, pre-resolved tools.",
  },
  cost_savings_agent: {
    input: "baseline + researchedPool",
    role: "Sonnet (plain JSON). Proposes cost wins per cluster, pre-resolved tools.",
  },
  green_judge_agent: {
    input: "greenAlt output + researchedPool",
    role: "Sonnet validator. Hard rule in code: zero-source recommendations auto-rejected. Math re-verified.",
  },
  cost_judge_agent: {
    input: "costSavings output + researchedPool",
    role: "Sonnet validator. Same drift discipline as Green Judge.",
  },
  carbon_credit_incentive_strategy_agent: {
    input: "greenJudge + costJudge approved + baseline",
    role: "Sonnet for prose only. All math deterministic in code (compute()).",
  },
  executive_report_agent: {
    input: "all prior outputs",
    role: "Sonnet for narrative only. Numbers deterministic. Produces matrix quadrants + top recommendations.",
  },
};

type AgentMsgRow = {
  agentName: string;
  tokensIn: number | null;
  tokensOut: number | null;
  cached: boolean;
  mockPath: number | null;
  serverToolUseCount: number | null;
  webSearchRequests: number | null;
};

const log = (msg: string) => {
  process.stderr.write(`[e2e] ${msg}\n`);
};

const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`);

const truncate = (obj: unknown, maxChars = 1500): string => {
  const json = JSON.stringify(obj, null, 2);
  if (json.length <= maxChars) return json;
  return json.slice(0, maxChars) + `\n... [truncated ${json.length - maxChars} chars]`;
};

const main = async () => {
  mkdirSync(REPORTS_DIR, { recursive: true });

  log("[1/8] importing modules...");
  const { runDag } = await import("@/lib/agents/dag");
  const { db } = await import("@/lib/db/client");
  const { agentMessages } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { appendAudit, verifyChain } = await import("@/lib/audit/append");
  const { isAnthropicMock } = await import("@/lib/anthropic/client");
  log("[2/8] modules loaded.");

  if (isAnthropicMock()) {
    log("ABORT: ANTHROPIC_MOCK still resolves true; live run impossible.");
    process.exit(2);
  }
  log(`[3/8] live mode confirmed. ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`);
  log(`# org=${ORG_ID} month=${MONTH} clusters=${process.env.RESEARCH_MAX_CLUSTERS} searches/cluster=${process.env.RESEARCH_MAX_SEARCHES_PER_CLUSTER} research_disabled=${process.env.RESEARCH_DISABLED}`);

  const auditEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const t0 = performance.now();

  log("[4/8] invoking runDag — this will burn real tokens...");
  let result: Awaited<ReturnType<typeof runDag>>;
  try {
    result = await runDag(
      { orgId: ORG_ID, month: MONTH },
      {
        orgId: ORG_ID,
        analysisPeriod: MONTH,
        dryRun: true,
        mock: false,
        auditLog: async (event) => {
          auditEvents.push(event);
          const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
          log(`  [+${elapsed}s] ${event.type}`);
          appendAudit({ orgId: ORG_ID, actor: "agent", type: event.type, payload: event.payload });
        },
      },
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`runDag threw: ${reason}`);
    writeFileSync(REPORT_PATH, `# E2E live run FAILED\n\n- timestamp: ${TIMESTAMP}\n- error: ${reason}\n`);
    process.exit(1);
  }

  const totalMs = performance.now() - t0;
  log(`[5/8] runDag completed in ${fmtMs(totalMs)}. runId=${result.runId}`);

  // Persist into agent_runs + impact_recommendations so the run is browsable
  // at /agents/[runId] and seeds the /impacts workspace. Same path as
  // POST /api/impacts/research; mock=false because we're actually live here.
  try {
    const { persistDagRun } = await import("@/lib/impacts/store");
    persistDagRun({ orgId: ORG_ID, month: MONTH, dag: result, mock: false });
    log(`[5a] persisted to agent_runs as ${result.runId}`);
  } catch (err) {
    log(`[5a] persistDagRun failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  log("[6/8] querying agent_messages for per-agent tokens + mock_path...");
  const msgRows = db
    .select({
      agentName: agentMessages.agentName,
      tokensIn: agentMessages.tokensIn,
      tokensOut: agentMessages.tokensOut,
      cached: agentMessages.cached,
      mockPath: agentMessages.mockPath,
      serverToolUseCount: agentMessages.serverToolUseCount,
      webSearchRequests: agentMessages.webSearchRequests,
    })
    .from(agentMessages)
    .where(eq(agentMessages.agentRunId, result.runId))
    .all() as AgentMsgRow[];

  const byAgent = new Map<string, AgentMsgRow[]>();
  for (const r of msgRows) {
    const arr = byAgent.get(r.agentName) ?? [];
    arr.push(r);
    byAgent.set(r.agentName, arr);
  }

  const verdict = verifyChain(ORG_ID);
  log(`[7/8] audit chain verify: ${JSON.stringify(verdict)}`);

  // Build the markdown report.
  const lines: string[] = [];
  lines.push(`# DAG End-to-End Live Run — ${TIMESTAMP}`);
  lines.push("");
  lines.push("> Single real-LLM execution of the 8-agent DAG with per-agent introspection.");
  lines.push("> Diff future `e2e-live-*.md` against this file to track regressions.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **runId**: \`${result.runId}\``);
  lines.push(`- **Total wall time**: ${fmtMs(totalMs)}`);
  lines.push(`- **Org / month**: ${ORG_ID} / ${MONTH}`);
  const researchLive = process.env.RESEARCH_DISABLED !== "1";
  lines.push(`- **Mode**: LIVE Anthropic for ${researchLive ? "all 7" : "6/7"} LLM agents${researchLive ? " (research uses native web_search)" : "; research forced to template path"}.`);
  lines.push(`- **Research scope**: max ${process.env.RESEARCH_MAX_CLUSTERS} clusters × ${process.env.RESEARCH_MAX_SEARCHES_PER_CLUSTER} searches each${researchLive ? "" : " (capped, but unused while RESEARCH_DISABLED=1)"}`);
  lines.push(`- **Audit chain**: ${verdict.valid ? `valid (${(verdict as { count?: number }).count ?? "?"} events)` : `BROKEN at id ${(verdict as { brokenAtId?: number }).brokenAtId}`}`);
  lines.push(`- **Audit events emitted by runDag**: ${auditEvents.length}`);
  let totalIn = 0;
  let totalOut = 0;
  let mockCount = 0;
  for (const r of msgRows) {
    totalIn += r.tokensIn ?? 0;
    totalOut += r.tokensOut ?? 0;
    if (r.mockPath === 1) mockCount += 1;
  }
  lines.push(`- **Tokens (live)**: in=${totalIn} out=${totalOut}`);
  lines.push(`- **Agents that took mock path**: ${mockCount} / 7 (expected 0 for live)`);
  lines.push("");

  lines.push("## Pipeline flow");
  lines.push("");
  lines.push("```");
  lines.push("[1] spend_emissions_baseline_agent  (deterministic SQL, no LLM)");
  lines.push("       │ baseline + priority_targets");
  lines.push("       ▼");
  lines.push("[2] research_agent                  (Sonnet + web_search)");
  lines.push("       │ researchedPool keyed by cluster_id");
  lines.push("       ├──────────────────────────────┐");
  lines.push("       ▼                              ▼");
  lines.push("[3] green_alternatives_agent    [4] cost_savings_agent     (parallel)");
  lines.push("       │ greenAlt.results              │ costSavings.results");
  lines.push("       ▼                              ▼");
  lines.push("[5] green_judge_agent           [6] cost_judge_agent       (parallel)");
  lines.push("       │ approved green                │ approved cost");
  lines.push("       └──────────────┬───────────────┘");
  lines.push("                      ▼");
  lines.push("[7] carbon_credit_incentive_strategy_agent  (Sonnet prose, deterministic math)");
  lines.push("                      │ creditStrategy.summary.net_company_scale_financial_impact_eur");
  lines.push("                      ▼");
  lines.push("[8] executive_report_agent          (Sonnet narrative, deterministic numbers)");
  lines.push("                      │ matrix + top_recommendations");
  lines.push("                      ▼");
  lines.push("                  DagRunResult");
  lines.push("```");
  lines.push("");

  lines.push("## Per-agent details");
  lines.push("");
  lines.push("| # | Agent | Latency | Tokens in | Tokens out | Cached | Mock path | Web searches | Tool calls |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const name = STAGE_ORDER[i];
    const m = result.metrics[name as AgentName];
    const rows = byAgent.get(name) ?? [];
    const inSum = rows.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
    const outSum = rows.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
    const cached = rows.some((r) => r.cached);
    const mock = rows.some((r) => r.mockPath === 1);
    const ws = rows.reduce((s, r) => s + (r.webSearchRequests ?? 0), 0);
    const tc = rows.reduce((s, r) => s + (r.serverToolUseCount ?? 0), 0);
    lines.push(
      `| ${i + 1} | ${name} | ${fmtMs(m?.latencyMs ?? 0)} | ${inSum} | ${outSum} | ${cached ? "y" : "n"} | ${mock ? "**y**" : "n"} | ${ws} | ${tc} |`,
    );
  }
  lines.push("");

  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const name = STAGE_ORDER[i];
    const m = result.metrics[name as AgentName];
    const desc = STAGE_DESCRIPTION[name];
    lines.push(`### Stage ${i + 1} — \`${name}\``);
    lines.push("");
    lines.push(`- **Latency**: ${fmtMs(m?.latencyMs ?? 0)}`);
    lines.push(`- **Input**: ${desc.input}`);
    lines.push(`- **Role**: ${desc.role}`);
    lines.push("");
    lines.push("**Output excerpt:**");
    lines.push("");
    lines.push("```json");
    let snippet: unknown;
    switch (name) {
      case "spend_emissions_baseline_agent":
        snippet = {
          total_spend_eur: result.baseline.baseline.total_spend_eur,
          estimated_total_tco2e: result.baseline.baseline.estimated_total_tco2e,
          baseline_confidence: result.baseline.baseline.baseline_confidence,
          priority_target_count: result.baseline.priority_targets.length,
          required_context_question: result.baseline.required_context_question,
          first_priority_target: result.baseline.priority_targets[0] ?? null,
        };
        break;
      case "research_agent":
        snippet = {
          clusters_researched: result.research.summary.clusters_researched,
          total_alternatives: result.research.summary.total_alternatives,
          total_sources: result.research.summary.total_sources,
          total_searches_used: result.research.summary.total_searches_used,
          cache_hits: result.research.summary.cache_hits,
          web_search_spend_eur: result.research.summary.web_search_spend_eur,
          first_result_sample: result.research.results[0] ?? null,
        };
        break;
      case "green_alternatives_agent":
        snippet = {
          result_count: result.greenAlt.results.length,
          summary: result.greenAlt.summary,
          first_result: result.greenAlt.results[0] ?? null,
        };
        break;
      case "cost_savings_agent":
        snippet = {
          result_count: result.costSavings.results.length,
          summary: result.costSavings.summary,
          first_result: result.costSavings.results[0] ?? null,
        };
        break;
      case "green_judge_agent":
        snippet = {
          judged_count: result.greenJudge.judged_results.length,
          summary: result.greenJudge.summary,
          first_judged: result.greenJudge.judged_results[0] ?? null,
        };
        break;
      case "cost_judge_agent":
        snippet = {
          judged_count: result.costJudge.judged_results.length,
          summary: result.costJudge.summary,
          first_judged: result.costJudge.judged_results[0] ?? null,
        };
        break;
      case "carbon_credit_incentive_strategy_agent":
        snippet = {
          jurisdiction: result.creditStrategy.jurisdiction,
          baseline: result.creditStrategy.baseline,
          summary: result.creditStrategy.summary,
          result_count: result.creditStrategy.results.length,
          first_result: result.creditStrategy.results[0] ?? null,
        };
        break;
      case "executive_report_agent":
        snippet = {
          report_title: result.executiveReport.report_title,
          executive_summary: result.executiveReport.executive_summary,
          kpis: result.executiveReport.kpis,
          top_recommendations: result.executiveReport.top_recommendations,
          matrix: result.executiveReport.matrix,
          limitations: result.executiveReport.limitations,
        };
        break;
    }
    lines.push(truncate(snippet, 1800));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Headline numbers (for diffing)");
  lines.push("");
  lines.push("```json");
  lines.push(
    truncate(
      {
        net_company_scale_financial_impact_eur:
          result.creditStrategy.summary.total_net_company_scale_financial_impact_eur,
        emissions_reduced_tco2e: result.creditStrategy.summary.total_emissions_reduced_tco2e,
        recommended_credit_purchase_cost_eur:
          result.creditStrategy.summary.total_recommended_credit_purchase_cost_eur,
        tax_advisor_review_required: result.creditStrategy.summary.tax_advisor_review_required,
        kpis: result.executiveReport.kpis,
      },
      2400,
    ),
  );
  lines.push("```");
  lines.push("");

  lines.push("## Audit events emitted by this run");
  lines.push("");
  for (const e of auditEvents) {
    lines.push(`- \`${e.type}\` — ${truncate(e.payload, 220)}`);
  }
  lines.push("");

  lines.push("## Run notes");
  lines.push("");
  lines.push(`- ANTHROPIC_MOCK was forced to "0" for this process; .env.local untouched.`);
  lines.push(`- Audit events were appended via the live audit chain (verify result above).`);
  lines.push(`- Web-search spend estimate: €${result.research.summary.web_search_spend_eur.toFixed(4)}.`);
  lines.push(`- Compare future live runs against this report by diffing the headline numbers + per-agent latency table.`);
  lines.push("");
  lines.push("## Resolved issue — research toolRunner crash");
  lines.push("");
  lines.push("**Status: RESOLVED.** Anthropic SDK 0.91.0's `BetaToolRunner.done()` returns its `#completion` promise without consuming the async iterator (see `node_modules/@anthropic-ai/sdk/.../BetaToolRunner.ts:369-371`). The promise never resolves, the event loop drains, Node exits cleanly with code 0 and no output.");
  lines.push("");
  lines.push("Fix: swap `await runner.done()` → `await runner.runUntilDone()` at `lib/agents/dag/llm.ts:139`. `runUntilDone()` consumes the iterator first via `for await (const _ of this)` then awaits completion. One-line change, no SDK upgrade needed.");
  lines.push("");
  lines.push("Use `RESEARCH_DISABLED=1` only if you want the deterministic template fallback for cost or latency reasons.");
  lines.push("");

  log("[8/8] writing report...");
  writeFileSync(REPORT_PATH, lines.join("\n"));
  log(`report written: ${REPORT_PATH}`);
  log(`done. total wall time: ${fmtMs(totalMs)}, runId: ${result.runId}`);
};

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
