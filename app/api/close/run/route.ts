import { NextResponse } from "next/server";
import { startCloseRun } from "@/lib/agent/close";

export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgId?: string; month?: string };
  const orgId = body.orgId ?? "org_acme_bv";
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = body.month ?? defaultMonth;
  try {
    const result = await startCloseRun(orgId, month);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
