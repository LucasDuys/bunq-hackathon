/**
 * R008 / T012 — Close-machine ↔ runDag integration.
 *
 * Three slices, all driven through `startCloseRun()` against a fresh temp
 * sqlite so we never poison ./data/carbon.db:
 *   1. AC1 — `close_runs.dag_run_id` is populated and the close machine
 *      passes through the new `DAG_RUNNING` state (no `QUESTIONS_GENERATED`).
 *   2. AC3 — when `runDag().required_context_question === null` (seeded-tx
 *      path under ANTHROPIC_MOCK=1), AWAITING_ANSWERS is skipped and the
 *      machine advances directly to APPLY_POLICY → PROPOSED/AWAITING_APPROVAL.
 *   3. AC3 — when the DAG returns a non-null `required_context_question`
 *      (forced via the empty-90-day-lookback path: seed transactions in the
 *      close.ts month-window only, leaving spendBaseline's 90-day window
 *      empty), AWAITING_ANSWERS IS entered and a refinement_qa row exists.
 *
 * AC2 (questions.ts + narrative.ts deletion) is enforced by the static type
 * system — this file does not import either module. AC4 (route smoke) is
 * exercised by the route-handler test below in the same file. AC5 (typecheck +
 * baseline tests) is verified by `npx tsx --test lib/agents/dag/__tests__/*.test.ts`.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Spin up an isolated sqlite file BEFORE any module that imports
// `lib/db/client` is loaded. ANTHROPIC_MOCK=1 so the LLM-using DAG agents
// take the deterministic mock path (zero Anthropic cost).
const tmpDir = mkdtempSync(join(tmpdir(), "carbo-t012-"));
const tmpDbPath = join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ANTHROPIC_MOCK = "1";

let dbModule: typeof import("@/lib/db/client");
let closeModule: typeof import("../close");
let auditModule: typeof import("@/lib/audit/append");

const ORG_ID = "org_acme_bv";
// Current calendar month; spendBaseline's 90-day lookback sees these rows so
// `required_context_question` is null on this fixture.
const monthBoundsForToday = (): { month: string; start: number; end: number } => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const month = `${y}-${String(m + 1).padStart(2, "0")}`;
  const start = Math.floor(Date.UTC(y, m, 1) / 1000);
  const end = Math.floor(Date.UTC(y, m + 1, 1) / 1000);
  return { month, start, end };
};

before(async () => {
  const Database = (await import("better-sqlite3")).default;
  const sqlite = new Database(tmpDbPath);
  sqlite.pragma("journal_mode = WAL");
  // Schema mirrors lib/db/schema.ts for the tables close.ts + runDag touch.
  // Includes the R008.AC1 additive `dag_run_id` column.
  sqlite.exec(`
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
    CREATE TABLE IF NOT EXISTS emission_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_id TEXT NOT NULL,
      factor_id TEXT NOT NULL,
      co2e_kg_low REAL NOT NULL,
      co2e_kg_point REAL NOT NULL,
      co2e_kg_high REAL NOT NULL,
      confidence REAL NOT NULL,
      method TEXT NOT NULL,
      close_run_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      rules TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS close_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL,
      state TEXT NOT NULL,
      initial_co2e_kg REAL,
      final_co2e_kg REAL,
      initial_confidence REAL,
      final_confidence REAL,
      reserve_eur REAL,
      credit_recommendation TEXT,
      proposed_actions TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      approved_at INTEGER,
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER,
      dag_run_id TEXT
    );
    CREATE TABLE IF NOT EXISTS refinement_qa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      close_run_id TEXT NOT NULL,
      cluster_id TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT,
      affected_tx_ids TEXT NOT NULL,
      co2e_delta_kg REAL,
      answered_at INTEGER,
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
    -- spendBaseline reads invoices.linked_tx_id for invoice-confidence boost.
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      linked_tx_id TEXT,
      status TEXT NOT NULL DEFAULT 'processed'
    );
    -- close.approveAndExecute reads orgs for bunq context. Test never inserts;
    -- close.ts handles missing org gracefully (uses ctx defaults).
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bunq_user_id TEXT,
      reserve_account_id TEXT,
      credits_account_id TEXT,
      tax_reserve_account_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS bunq_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      installation_token TEXT NOT NULL,
      session_token TEXT NOT NULL,
      server_public_key TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    -- close.ts now calls persistDagRun, which writes here. Without these
    -- tables persistDagRun fails silently (try/catch in close.ts) and the
    -- close page can't surface the DAG panel.
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      month TEXT NOT NULL,
      research_run_id TEXT,
      dag_payload TEXT NOT NULL,
      total_latency_ms INTEGER NOT NULL,
      mock INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS impact_recommendations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      research_run_id TEXT NOT NULL,
      month TEXT NOT NULL,
      baseline_key TEXT NOT NULL,
      baseline_merchant_norm TEXT NOT NULL,
      baseline_merchant_label TEXT NOT NULL,
      baseline_category TEXT NOT NULL,
      baseline_sub_category TEXT,
      baseline_annual_spend_eur REAL NOT NULL,
      baseline_annual_co2e_kg REAL NOT NULL,
      baseline_confidence REAL NOT NULL,
      alt_name TEXT NOT NULL,
      alt_type TEXT NOT NULL,
      alt_description TEXT NOT NULL,
      alt_cost_delta_pct REAL NOT NULL,
      alt_co2e_delta_pct REAL NOT NULL,
      alt_cost_delta_eur_year REAL NOT NULL,
      alt_co2e_delta_kg_year REAL NOT NULL,
      alt_confidence REAL NOT NULL,
      alt_feasibility TEXT NOT NULL,
      alt_rationale TEXT NOT NULL,
      alt_sources TEXT NOT NULL,
      quadrant TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  sqlite.close();

  dbModule = await import("@/lib/db/client");
  closeModule = await import("../close");
  auditModule = await import("@/lib/audit/append");
});

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

type CloseRunRow = {
  id: string;
  state: string;
  status: string;
  dag_run_id: string | null;
  reserve_eur: number | null;
  proposed_actions: string | null;
};

const seedTxs = (
  month: string,
  start: number,
  rows: Array<[string, string, string, number, string, string]>,
) => {
  const insert = dbModule.sqlite.prepare(
    `INSERT INTO transactions (id, org_id, merchant_raw, merchant_norm, amount_cents, timestamp, category, sub_category, category_confidence, classifier_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // Mid-month timestamp so the row sits comfortably inside [start, end).
  const ts = start + 7 * 86_400;
  for (const [id, raw, norm, cents, cat, sub] of rows) {
    insert.run(`${id}_${month}`, ORG_ID, raw, norm, cents, ts, cat, sub, 0.7, "test");
  }
};

const wipeTxs = () => {
  dbModule.sqlite.exec("DELETE FROM transactions; DELETE FROM emission_estimates; DELETE FROM refinement_qa; DELETE FROM close_runs;");
};

describe("R008.AC1 — DAG_RUNNING state replaces QUESTIONS_GENERATED, dag_run_id persisted", () => {
  it("close run records dag_run_id and never lands in QUESTIONS_GENERATED", async () => {
    wipeTxs();
    const { month, start } = monthBoundsForToday();
    seedTxs(month, start, [
      ["tx1", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
      ["tx2", "KLM Royal Dutch Airlines", "klm", 320_000, "travel", "flights"],
      ["tx3", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
      ["tx4", "AWS", "aws", 150_000, "cloud", "iaas"],
      ["tx5", "Uber Eats", "uber_eats", 12_000, "food", "delivery"],
    ]);

    const result = await closeModule.startCloseRun(ORG_ID, month);
    assert.ok(result.id, "startCloseRun must return an id");
    // The runtime return shape from startCloseRun gained `dagRunId` in T012.
    assert.equal(typeof (result as { dagRunId?: unknown }).dagRunId, "string");

    const row = dbModule.sqlite
      .prepare(
        "SELECT id, state, status, dag_run_id, reserve_eur, proposed_actions FROM close_runs WHERE id = ?",
      )
      .get(result.id) as CloseRunRow;
    assert.ok(row, "close_runs row must exist");
    assert.ok(row.dag_run_id, "dag_run_id must be populated after DAG_RUNNING");
    assert.match(row.dag_run_id ?? "", /^run_/, "dag_run_id is a runDag-shaped id");

    // The legacy QUESTIONS_GENERATED state must never appear in any audit row
    // for this close run after the refactor.
    const auditTypes = dbModule.sqlite
      .prepare("SELECT type FROM audit_events WHERE close_run_id = ?")
      .all(result.id) as Array<{ type: string }>;
    assert.equal(
      auditTypes.find((r) => r.type === "close.questions_generated"),
      undefined,
      "close.questions_generated audit type must not be emitted post-T012",
    );
    assert.ok(
      auditTypes.find((r) => r.type === "close.dag_run"),
      "close.dag_run audit type must be emitted",
    );
  });
});

describe("R008.AC3 — null required_context_question skips AWAITING_ANSWERS, advances to APPLY_POLICY+", () => {
  it("close machine reaches PROPOSED or AWAITING_APPROVAL without entering AWAITING_ANSWERS", async () => {
    wipeTxs();
    const { month, start } = monthBoundsForToday();
    seedTxs(month, start, [
      ["tx1", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
      ["tx2", "KLM Royal Dutch Airlines", "klm", 320_000, "travel", "flights"],
      ["tx3", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
      ["tx4", "AWS", "aws", 150_000, "cloud", "iaas"],
      ["tx5", "Uber Eats", "uber_eats", 12_000, "food", "delivery"],
    ]);

    const result = await closeModule.startCloseRun(ORG_ID, month);
    const row = dbModule.sqlite
      .prepare("SELECT state, status, proposed_actions FROM close_runs WHERE id = ?")
      .get(result.id) as Pick<CloseRunRow, "state" | "status" | "proposed_actions">;

    // finalizeEstimates ends in PROPOSED, AWAITING_APPROVAL, or COMPLETED
    // (auto-executed) depending on policy.requiresApproval. Any of those is
    // "advanced past AWAITING_ANSWERS".
    assert.ok(
      row.state === "PROPOSED" ||
        row.state === "AWAITING_APPROVAL" ||
        row.state === "COMPLETED",
      `expected PROPOSED/AWAITING_APPROVAL/COMPLETED, got ${row.state}`,
    );
    assert.ok(row.proposed_actions, "proposed_actions must be populated by finalizeEstimates");

    // No refinement_qa row should be created on the no-question path.
    const qaRows = dbModule.sqlite
      .prepare("SELECT COUNT(*) AS c FROM refinement_qa WHERE close_run_id = ?")
      .get(result.id) as { c: number };
    assert.equal(qaRows.c, 0, "no refinement_qa row when required_context_question is null");
  });
});

describe("R008.AC4 — POST /api/close/run still returns 200 end-to-end on seeded fixture", () => {
  it("route handler returns 200 with dagRunId; close_runs row reaches PROPOSED/AWAITING_APPROVAL", async () => {
    wipeTxs();
    const { month, start } = monthBoundsForToday();
    seedTxs(month, start, [
      ["txa", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
      ["txb", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
      ["txc", "AWS", "aws", 150_000, "cloud", "iaas"],
    ]);

    const route = await import("@/app/api/close/run/route");
    const req = new Request("http://localhost/api/close/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: ORG_ID, month }),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200, "POST /api/close/run must return 200");
    const json = (await res.json()) as { id: string; dagRunId?: string; questionCount?: number };
    assert.ok(json.id, "response must include the close run id");
    assert.ok(json.dagRunId, "response must include the dagRunId from runDag");
    assert.equal(json.questionCount, 0, "no DAG question on seeded current-month fixture");

    const row = dbModule.sqlite
      .prepare("SELECT state, status, dag_run_id FROM close_runs WHERE id = ?")
      .get(json.id) as Pick<CloseRunRow, "state" | "status" | "dag_run_id">;
    assert.ok(
      row.state === "PROPOSED" ||
        row.state === "AWAITING_APPROVAL" ||
        row.state === "COMPLETED",
      `route end state must be PROPOSED/AWAITING_APPROVAL/COMPLETED, got ${row.state}`,
    );
    assert.equal(row.dag_run_id, json.dagRunId, "persisted dag_run_id matches the response");
  });
});

describe("R008.AC3 — non-null required_context_question parks in AWAITING_ANSWERS", () => {
  it("when spendBaseline returns a context question, AWAITING_ANSWERS is entered with one refinement row", async () => {
    wipeTxs();
    // Seed transactions in 2020-01 ONLY. close.ts's monthBounds("2020-01")
    // sees them (so the close run starts), but spendBaseline's `LOOKBACK_DAYS`
    // = 90 day window on `Date.now() - 90*86400` finds zero rows and returns
    // `required_context_question: "No transactions found in the last 90 days…"`.
    // This is the most reliable way to drive the DAG into the non-null path
    // without mocking out runDag (Karpathy: surgical changes, no test-only
    // module rewiring just to exercise a branch the production code already
    // takes naturally).
    const oldMonth = "2020-01";
    const oldStart = Math.floor(Date.UTC(2020, 0, 1) / 1000);
    seedTxs(oldMonth, oldStart, [
      ["tx1", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
      ["tx2", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
    ]);

    const result = await closeModule.startCloseRun(ORG_ID, oldMonth);
    const row = dbModule.sqlite
      .prepare("SELECT state, dag_run_id FROM close_runs WHERE id = ?")
      .get(result.id) as Pick<CloseRunRow, "state" | "dag_run_id">;
    assert.equal(row.state, "AWAITING_ANSWERS", "AWAITING_ANSWERS must be entered when DAG returns a question");
    assert.ok(row.dag_run_id, "dag_run_id must still be persisted on the question path");

    const qaRows = dbModule.sqlite
      .prepare("SELECT cluster_id, question, options FROM refinement_qa WHERE close_run_id = ?")
      .all(result.id) as Array<{ cluster_id: string; question: string; options: string }>;
    assert.equal(qaRows.length, 1, "exactly one refinement_qa row should be inserted from the DAG question");
    assert.match(qaRows[0].question, /transactions/i, "the persisted question matches the DAG's required_context_question text");
  });
});
