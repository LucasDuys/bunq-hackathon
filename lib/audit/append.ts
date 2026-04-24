import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { auditEvents, db } from "@/lib/db/client";

export type AuditActor = "webhook" | "agent" | "user" | "system";

const ZERO_HASH = "0".repeat(64);

const latestHash = (orgId: string): string => {
  const row = db.select().from(auditEvents).where(eq(auditEvents.orgId, orgId)).orderBy(desc(auditEvents.id)).limit(1).all();
  return row[0]?.hash ?? ZERO_HASH;
};

const computeHash = (prev: string, actor: string, type: string, payload: string, createdAt: number) => {
  const h = createHash("sha256");
  h.update(prev).update("|").update(actor).update("|").update(type).update("|").update(payload).update("|").update(String(createdAt));
  return h.digest("hex");
};

export const appendAudit = (params: {
  orgId: string;
  actor: AuditActor;
  type: string;
  payload: unknown;
  closeRunId?: string | null;
}) => {
  const prev = latestHash(params.orgId);
  const createdAt = Math.floor(Date.now() / 1000);
  const payloadStr = JSON.stringify(params.payload);
  const hash = computeHash(prev, params.actor, params.type, payloadStr, createdAt);
  db.insert(auditEvents).values({
    orgId: params.orgId,
    closeRunId: params.closeRunId ?? null,
    actor: params.actor,
    type: params.type,
    payload: payloadStr,
    prevHash: prev,
    hash,
    createdAt,
  }).run();
  return { hash, prevHash: prev };
};

/**
 * Walks the chain forward from ZERO_HASH; returns { valid, brokenAtId? }.
 */
export const verifyChain = (orgId: string) => {
  const rows = db.select().from(auditEvents).where(eq(auditEvents.orgId, orgId)).orderBy(auditEvents.id).all();
  let expectedPrev = ZERO_HASH;
  for (const r of rows) {
    if (r.prevHash !== expectedPrev) return { valid: false, brokenAtId: r.id, reason: "prevHash mismatch" };
    const recomputed = computeHash(r.prevHash, r.actor, r.type, r.payload, r.createdAt);
    if (recomputed !== r.hash) return { valid: false, brokenAtId: r.id, reason: "hash mismatch" };
    expectedPrev = r.hash;
  }
  return { valid: true, count: rows.length };
};
