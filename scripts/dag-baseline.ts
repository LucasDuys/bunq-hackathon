/**
 * Mock baseline harness — R011 / T007.
 *
 * Repeatable DAG runner that batches `runDag()` invocations and produces a
 * markdown report so we can measure per-agent latency, JSON-parse failures,
 * mock-path usage, and inter-agent errors without watching logs.
 *
 *   npx tsx scripts/dag-baseline.ts            # 5 mock runs
 *   npx tsx scripts/dag-baseline.ts --runs 10  # 10 mock runs
 *   npx tsx scripts/dag-baseline.ts --live     # 5 live runs (one-off, costs $$)
 *
 * `--live` only unsets ANTHROPIC_MOCK for THIS process; .env.local is never
 * mutated. Mock is the default so accidental runs don't burn API credits.
 *
 * Implementation note: `lib/env.ts` reads ANTHROPIC_MOCK once at module-init.
 * Static imports hoist before any module code runs, so we set/unset the flag
 * here and then dynamic-import everything that touches env. That keeps the
 * `--live` toggle process-scoped without leaking into other tooling.
 *
 * `parse_ok` is a coarse proxy: an agent is considered to have parsed OK iff
 * it either reached its mock branch (mock data is always valid by construction)
 * or it took the live path (in which case the only way to fail Zod parse today
 * is to throw, which is caught at the run level — no per-agent signal yet).
 * Tightening this requires plumbing `parseOk` through `AgentRunMetrics`, which
 * is R011 follow-up scope, not T007 scope.
 */
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- argv scan ----------------------------------------------------------
type CliArgs = { runs: number; live: boolean };
const parseArgs = (argv: string[]): CliArgs => {
  let runs = 5;
  let live = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--live") live = true;
    else if (a === "--runs") {
      const next = argv[i + 1];
      const n = Number(next);
      if (!Number.isFinite(n) || n < 1) {
        console.error(`--runs requires a positive integer, got: ${next}`);
        process.exit(2);
      }
      runs = Math.floor(n);
      i++;
    }
  }
  return { runs, live };
};
const args = parseArgs(process.argv.slice(2));

// --- env toggle (BEFORE dynamic import) ---------------------------------
if (args.live) {
  // isAnthropicMock() = env.anthropicMock || !env.anthropicKey. Deleting the
  // env var lets `flag()` fall through to its default (true) — but the default
  // is true (mock). To actually go live we must explicitly set it to "0" so
  // the flag() helper resolves to false. Belt + suspenders: also keep the API
  // key intact (required for live).
  process.env.ANTHROPIC_MOCK = "0";
} else {
  process.env.ANTHROPIC_MOCK = "1";
}

// Dynamic imports happen inside main() because tsx transpiles to CJS and
// top-level await isn't available in that target. Type-only imports are
// fine (erased at compile-time, no runtime read of lib/env).
import type { AgentName, DagRunResult } from "@/lib/agents/dag/types";

// Late-bound runtime deps. Populated by main() AFTER the env toggle so
// `lib/env.ts` captures the right ANTHROPIC_MOCK value.
type Deps = {
  runDag: typeof import("@/lib/agents/dag").runDag;
  db: typeof import("@/lib/db/client").db;
  agentMessages: typeof import("@/lib/db/client").agentMessages;
  eq: typeof import("drizzle-orm").eq;
  env: typeof import("@/lib/env").env;
};

// --- types --------------------------------------------------------------
type AgentStats = {
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cached: boolean;
  used_mock: boolean;
  parse_ok: boolean;
};
type RunOk = {
  ok: true;
  idx: number;
  wallMs: number;
  result: DagRunResult;
  perAgent: Record<AgentName, AgentStats>;
};
type RunFail = {
  ok: false;
  idx: number;
  wallMs: number;
  stage: string;
  reason: string;
};
type Run = RunOk | RunFail;

const AGENT_ORDER: AgentName[] = [
  "spend_emissions_baseline_agent",
  "research_agent",
  "green_alternatives_agent",
  "cost_savings_agent",
  "green_judge_agent",
  "cost_judge_agent",
  "carbon_credit_incentive_strategy_agent",
  "executive_report_agent",
];

