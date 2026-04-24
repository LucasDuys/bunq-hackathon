import { NextResponse } from "next/server";
import { getTaxSavingsForMonth, currentMonth, DEFAULT_ORG_ID } from "@/lib/queries";
import { generateImpactAnalysis } from "@/lib/agent/impact-analysis";

export const POST = async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as {
    orgId?: string;
    month?: string;
  };
  const orgId = body.orgId ?? DEFAULT_ORG_ID;
  const month = body.month ?? currentMonth();

  try {
    const savings = getTaxSavingsForMonth(orgId, month);
    const analysis = await generateImpactAnalysis(savings);
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
};
