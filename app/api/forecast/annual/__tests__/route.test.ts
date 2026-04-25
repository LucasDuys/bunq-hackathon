/**
 * R005 / T008 — POST /api/forecast/annual route tests.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDbPath = join(mkdtempSync(join(tmpdir(), "carbo-t008-")), "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;

type RouteModule = typeof import("../route");
type AuditModule = typeof import("@/lib/audit/append");

let route: RouteModule;
let audit: AuditModule;

before(async () => {
  const { default: Database } = await import("better-sqlite3");
  const sqlite = new Database(tmpDbPath);
  sqlite.exec(`
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
  route = await import("../route");
  audit = await import("@/lib/audit/append");
});

const post = async (body: unknown): Promise<{ status: number; json: any }> => {
  const req = new Request("http://localhost/api/forecast/annual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await route.POST(req);
  return { status: res.status, json: await res.json() };
};

describe("POST /api/forecast/annual (R005)", () => {
  it("AC1+AC2: 200 with ForecastOutput on valid input", async () => {
    const { status, json } = await post({
      jurisdiction: "NL",
      entityType: "BV",
      monthlySpendEur: 100_000,
      spendDistribution: { travel: 0.2, procurement: 0.2, food: 0.2, services: 0.2, cloud: 0.2 },
      switchAdoptionPct: 0.5,
    });
    assert.equal(status, 200);
    assert.ok(json.baseline_annual_spend_eur > 0);
    assert.ok(json.projected_savings.net_company_scale_financial_impact_eur > 0);
    assert.ok(Array.isArray(json.sensitivity));
    assert.equal(json.sensitivity.length, 4);
  });

  it("AC2: defaults supplied for empty body", async () => {
    const { status, json } = await post({});
    assert.equal(status, 200);
    assert.ok(json.baseline_annual_spend_eur > 0);
  });

  it("AC3: 400 on invalid jurisdiction", async () => {
    const { status, json } = await post({ jurisdiction: "US" });
    assert.equal(status, 400);
    assert.equal(json.error, "invalid_jurisdiction");
  });

  it("AC3: 400 on non-summing distribution", async () => {
    const { status, json } = await post({ spendDistribution: { travel: 0.3, food: 0.4 } });
    assert.equal(status, 400);
    assert.equal(json.error, "invalid_distribution");
  });

  it("AC4: audit event written on success", async () => {
    const beforeChain = audit.verifyChain("org_acme_bv");
    const before = (beforeChain as { count?: number }).count ?? 0;
    await post({ monthlySpendEur: 50_000 });
    const afterChain = audit.verifyChain("org_acme_bv");
    const after = (afterChain as { count?: number }).count ?? 0;
    assert.ok(after > before, `audit count should grow: before=${before} after=${after}`);
  });

  it("AC6: returns in <200ms", async () => {
    const t0 = performance.now();
    const { status } = await post({});
    const ms = performance.now() - t0;
    assert.equal(status, 200);
    assert.ok(ms < 200, `took ${ms.toFixed(1)}ms, expected <200ms`);
  });
});
