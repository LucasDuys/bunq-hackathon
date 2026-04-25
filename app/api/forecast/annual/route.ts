/**
 * T008 / R005 — POST /api/forecast/annual.
 *
 * Surfaces the deterministic annual savings projector (R004) so the dashboard
 * + presentation can call it without code changes. Pure, no LLM, no DB writes
 * other than the audit event.
 */
import { NextResponse } from "next/server";
import { appendAudit } from "@/lib/audit/append";
import {
  forecastAnnualSavings,
  type ForecastEntityType,
  type ForecastInput,
  type ForecastJurisdiction,
} from "@/lib/agents/dag/projector";
import { DEFAULT_ORG_ID } from "@/lib/queries";

const ALLOWED_JURISDICTIONS: ForecastJurisdiction[] = ["NL", "DE", "FR", "EU"];
const ALLOWED_ENTITY_TYPES: ForecastEntityType[] = ["BV", "NV", "GmbH", "SARL", "other"];

const DEFAULT_DISTRIBUTION: Record<string, number> = {
  travel: 0.2,
  procurement: 0.2,
  food: 0.2,
  services: 0.2,
  cloud: 0.2,
};

export const POST = async (req: Request) => {
  let body: Partial<ForecastInput> & { orgId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Empty body → use defaults below.
  }

  const orgId = body.orgId ?? DEFAULT_ORG_ID;
  const jurisdiction = body.jurisdiction ?? "NL";
  const entityType = body.entityType ?? "BV";
  const monthlySpendEur = body.monthlySpendEur ?? 100_000;
  const spendDistribution = body.spendDistribution ?? DEFAULT_DISTRIBUTION;
  const switchAdoptionPct = body.switchAdoptionPct ?? 0.5;

  if (!ALLOWED_JURISDICTIONS.includes(jurisdiction as ForecastJurisdiction)) {
    return NextResponse.json(
      { error: "invalid_jurisdiction", details: `must be one of ${ALLOWED_JURISDICTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!ALLOWED_ENTITY_TYPES.includes(entityType as ForecastEntityType)) {
    return NextResponse.json(
      { error: "invalid_entity_type", details: `must be one of ${ALLOWED_ENTITY_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  const distSum = Object.values(spendDistribution).reduce((s, v) => s + (v || 0), 0);
  if (Math.abs(distSum - 1) > 0.01 && distSum !== 0) {
    return NextResponse.json(
      { error: "invalid_distribution", details: `spendDistribution must sum to 1.0 (got ${distSum.toFixed(3)})` },
      { status: 400 },
    );
  }
  if (typeof monthlySpendEur !== "number" || monthlySpendEur < 0) {
    return NextResponse.json(
      { error: "invalid_monthly_spend", details: "monthlySpendEur must be a non-negative number" },
      { status: 400 },
    );
  }
  if (typeof switchAdoptionPct !== "number" || switchAdoptionPct < 0 || switchAdoptionPct > 1) {
    return NextResponse.json(
      { error: "invalid_adoption_pct", details: "switchAdoptionPct must be in [0, 1]" },
      { status: 400 },
    );
  }

  const input: ForecastInput = {
    jurisdiction: jurisdiction as ForecastJurisdiction,
    entityType: entityType as ForecastEntityType,
    monthlySpendEur,
    spendDistribution,
    switchAdoptionPct,
    policyId: body.policyId,
  };

  const output = forecastAnnualSavings(input);

  appendAudit({
    orgId,
    actor: "agent",
    type: "forecast.annual.completed",
    payload: {
      orgId,
      monthlySpendEur,
      switchAdoptionPct,
      netImpactEur: output.projected_savings.net_company_scale_financial_impact_eur,
    },
  });

  return NextResponse.json(output, { status: 200 });
};
