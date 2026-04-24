import { NextResponse } from "next/server";
import { cancelOnboarding } from "@/lib/agent/onboarding";

export const POST = async (_req: Request, { params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  try {
    cancelOnboarding(runId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
