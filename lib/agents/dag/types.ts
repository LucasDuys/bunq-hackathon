/**
 * Shared types for the 7-agent DAG.
 * Schemas mirror C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md §15.
 * See docs/agents/00-overview.md for the dependency diagram.
 */

export type AgentName =
  | "spend_emissions_baseline_agent"
  | "research_agent"
  | "green_alternatives_agent"
  | "cost_savings_agent"
  | "green_judge_agent"
  | "cost_judge_agent"
  | "carbon_credit_incentive_strategy_agent"
  | "executive_report_agent";

export type Confidence = number; // 0..1

export interface AgentContext {
  orgId: string;
  analysisPeriod: string; // YYYY-MM
  policyId?: string;
  dryRun: boolean;
  mock: boolean;
  auditLog: (event: { type: string; payload: Record<string, unknown> }) => Promise<void>;
  /**
   * R002 / T002 — set by `runDag` before invoking each agent so per-agent
   * observability rows in `agent_messages` (mock_path, tokens, cached) can be
   * keyed back to the same runId that `runDag` returns. Optional so callers
   * outside the DAG (legacy spendBaseline tests, etc.) keep working.
   */
  agentRunId?: string;
}

export interface AgentRunMetrics {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export interface BaselineOutput {
  agent: "spend_emissions_baseline_agent";
  company_id: string;
  analysis_period: string;
  baseline: {
    total_spend_eur: number;
    estimated_total_tco2e: number;
    baseline_confidence: Confidence;
    top_spend_categories: Array<{ category: string; spend_eur: number; share_pct: number }>;
    top_emission_categories: Array<{ category: string; tco2e: number; share_pct: number }>;
    high_cost_high_carbon_clusters: string[];
    uncertain_high_value_clusters: string[];
  };
  priority_targets: PriorityTarget[];
  required_context_question: string | null;
}

export interface PriorityTarget {
  cluster_id: string;
  category: string;
  annualized_spend_eur: number;
  estimated_tco2e: number;
  reason_for_priority: "high_spend" | "high_emissions" | "high_uncertainty" | "policy_relevant";
  recommended_next_agent: "green_alternatives_agent" | "cost_savings_agent" | "both";
  // Enriched context the Baseline agent computes and downstream agents consume directly.
  // Keeps tool-call pressure off Green/Cost agents — they don't need to re-resolve merchant labels.
  baseline_merchant_norm?: string;
  baseline_merchant_label?: string;
  baseline_sub_category?: string | null;
  baseline_confidence?: number;
  baseline_tx_count?: number;
  baseline_has_invoice?: boolean;
  baseline_invoice_count?: number;
  baseline_data_basis?: "invoice" | "spend_based";
}

// plans/matrix-research.md §6 — evidence-backed alternatives from the Research Agent.
// R010 / T006 — `logoUrl` is a deterministic Google s2 favicon URL keyed off
// `domain`. We populate it in code after the LLM returns (never asked from the
// model) so the executive matrix can render real vendor logos with no extra
// network calls. Survives `orgNeutralizeForCache` since logoUrl depends solely
// on the already-org-neutral `domain` field.
export interface EvidenceSource {
  title: string;
  url: string;
  snippet: string | null;
  domain: string;
  logoUrl: string;
  fetched_at: number; // unix sec
}

export type ResearchedAltFeasibility = "drop_in" | "migration" | "procurement" | "policy";
export type ResearchedAltProvenance = "web_search" | "cache" | "template" | "hybrid";
export type ResearchedAltFlag =
  | "requires_policy_check"
  | "requires_tax_verification"
  | "incumbent_match"
  | "paywalled_source"
  | "single_source_only";

export interface ResearchedAlternative {
  id: string; // stable hash per (cluster, vendor, name)
  cluster_id: string;
  name: string;
  vendor: string | null;
  url: string | null;
  description: string;
  cost_delta_pct: number | null; // signed, -0.35 = 35% cheaper
  co2e_delta_pct: number | null; // signed, -0.9 = 90% less
  confidence: number; // 0..1
  feasibility: ResearchedAltFeasibility;
  geography: string;
  sources: EvidenceSource[];
  provenance: ResearchedAltProvenance;
  freshness_days: number;
  flags: ResearchedAltFlag[];
}

export interface ResearchResult {
  cluster_id: string;
  alternatives: ResearchedAlternative[];
  searches_used: number;
  cache_hit: boolean;
}

export interface ResearchOutput {
  agent: "research_agent";
  company_id: string;
  analysis_period: string;
  results: ResearchResult[];
  summary: {
    clusters_researched: number;
    total_alternatives: number;
    total_sources: number;
    total_searches_used: number;
    cache_hits: number;
    web_search_spend_eur: number; // at $10/1k requests → €0.0094/req (approx, USD→EUR rough)
  };
}

// ResearchedPool keyed by cluster_id for easy access in Green/Cost agents.
export type ResearchedPool = Record<string, ResearchedAlternative[]>;

export interface GreenAltOutput {
  agent: "green_alternatives_agent";
  company_id: string;
  analysis_period: string;
  results: Array<{
    cluster_id: string | null;
    transaction_id: string | null;
    merchant: string;
    current_purchase: {
      raw_description: string;
      normalized_item_or_category: string;
      amount_eur: number;
      estimated_kg_co2e: number | null;
      confidence: Confidence;
      data_basis: "item_level" | "category_level" | "merchant_level" | "spend_based" | "unknown";
    };
    alternatives: Array<{
      alternative_name: string;
      alternative_type: "product" | "supplier" | "behavior" | "travel_mode" | "procurement_policy";
      estimated_kg_co2e: number | null;
      carbon_saving_kg: number | null;
      carbon_saving_percent: number | null;
      estimated_price_eur: number | null;
      price_delta_eur: number | null;
      source: "api" | "emission_factor_library" | "historical_data" | "simulated" | "assumption";
      confidence: Confidence;
      comparability_notes: string;
      // R010 / T006 — populated in code by case-insensitive substring match of
      // `alternative_name` (when the alt is a product/supplier) against the
      // research sources for the same cluster. Null when no match.
      suggested_vendor_domain: string | null;
      suggested_vendor_logo_url: string | null;
    }>;
    recommendation_status:
      | "recommend_switch"
      | "recommend_if_policy_allows"
      | "needs_context"
      | "no_viable_alternative_found"
      | "no_action_needed"
      | "reserve_or_offset_after_reduction_review";
    recommended_action: string;
    reasoning_summary: string;
  }>;
  summary: {
    total_current_kg_co2e: number;
    total_potential_kg_co2e_saved: number;
    top_green_opportunities: string[];
    average_confidence: Confidence;
  };
}

export interface CostSavingsOutput {
  agent: "cost_savings_agent";
  company_id: string;
  analysis_period: string;
  results: Array<{
    cluster_id: string | null;
    transaction_id: string | null;
    merchant: string;
    current_spend: {
      amount_eur: number;
      monthly_spend_eur: number | null;
      annualized_spend_eur: number | null;
      category: string;
      data_basis: "single_transaction" | "recurring_pattern" | "category_cluster" | "invoice" | "assumption";
    };
    cost_saving_options: Array<{
      option_name: string;
      option_type:
        | "vendor_switch"
        | "supplier_consolidation"
        | "bulk_purchase"
        | "cancellation"
        | "usage_reduction"
        | "renegotiation"
        | "policy_change";
      estimated_monthly_saving_eur: number | null;
      estimated_annual_saving_eur: number | null;
      one_time_saving_eur: number | null;
      confidence: Confidence;
      source: "historical_data" | "pricing_api" | "benchmark" | "assumption" | "simulated";
      business_risk: "low" | "medium" | "high";
      carbon_effect: "lower" | "neutral" | "higher" | "unknown";
      notes: string;
      // R010 / T006 — populated in code by case-insensitive substring match of
      // `option_name` against the research sources for the same cluster. Null
      // when the option is not a vendor switch or no matching source is found.
      suggested_vendor_domain: string | null;
      suggested_vendor_logo_url: string | null;
    }>;
    recommendation_status:
      | "recommend_switch"
      | "review_recurring_spend"
      | "consolidate_supplier"
      | "bulk_purchase_opportunity"
      | "needs_validation"
      | "no_action_needed";
    recommended_action: string;
    approval_required: boolean;
    reasoning_summary: string;
  }>;
  summary: {
    total_observed_spend_eur: number;
    total_potential_monthly_saving_eur: number;
    total_potential_annual_saving_eur: number;
    top_cost_opportunities: string[];
    average_confidence: Confidence;
  };
}

export type Verdict = "approved" | "approved_with_caveats" | "needs_context" | "rejected";

export interface JudgedBase {
  cluster_id: string | null;
  transaction_id: string | null;
  verdict: Verdict;
  approved_recommendation: string | null;
  confidence: Confidence;
  issues_found: string[];
  audit_summary: string;
}

export interface GreenJudgedResult extends JudgedBase {
  green_score: number;
  corrected_current_kg_co2e: number | null;
  corrected_potential_kg_co2e_saved: number | null;
}

export interface GreenJudgeOutput {
  agent: "green_judge_agent";
  company_id: string;
  analysis_period: string;
  judged_results: GreenJudgedResult[];
  summary: {
    approved_total_current_kg_co2e: number;
    approved_total_potential_kg_co2e_saved: number;
    high_confidence_green_opportunities: string[];
    rejected_or_uncertain_items: string[];
  };
}

export interface CostJudgedResult extends JudgedBase {
  cost_score: number;
  corrected_monthly_saving_eur: number | null;
  corrected_annual_saving_eur: number | null;
  business_risk: "low" | "medium" | "high";
  carbon_effect: "lower" | "neutral" | "higher" | "unknown";
}

export interface CostJudgeOutput {
  agent: "cost_judge_agent";
  company_id: string;
  analysis_period: string;
  judged_results: CostJudgedResult[];
  summary: {
    approved_total_monthly_saving_eur: number;
    approved_total_annual_saving_eur: number;
    high_confidence_cost_opportunities: string[];
    rejected_or_uncertain_items: string[];
  };
}

export interface CreditStrategyResult {
  cluster_id: string | null;
  recommendation_title: string;
  switching_impact: {
    current_annual_spend_eur: number | null;
    new_annual_spend_eur: number | null;
    direct_procurement_saving_eur: number | null;
    implementation_cost_eur: number | null;
    baseline_tco2e: number | null;
    new_tco2e: number | null;
    emissions_reduced_tco2e: number | null;
  };
  credit_strategy: {
    remaining_tco2e_after_switch: number | null;
    recommended_credit_purchase_tco2e: number | null;
    credit_type: "removal_technical" | "removal_nature" | "reduction" | "mixed" | "unknown";
    project_region: "EU" | "non_EU" | "mixed" | "unknown";
    credit_price_per_tonne_eur: number | null;
    credit_purchase_cost_eur: number | null;
    avoided_credit_purchase_cost_eur: number | null;
    eligibility_basis: "confirmed" | "database_match" | "assumption" | "not_eligible" | "requires_verification";
  };
  tax_and_incentives: {
    estimated_credit_tax_value_eur: number | null;
    estimated_procurement_tax_value_eur: number | null;
    avoided_carbon_tax_or_ets_cost_eur: number | null;
    tax_treatment: "confirmed" | "scenario_only" | "not_applicable" | "requires_verification";
  };
  net_financial_impact: {
    gross_savings_before_tax_eur: number | null;
    total_tax_incentive_upside_eur: number | null;
    total_avoided_carbon_cost_eur: number | null;
    total_credit_cost_eur: number | null;
    net_company_scale_financial_impact_eur: number | null;
    payback_period_months: number | null;
  };
  decision: {
    recommendation_status:
      | "strong_financial_case"
      | "positive_with_tax_incentive"
      | "positive_only_if_policy_required"
      | "not_financially_positive"
      | "requires_tax_verification"
      | "insufficient_data";
    cfo_summary: string;
    verification_needed: string[];
    confidence: Confidence;
  };
}

export interface CreditStrategyOutput {
  agent: "carbon_credit_incentive_strategy_agent";
  company_id: string;
  analysis_period: string;
  jurisdiction: {
    country: string | null;
    tax_jurisdiction: string | null;
    entity_type: string | null;
    corporate_tax_rate: number | null;
  };
  baseline: { baseline_annual_spend_eur: number; baseline_annual_tco2e: number };
  results: CreditStrategyResult[];
  summary: {
    total_direct_procurement_saving_eur: number;
    total_emissions_reduced_tco2e: number;
    total_avoided_credit_purchase_cost_eur: number;
    total_recommended_credit_purchase_cost_eur: number;
    total_estimated_tax_incentive_upside_eur: number;
    total_avoided_carbon_tax_or_ets_cost_eur: number;
    total_net_company_scale_financial_impact_eur: number;
    average_confidence: Confidence;
    tax_advisor_review_required: boolean;
  };
}

export interface ExecReportOutput {
  agent: "executive_report_agent";
  company_id: string;
  analysis_period: string;
  report_title: string;
  executive_summary: string;
  kpis: {
    baseline_annual_spend_eur: number;
    projected_annual_spend_after_switching_eur: number;
    direct_procurement_savings_eur: number;
    emissions_reduced_tco2e: number;
    recommended_credit_purchase_cost_eur: number;
    estimated_tax_incentive_upside_eur: number;
    avoided_carbon_tax_or_ets_cost_eur: number;
    implementation_cost_eur: number;
    net_company_scale_financial_impact_eur: number;
    payback_period_months: number;
    confidence: Confidence;
    evidence_source_count: number;
    web_search_spend_eur: number;
  };
  top_recommendations: Array<{
    rank: number;
    title: string;
    category: string;
    carbon_saving_kg: number | null;
    annual_saving_eur: number | null;
    matrix_quadrant:
      | "low_cost_low_carbon"
      | "high_cost_low_carbon"
      | "low_cost_high_carbon"
      | "high_cost_high_carbon";
    action: string;
    approval_required: boolean;
    confidence: Confidence;
  }>;
  matrix: {
    low_cost_low_carbon: string[];
    high_cost_low_carbon: string[];
    low_cost_high_carbon: string[];
    high_cost_high_carbon: string[];
  };
  limitations: string[];
}

/**
 * R001 / T005 — payload shape for the `agent.credit_strategy.run` audit event
 * emitted by `runDag`. The signed `input_digest_sha256` lets a reviewer detect
 * a sign-flip or formula bug post-hoc by re-hashing the four inputs and
 * comparing against the recorded digest.
 */
export interface CreditAuditPayload {
  orgId: string;
  month: string;
  runId: string;
  total_net_company_scale_financial_impact_eur: number;
  total_emissions_reduced_tco2e: number;
  total_recommended_credit_purchase_cost_eur: number;
  tax_advisor_review_required: boolean;
  input_digest_sha256: string;
}

export interface DagRunResult {
  runId: string;
  baseline: BaselineOutput;
  research: ResearchOutput;
  greenAlt: GreenAltOutput;
  costSavings: CostSavingsOutput;
  greenJudge: GreenJudgeOutput;
  costJudge: CostJudgeOutput;
  creditStrategy: CreditStrategyOutput;
  executiveReport: ExecReportOutput;
  metrics: Record<AgentName, AgentRunMetrics>;
  /**
   * R002.AC4 — top-level count of LLM-using agents that took the mock path on
   * this run. 0 means every Sonnet-using agent reached the API; 7 means the
   * full LLM panel was mocked (intended in `ANTHROPIC_MOCK=1`, a degradation
   * signal otherwise). Reads from `agent_messages.mock_path` keyed by runId.
   */
  mock_agent_count: number;
  totalLatencyMs: number;
}
