import { Factory, Sprout, Trees, Globe2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from "@/components/ui";
import { DEFAULT_ORG_ID, getCreditProjects, getLatestCloseRun } from "@/lib/queries";
import { fmtEur } from "@/lib/utils";
import type { CreditProject } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const iconFor = (p: CreditProject) => {
  if (p.id.includes("biochar")) return <Factory className="h-5 w-5" style={{ color: "var(--amber)" }} />;
  if (p.id.includes("peatland")) return <Sprout className="h-5 w-5" style={{ color: "var(--green)" }} />;
  if (p.id.includes("reforestation")) return <Trees className="h-5 w-5" style={{ color: "var(--green-bright)" }} />;
  return <Globe2 className="h-5 w-5" style={{ color: "var(--text-mute)" }} />;
};

export default async function ReservePage() {
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const projects = getCreditProjects();
  const mix = latest?.creditRecommendation ? (JSON.parse(latest.creditRecommendation) as Array<{ project: { id: string; name: string }; tonnes: number; eur: number }>) : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const totalEur = mix.reduce((s, m) => s + m.eur, 0);

  return (
    <div className="relative z-[1] flex flex-col gap-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
          Carbon offset
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1.5" style={{ color: "var(--text)" }}>
          Carbon Reserve
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Dedicated bunq sub-account funded at each close. Used for EU-based carbon credit purchases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardBody><Stat label="Reserve allocated (last close)" value={latest?.reserveEur ? fmtEur(latest.reserveEur, 0) : "—"} sub={latest?.approved ? "Transferred" : latest?.reserveEur ? "Awaiting approval" : "No close yet"} tone={latest?.approved ? "positive" : undefined} serif /></CardBody></Card>
        <Card><CardBody><Stat label="Recommended coverage" value={`${totalTonnes.toFixed(2)} t`} sub={`Across ${mix.length} EU projects`} serif /></CardBody></Card>
        <Card><CardBody><Stat label="Credit spend (simulated)" value={fmtEur(totalEur, 0)} sub="EU-only · removal-weighted" tone="positive" serif /></CardBody></Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recommended credit mix</CardTitle>
          <Badge tone="positive">EU-based · ≥ 70% removal</Badge>
        </CardHeader>
        <CardBody>
          {mix.length === 0 && <div className="text-sm" style={{ color: "var(--text-mute)" }}>Complete a close to see credit recommendations.</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((p) => {
              const chosen = mix.find((m) => m.project.id === p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-5 flex flex-col gap-2.5"
                  style={{
                    background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-card-2) 100%)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    {iconFor(p)}
                    <div className="font-medium text-[13px]" style={{ color: "var(--text)" }}>{p.name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={p.type === "removal_technical" ? "info" : "positive"}>{p.type.replace("_", " ")}</Badge>
                    <Badge>{p.country}</Badge>
                    <span style={{ color: "var(--text-mute)" }}>{fmtEur(p.pricePerTonneEur, 0)}/t</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>{p.description}</p>
                  <div className="mt-auto pt-2.5 text-xs" style={{ borderTop: "1px solid var(--border-faint)", color: "var(--text-mute)" }}>
                    Registry: {p.registry}
                  </div>
                  {chosen && (
                    <div
                      className="rounded-xl px-3.5 py-2.5 text-sm"
                      style={{
                        background: "rgba(48,192,111,0.08)",
                        border: "1px solid rgba(48,192,111,0.18)",
                      }}
                    >
                      <div className="font-semibold" style={{ color: "var(--green-bright)" }}>
                        {chosen.tonnes.toFixed(3)} t · {fmtEur(chosen.eur)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--green)" }}>
                        Allocated from this close
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
