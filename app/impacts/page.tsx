import { Target } from "lucide-react";
import type { Quadrant } from "@/lib/agent/impacts";
import { Card, CardBody, CodeLabel } from "@/components/ui";
import type { MatrixPoint } from "@/components/ImpactMatrix";
import { RunImpactResearch } from "@/components/RunImpactResearch";
import { ExplainButton } from "@/components/ExplainButton";
import type { PlannableAlternative } from "@/components/ScenarioPlanner";
import {
  ImpactsWorkspace,
  type WorkspaceAlt,
  type WorkspaceBaseline,
  type WorkspaceHeadline,
} from "@/components/ImpactsWorkspace";
import { getLatestDagResult, getLatestRecommendations } from "@/lib/impacts/store";
import { DEFAULT_ORG_ID, getAllTransactions } from "@/lib/queries";

export const dynamic = "force-dynamic";

type RecRow = Awaited<ReturnType<typeof getLatestRecommendations>>[number];

const parseSources = (raw: string): Array<{ title: string; url: string }> => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const groupByBaseline = (rows: RecRow[]): WorkspaceBaseline[] => {
  const m = new Map<string, WorkspaceBaseline>();
  for (const r of rows) {
    let b = m.get(r.baselineKey);
    if (!b) {
      b = {
        key: r.baselineKey,
        merchantLabel: r.baselineMerchantLabel,
        category: r.baselineCategory,
        subCategory: r.baselineSubCategory ?? null,
        annualSpendEur: r.baselineAnnualSpendEur,
        annualCo2eKg: r.baselineAnnualCo2eKg,
        confidence: r.baselineConfidence,
        alternatives: [],
      };
      m.set(r.baselineKey, b);
    }
    const alt: WorkspaceAlt = {
      id: r.id,
      name: r.altName,
      description: r.altDescription,
      type: r.altType,
      costDeltaEurYear: r.altCostDeltaEurYear,
      co2eDeltaKgYear: r.altCo2eDeltaKgYear,
      costDeltaPct: r.altCostDeltaPct,
      co2eDeltaPct: r.altCo2eDeltaPct,
      confidence: r.altConfidence,
      feasibility: r.altFeasibility,
      rationale: r.altRationale,
      sources: parseSources(r.altSources),
      quadrant: r.quadrant as Quadrant,
    };
    b.alternatives.push(alt);
  }
  return [...m.values()].sort((a, b) => b.annualCo2eKg - a.annualCo2eKg);
};

const computeHeadline = (baselines: WorkspaceBaseline[]): WorkspaceHeadline => {
  let totalCo2 = 0;
  let totalSpend = 0;
  let confSum = 0;
  let winWinCo2 = 0;
  let winWinEur = 0;
  let winWinCount = 0;
  let payCo2 = 0;
  let payEur = 0;
  let payCount = 0;
  for (const b of baselines) {
    totalCo2 += b.annualCo2eKg;
    totalSpend += b.annualSpendEur;
    confSum += b.confidence * b.annualCo2eKg;
    const bestWin = b.alternatives
      .filter((a) => a.quadrant === "win_win")
      .sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear)[0];
    if (bestWin) {
      winWinCo2 += bestWin.co2eDeltaKgYear;
      winWinEur += bestWin.costDeltaEurYear;
      winWinCount += 1;
    }
    const bestPay = b.alternatives
      .filter((a) => a.quadrant === "pay_to_decarbonize")
      .sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear)[0];
    if (bestPay) {
      payCo2 += bestPay.co2eDeltaKgYear;
      payEur += bestPay.costDeltaEurYear;
      payCount += 1;
    }
  }
  return {
    totalCo2,
    totalSpend,
    avgConfidence: totalCo2 > 0 ? confSum / totalCo2 : 0,
    winWinCo2,
    winWinEur,
    winWinCount,
    payCo2,
    payEur,
    payCount,
  };
};

