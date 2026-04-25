/**
 * R010 / T006 — vendor logo + domain enrichment.
 *
 * Two slices:
 *   1. AC6 — research output for a single category with two URLs returns both
 *      entries with non-empty `domain` and `logoUrl`. We exercise the mock
 *      path (ANTHROPIC_MOCK=1) which uses the GREEN_TEMPLATES library; the
 *      `office_supplies` cluster is the one library entry that ships two
 *      source URLs out of the box, so the domain/logoUrl assertions hit a
 *      genuine 2-URL row.
 *   2. AC7 — a costSavings recommendation whose `option_name` substring-
 *      matches a research source's domain or title gets a non-null
 *      `suggested_vendor_logo_url`; one that does not match gets `null`.
 *
 * The matcher is scoped to the same cluster's research pool by construction
 * (see `enrichCostOptionsWithLogos` in costSavings.ts), so this test confirms
 * the wiring without mocking the agent graph.
 *
 * Run with: `npx tsx --test lib/agents/dag/__tests__/logo-enrichment.test.ts`
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Spin up a fresh sqlite file BEFORE importing anything that pulls in
// `lib/db/client`. ANTHROPIC_MOCK=1 keeps research on the template path so
// no Anthropic key is required.
const tmpDir = mkdtempSync(join(tmpdir(), "carbo-t006-"));
const tmpDbPath = join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ANTHROPIC_MOCK = "1";

type ResearchModule = typeof import("../research");
type CostSavingsModule = typeof import("../costSavings");
type TypesModule = typeof import("../types");

let researchModule: ResearchModule;
let costSavingsModule: CostSavingsModule;
let typesModule: TypesModule;

before(async () => {
  // Minimal schema slice — only the tables the research + costSavings agents
  // touch on the mock path.
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
  `);
  sqlite.close();

  researchModule = await import("../research");
  costSavingsModule = await import("../costSavings");
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
// Fixture builders.
//
// We target `travel.flight_shorthaul` because the GREEN_TEMPLATES entry for
// that key ships an alternative ("Rail for routes under 700 km") with TWO
// source URLs (gov.uk + transportenvironment.org) — the canonical "single
// category with 2 URLs" AC6 scenario, with no test-fixture engineering needed.
// `recommended_next_agent: "both"` exercises Green AND Cost in one baseline.
// ---------------------------------------------------------------------------
const buildBaselineForFlights = (): import("../types").BaselineOutput => ({
  agent: "spend_emissions_baseline_agent",
  company_id: "org_logo_test",
  analysis_period: "2026-04",
  baseline: {
    total_spend_eur: 200_000,
    estimated_total_tco2e: 35,
    baseline_confidence: 0.75,
    top_spend_categories: [
      { category: "travel", spend_eur: 80_000, share_pct: 0.4 },
    ],
    top_emission_categories: [
      { category: "travel", tco2e: 25, share_pct: 0.7 },
    ],
    high_cost_high_carbon_clusters: ["cluster_flights"],
    uncertain_high_value_clusters: [],
  },
  priority_targets: [
    {
      cluster_id: "cluster_flights",
      category: "travel",
      annualized_spend_eur: 80_000,
      estimated_tco2e: 22,
      reason_for_priority: "high_emissions",
      recommended_next_agent: "both",
      baseline_merchant_norm: "klm",
      baseline_merchant_label: "KLM Royal Dutch Airlines",
      baseline_sub_category: "flight_shorthaul",
      baseline_confidence: 0.8,
      baseline_tx_count: 12,
    },
  ],
  required_context_question: null,
});

const buildCtx = (orgId: string): import("../types").AgentContext => ({
  orgId,
  analysisPeriod: "2026-04",
  dryRun: true,
  mock: true,
  auditLog: async () => {},
  agentRunId: `run_${orgId}`,
});

// ---------------------------------------------------------------------------
// AC6 — research output with 2 URLs returns non-empty domain + logoUrl.
// ---------------------------------------------------------------------------
describe("R010.AC6 — research sources carry domain + logoUrl", () => {
  it("a cluster whose template ships >=2 source URLs produces sources with non-empty domain + logoUrl", async () => {
    const orgId = "org_ac6";
    const out = await researchModule.run(
      { baseline: buildBaselineForFlights(), agentRunId: `run_${orgId}` },
      buildCtx(orgId),
    );
    assert.equal(
      out.summary.clusters_researched,
      1,
      "baseline drives exactly one cluster",
    );

    // Walk every alternative's source[]; require that AT LEAST one alternative
    // surfaced two sources, and that every source on those alternatives carries
    // both `domain` and `logoUrl` populated. The s2 favicon URL must reference
    // the same domain — a regression in `logoFor()` (e.g. forgot the template
    // string) would surface here.
    const allAlternatives = out.results.flatMap((r) => r.alternatives);
    assert.ok(allAlternatives.length > 0, "expected >=1 alternative");
    const twoSourceAlt = allAlternatives.find((a) => a.sources.length >= 2);
    assert.ok(
      twoSourceAlt,
      `expected >=1 alternative with 2+ sources, got max=${Math.max(
        ...allAlternatives.map((a) => a.sources.length),
      )}`,
    );
    assert.ok(twoSourceAlt.sources.length >= 2, "twoSourceAlt has 2+ sources");
    for (const s of twoSourceAlt.sources) {
      assert.ok(s.domain.length > 0, `source.domain must be non-empty, got "${s.domain}"`);
      assert.ok(
        s.logoUrl.length > 0,
        `source.logoUrl must be non-empty, got "${s.logoUrl}"`,
      );
      assert.ok(
        s.logoUrl.includes(s.domain),
        `source.logoUrl must reference its domain, got url=${s.logoUrl} domain=${s.domain}`,
      );
      assert.ok(
        s.logoUrl.startsWith("https://www.google.com/s2/favicons?domain="),
        `source.logoUrl must use the Google s2 favicon pattern, got ${s.logoUrl}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC7 — costSavings recommendation matched vs unmatched logo behavior.
//
// Strategy: hand-construct a `ResearchedPool` so the source domain + the
// alternative name we want to test against are both known up front. Calling
// `costSavings.run` with that pool exercises the same matcher pass that runs
// in production (mock-path + live-path share `enrichCostOptionsWithLogos`),
// without depending on which template library entries happen to ship with
// 2 sources for the test category.
// ---------------------------------------------------------------------------
describe("R010.AC7 — costSavings vendor->source matching", () => {
  it("an alternative whose name contains a research source's domain head gets a logo; an unmatchable one stays null", async () => {
    const orgId = "org_ac7";

    // Synthesize ResearchedAlternative entries with a controlled domain so the
    // matcher's expected behavior is deterministic. Two researched alts:
    //   - "OVO Energy" with source domain `ovo.com` -> head=`ovo`. The
    //     option_name echoes the alt name verbatim, so the matcher's
    //     `v.includes(head)` branch fires (`"ovo energy".includes("ovo")`).
    //   - "Pure Planet" with source domain `pureplanet.com` -> head=`pureplanet`.
    //     Same wiring; included as a second positive case so a regression in
    //     "first source wins" loop logic surfaces here.
    // And one unmatchable alt:
    //   - "Renegotiate annual contract" — no source contains "renegotiate"
    //     and the alt name does not contain any source's head, so the
    //     matcher returns null for that option.
    const clusterId = "cluster_energy";
    const researchedPool: import("../types").ResearchedPool = {
      [clusterId]: [
        {
          id: "alt_ovo",
          cluster_id: clusterId,
          name: "OVO Energy",
          vendor: "OVO Energy",
          url: "https://ovo.com",
          description: "100% renewable B2B tariff with public Dutch pricing.",
          cost_delta_pct: -0.1,
          co2e_delta_pct: -0.6,
          confidence: 0.8,
          feasibility: "drop_in",
          geography: "EU",
          sources: [
            {
              title: "OVO B2B tariff sheet",
              url: "https://ovo.com/business",
              snippet: null,
              domain: "ovo.com",
              logoUrl: "https://www.google.com/s2/favicons?domain=ovo.com&sz=64",
              fetched_at: Math.floor(Date.now() / 1000),
            },
          ],
          provenance: "web_search",
          freshness_days: 0,
          flags: [],
        },
        {
          id: "alt_pureplanet",
          cluster_id: clusterId,
          name: "Pure Planet renewable plan",
          vendor: "Pure Planet",
          url: "https://pureplanet.com",
          description: "Green energy supplier with B2B pricing.",
          cost_delta_pct: -0.05,
          co2e_delta_pct: -0.55,
          confidence: 0.75,
          feasibility: "drop_in",
          geography: "EU",
          sources: [
            {
              title: "Pure Planet business plans",
              url: "https://pureplanet.com/business",
              snippet: null,
              domain: "pureplanet.com",
              logoUrl: "https://www.google.com/s2/favicons?domain=pureplanet.com&sz=64",
              fetched_at: Math.floor(Date.now() / 1000),
            },
          ],
          provenance: "web_search",
          freshness_days: 0,
          flags: [],
        },
        {
          id: "alt_renegotiate",
          cluster_id: clusterId,
          name: "Renegotiate annual contract",
          vendor: null,
          url: null,
          description:
            "Use independent benchmark data to renegotiate the existing energy contract.",
          cost_delta_pct: -0.12,
          co2e_delta_pct: 0,
          confidence: 0.7,
          feasibility: "drop_in",
          geography: "EU",
          sources: [
            {
              title: "ACM energy advice",
              url: "https://acm.nl",
              snippet: null,
              domain: "acm.nl",
              logoUrl: "https://www.google.com/s2/favicons?domain=acm.nl&sz=64",
              fetched_at: Math.floor(Date.now() / 1000),
            },
          ],
          provenance: "web_search",
          freshness_days: 0,
          flags: [],
        },
      ],
    };

    const baseline: import("../types").BaselineOutput = {
      agent: "spend_emissions_baseline_agent",
      company_id: "org_ac7",
      analysis_period: "2026-04",
      baseline: {
        total_spend_eur: 90_000,
        estimated_total_tco2e: 18,
        baseline_confidence: 0.7,
        top_spend_categories: [
          { category: "utilities", spend_eur: 24_000, share_pct: 0.27 },
        ],
        top_emission_categories: [
          { category: "utilities", tco2e: 12, share_pct: 0.66 },
        ],
        high_cost_high_carbon_clusters: [clusterId],
        uncertain_high_value_clusters: [],
      },
      priority_targets: [
        {
          cluster_id: clusterId,
          category: "utilities",
          annualized_spend_eur: 24_000,
          estimated_tco2e: 12,
          reason_for_priority: "high_emissions",
          recommended_next_agent: "cost_savings_agent",
          baseline_merchant_norm: "energydirect",
          baseline_merchant_label: "EnergyDirect B.V.",
          baseline_sub_category: "electricity",
          baseline_confidence: 0.7,
          baseline_tx_count: 6,
        },
      ],
      required_context_question: null,
    };

    const costOut = await costSavingsModule.run(
      { baseline, researchedPool },
      buildCtx(orgId),
    );

    const result = costOut.results.find((r) => r.cluster_id === clusterId);
    assert.ok(result, "costSavings should have produced a result for cluster_energy");
    assert.ok(
      result.cost_saving_options.length >= 2,
      "result should carry >=2 options (OVO + Pure Planet were both researched)",
    );

    // R010.AC7 #1 — the OVO option (vendor_switch type, name contains "ovo")
    // matches its `ovo.com` source. Its logo URL must be the deterministic s2
    // favicon URL for ovo.com.
    const ovo = result.cost_saving_options.find((o) => o.option_name.toLowerCase().includes("ovo"));
    assert.ok(ovo, "expected an option named after OVO");
    assert.equal(
      ovo.suggested_vendor_domain,
      "ovo.com",
      `OVO option must match ovo.com domain, got ${ovo.suggested_vendor_domain}`,
    );
    assert.equal(
      ovo.suggested_vendor_logo_url,
      "https://www.google.com/s2/favicons?domain=ovo.com&sz=64",
      `OVO option logo URL must be the deterministic s2 favicon, got ${ovo.suggested_vendor_logo_url}`,
    );

    // R010.AC7 #2 — the "Renegotiate annual contract" option name contains
    // none of the source domain heads (ovo, pureplanet, acm) and no source
    // title contains the full string "renegotiate annual contract", so the
    // matcher returns null for both fields.
    const renegotiate = result.cost_saving_options.find((o) =>
      o.option_name.toLowerCase().includes("renegotiate"),
    );
    assert.ok(renegotiate, "expected an option named after the renegotiation alternative");
    assert.equal(
      renegotiate.suggested_vendor_domain,
      null,
      `Renegotiate option must NOT match any source, got ${renegotiate.suggested_vendor_domain}`,
    );
    assert.equal(
      renegotiate.suggested_vendor_logo_url,
      null,
      `Renegotiate option must NOT have a logo URL, got ${renegotiate.suggested_vendor_logo_url}`,
    );
  });
});
