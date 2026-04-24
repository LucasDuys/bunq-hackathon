import { Globe2, Sprout, Trees, Factory } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from "@/components/ui";
import { DEFAULT_ORG_ID, getCreditProjects, getLatestCloseRun } from "@/lib/queries";
import { fmtEur } from "@/lib/utils";
import type { CreditProject } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const iconFor = (p: CreditProject) => {
  if (p.id.includes("biochar")) return <Factory className="h-5 w-5 text-amber-600" />;
  if (p.id.includes("peatland")) return <Sprout className="h-5 w-5 text-emerald-600" />;
  if (p.id.includes("reforestation")) return <Trees className="h-5 w-5 text-emerald-700" />;
  return <Globe2 className="h-5 w-5 text-zinc-500" />;
};

export default async function ReservePage() {
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const projects = getCreditProjects();
  const mix = latest?.creditRecommendation ? (JSON.parse(latest.creditRecommendation) as Array<{ project: { id: string; name: string }; tonnes: number; eur: number }>) : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const totalEur = mix.reduce((s, m) => s + m.eur, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Carbon Reserve</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Dedicated bunq sub-account funded at each close. Used for EU-based carbon credit purchases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardBody><Stat label="Reserve allocated (last close)" value={latest?.reserveEur ? fmtEur(latest.reserveEur, 0) : "—"} sub={latest?.approved ? "Transferred" : latest?.reserveEur ? "Awaiting approval" : "No close yet"} tone={latest?.approved ? "positive" : "default"} /></CardBody></Card>
        <Card><CardBody><Stat label="Recommended coverage" value={`${totalTonnes.toFixed(2)} t`} sub={`Across ${mix.length} EU projects`} /></CardBody></Card>
        <Card><CardBody><Stat label="Credit spend (simulated)" value={fmtEur(totalEur, 0)} sub="EU-only · removal-weighted" tone="positive" /></CardBody></Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recommended credit mix</CardTitle>
          <Badge tone="info">EU-based · ≥ 70% removal</Badge>
        </CardHeader>
        <CardBody>
          {mix.length === 0 && <div className="text-sm text-zinc-500">Complete a close to see credit recommendations.</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((p) => {
              const chosen = mix.find((m) => m.project.id === p.id);
              return (
                <div key={p.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {iconFor(p)}
                    <div className="font-medium text-sm">{p.name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={p.type === "removal_technical" ? "info" : "positive"}>{p.type.replace("_", " ")}</Badge>
                    <Badge>{p.country}</Badge>
                    <span className="text-zinc-500">{fmtEur(p.pricePerTonneEur, 0)}/t</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{p.description}</p>
                  <div className="mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-900 text-xs text-zinc-500">Registry: {p.registry}</div>
                  {chosen && (
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300">{chosen.tonnes.toFixed(3)} t · {fmtEur(chosen.eur)}</div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400">Allocated from this close</div>
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