export default async function ImpactsPage() {
  const rows = getLatestRecommendations(DEFAULT_ORG_ID);
  const dag = getLatestDagResult(DEFAULT_ORG_ID);
  const baselines = groupByBaseline(rows);
  const hasRecommendations = baselines.length > 0;
  // The DAG payload alone is enough to show the workspace — research, cost
  // savings, credit strategy, executive report all render off `dag`. Recs only
  // exist when greenJudge approves a cluster, so a real run with all-rejected
  // verdicts would otherwise hide the entire workspace.
  const hasData = hasRecommendations || !!dag;
  const headline = computeHeadline(baselines);

  // Surfaces "Research my last 90 days" with a merchant count when no data yet.
  const allTxs = getAllTransactions(DEFAULT_ORG_ID);
  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
  const recentMerchants = new Set(
    allTxs
      .filter((t) => t.timestamp >= ninetyDaysAgo)
      .map((t) => (t.merchantNorm ?? t.merchantRaw ?? "").toLowerCase()),
  );
  recentMerchants.delete("");
  const recentMerchantCount = recentMerchants.size;

  const matrixPoints: MatrixPoint[] = baselines.flatMap((b) =>
    b.alternatives.map((a) => ({
      id: a.id,
      baselineLabel: b.merchantLabel,
      altName: a.name,
      costDeltaEurYear: a.costDeltaEurYear,
      co2eDeltaKgYear: a.co2eDeltaKgYear,
      baselineAnnualCo2eKg: b.annualCo2eKg,
      quadrant: a.quadrant,
      feasibility: a.feasibility,
      confidence: a.confidence,
    })),
  );

  const plannableAlts: PlannableAlternative[] = baselines.flatMap((b) =>
    b.alternatives.map((a) => ({
      id: a.id,
      baselineKey: b.key,
      baselineLabel: b.merchantLabel,
      name: a.name,
      category: b.category,
      costDeltaEurYear: a.costDeltaEurYear,
      co2eDeltaKgYear: a.co2eDeltaKgYear,
      confidence: a.confidence,
      quadrant: a.quadrant,
      sourceCount: a.sources.length,
    })),
  );

  const researchKpis = dag
    ? {
        evidenceSources: dag.executiveReport.kpis.evidence_source_count ?? 0,
        webSearchSpendEur: dag.executiveReport.kpis.web_search_spend_eur ?? 0,
        clustersResearched: dag.research?.summary.clusters_researched ?? 0,
        cacheHits: dag.research?.summary.cache_hits ?? 0,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <CodeLabel>Impact workspace</CodeLabel>
          <h1
            className="text-[32px] font-normal leading-[1.00] tracking-[-0.015em] mt-2"
            style={{ color: "var(--fg-primary)" }}
          >
            Impact workspace
          </h1>
          <p
            className="text-[14px] mt-2 max-w-[64ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Where swapping a vendor or policy cuts the most CO₂e per euro — grounded in DEFRA,
            Ember and vendor sustainability pages, judged by our green and cost LLM panels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExplainButton metric="impact-summary" />
          <RunImpactResearch hasData={hasRecommendations} />
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardBody className="py-14 text-center flex flex-col items-center gap-3">
            <Target
              className="h-8 w-8"
              style={{ color: "var(--brand-green)" }}
              aria-hidden
            />
            <h2
              className="text-[17px] font-normal"
              style={{ color: "var(--fg-primary)", letterSpacing: "-0.16px" }}
            >
              {recentMerchantCount > 0
                ? "Research my last 90 days"
                : "No impact research yet"}
            </h2>
            <p
              className="text-[13px] max-w-md"
              style={{ color: "var(--fg-secondary)" }}
            >
              The agents analyse cloud, travel, utilities, food and procurement and surface
              realistic alternatives — with sources, confidence, and a CFO-grade net impact
              number.
            </p>
            {recentMerchantCount > 0 && (
              <CodeLabel>{recentMerchantCount} merchants in scope</CodeLabel>
            )}
          </CardBody>
        </Card>
      ) : (
        <ImpactsWorkspace
          baselines={baselines}
          headline={headline}
          matrixPoints={matrixPoints}
          plannableAlts={plannableAlts}
          dag={dag}
          researchKpis={researchKpis}
          action={<RunImpactResearch hasData={hasRecommendations} />}
        />
      )}
    </div>
  );
}
