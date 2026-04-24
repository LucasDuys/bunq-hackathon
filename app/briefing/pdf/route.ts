import { renderToBuffer } from "@react-pdf/renderer";
import { buildBriefing } from "@/lib/reports/briefing";
import { briefingDocument } from "@/lib/reports/render-briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = (searchParams.get("kind") ?? "month") as "month" | "week";
  const labelParam = searchParams.get("label") ?? searchParams.get("month") ?? undefined;

  const briefing = await buildBriefing({ kind, label: labelParam });
  const buffer = await renderToBuffer(briefingDocument(briefing));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="carbo-briefing-${briefing.period.label}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
