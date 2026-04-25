import { NextResponse } from "next/server";
import { eq, like } from "drizzle-orm";
import { appendAudit } from "@/lib/audit/append";
import { auditEvents, closeRuns, db } from "@/lib/db/client";
import { approveAndExecute } from "@/lib/agent/close";

const ORG_ID = "org_acme_bv";

/**
 * Receives bunq's DRAFT_PAYMENT webhook (or a synthetic local POST for demos).
 * On status=ACCEPTED → resolve the linked close run by draft id and execute.
 * On status=REJECTED → mark the close as rejected.
 *
 * Synthetic body shape (matches bunq's NotificationUrl envelope):
 *   {
 *     "NotificationUrl": {
 *       "category": "DRAFT_PAYMENT",
 *       "event_type": "DRAFT_PAYMENT_ACCEPTED",
 *       "object": { "DraftPayment": { "id": <draftId>, "status": "ACCEPTED" } }
 *     }
 *   }
 */
export const POST = async (req: Request) => {
  const raw = await req.text();
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const draft = (body as { NotificationUrl?: { object?: { DraftPayment?: { id: number; status: string } } } })
    ?.NotificationUrl?.object?.DraftPayment;
  if (!draft) return NextResponse.json({ error: "no DraftPayment in body" }, { status: 400 });

  const { id: draftId, status } = draft;
  if (!draftId || typeof draftId !== "number") return NextResponse.json({ error: "no draftId" }, { status: 400 });

  // Look up the close run via the audit row we wrote when creating the draft.
  // Audit payload is JSON text; we use a LIKE filter as a cheap index-free scan.
  const safeDraftId = String(draftId).replace(/[%_]/g, "");
  const candidates = db.select()
    .from(auditEvents)
    .where(like(auditEvents.payload, `%"draftId":${safeDraftId}%`))
    .all();
  const created = candidates.find((r) => r.type === "bunq.draft.created");
  if (!created || !created.closeRunId) {
    return NextResponse.json({ error: "no close run linked to draft", draftId }, { status: 404 });
  }
  const closeRunId = created.closeRunId;

  // Idempotency: if we've already resolved this draft, ack and bail.
  const alreadyResolved = candidates.find((r) => r.type === "bunq.draft.resolved");
  if (alreadyResolved) {
    return NextResponse.json({ ok: true, draftId, dedup: true });
  }

  appendAudit({
    orgId: ORG_ID,
    actor: "system",
    type: "bunq.draft.resolved",
    payload: { draftId, status, closeRunId },
    closeRunId,
  });

  if (status === "ACCEPTED") {
    try {
      const result = await approveAndExecute(closeRunId, "user");
      return NextResponse.json({ ok: true, draftId, executed: result.executed });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (status === "REJECTED" || status === "CANCELLED") {
    db.update(closeRuns)
      .set({ state: "FAILED", status: "rejected", completedAt: Math.floor(Date.now() / 1000) })
      .where(eq(closeRuns.id, closeRunId)).run();
    appendAudit({
      orgId: ORG_ID,
      actor: "user",
      type: "close.rejected",
      payload: { draftId, status, closeRunId, reason: "CFO rejected DraftPayment" },
      closeRunId,
    });
    return NextResponse.json({ ok: true, draftId, rejected: true });
  }

  return NextResponse.json({ ok: true, draftId, status, note: "no-op (status pending)" });
};
