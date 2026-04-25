import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { env } from "@/lib/env";

/**
 * Applies schema via raw CREATE TABLE IF NOT EXISTS.
 * For hackathon speed we skip drizzle-kit migrations and create the schema inline here.
 * Must be kept in sync with lib/db/schema.ts.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bunq_user_id TEXT,
  reserve_account_id TEXT,
  credits_account_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_tx_org_ts ON transactions(org_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tx_merchant_norm ON transactions(merchant_norm);

CREATE TABLE IF NOT EXISTS merchant_category_cache (
  merchant_norm TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sub_category TEXT,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS emission_factors (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sub_category TEXT,
  factor_kg_per_eur REAL NOT NULL,
  uncertainty_pct REAL NOT NULL,
  region TEXT NOT NULL DEFAULT 'EU',
  source TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 3
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
CREATE INDEX IF NOT EXISTS idx_est_run ON emission_estimates(close_run_id);
CREATE INDEX IF NOT EXISTS idx_est_tx ON emission_estimates(tx_id);

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
  completed_at INTEGER
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
-- Append-only: prevent UPDATE and DELETE.
CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

CREATE TABLE IF NOT EXISTS credit_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  price_per_tonne_eur REAL NOT NULL,
  description TEXT NOT NULL,
  registry TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  close_run_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  tonnes REAL NOT NULL,
  eur REAL NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_impact_org_run ON impact_recommendations(org_id, research_run_id);
CREATE INDEX IF NOT EXISTS idx_impact_baseline ON impact_recommendations(research_run_id, baseline_key);

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
CREATE INDEX IF NOT EXISTS idx_agent_runs_org ON agent_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_research ON agent_runs(research_run_id);

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
CREATE INDEX IF NOT EXISTS idx_agent_messages_run ON agent_messages(agent_run_id);

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
CREATE INDEX IF NOT EXISTS idx_research_cache_org ON research_cache(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_cache_week ON research_cache(week_bucket, category);

CREATE TABLE IF NOT EXISTS web_search_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_run_id TEXT NOT NULL,
  cluster_id TEXT,
  query TEXT NOT NULL,
  results_n INTEGER NOT NULL,
  first_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_web_search_audit_run ON web_search_audit(agent_run_id);


CREATE TABLE IF NOT EXISTS onboarding_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  track TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  profile TEXT,
  partial_policy TEXT,
  gap_list TEXT,
  unsupported_list TEXT,
  draft_policy TEXT,
  draft_markdown TEXT,
  credit_shortlist TEXT,
  calibration_notes TEXT,
  upload_ref TEXT,
  upload_mime TEXT,
  upload_extract TEXT,
  seed_close_run_id TEXT,
  question_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_onb_org ON onboarding_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_onb_status ON onboarding_runs(status);

CREATE TABLE IF NOT EXISTS onboarding_qa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  topic TEXT NOT NULL,
  kind TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT,
  rationale TEXT,
  answer TEXT,
  parsed_answer TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  asked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  answered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_onbqa_run ON onboarding_qa(run_id);
`;

const dbPath = env.dbUrl.replace(/^file:/, "");
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(DDL);

// Additive columns on pre-existing tables. SQLite has no "ADD COLUMN IF NOT EXISTS",
// so check the pragma before issuing. Keep forward-compatible with fresh installs.
const columnsOf = (table: string): Set<string> => {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
};
const ensureColumn = (table: string, column: string, ddl: string) => {
  const cols = columnsOf(table);
  if (!cols.has(column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
};
ensureColumn("agent_messages", "server_tool_use_count", "INTEGER");
ensureColumn("agent_messages", "web_search_requests", "INTEGER");
// R002.AC2 — additive `mock_path` (0 real, 1 mock). Nullable for backfill safety.
ensureColumn("agent_messages", "mock_path", "INTEGER");
// R008.AC1 / T012 — additive `dag_run_id` on close_runs links the legacy
// 12-state close machine to the 8-agent DAG run it triggers. Nullable so
// rows from before the QUESTIONS_GENERATED → DAG_RUNNING refactor still load.
ensureColumn("close_runs", "dag_run_id", "TEXT");

console.log(`Migrated: ${dbPath}`);
sqlite.close();
