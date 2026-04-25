/**
 * R001 / T005 — Credit-strategy signed audit event.
 *
 * Three slices, all driven through `runDag()` against a fresh temp sqlite so
 * we don't poison ./data/carbon.db:
 *   1. The `agent.credit_strategy.run` audit event payload contains all 8
 *      required keys (R001.AC1).
 *   2. Two runs with identical seeded inputs produce IDENTICAL
 *      `input_digest_sha256` values (R001.AC2).
 *   3. After both runs, `verifyChain(orgId)` returns `{ valid: true }`
 *      (R001.AC3) — the new event respects the prev-hash chain rule.
 *
 * R001.AC4 (no change to `creditStrategy` module signature) is enforced by
 * the static type system; this file does not import `creditStrategy` at all.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Spin up an isolated sqlite file BEFORE any module that imports
// `lib/db/client` is loaded. ANTHROPIC_MOCK=1 so the LLM-using agents take the
// deterministic mock path (zero Anthropic cost, deterministic outputs → stable
// `input_digest_sha256` across runs).
const tmpDir = mkdtempSync(join(tmpdir(), "carbo-t005-"));
const tmpDbPath = join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ANTHROPIC_MOCK = "1";

type AuditRow = {
  id: number;
  type: string;
  payload: string;
  prev_hash: string;
  hash: string;
};

let dbModule: typeof import("@/lib/db/client");
let dagModule: typeof import("../index");
let auditModule: typeof import("@/lib/audit/append");

const ORG_ID = "org_acme_bv";
const MONTH = "2026-03";

before(async () => {
  const Database = (await import("better-sqlite3")).default;
  const sqlite = new Database(tmpDbPath);
  sqlite.pragma("journal_mode = WAL");
  // Schema: only what runDag + appendAudit + recordAgentMessage touch.
  // Mirrors mock-observability.test.ts so the two stay in sync if the schema
  // shifts.
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
    -- spendBaseline reads invoices.linked_tx_id to give invoice-linked txs a
    -- confidence boost. Test never inserts; minimal columns for SELECT.
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      linked_tx_id TEXT,
      status TEXT NOT NULL DEFAULT 'processed'
    );
  `);

  // Seed enough transactions to give spendBaseline at least one priority
  // target so creditStrategy has something to work on. Same fixture shape as
  // mock-observability.test.ts to keep cross-test parity.
  const nowSec = Math.floor(Date.now() / 1000);
  const insert = sqlite.prepare(
    `INSERT INTO transactions (id, org_id, merchant_raw, merchant_norm, amount_cents, timestamp, category, sub_category, category_confidence, classifier_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const seedRows: Array<[string, string, string, number, string, string]> = [
    ["tx1", "KLM Royal Dutch Airlines", "klm", 250_000, "travel", "flights"],
    ["tx2", "KLM Royal Dutch Airlines", "klm", 320_000, "travel", "flights"],
    ["tx3", "Office Depot", "office_depot", 80_000, "procurement", "office_supplies"],
    ["tx4", "AWS", "aws", 150_000, "cloud", "iaas"],
    ["tx5", "Uber Eats", "uber_eats", 12_000, "food", "delivery"],
  ];
  for (const [id, raw, norm, cents, cat, sub] of seedRows) {
    insert.run(id, ORG_ID, raw, norm, cents, nowSec - 30 * 86_400, cat, sub, 0.7, "test");
  }
  sqlite.close();

  dbModule = await import("@/lib/db/client");
  dagModule = await import("../index");
  auditModule = await import("@/lib/audit/append");
});

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

const REQUIRED_KEYS = [
  "orgId",
  "month",
  "runId",
  "total_net_company_scale_financial_impact_eur",
  "total_emissions_reduced_tco2e",
  "total_recommended_credit_purchase_cost_eur",
  "tax_advisor_review_required",
  "input_digest_sha256",
] as const;

const buildCtx = (events: Array<{ type: string; payload: Record<string, unknown> }>) => ({
  orgId: ORG_ID,
  analysisPeriod: MONTH,
  dryRun: true,
  mock: true,
  // Mirror /api/impacts/research/route.ts: every audit event from runDag is
  // forwarded to `appendAudit` so it lands in the chain and the digest survives
  // a `verifyChain` round-trip.
  auditLog: async (event: { type: string; payload: Record<string, unknown> }) => {
    events.push(event);
    auditModule.appendAudit({
      orgId: ORG_ID,
      actor: "agent",
      type: event.type,
      payload: event.payload,
    });
  },
});

describe("R001.AC1 — credit_strategy.run payload contains all required keys", () => {
  it("emits exactly the 8-key shape with the right value types", async () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const out = await dagModule.runDag({ orgId: ORG_ID, month: MONTH }, buildCtx(events));

    const credit = events.find((e) => e.type === "agent.credit_strategy.run");
    assert.ok(credit, "agent.credit_strategy.run audit event must be emitted");
    const p = credit.payload;

    for (const key of REQUIRED_KEYS) {
      assert.ok(key in p, `payload missing required key: ${key}`);
    }

    assert.equal(p.orgId, ORG_ID, "orgId mirrors input.orgId");
    assert.equal(p.month, MONTH, "month mirrors input.month");
    assert.equal(p.runId, out.runId, "runId mirrors runDag's runId");
    assert.equal(typeof p.total_net_company_scale_financial_impact_eur, "number");
    assert.equal(typeof p.total_emissions_reduced_tco2e, "number");
    assert.equal(typeof p.total_recommended_credit_purchase_cost_eur, "number");
    assert.equal(typeof p.tax_advisor_review_required, "boolean");
    assert.equal(typeof p.input_digest_sha256, "string");
    assert.match(
      p.input_digest_sha256 as string,
      /^[a-f0-9]{64}$/,
      "input_digest_sha256 is a 64-char lowercase hex sha256 digest",
    );
  });
});

describe("R001.AC2 — identical inputs hash equal across runs", () => {
  it("two runDag invocations on the same fixture produce equal input_digest_sha256", async () => {
    const eventsA: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const eventsB: Array<{ type: string; payload: Record<string, unknown> }> = [];
    await dagModule.runDag({ orgId: ORG_ID, month: MONTH }, buildCtx(eventsA));
    await dagModule.runDag({ orgId: ORG_ID, month: MONTH }, buildCtx(eventsB));

    const digestA = (
      eventsA.find((e) => e.type === "agent.credit_strategy.run")?.payload.input_digest_sha256
    ) as string | undefined;
    const digestB = (
      eventsB.find((e) => e.type === "agent.credit_strategy.run")?.payload.input_digest_sha256
    ) as string | undefined;

    assert.ok(digestA, "run A must produce an input_digest_sha256");
    assert.ok(digestB, "run B must produce an input_digest_sha256");
    assert.equal(digestA, digestB, "identical seeded inputs must hash equal");
  });

  it("digest is the documented sha256 over the four input fields", async () => {
    // Re-derive the digest independently using the four inputs described in
    // R001.AC2 and compare against the latest emitted event. This locks the
    // formula so a future refactor can't silently change which inputs feed
    // the hash.
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const out = await dagModule.runDag({ orgId: ORG_ID, month: MONTH }, buildCtx(events));
    const credit = events.find((e) => e.type === "agent.credit_strategy.run");
    const emitted = credit?.payload.input_digest_sha256 as string;

    const greenJudgeApprovedCount = out.greenJudge.judged_results.filter(
      (r) => r.verdict === "approved" || r.verdict === "approved_with_caveats",
    ).length;
    const costJudgeApprovedCount = out.costJudge.judged_results.filter(
      (r) => r.verdict === "approved" || r.verdict === "approved_with_caveats",
    ).length;
    const expected = createHash("sha256")
      .update(
        JSON.stringify({
          greenJudgeApprovedCount,
          costJudgeApprovedCount,
          baselineTotalSpendEur: out.baseline.baseline.total_spend_eur,
          baselineTotalTco2e: out.baseline.baseline.estimated_total_tco2e,
        }),
      )
      .digest("hex");
    assert.equal(emitted, expected, "emitted digest must match the documented input → sha256 formula");
  });
});

describe("R001.AC3 — event lands in audit_events and verifyChain passes", () => {
  it("audit_events table contains the credit_strategy.run row and chain is valid", async () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    await dagModule.runDag({ orgId: ORG_ID, month: MONTH }, buildCtx(events));

    const rows = dbModule.sqlite
      .prepare(
        "SELECT id, type, payload, prev_hash, hash FROM audit_events WHERE org_id = ? AND type = ? ORDER BY id DESC LIMIT 1",
      )
      .all(ORG_ID, "agent.credit_strategy.run") as AuditRow[];
    assert.ok(rows.length > 0, "agent.credit_strategy.run row must exist in audit_events");
    const parsed = JSON.parse(rows[0].payload) as Record<string, unknown>;
    for (const key of REQUIRED_KEYS) {
      assert.ok(key in parsed, `persisted row payload missing required key: ${key}`);
    }

    const verdict = auditModule.verifyChain(ORG_ID);
    assert.equal(verdict.valid, true, `verifyChain must pass; got ${JSON.stringify(verdict)}`);
  });
});
