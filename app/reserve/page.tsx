import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  SectionDivider,
  Stat,
} from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { currentMonth } from "@/lib/queries";
import {
  DEFAULT_ORG_ID,
  getCreditProjects,
  getLatestCloseRun,
} from "@/lib/queries";
import { fmtEur } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CreditMixRow = {
  project: { id: string; name: string };
  tonnes: number;
  eur: number;
};

const typeLabel = (type: string): string =>
  type.replace(/_/g, " ");

export default async function ReservePage() {
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const projects = getCreditProjects();

  const mix: CreditMixRow[] = latest?.creditRecommendation
    ? (JSON.parse(latest.creditRecommendation) as CreditMixRow[])
    : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const totalEur = mix.reduce((s, m) => s + m.eur, 0);
  const reserveEur = latest?.reserveEur ?? 0;

  // Offset rate = € reserved per tonne of recommended coverage.
  const offsetRatePerTonne =
    totalTonnes > 0 && reserveEur > 0 ? reserveEur / totalTonnes : 0;

  return (
    <div className="relative z-[1] flex flex-col gap-8">
      {/* ── Heading ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <CodeLabel>Carbon reserve</CodeLabel>
          <h1
            className="text-[36px] font-normal leading-[1.1] mt-2"
            style={{ color: "var(--fg-primary)", letterSpacing: "-0.015em" }}
          >
            Carbon reserve
          </h1>
          <p
            className="text-[14px] mt-2 max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Dedicated bunq sub-account funded at each close. Used for EU-registered
            carbon credit purchases once you approve a run.
          </p>
        </div>
        <div className="shrink-0 mt-2 flex items-center gap-2">
          <ExplainButton metric="month-reserve" scope={{ month: latest?.month ?? currentMonth() }} />
          <Link href="/">
            <Button variant="primary" size="md">
              Run carbon close
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <SectionDivider />

      {/* ── Hero balance panel ── */}
      <Card className="ca-card--lg">
        <CardBody className="!px-8 !py-10">
          <div className="flex items-start justify-between gap-8 flex-wrap">
            <div className="flex flex-col gap-4">
              <CodeLabel>Reserve balance</CodeLabel>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 56,
                  fontWeight: 400,
                  lineHeight: 1.0,
                  letterSpacing: "-0.02em",
                  color: "var(--fg-primary)",
                }}
              >
                {fmtEur(reserveEur, 0)}
              </div>
              <div
                className="text-[14px]"
                style={{ color: "var(--fg-secondary)" }}
              >
                {latest?.approved
                  ? "Transferred to the reserve sub-account."
                  : latest?.reserveEur
                    ? "Awaiting approval on the latest close."
                    : "No close yet — run one to fund the reserve."}
              </div>
            </div>

            <div className="flex flex-col gap-6 items-start">
              <div className="flex flex-col gap-1.5">
                <CodeLabel>Offset rate</CodeLabel>
                <div
                  className="text-[20px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {offsetRatePerTonne > 0
                    ? `${fmtEur(offsetRatePerTonne, 0)} / tCO₂e`
                    : "—"}
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  EU-only · removal-weighted
                </div>
              </div>
              <div>
                <Badge tone={latest?.approved ? "positive" : "warning"}>
                  {latest?.approved
                    ? "Approved & transferred"
                    : latest?.reserveEur
                      ? "Pending approval"
                      : "No close"}
                </Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Recommended coverage"
              value={`${totalTonnes.toFixed(2)} t`}
              sub={`Across ${mix.length} EU project${mix.length === 1 ? "" : "s"}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Credit spend (simulated)"
              value={fmtEur(totalEur, 0)}
              sub="EU-only · ≥ 70% removal"
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Projects in catalogue"
              value={String(projects.length)}
              sub="All EU-registered"
            />
          </CardBody>
        </Card>
      </div>

      <SectionDivider label="Transfers" />

      {/* ── Past transfers (credit mix) table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended credit mix</CardTitle>
          <div className="flex items-center gap-2">
            <Badge tone="positive">EU · ≥ 70% removal</Badge>
            <ExplainButton metric="month-reserve" scope={{ month: latest?.month ?? currentMonth() }} />
          </div>
        </CardHeader>
        <CardBody className="!px-0 !py-0">
          {mix.length === 0 && projects.length === 0 && (
            <div
              className="px-6 py-10 text-center text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              No credit projects loaded.
            </div>
          )}

          {mix.length === 0 && projects.length > 0 && (
            <div
              className="px-6 py-10 text-center text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              Complete a close to see credit recommendations.
            </div>
          )}

          {mix.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr
                    className="text-left"
                    style={{ borderBottom: "1px solid var(--border-faint)" }}
                  >
                    <th className="px-4 py-3">
                      <CodeLabel>Project</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[140px]">
                      <CodeLabel>Type</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[100px]">
                      <CodeLabel>Country</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[120px] text-right">
                      <CodeLabel>Price / t</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[120px] text-right">
                      <CodeLabel>Tonnes</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[120px] text-right">
                      <CodeLabel>Allocation</CodeLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const chosen = mix.find((m) => m.project.id === p.id);
                    const allocated = !!chosen;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          height: 44,
                          borderBottom: "1px solid var(--border-faint)",
                          opacity: allocated ? 1 : 0.6,
                        }}
                      >
                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-full shrink-0"
                              style={{
                                width: 6,
                                height: 6,
                                background:
                                  p.type === "removal_technical"
                                    ? "var(--cat-digital)"
                                    : "var(--cat-electricity)",
                              }}
                            />
                            <span style={{ color: "var(--fg-primary)" }}>
                              {p.name}
                            </span>
                          </div>
                          <div
                            className="mt-0.5 font-mono text-[12px]"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {p.registry} · {p.id}
                          </div>
                        </td>
                        <td
                          className="px-4 text-[12px]"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {typeLabel(p.type)}
                        </td>
                        <td
                          className="px-4 text-[12px]"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {p.country}
                        </td>
                        <td
                          className="px-4 text-right tabular-nums"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {fmtEur(p.pricePerTonneEur, 0)}
                        </td>
                        <td
                          className="px-4 text-right tabular-nums"
                          style={{
                            color: chosen
                              ? "var(--fg-primary)"
                              : "var(--fg-faint)",
                          }}
                        >
                          {chosen ? chosen.tonnes.toFixed(3) : "—"}
                        </td>
                        <td
                          className="px-4 text-right tabular-nums"
                          style={{
                            color: chosen
                              ? "var(--brand-green)"
                              : "var(--fg-faint)",
                          }}
                        >
                          {chosen ? fmtEur(chosen.eur, 0) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