// --- one run -----------------------------------------------------------
const ORG_ID = "org_acme_bv";
const MONTH = "2026-03";

const runOnce = async (idx: number, deps: Deps): Promise<Run> => {
  const start = performance.now();
  try {
    const result = await deps.runDag(
      { orgId: ORG_ID, month: MONTH },
      {
        orgId: ORG_ID,
        analysisPeriod: MONTH,
        dryRun: true,
        mock: !args.live,
        auditLog: async () => {},
      },
    );
    const wallMs = performance.now() - start;

    // Aggregate mock_path counts from agent_messages keyed to this runId.
    // R002 invariant: each LLM-using agent writes exactly one row per run;
    // spendBaseline writes none. We default `used_mock` to false for agents
    // with no row (i.e. the deterministic spendBaseline agent).
    const rows = deps.db
      .select({ agentName: deps.agentMessages.agentName, mockPath: deps.agentMessages.mockPath })
      .from(deps.agentMessages)
      .where(deps.eq(deps.agentMessages.agentRunId, result.runId))
      .all();
    const mockByAgent: Record<string, boolean> = {};
    for (const r of rows) {
      if (r.mockPath === 1) mockByAgent[r.agentName] = true;
    }

    const perAgent = {} as Record<AgentName, AgentStats>;
    for (const name of AGENT_ORDER) {
      const m = result.metrics[name];
      const usedMock = mockByAgent[name] === true;
      // parse_ok proxy (R011 / T007): per the task brief, infer
      // `parse_ok = !usedMock || isMock()`. When a live-path agent fails Zod
      // parse today it falls back to its `buildMock()` branch, which flips
      // usedMock=true; but in mock mode that's expected, not a parse fault.
      // So the only signal we can tease out without expanding scope is:
      // a degradation-mode mock = parse failure. Everything else = OK.
      const isMockMode = deps.env.anthropicMock || !deps.env.anthropicKey;
      const parseOk = !usedMock || isMockMode;
      perAgent[name] = {
        latency_ms: m?.latencyMs ?? 0,
        tokens_in: m?.inputTokens ?? 0,
        tokens_out: m?.outputTokens ?? 0,
        cached: m?.cached ?? false,
        used_mock: usedMock,
        parse_ok: parseOk,
      };
    }
    return { ok: true, idx, wallMs, result, perAgent };
  } catch (e) {
    const wallMs = performance.now() - start;
    const err = e as Error & { stage?: string };
    return {
      ok: false,
      idx,
      wallMs,
      stage: err.stage ?? "unknown",
      reason: err.message ?? String(e),
    };
  }
};

// --- stats helpers -----------------------------------------------------
const sortedNum = (xs: number[]) => [...xs].sort((a, b) => a - b);
const percentile = (xs: number[], p: number): number => {
  if (xs.length === 0) return 0;
  const s = sortedNum(xs);
  if (s.length === 1) return s[0];
  // Nearest-rank (simple, deterministic, no interpolation).
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
};
const p50 = (xs: number[]) => percentile(xs, 50);
const p95 = (xs: number[]) => (xs.length < 4 ? Math.max(0, ...xs) : percentile(xs, 95));

// --- report writer -----------------------------------------------------
const fmtMs = (ms: number) => Math.round(ms).toString();
const fmtNum = (n: number) => n.toLocaleString("en-US");

