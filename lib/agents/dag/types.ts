/**
 * Shared types for the 7-agent DAG.
 * Schemas mirror C:\Users\20243455\Downloads\carbon_autopilot_agentic_system (2).md §15.
 * See docs/agents/00-overview.md for the dependency diagram.
 */

export type AgentName =
  | "spend_emissions_baseline_agent"
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
  priority_targets: Array<{
    cluster_id: string;
    category: string;
    annualized_spend_eur: number;
    estimated_tco2e: number;
    reason_for_priority: "high_spend" | "high_emissions" | "high_uncertainty" | "policy_relevant";
    recommended_next_agent: "green_alternatives_agent" | "cost_savings_agent" | "both";
  }>;
  required_context_question: string | null;
}

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

export interface JudgedResult {
  cluster_id: string | null;
  transaction_id: string | null;
  verdict: "approved" | "approved_with_caveats" | "needs_context" | "rejected";
  score: number;
  approved_recommendation: string | null;
  confidence: Confidence;
  issues_found: string[];
  audit_summary: string;
}

export interface GreenJudgeOutput {
  agent: "green_judge_agent";
  company_id: string;
  analysis_period: string;
  judged_results: Array<
    JudgedResult & {
      corrected_current_kg_co2e: number | null;
      corrected_potential_kg_co2e_saved: number | null;
    }
  >;
  summary: {
    approved_total_current_kg_co2e: number;
    approved_total_potential_kg_co2e_saved: number;
    high_confidence_green_opportunities: string[];
    rejected_or_uncertain_items: string[];
  };
}

export interface CostJudgeOutput {
  agent: "cost_judge_agent";
  company_id: string;
  analysis_period: string;
  judged_results: Array<
    JudgedResult & {
      corrected_monthly_saving_eur: number | null;
      corrected_annual_saving_eur: number | null;
      business_risk: "low" | "medium" | "high";
      carbon_effect: "lower" | "neutral" | "higher" | "unknown";
    }
  >;
  summary: {
    approved_total_monthly_saving_eur: number;
    approved_total_annual_saving_eur: number;
    high_confidence_cost_opportunities: string[];
    rejected_or_uncertain_items: string[];
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
  results: Array<Record<string, unknown>>;
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

export interface DagRunResult {
  runId: string;
  baseline: BaselineOutput;
  greenAlt: GreenAltOutput;
  costSavings: CostSavingsOutput;
  greenJudge: GreenJudgeOutput;
  costJudge: CostJudgeOutput;
  creditStrategy: CreditStrategyOutput;
  executiveReport: ExecReportOutput;
  metrics: Record<AgentName, AgentRunMetrics>;
  totalLatencyMs: number;
}
