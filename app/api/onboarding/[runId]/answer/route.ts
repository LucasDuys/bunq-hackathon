import { NextResponse } from "next/server";
import { z } from "zod";
import { answerOnboardingQuestion, skipOnboardingQuestion } from "@/lib/agent/onboarding";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), qaId: z.number().int(), answer: z.string().min(1) }),
  z.object({ action: z.literal("skip"), qaId: z.number().int() }),
]);

export const POST = async (req: Request, { params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  try {
    const raw = await req.json();
    const body = bodySchema.parse(raw);
    const result =
      body.action === "answer"
        ? await answerOnboardingQuestion(runId, body.qaId, body.answer)
        : await skipOnboardingQuestion(runId, body.qaId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
