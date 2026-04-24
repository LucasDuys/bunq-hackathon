import { renderToBuffer } from "@react-pdf/renderer";
import { buildAnnualReport } from "@/lib/reports/annual";
import { enrichWithNarrative } from "@/lib/agent/annual-narrative";
import { annualReportDocument } from "@/lib/reports/render-annual";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return new Response(`invalid year: ${yearStr}`, { status: 400 });
  }
  const baseReport = await buildAnnualReport({ year });
  const report = await enrichWithNarrative(baseReport);
  const buffer = await renderToBuffer(annualReportDocument(report));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="carbo-annual-${report.company.replace(/\s+/g, "_")}-${year}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
