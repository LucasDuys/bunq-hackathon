import { NextResponse } from "next/server";
import { approveAndExecute } from "@/lib/agent/close";

export const POST = async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  try {
    const result = await approveAndExecute(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
