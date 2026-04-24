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
`;

const dbPath = env.dbUrl.replace(/^file:/, "");
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(DDL);
console.log(`Migrated: ${dbPath}`);
sqlite.close();
