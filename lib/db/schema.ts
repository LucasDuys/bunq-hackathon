import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bunqUserId: text("bunq_user_id"),
  reserveAccountId: text("reserve_account_id"),
  creditsAccountId: text("credits_account_id"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const bunqSessions = sqliteTable("bunq_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgId: text("org_id").notNull(),
  installationToken: text("installation_token").notNull(),
  sessionToken: text("session_token").notNull(),
  serverPublicKey: text("server_public_key").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  bunqTxId: text("bunq_tx_id"),
  merchantRaw: text("merchant_raw").notNull(),
  merchantNorm: text("merchant_norm").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  timestamp: integer("timestamp").notNull(),
  accountId: text("account_id"),
  description: text("description"),
  category: text("category"),
  subCategory: text("sub_category"),
  categoryConfidence: real("category_confidence"),
  classifierSource: text("classifier_source"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const merchantCategoryCache = sqliteTable("merchant_category_cache", {
  merchantNorm: text("merchant_norm").primaryKey(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  confidence: real("confidence").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const emissionFactors = sqliteTable("emission_factors", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  factorKgPerEur: real("factor_kg_per_eur").notNull(),
  uncertaintyPct: real("uncertainty_pct").notNull(),
  region: text("region").notNull().default("EU"),
  source: text("source").notNull(),
  tier: integer("tier").notNull().default(3),
});

export const emissionEstimates = sqliteTable("emission_estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  txId: text("tx_id").notNull(),
  factorId: text("factor_id").notNull(),
  co2eKgLow: real("co2e_kg_low").notNull(),
  co2eKgPoint: real("co2e_kg_point").notNull(),
  co2eKgHigh: real("co2e_kg_high").notNull(),
  confidence: real("confidence").notNull(),
  method: text("method").notNull(),
  closeRunId: text("close_run_id"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  rules: text("rules").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const closeRuns = sqliteTable("close_runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  month: text("month").notNull(),
  status: text("status").notNull(),
  state: text("state").notNull(),
  initialCo2eKg: real("initial_co2e_kg"),
  finalCo2eKg: real("final_co2e_kg"),
  initialConfidence: real("initial_confidence"),
  finalConfidence: real("final_confidence"),
  reserveEur: real("reserve_eur"),
  creditRecommendation: text("credit_recommendation"),
  proposedActions: text("proposed_actions"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  approvedAt: integer("approved_at"),
  startedAt: integer("started_at").notNull().default(sql`(unixepoch())`),
  completedAt: integer("completed_at"),
});

export const refinementQa = sqliteTable("refinement_qa", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  closeRunId: text("close_run_id").notNull(),
  clusterId: text("cluster_id").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull(),
  answer: text("answer"),
  affectedTxIds: text("affected_tx_ids").notNull(),
  co2eDeltaKg: real("co2e_delta_kg"),
  answeredAt: integer("answered_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgId: text("org_id").notNull(),
  closeRunId: text("close_run_id"),
  actor: text("actor").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const creditProjects = sqliteTable("credit_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  pricePerTonneEur: real("price_per_tonne_eur").notNull(),
  description: text("description").notNull(),
  registry: text("registry").notNull(),
});

export const creditPurchases = sqliteTable("credit_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  closeRunId: text("close_run_id").notNull(),
  projectId: text("project_id").notNull(),
  tonnes: real("tonnes").notNull(),
  eur: real("eur").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const impactRecommendations = sqliteTable("impact_recommendations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  researchRunId: text("research_run_id").notNull(),
  month: text("month").notNull(),
  baselineKey: text("baseline_key").notNull(),
  baselineMerchantNorm: text("baseline_merchant_norm").notNull(),
  baselineMerchantLabel: text("baseline_merchant_label").notNull(),
  baselineCategory: text("baseline_category").notNull(),
  baselineSubCategory: text("baseline_sub_category"),
  baselineAnnualSpendEur: real("baseline_annual_spend_eur").notNull(),
  baselineAnnualCo2eKg: real("baseline_annual_co2e_kg").notNull(),
  baselineConfidence: real("baseline_confidence").notNull(),
  altName: text("alt_name").notNull(),
  altType: text("alt_type").notNull(),
  altDescription: text("alt_description").notNull(),
  altCostDeltaPct: real("alt_cost_delta_pct").notNull(),
  altCo2eDeltaPct: real("alt_co2e_delta_pct").notNull(),
  altCostDeltaEurYear: real("alt_cost_delta_eur_year").notNull(),
  altCo2eDeltaKgYear: real("alt_co2e_delta_kg_year").notNull(),
  altConfidence: real("alt_confidence").notNull(),
  altFeasibility: text("alt_feasibility").notNull(),
  altRationale: text("alt_rationale").notNull(),
  altSources: text("alt_sources").notNull(),
  quadrant: text("quadrant").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  month: text("month").notNull(),
  researchRunId: text("research_run_id"),
  dagPayload: text("dag_payload").notNull(),
  totalLatencyMs: integer("total_latency_ms").notNull(),
  mock: integer("mock", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const agentMessages = sqliteTable("agent_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentRunId: text("agent_run_id").notNull(),
  agentName: text("agent_name").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  cached: integer("cached", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type EmissionFactor = typeof emissionFactors.$inferSelect;
export type EmissionEstimate = typeof emissionEstimates.$inferSelect;
export type CloseRun = typeof closeRuns.$inferSelect;
export type RefinementQa = typeof refinementQa.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type CreditProject = typeof creditProjects.$inferSelect;
export type ImpactRecommendation = typeof impactRecommendations.$inferSelect;
export type NewImpactRecommendation = typeof impactRecommendations.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
