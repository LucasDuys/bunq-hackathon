import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, closeRuns, auditEvents } from "@/lib/db/client";

export interface CloseDigestPayload {
  runId: string;
  month: string;
  co2eKg: number;
  confidence: number;
  reserveEur: number;
  approvedAt: number | null;
  auditEventCount: number;
  lastHash: string;
}

export function computeCloseDigest(runId: string): {
  digest: string;
  payload: CloseDigestPayload;
} | null {
  const run = db
    .select()
    .from(closeRuns)
    .where(eq(closeRuns.id, runId))
    .all()[0];
  if (!run) return null;

  const events = db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.closeRunId, runId)))
    .orderBy(auditEvents.id)
    .all();

  const payload: CloseDigestPayload = {
    runId: run.id,
    month: run.month,
    co2eKg: run.finalCo2eKg ?? run.initialCo2eKg ?? 0,
    confidence: run.finalConfidence ?? run.initialConfidence ?? 0,
    reserveEur: run.reserveEur ?? 0,
    approvedAt: run.approvedAt ?? null,
    auditEventCount: events.length,
    lastHash: events.at(-1)?.hash ?? "0".repeat(64),
  };

  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return { digest, payload };
}
