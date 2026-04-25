import { Card, CardBody, CardHeader, CardTitle, Badge, SectionDivider } from "@/components/ui";
import { DEFAULT_ORG_ID, getCategorySpendForMonth, getLatestCloseRun, getLatestEstimatesForMonth } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";
import type { CreditProject } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * R008.AC2 / T012 — `lib/agent/narrative.ts` was deleted as part of the
 * close-machine ↔ runDag consolidation. The CSRD narrative has always been a
 * deterministic 4-sentence factual summary in mock mode (the only mode the
 * report page is rendered in for the hackathon demo); we inline that body
 * here so the page keeps producing the same output without owning a separate
 * Sonnet touchpoint. If a future spec needs an LLM-written narrative again,
 * call `runDag` (single LLM entry point) and add a narrative shape to the
 * executive report agent — do not resurrect a per-page Anthropic call.
 */
const buildCsrdNarrative = (params: {
  month: string;
  totalCo2eKg: number;
  confidence: number;
  topCategories: Array<{ category: string; co2eKg: number; spendEur: number }>;
  reserveEur: number;
  creditTonnes: number;
  euPct: number;
}): string => {
  const { month, totalCo2eKg, confidence, topCategories, reserveEur, creditTonnes, euPct } = params;
  return [
    `In ${month}, reported Scope 3 emissions were estimated at ${(totalCo2eKg / 1000).toFixed(2)} tCO₂e with ${(confidence * 100).toFixed(0)}% data-quality confidence (spend-based method, Exiobase/DEFRA 2024 factors).`,
    `Top emission drivers: ${topCategories.slice(0, 3).map((c) => `${c.category} (${(c.co2eKg / 1000).toFixed(2)} tCO₂e)`).join(", ")}.`,
    `A Carbo Reserve of €${reserveEur.toFixed(2)} was allocated, funding ${creditTonnes.toFixed(2)} tCO₂e of carbon credits (${euPct.toFixed(0)}% EU-based, removal-weighted).`,
    `Methodology: GHG Protocol Scope 3 Category 1/6; data-quality Tier 3 unless refined; uncertainty quantified per category. Credit recommendations exclude non-EU offsets per policy.`,
  ].join(" ");
};

