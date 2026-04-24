import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@/lib/queries";
import { startOnboarding } from "@/lib/agent/onboarding";

const bodySchema = z.object({
  orgId: z.string().default(DEFAULT_ORG_ID),
  track: z.enum(["generate", "upload", "mix"]),
  companyName: z.string().optional(),
});

export const POST = async (req: Request) => {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);
    const result = await startOnboarding(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
