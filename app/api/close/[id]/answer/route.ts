import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/agent/close";

export const POST = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json() as { qaId: number; answer: string };
  try {
    const result = await answerQuestion(id, body.qaId, body.answer);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