const buildReport = (
  isoStamp: string,
  totalWallMs: number,
  runs: Run[],
): string => {
  const oks = runs.filter((r): r is RunOk => r.ok);
  const fails = runs.filter((r): r is RunFail => !r.ok);

  // Per-agent aggregates across all OK runs.
  const lines: string[] = [];
  lines.push(`# DAG Baseline Report — ${isoStamp}`);
  lines.push("");
  lines.push(`- Mode: ${args.live ? "live" : "mock"}`);
  lines.push(`- Runs: ${runs.length}`);
  lines.push(`- Total wall time: ${(totalWallMs / 1000).toFixed(2)}s`);
  lines.push(`- Failed runs: ${fails.length} / ${runs.length}`);
  lines.push("");
  lines.push(
    "> `parse_ok` is a coarse proxy in T007: live runs that don't throw are presumed parse-OK; mock runs are parse-OK by construction. Per-agent Zod parse signal is R011 follow-up scope.",
  );
  lines.push("");
  lines.push(`## Per-agent stats (across ${oks.length} successful run${oks.length === 1 ? "" : "s"})`);
  lines.push("");
  lines.push("| Agent | p50 ms | p95 ms | total tokens in | total out | mock count | parse fail count |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const name of AGENT_ORDER) {
    const lat: number[] = [];
    let tin = 0;
    let tout = 0;
    let mock = 0;
    let parseFail = 0;
    for (const r of oks) {
      const s = r.perAgent[name];
      lat.push(s.latency_ms);
      tin += s.tokens_in;
      tout += s.tokens_out;
      if (s.used_mock) mock++;
      if (!s.parse_ok) parseFail++;
    }
    lines.push(
      `| ${name} | ${fmtMs(p50(lat))} | ${fmtMs(p95(lat))} | ${fmtNum(tin)} | ${fmtNum(tout)} | ${mock} | ${parseFail} |`,
    );
  }
  lines.push("");

  lines.push("## Failures");
  lines.push("");
  if (fails.length === 0) {
    lines.push("none");
  } else {
    for (const f of fails) {
      lines.push(`- run ${f.idx}: stage=\`${f.stage}\` reason=\`${f.reason.replace(/\n/g, " ")}\``);
    }
  }
  lines.push("");

  lines.push("## Run[0] DagRunResult (for eyeball accuracy)");
  lines.push("");
  if (oks.length === 0) {
    lines.push("_no successful runs_");
  } else {
    lines.push("```json");
    lines.push(JSON.stringify(oks[0].result, null, 2));
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
};

// --- main --------------------------------------------------------------
const main = async () => {
  // Resolve runtime deps now that ANTHROPIC_MOCK is set (see top of file).
  const dagMod = await import("@/lib/agents/dag");
  const dbMod = await import("@/lib/db/client");
  const drizzle = await import("drizzle-orm");
  const envMod = await import("@/lib/env");
  const deps: Deps = {
    runDag: dagMod.runDag,
    db: dbMod.db,
    agentMessages: dbMod.agentMessages,
    eq: drizzle.eq,
    env: envMod.env,
  };

  const reportsDir = resolve(process.cwd(), ".forge", "reports");
  mkdirSync(reportsDir, { recursive: true });
  // Keep the directory present in git so fresh checkouts have somewhere to
  // write reports without an extra mkdir step.
  const gitkeep = resolve(reportsDir, ".gitkeep");
  if (!existsSync(gitkeep)) writeFileSync(gitkeep, "");

  console.log(`# dag-baseline — ${args.live ? "LIVE" : "mock"} | runs=${args.runs}`);
  if (args.live && !deps.env.anthropicKey) {
    console.error("--live requires ANTHROPIC_API_KEY in env. Aborting.");
    process.exit(2);
  }

  const totalStart = performance.now();
  const runs: Run[] = [];
  for (let i = 0; i < args.runs; i++) {
    process.stdout.write(`run ${i + 1}/${args.runs}... `);
    const r = await runOnce(i, deps);
    runs.push(r);
    console.log(r.ok ? `ok (${Math.round(r.wallMs)}ms)` : `FAIL (${r.stage}: ${r.reason})`);
  }
  const totalWallMs = performance.now() - totalStart;

  const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = resolve(reportsDir, `baseline-${isoStamp}.md`);
  const report = buildReport(isoStamp, totalWallMs, runs);
  writeFileSync(reportPath, report);
  console.log(`\nreport: ${reportPath}`);
  console.log(`total wall: ${(totalWallMs / 1000).toFixed(2)}s | failed: ${runs.filter((r) => !r.ok).length}/${runs.length}`);
};

main().catch((e) => {
  console.error("baseline harness crashed:", e);
  process.exit(1);
});