export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const run = latest && latest.month === month ? latest : null;
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);

  const perCat = new Map<string, { spendEur: number; co2eKg: number }>();
  for (const r of spendRows) {
    if (!r.category) continue;
    perCat.set(r.category, { spendEur: Number(r.spendEur ?? 0), co2eKg: 0 });
  }
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const s = perCat.get(cat) ?? { spendEur: 0, co2eKg: 0 };
    s.co2eKg += e.co2eKgPoint;
    perCat.set(cat, s);
  }
  const catRows = Array.from(perCat.entries()).sort((a, b) => b[1].co2eKg - a[1].co2eKg);
  const totalCo2 = catRows.reduce((s, [, v]) => s + v.co2eKg, 0);

  const mix = run?.creditRecommendation ? (JSON.parse(run.creditRecommendation) as Array<{ project: CreditProject; tonnes: number; eur: number }>) : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const euTonnes = mix.filter((m) => m.project.region === "EU").reduce((s, m) => s + m.tonnes, 0);
  const removalTonnes = mix.filter((m) => m.project.type !== "reduction").reduce((s, m) => s + m.tonnes, 0);
  const euPct = totalTonnes > 0 ? euTonnes / totalTonnes : 0;
  const removalPct = totalTonnes > 0 ? removalTonnes / totalTonnes : 0;

  const narrative = buildCsrdNarrative({
    month,
    totalCo2eKg: run?.finalCo2eKg ?? totalCo2,
    confidence: run?.finalConfidence ?? 0.6,
    topCategories: catRows.slice(0, 3).map(([category, v]) => ({ category, ...v })),
    reserveEur: run?.reserveEur ?? 0,
    creditTonnes: totalTonnes,
    euPct: euPct * 100,
  });

  return (
    <div className="relative z-[1] flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
            CSRD ESRS E1 extract
          </div>
          <h1 className="text-2xl font-semibold mt-1.5" style={{ color: "var(--text)" }}>
            Monthly carbon report — {month}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            Voluntary monthly slice; methodology and uncertainty quantified per GHG Protocol Scope 3.
          </p>
        </div>
        <Badge tone="info">Audit-ready</Badge>
      </div>

      <SectionDivider />

      <Card>
        <CardHeader><CardTitle>Narrative summary</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>{narrative}</p>
        </CardBody>
      </Card>

      <SectionDivider label="Emissions" />

      <Card>
        <CardHeader><CardTitle>E1-6 — Gross GHG emissions (approximated)</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.6px] font-semibold" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-mute)" }}>
                <th className="py-2.5 pr-4">Category (Scope 3, Cat 1/6)</th>
                <th className="py-2.5 pr-4 text-right">Spend</th>
                <th className="py-2.5 pr-4 text-right">CO₂e</th>
                <th className="py-2.5 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map(([cat, v]) => (
                <tr key={cat} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                  <td className="py-2.5 pr-4 capitalize" style={{ color: "var(--text)" }}>{cat}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--text-dim)" }}>{fmtEur(v.spendEur, 0)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--text-dim)" }}>{fmtKg(v.co2eKg)}</td>
                  <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>{totalCo2 ? `${((v.co2eKg / totalCo2) * 100).toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2.5 pr-4" style={{ color: "var(--text)" }}>Total</td>
                <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--text)" }}>{fmtEur(catRows.reduce((s, [, v]) => s + v.spendEur, 0), 0)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--text)" }}>{fmtKg(totalCo2)}</td>
                <td className="py-2.5 text-right" style={{ color: "var(--text)" }}>100%</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs mt-3" style={{ color: "var(--text-mute)" }}>
            Method: spend-based (Exiobase / DEFRA 2024 / ADEME Base Carbone). Uncertainty varies by factor (see ledger).
          </p>
        </CardBody>
      </Card>

      <SectionDivider label="Credits" />

      <Card>
        <CardHeader><CardTitle>E1-7 — Carbon removal and carbon credits</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.6px] font-semibold" style={{ color: "var(--text-mute)" }}>Total credits</div>
              <div className="font-serif text-xl font-normal tabular-nums mt-1" style={{ color: "#fff" }}>{totalTonnes.toFixed(2)} t</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.6px] font-semibold" style={{ color: "var(--text-mute)" }}>EU-based</div>
              <div className="font-serif text-xl font-normal tabular-nums mt-1" style={{ color: "#fff" }}>{(euPct * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.6px] font-semibold" style={{ color: "var(--text-mute)" }}>Removal vs reduction</div>
              <div className="font-serif text-xl font-normal tabular-nums mt-1" style={{ color: "#fff" }}>{(removalPct * 100).toFixed(0)}% removal</div>
            </div>
          </div>
          {mix.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.6px] font-semibold" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-mute)" }}>
                  <th className="py-2.5 pr-4">Project</th>
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 pr-4">Registry</th>
                  <th className="py-2.5 pr-4 text-right">Tonnes</th>
                  <th className="py-2.5 text-right">EUR</th>
                </tr>
              </thead>
              <tbody>
                {mix.map((m) => (
                  <tr key={m.project.id} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text)" }}>{m.project.name}</td>
                    <td className="py-2.5 pr-4 capitalize" style={{ color: "var(--text-dim)" }}>{m.project.type.replace("_", " ")}</td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-mute)" }}>{m.project.registry}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--text-dim)" }}>{m.tonnes.toFixed(3)}</td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--text-dim)" }}>{fmtEur(m.eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <SectionDivider label="Methodology" />

      <Card>
        <CardHeader><CardTitle>Methodology & data lineage</CardTitle></CardHeader>
        <CardBody className="text-sm space-y-2.5" style={{ color: "var(--text-dim)" }}>
          <p>Transactions are ingested via bunq MUTATION webhook and classified merchant-first (regex rules) with LLM fallback. Per-transaction CO₂e = spend × factor; factors are sourced from DEFRA 2024, ADEME Base Carbone, and Exiobase v3. Each factor carries an uncertainty % following GHG Protocol Tier guidance.</p>
          <p>Confidence = (1 − factor uncertainty) × classifier confidence × tier weight. Uncertainty is clustered at merchant level; a Claude Sonnet 4.6 agent generates at most three high-impact refinement questions per close to reduce variance.</p>
          <p>Reserve allocation and credit recommendations follow a declarative policy (see <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--bg-inset)", color: "var(--text-mute)" }}>policies</code> row). Every state transition is appended to a SHA-256 hash-chained <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--bg-inset)", color: "var(--text-mute)" }}>audit_events</code> log — UPDATE and DELETE are blocked by trigger.</p>
        </CardBody>
      </Card>
    </div>
  );
}
