/**
 * R003 / T003 — research-cache cross-tenant URL leakage fix (option B).
 *
 * The `researchCache` PK is `(category, jurisdiction, policyDigest, week)` —
 * intentionally org-neutral so two orgs in the same regulatory regime amortise
 * web-search spend. The risk that lived alongside that design choice was
 * cross-tenant evidence leakage: the second org would read the first org's
 * full source URLs straight back from the cache.
 *
 * Option B (shipped here) strips per-row source URLs to a `https://{domain}`
 * prefix on cache *insert*, so cached reads can never surface deep links.
 * Live runs in the current invocation (the agent that did the search) keep
 * full URLs in their returned `recorded[]` — those never round-trip through
 * the cache.
 *
 * This test seeds two orgs in NL with the same default policy and runs the
 * Research Agent's `run()` for the same baseline cluster in the same week.
 * The first run populates the cache (writeCache strips URLs); the second run
 * MUST report `cache_hits >= 1` and its returned source URLs MUST be
 * domain-only.
 *
 * Run with: `npx tsx --test lib/agents/dag/__tests__/research-cache.test.ts`
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Spin up a fresh sqlite file in a temp dir before importing anything that
// reaches `lib/db/client`. ANTHROPIC_MOCK=1 keeps research on the template
// path so we exercise writeCache/readCache without needing an Anthropic key.
const tmpDir = mkdtempSync(join(tmpdir(), "carbo-t003-"));
const tmpDbPath = join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ANTHROPIC_MOCK = "1";

type ResearchModule = typeof import("../research");
type TypesModule = typeof import("../types");

let researchModule: ResearchModule;
let typesModule: TypesModule;

before(async () => {
  // Apply the schema slice this test depends on. Mirror the relevant DDL from
  // `scripts/migrate.ts` — keep this minimal so an unrelated migration change
  // does not break the test.
  const Database = (await import("better-sqlite3")).default;
  const sqlite = new Database(tmpDbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
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
  `);
  sqlite.close();

  researchModule = await import("../research");
  typesModule = await import("../types");
  void typesModule; // referenced via type-only imports below
});

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

// ---------------------------------------------------------------------------
// Fixture builder — minimal BaselineOutput with a single travel/flight_shorthaul
// priority target so `mockAlternativesForCluster` returns >= 1 template-backed
// alternative carrying full URLs (e.g. https://www.gov.uk/...).
// ---------------------------------------------------------------------------
const buildBaseline = (orgKey: string): import("../types").BaselineOutput => ({
  agent: "spend_emissions_baseline_agent",
  company_id: orgKey,
  analysis_period: "2026-03",
  baseline: {
    total_spend_eur: 100_000,
    estimated_total_tco2e: 25,
    baseline_confidence: 0.7,
    top_spend_categories: [{ category: "travel", spend_eur: 50_000, share_pct: 0.5 }],
    top_emission_categories: [{ category: "travel", tco2e: 20, share_pct: 0.8 }],
    high_cost_high_carbon_clusters: ["cluster_klm"],
    uncertain_high_value_clusters: [],
  },
  priority_targets: [
    {
      cluster_id: "cluster_klm",
      category: "travel",
      annualized_spend_eur: 60_000,
      estimated_tco2e: 18,
      reason_for_priority: "high_emissions",
      recommended_next_agent: "green_alternatives_agent",
      baseline_merchant_norm: "klm",
      baseline_merchant_label: "KLM Royal Dutch Airlines",
      baseline_sub_category: "flight_shorthaul",
      baseline_confidence: 0.8,
      baseline_tx_count: 4,
    },
  ],
  required_context_question: null,
});

const buildCtx = (orgId: string): import("../types").AgentContext => ({
  orgId,
  analysisPeriod: "2026-03",
  dryRun: true,
  mock: true,
  auditLog: async () => {},
  agentRunId: `run_${orgId}`,
});

// ---------------------------------------------------------------------------
// AC4 — two orgs in NL, same default policy, same category + same week.
// ---------------------------------------------------------------------------
describe("R003.AC4 — cross-tenant cache amortization stays org-neutral", () => {
  it("first org's run populates the cache; second org reads back domain-only sources", async () => {
    const orgA = "org_acme_bv";
    const orgB = "org_beta_bv";

    // First run — populates the cache. Mock path uses templates whose sources
    // contain full URLs (e.g. https://www.gov.uk/government/publications/...).
    const runA = await researchModule.run(
      { baseline: buildBaseline(orgA), agentRunId: `run_${orgA}` },
      buildCtx(orgA),
    );
    assert.equal(runA.summary.clusters_researched, 1, "baseline must drive one cluster");
    assert.ok(
      runA.summary.cache_hits === 0,
      `first run must be a cache miss, got cache_hits=${runA.summary.cache_hits}`,
    );

    // Second run — different org, same policy + jurisdiction + week + category,
    // so the cache key resolves identically and the read path takes over.
    const runB = await researchModule.run(
      { baseline: buildBaseline(orgB), agentRunId: `run_${orgB}` },
      buildCtx(orgB),
    );
    assert.ok(
      runB.summary.cache_hits >= 1,
      `second org must hit the cache, got cache_hits=${runB.summary.cache_hits}`,
    );

    // AC4 — every source returned to the second org from the cache must be
    // org-neutral: URL is `https://{domain}` only (no path), title equals the
    // domain, snippet is null. The deep-link content stays inside the original
    // run's process.
    const altsB = runB.results.flatMap((r) => r.alternatives);
    assert.ok(altsB.length > 0, "cached read should still return >= 1 alternative");
    let inspected = 0;
    for (const alt of altsB) {
      // alt.url is either null or domain-only after stripping.
      if (alt.url !== null) {
        const u = new URL(alt.url);
        assert.equal(
          u.pathname.replace(/\/$/, ""),
          "",
          `cached alt.url must be domain-only, got ${alt.url}`,
        );
      }
      for (const s of alt.sources) {
        inspected++;
        const u = new URL(s.url);
        assert.equal(
          u.pathname.replace(/\/$/, ""),
          "",
          `cached source.url must be domain-only, got ${s.url}`,
        );
        assert.equal(
          s.title,
          s.domain,
          `cached source.title must equal domain (org-neutral), got title=${s.title} domain=${s.domain}`,
        );
        assert.equal(
          s.snippet,
          null,
          `cached source.snippet must be null (org-neutral), got ${String(s.snippet)}`,
        );
      }
    }
    assert.ok(inspected > 0, "expected at least one source to inspect");
  });
});
