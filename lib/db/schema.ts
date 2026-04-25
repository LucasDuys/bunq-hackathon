import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bunqUserId: text("bunq_user_id"),
  reserveAccountId: text("reserve_account_id"),
  creditsAccountId: text("credits_account_id"),
  taxReserveAccountId: text("tax_reserve_account_id"),
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
  // R008.AC1 / T012 — additive runId pointer linking this close run to the
  // 8-agent DAG run it triggered (replaces the old questions.ts touchpoint).
  // Nullable so historical close_runs rows from before T012 stay valid.
  dagRunId: text("dag_run_id"),
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
  serverToolUseCount: integer("server_tool_use_count"),
  webSearchRequests: integer("web_search_requests"),
  // R002.AC2 — 0 = real API path, 1 = `buildMock()` fallback. Additive; nullable
  // for rows written before the migration ran.
  mockPath: integer("mock_path"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// Research Agent cache — plans/matrix-research.md §5. Keyed per jurisdiction + policy digest
// so two orgs in the same regime share cache rows (future multi-tenant amortization).
export const researchCache = sqliteTable("research_cache", {
  cacheKey: text("cache_key").primaryKey(),
  orgId: text("org_id").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  jurisdiction: text("jurisdiction").notNull(),
  policyDigest: text("policy_digest").notNull(),
  weekBucket: text("week_bucket").notNull(),
  alternativesJson: text("alternatives_json").notNull(),
  sourcesCount: integer("sources_count").notNull(),
  searchRequestsUsed: integer("search_requests_used").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  ttlSec: integer("ttl_sec").notNull().default(2_592_000),
});

export const webSearchAudit = sqliteTable("web_search_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentRunId: text("agent_run_id").notNull(),
  clusterId: text("cluster_id"),
  query: text("query").notNull(),
  resultsN: integer("results_n").notNull(),
  firstUrl: text("first_url"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const onboardingRuns = sqliteTable("onboarding_runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  track: text("track").notNull(),
  state: text("state").notNull(),
  status: text("status").notNull().default("active"),
  profile: text("profile"),
  partialPolicy: text("partial_policy"),
  gapList: text("gap_list"),
  unsupportedList: text("unsupported_list"),
  draftPolicy: text("draft_policy"),
  draftMarkdown: text("draft_markdown"),
  creditShortlist: text("credit_shortlist"),
  calibrationNotes: text("calibration_notes"),
  uploadRef: text("upload_ref"),
  uploadMime: text("upload_mime"),
  uploadExtract: text("upload_extract"),
  seedCloseRunId: text("seed_close_run_id"),
  questionCount: integer("question_count").notNull().default(0),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  completedAt: integer("completed_at"),
});

export const onboardingQa = sqliteTable("onboarding_qa", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  turnIndex: integer("turn_index").notNull(),
  topic: text("topic").notNull(),
  kind: text("kind").notNull(),
  question: text("question").notNull(),
  options: text("options"),
  rationale: text("rationale"),
  answer: text("answer"),
  parsedAnswer: text("parsed_answer"),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  askedAt: integer("asked_at").notNull().default(sql`(unixepoch())`),
  answeredAt: integer("answered_at"),
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
export type ResearchCacheRow = typeof researchCache.$inferSelect;
export type NewResearchCacheRow = typeof researchCache.$inferInsert;
export type WebSearchAudit = typeof webSearchAudit.$inferSelect;
export type NewWebSearchAudit = typeof webSearchAudit.$inferInsert;
export type OnboardingRun = typeof onboardingRuns.$inferSelect;
export type NewOnboardingRun = typeof onboardingRuns.$inferInsert;
export type OnboardingQa = typeof onboardingQa.$inferSelect;
export type NewOnboardingQa = typeof onboardingQa.$inferInsert;

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileMime: text("file_mime").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  source: text("source").notNull(),
  gmailMessageId: text("gmail_message_id"),
  merchantRaw: text("merchant_raw"),
  merchantNorm: text("merchant_norm"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: integer("invoice_date"),
  dueDate: integer("due_date"),
  subtotalCents: integer("subtotal_cents"),
  vatCents: integer("vat_cents"),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  category: text("category"),
  subCategory: text("sub_category"),
  categoryConfidence: real("category_confidence"),
  classifierSource: text("classifier_source"),
  linkedTxId: text("linked_tx_id"),
  extractionModel: text("extraction_model").notNull(),
  extractionRaw: text("extraction_raw"),
  status: text("status").notNull().default("processed"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: text("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity"),
  unitPriceCents: integer("unit_price_cents"),
  amountCents: integer("amount_cents").notNull(),
  vatRatePct: real("vat_rate_pct"),
  vatCents: integer("vat_cents"),
  category: text("category"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
