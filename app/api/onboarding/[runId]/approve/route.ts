import { NextResponse } from "next/server";
import { approveAndFinalize } from "@/lib/agent/onboarding";

export const POST = async (_req: Request, { params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  try {
    const result = await approveAndFinalize(runId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
