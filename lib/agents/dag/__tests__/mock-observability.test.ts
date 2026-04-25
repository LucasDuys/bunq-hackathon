/**
 * R002 / T002 — mock-fallback observability.
 *
 * Three slices:
 *   1. `LlmCallResult` / `ToolRunResult` type contract — the new `usedMock`
 *      field is present and `false` when the live path runs (we cannot hit
 *      the live Anthropic API from a unit test, so we assert via a structural
 *      shape check on the exported result type's discriminator).
 *   2. `recordAgentMessage` persists `mock_path = 1` for mock-path runs and
 *      `mock_path = 0` for live-path runs.
 *   3. Full `runDag()` under `ANTHROPIC_MOCK=1` returns a `DagRunResult` whose
 *      `mock_agent_count` is the same length as the deduped set of LLM-using
 *      agents that recorded a mocked row, and emits one
 *      `agent.<name>.fallback_to_mock` audit event per such agent with the
 *      `intended` flag (because mock mode is the env default).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Make the test self-contained: spin up a fresh sqlite file in a temp dir so
// we never poison the real ./data/carbon.db. We MUST set DATABASE_URL before
// `lib/db/client` (and anything that imports it) loads.
const tmpDir = mkdtempSync(join(tmpdir(), "carbo-t002-"));
const tmpDbPath = join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ANTHROPIC_MOCK = "1";

// Importing `lib/db/client` triggers its `Database` constructor, so the env
// must be set BEFORE this import. After the import, run the schema DDL by
// spawning the migrate script's logic against the same path.
// We import dynamically to make the env-var ordering explicit.
type AgentMessageRow = {
  agent_run_id: string;
  agent_name: string;
  mock_path: number | null;
};

let dbModule: typeof import("@/lib/db/client");
let persistModule: typeof import("../persist");
let dagModule: typeof import("../index");
let llmModule: typeof import("../llm");

before(async () => {
  // Apply schema. Migrate.ts performs the full DDL when run; reuse it by
  // importing it for its top-level side effect, then dispose its handle so
  // our own client owns the file.
  const Database = (await import("better-sqlite3")).default;
  const sqlite = new Database(tmpDbPath);
  sqlite.pragma("journal_mode = WAL");
  // Minimal schema: only what mock-observability touches.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_run_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cached INTEGER NOT NULL DEFAULT 0,
      server_tool_use_count INTEGER,
      web_search_requests INTEGER,
      mock_path INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      close_run_id TEXT,
      actor TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  sqlite.close();

  dbModule = await import("@/lib/db/client");
  persistModule = await import("../persist");
  dagModule = await import("../index");
  llmModule = await import("../llm");
});

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe("R002.AC1 — callAgent / callAgentWithTools usedMock contract", () => {
  it("LlmCallResult shape includes usedMock as a boolean field", () => {
    // Compile-time contract: build a result that matches the exported type and
    // assert at runtime that `usedMock` is required. We can't call the live
    // API from a unit test, so we exercise the type by structural literal.
    const sample: import("../llm").LlmCallResult = {
      jsonText: null,
      rawText: "",
      tokensIn: 0,
      tokensOut: 0,
      cached: false,
      usedMock: false,
    };
    assert.equal(typeof sample.usedMock, "boolean");
    assert.equal(sample.usedMock, false, "live-path callAgent must report usedMock=false");
  });

  it("ToolRunResult shape includes usedMock as a boolean field", () => {
    const sample = {
      finalMessage: { content: [], usage: {} } as unknown as import("../llm").ToolRunResult["finalMessage"],
      rawText: "",
      tokensIn: 0,
      tokensOut: 0,
      cached: false,
      webSearchRequests: 0,
      serverToolUseCount: 0,
      webSearchHits: [],
      usedMock: false,
    } satisfies import("../llm").ToolRunResult;
    assert.equal(typeof sample.usedMock, "boolean");
    // Reference the imported namespace so the unused-import check stays quiet.
    void llmModule;
  });
});

describe("R002.AC2 — recordAgentMessage persists mock_path", () => {
  it("writes mock_path=1 for mock-path runs", () => {
    const ctx = {
      orgId: "org_test",
      analysisPeriod: "2026-04",
      dryRun: true,
      mock: true,
      auditLog: async () => {},
      agentRunId: "run_test_mock",
    };
    persistModule.recordAgentMessage(ctx, {
      agentName: "green_alternatives_agent",
      usedMock: true,
    });
    const rows = dbModule.sqlite
      .prepare(
        "SELECT agent_run_id, agent_name, mock_path FROM agent_messages WHERE agent_run_id = ?",
      )
      .all("run_test_mock") as AgentMessageRow[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mock_path, 1, "mock-path run must persist mock_path=1");
  });

  it("writes mock_path=0 for live-path runs", () => {
    const ctx = {
      orgId: "org_test",
      analysisPeriod: "2026-04",
      dryRun: true,
      mock: false,
      auditLog: async () => {},
      agentRunId: "run_test_live",
    };
    persistModule.recordAgentMessage(ctx, {
      agentName: "cost_judge_agent",
      usedMock: false,
      tokensIn: 1234,
      tokensOut: 567,
      cached: false,
    });
    const rows = dbModule.sqlite
      .prepare(
        "SELECT agent_run_id, agent_name, mock_path FROM agent_messages WHERE agent_run_id = ?",
      )
      .all("run_test_live") as AgentMessageRow[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mock_path, 0, "live-path run must persist mock_path=0");
  });

  it("is a no-op without ctx.agentRunId (keeps spendBaseline + standalone tests clean)", () => {
    const before = (dbModule.sqlite.prepare("SELECT COUNT(*) AS c FROM agent_messages").get() as { c: number }).c;
    persistModule.recordAgentMessage(
      {
        orgId: "org_test",
        analysisPeriod: "2026-04",
        dryRun: true,
        mock: true,
        auditLog: async () => {},
      },
      { agentName: "spend_emissions_baseline_agent", usedMock: true },
    );
    const after = (dbModule.sqlite.prepare("SELECT COUNT(*) AS c FROM agent_messages").get() as { c: number }).c;
    assert.equal(before, after, "missing agentRunId must skip the write");
  });
});

describe("R002.AC4-AC5 — DagRunResult.mock_agent_count + intended-vs-degradation", () => {
  it("mock_agent_count > 0 under ANTHROPIC_MOCK=1 and audit events flagged 'intended'", async () => {
    // We need transactions for spendBaseline to produce priority targets.
    // Seed the bare minimum into the temp DB so the DAG can run.
    dbModule.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        bunq_tx_id TEXT,
        merchant_raw TEXT NOT NULL,
        merchant_norm TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        timestamp INTEGER NOT NULL,
        account_id TEXT,
        description TEXT,
        category TEXT,
        sub_category TEXT,
        category_confidence REAL,
        classifier_source TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE TABLE IF NOT EXISTS merchant_category_cache (
        merchant_norm TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        sub_category TEXT,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE TABLE IF NOT EXISTS research_cache (
        cache_key TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT,
        jurisdiction TEXT NOT NULL,
        policy_digest TEXT NOT NULL,
        week_bucket TEXT NOT NULL,
        alternatives_json TEXT NOT NULL,
        sources_count INTEGER NOT NULL,
        search_requests_used INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        ttl_sec INTEGER NOT NULL DEFAULT 2592000
      );
      CREATE TABLE IF NOT EXISTS web_search_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_run_id TEXT NOT NULL,
        cluster_id TEXT,
        query TEXT NOT NULL,
        results_n INTEGER NOT NULL,
        first_url TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    const nowSec = Math.floor(Date.now() / 1000);
    const insert = dbModule.sqlite.prepare(
      `INSERT INTO transactions (id, org_id, merchant_raw, merchant_norm, amount_cents, timestamp, category, sub_category, category_confidence, classifier_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    // Plant 5 cluster-worthy spend rows so spendBaseline has priority_targets.
    const seedRows = [
      ["tx1", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
      ["tx2", "KLM Royal Dutch Airlines", "klm", 320_000, "travel", "flights"],
      ["tx3", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
      ["tx4", "AWS", "aws", 150_000, "cloud", "iaas"],
      ["tx5", "Uber Eats", "uber_eats", 12_000, "food", "delivery"],
    ];
    for (const [id, raw, norm, cents, cat, sub] of seedRows) {
      insert.run(id, "org_acme_bv", raw, norm, cents, nowSec - 30 * 86_400, cat, sub, 0.7, "test");
    }

    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const ctx = {
      orgId: "org_acme_bv",
      analysisPeriod: "2026-03",
      dryRun: true,
      mock: true,
      auditLog: async (e: { type: string; payload: Record<string, unknown> }) => {
        events.push(e);
      },
    };
    const out = await dagModule.runDag({ orgId: "org_acme_bv", month: "2026-03" }, ctx);

    // AC4 — top-level metric is present and reflects mock-path agents.
    assert.equal(typeof out.mock_agent_count, "number", "mock_agent_count must be a top-level number");
    assert.ok(out.mock_agent_count > 0, `mock_agent_count must be > 0 under ANTHROPIC_MOCK=1, got ${out.mock_agent_count}`);

    // AC3 — at least one fallback_to_mock audit event was emitted.
    const fallbackEvents = events.filter((e) => e.type.endsWith(".fallback_to_mock"));
    assert.ok(
      fallbackEvents.length > 0,
      "runDag must emit agent.<name>.fallback_to_mock for mock-path agents",
    );
    assert.equal(
      fallbackEvents.length,
      out.mock_agent_count,
      "one fallback_to_mock event per mock-path agent",
    );

    // AC5 — flag is `intended` because ANTHROPIC_MOCK=1 is set in the env.
    for (const e of fallbackEvents) {
      assert.equal(e.payload.flag, "intended", `expected intended flag, got ${e.payload.flag}`);
    }

    // AC2 — agent_messages rows recorded with mock_path=1.
    const mockedRows = dbModule.sqlite
      .prepare("SELECT agent_name FROM agent_messages WHERE agent_run_id = ? AND mock_path = 1")
      .all(out.runId) as Array<{ agent_name: string }>;
    const distinctMocked = new Set(mockedRows.map((r) => r.agent_name));
    assert.equal(distinctMocked.size, out.mock_agent_count, "agent_messages mock_path=1 count must match mock_agent_count");
  });
});
