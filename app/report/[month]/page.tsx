import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Badge,
  CodeLabel,
  ConfidenceBar,
  SectionDivider,
  Stat,
} from "@/components/ui";
import {
  DEFAULT_ORG_ID,
  getCategorySpendForMonth,
  getLatestCloseRun,
  getLatestEstimatesForMonth,
} from "@/lib/queries";
import { fmtEur, fmtKg, fmtPct } from "@/lib/utils";
import { generateCsrdNarrative } from "@/lib/agent/narrative";
import type { CreditProject } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function categoryToken(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("fuel") || c.includes("scope1")) return "var(--cat-fuel)";
  if (c.includes("electric") || c.includes("energy")) return "var(--cat-electricity)";
  if (c.includes("travel") || c.includes("flight") || c.includes("transport")) return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas") || c.includes("software")) return "var(--cat-digital)";
  if (c.includes("service")) return "var(--cat-services)";
  if (c.includes("good") || c.includes("procure")) return "var(--cat-goods)";
  return "var(--cat-other)";
}

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
  const totalSpend = catRows.reduce((s, [, v]) => s + v.spendEur, 0);

  const mix = run?.creditRecommendation
    ? (JSON.parse(run.creditRecommendation) as Array<{ project: CreditProject; tonnes: number; eur: number }>)
    : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const euTonnes = mix.filter((m) => m.project.region === "EU").reduce((s, m) => s + m.tonnes, 0);
  const removalTonnes = mix
    .filter((m) => m.project.type !== "reduction")
    .reduce((s, m) => s + m.tonnes, 0);
  const euPct = totalTonnes > 0 ? euTonnes / totalTonnes : 0;
  const removalPct = totalTonnes > 0 ? removalTonnes / totalTonnes : 0;

  const confidence = run?.finalConfidence ?? 0.6;
  const headlineCo2 = run?.finalCo2eKg ?? totalCo2;

  const narrative = await generateCsrdNarrative({
    month,
    totalCo2eKg: headlineCo2,
    confidence,
    topCategories: catRows.slice(0, 3).map(([category, v]) => ({ category, ...v })),
    reserveEur: run?.reserveEur ?? 0,
    creditTonnes: totalTonnes,
    euPct: euPct * 100,
  });

  return (
    <div className="relative z-[1] flex flex-col gap-10 print:gap-6">
      {/* ── Header ─────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <CodeLabel>CSRD · ESRS E1 extract</CodeLabel>
          <h1
            className="text-[36px] font-normal m-0"
            style={{
              color: "var(--fg-primary)",
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
            }}
          >
            Monthly carbon report — {month}
          </h1>
          <p
            className="text-[16px] m-0"
            style={{ color: "var(--fg-secondary)", maxWidth: "66ch", lineHeight: 1.5 }}
          >
            Voluntary monthly slice. Methodology and uncertainty quantified per the GHG Protocol
            Scope 3 guidance. Numbers below pair every CO₂e figure with a confidence indicator.
          </p>
        </div>
        <Badge tone="info">Audit-ready</Badge>
      </header>

      {/* ── Headline stats ─────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <Stat
              label="Gross emissions"
              value={fmtKg(headlineCo2)}
              sub={`${fmtEur(totalSpend, 0)} spend analysed`}
            />
            <div className="mt-4">
              <ConfidenceBar value={confidence} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Credits retired"
              value={`${totalTonnes.toFixed(2)} t`}
              sub={`${fmtPct(euPct)} EU · ${fmtPct(removalPct)} removal`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Reserve transferred"
              value={fmtEur(run?.reserveEur ?? 0, 0)}
              sub={run ? `Close run ${run.id}` : "No close run yet"}
            />
          </CardBody>
        </Card>
      </section>

      <SectionDivider />

      {/* ── Narrative ──────────────────────────── */}
      <section className="flex flex-col gap-4">
        <CodeLabel>Narrative summary</CodeLabel>
        <p
          className="text-[16px] m-0"
          style={{ color: "var(--fg-secondary)", maxWidth: "66ch", lineHeight: 1.6 }}
        >
          {narrative}
        </p>
      </section>

      <SectionDivider label="E1-6 — Gross GHG emissions" />

      {/* ── Emissions table ────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Emissions by category (approximated)</CardTitle>
          <CodeLabel>Scope 3 · Cat 1 / 6</CodeLabel>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <th
                    className="code-label text-left py-3 pr-4"
                    style={{ fontWeight: 400 }}
                  >
                    Category
                  </th>
                  <th
                    className="code-label text-right py-3 pr-4"
                    style={{ fontWeight: 400 }}
                  >
                    Spend
                  </th>
                  <th
                    className="code-label text-right py-3 pr-4"
                    style={{ fontWeight: 400 }}
                  >
                    CO₂e
                  </th>
                  <th
                    className="code-label text-right py-3"
                    style={{ fontWeight: 400 }}
                  >
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {catRows.map(([cat, v]) => (
                  <tr key={cat} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                    <td className="py-3 pr-4" style={{ color: "var(--fg-primary)" }}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            background: categoryToken(cat),
                          }}
                        />
                        <span className="capitalize">{cat}</span>
                      </span>
                    </td>
                    <td
                      className="py-3 pr-4 text-right tabular-nums"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {fmtEur(v.spendEur, 0)}
                    </td>
                    <td
                      className="py-3 pr-4 text-right tabular-nums"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {fmtKg(v.co2eKg)}
                    </td>
                    <td
                      className="py-3 text-right tabular-nums"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {totalCo2 ? `${((v.co2eKg / totalCo2) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 pr-4" style={{ color: "var(--fg-primary)" }}>
                    Total
                  </td>
                  <td
                    className="py-3 pr-4 text-right tabular-nums"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    {fmtEur(totalSpend, 0)}
                  </td>
                  <td
                    className="py-3 pr-4 text-right tabular-nums"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    {fmtKg(totalCo2)}
                  </td>
                  <td
                    className="py-3 text-right tabular-nums"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
            <p
              className="text-[13px] m-0"
              style={{ color: "var(--fg-muted)", maxWidth: "66ch", lineHeight: 1.5 }}
            >
              Method: spend-based (Exiobase · DEFRA 2024 · ADEME Base Carbone). Uncertainty varies
              by factor; see the ledger for per-row lineage.
            </p>
            <div className="min-w-[220px]">
              <ConfidenceBar value={confidence} />
            </div>
          </div>
        </CardBody>
      </Card>

      <SectionDivider label="E1-7 — Credits & removals" />

      {/* ── Credits card ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Carbon removal and carbon credits</CardTitle>
          <CodeLabel>Post-reduction purchase mix</CodeLabel>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <Stat
              label="Total credits"
              value={`${totalTonnes.toFixed(2)} t`}
              sub="Retired this close"
            />
            <Stat
              label="EU-based"
              value={fmtPct(euPct)}
              sub="Registry: Gold Standard / Puro.earth EU"
              tone={euPct >= 0.5 ? "positive" : "default"}
            />
            <Stat
              label="Removal vs reduction"
              value={`${(removalPct * 100).toFixed(0)}% removal`}
              sub={`${((1 - removalPct) * 100).toFixed(0)}% reduction`}
            />
          </div>
          {mix.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <th
                      className="code-label text-left py-3 pr-4"
                      style={{ fontWeight: 400 }}
                    >
                      Project
                    </th>
                    <th
                      className="code-label text-left py-3 pr-4"
                      style={{ fontWeight: 400 }}
                    >
                      Type
                    </th>
                    <th
                      className="code-label text-left py-3 pr-4"
                      style={{ fontWeight: 400 }}
                    >
                      Registry
                    </th>
                    <th
                      className="code-label text-right py-3 pr-4"
                      style={{ fontWeight: 400 }}
                    >
                      Tonnes
                    </th>
                    <th
                      className="code-label text-right py-3"
                      style={{ fontWeight: 400 }}
                    >
                      EUR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mix.map((m) => (
                    <tr key={m.project.id} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                      <td className="py-3 pr-4" style={{ color: "var(--fg-primary)" }}>
                        {m.project.name}
                      </td>
                      <td
                        className="py-3 pr-4 capitalize"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {m.project.type.replace("_", " ")}
                      </td>
                      <td className="py-3 pr-4" style={{ color: "var(--fg-muted)" }}>
                        <span className="font-mono text-[12px]">{m.project.registry}</span>
                      </td>
                      <td
                        className="py-3 pr-4 text-right tabular-nums"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {m.tonnes.toFixed(3)}
                      </td>
                      <td
                        className="py-3 text-right tabular-nums"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {fmtEur(m.eur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[14px] m-0" style={{ color: "var(--fg-muted)" }}>
              No credit purchases recorded for this month.
            </p>
          )}
        </CardBody>
      </Card>

      <SectionDivider label="Methodology" />

      {/* ── Methodology prose ──────────────────── */}
      <section className="flex flex-col gap-4" style={{ maxWidth: "66ch" }}>
        <h2
          className="text-[24px] font-normal m-0"
          style={{ color: "var(--fg-primary)", lineHeight: 1.25, letterSpacing: "-0.005em" }}
        >
          Methodology and data lineage
        </h2>
        <div
          className="flex flex-col gap-4 text-[16px]"
          style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}
        >
          <p className="m-0">
            Transactions are ingested via the bunq MUTATION webhook and classified merchant-first
            (regex rules) with an LLM fallback. Per-transaction CO₂e = spend × factor; factors
            are sourced from DEFRA 2024, ADEME Base Carbone, and Exiobase v3. Each factor carries
            an uncertainty percentage following GHG Protocol Tier guidance.
          </p>
          <p className="m-0">
            Confidence = (1 − factor uncertainty) × classifier confidence × tier weight.
            Uncertainty is clustered at the merchant level; a Claude Sonnet 4.6 agent generates
            at most three high-impact refinement questions per close to reduce variance.
          </p>
          <p className="m-0">
            Reserve allocation and credit recommendations follow a declarative policy (see the{" "}
            <code
              className="text-[13px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "var(--bg-inset)", color: "var(--fg-muted)" }}
            >
              policies
            </code>{" "}
            row). Every state transition is appended to a SHA-256 hash-chained{" "}
            <code
              className="text-[13px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "var(--bg-inset)", color: "var(--fg-muted)" }}
            >
              audit_events
            </code>{" "}
            log — UPDATE and DELETE are blocked by trigger.
          </p>
        </div>
      </section>

      {/* ── Print overrides ────────────────────── */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .ca-card { border-color: rgba(0,0,0,0.15) !important; background: #fff !important; }
          .code-label { color: rgba(0,0,0,0.55) !important; }
        }
      `}</style>
    </div>
  );
}
