import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { auditEvents, db } from "@/lib/db/client";
import { getCloseRun, getQuestionsForRun } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const run = getCloseRun(id);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const since = Number.parseInt(url.searchParams.get("since") ?? "0", 10) || 0;

  const rows = db
    .select()
    .from(auditEvents)
    .where(
      since > 0
        ? and(eq(auditEvents.closeRunId, id), gt(auditEvents.id, since))
        : eq(auditEvents.closeRunId, id),
    )
    .orderBy(auditEvents.id)
    .all();

  const events = rows.map((r) => {
    let payload: unknown = null;
    try {
      payload = JSON.parse(r.payload);
    } catch {
      payload = r.payload;
    }
    return {
      id: r.id,
      actor: r.actor,
      type: r.type,
      createdAt: r.createdAt,
      hash: r.hash,
      payload,
    };
  });

  const questions = getQuestionsForRun(id).map((q) => ({
    id: q.id,
    closeRunId: q.closeRunId,
    clusterId: q.clusterId,
    question: q.question,
    options: q.options,
    answer: q.answer,
    affectedTxIds: q.affectedTxIds,
  }));

  return NextResponse.json({
    runId: id,
    state: run.state,
    status: run.status,
    month: run.month,
    initialCo2eKg: run.initialCo2eKg,
    finalCo2eKg: run.finalCo2eKg,
    initialConfidence: run.initialConfidence,
    finalConfidence: run.finalConfidence,
    reserveEur: run.reserveEur,
    approved: run.approved,
    events,
    questions,
  });
};
