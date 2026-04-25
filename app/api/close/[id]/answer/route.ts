import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/agent/close";

const answerBody = z.object({
  qaId: z.number().int(),
  answer: z.string().min(1),
});

export const POST = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = answerBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await answerQuestion(id, parsed.data.qaId, parsed.data.answer);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
};
