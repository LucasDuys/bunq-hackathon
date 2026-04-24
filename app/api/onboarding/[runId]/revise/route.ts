import { NextResponse } from "next/server";
import { z } from "zod";
import { reviseDraft } from "@/lib/agent/onboarding";

const bodySchema = z.object({
  approvalThresholdEur: z.number().nonnegative().optional(),
  maxReservePerMonthEur: z.number().nonnegative().optional(),
});

export const POST = async (req: Request, { params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  try {
    const raw = await req.json();
    const body = bodySchema.parse(raw);
    const result = await reviseDraft(runId, body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
