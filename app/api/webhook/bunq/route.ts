import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appendAudit } from "@/lib/audit/append";
import { classifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { db, transactions } from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { factorById } from "@/lib/factors";
import { env } from "@/lib/env";
import { loadContext } from "@/lib/bunq/context";
import { writeCarbonNote, formatCarbonNote } from "@/lib/bunq/notes";
import { BUNQ_SIG_HEADER, verifyWebhook, type BunqWebhookEvent } from "@/lib/bunq/webhook";

const ORG_ID = "org_acme_bv";

export const POST = async (req: Request) => {
  const raw = await req.text();
  const sig = req.headers.get(BUNQ_SIG_HEADER);

  if (!env.bunqMock) {
    const serverKey = loadContext().serverPublicKeyPem;
    if (!serverKey) {
      return NextResponse.json({ error: "server public key not bootstrapped" }, { status: 503 });
    }
    if (!verifyWebhook(raw, sig, serverKey)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let event: BunqWebhookEvent;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const payment = event.NotificationUrl?.object.Payment;
  if (!payment) {
    return NextResponse.json({ ok: true, note: "no payment in event" });
  }

  const bunqTxId = String(payment.id);

  // Idempotency: bunq retries 5x at 1-min intervals. If we've seen this tx, ack and bail.
  const existing = db.select({ id: transactions.id }).from(transactions)
    .where(and(eq(transactions.orgId, ORG_ID), eq(transactions.bunqTxId, bunqTxId))).all();
  if (existing.length > 0) {
    return NextResponse.json({ ok: true, id: existing[0].id, dedup: true });
  }

  const amountEur = Math.abs(Number(payment.amount.value));
  const merchantRaw = payment.counterparty_alias.display_name;
  const norm = normalizeMerchant(merchantRaw);
  const cls = await classifyMerchant(merchantRaw, payment.description);

  const id = `tx_${randomUUID()}`;
  db.insert(transactions).values({
    id,
    orgId: ORG_ID,
    bunqTxId,
    merchantRaw,
    merchantNorm: norm,
    amountCents: Math.round(amountEur * 100),
    currency: payment.amount.currency,
    timestamp: Math.floor(new Date(payment.created).getTime() / 1000),
    accountId: String(payment.monetary_account_id),
    description: payment.description,
    category: cls.category,
    subCategory: cls.subCategory,
    categoryConfidence: cls.confidence,
    classifierSource: cls.source,
  }).run();

  appendAudit({
    orgId: ORG_ID,
    actor: "webhook",
    type: "tx.ingested",
    payload: { id, bunqTxId, merchantRaw, amountEur, category: cls.category, confidence: cls.confidence },
  });

  // Best-effort: write a Carbo carbon estimate as a NoteText on the bunq Payment.
  // This is what makes the bunq export PDF double as the CSRD evidence trail —
  // every payment carries its own kg CO2e + factor citation on the bank's side.
  try {
    const est = estimateEmission({
      category: cls.category,
      subCategory: cls.subCategory,
      amountEur,
      classifierConfidence: cls.confidence,
    });
    const factor = factorById(est.factorId);
    const note = {
      co2eKgPoint: est.co2eKgPoint,
      co2eKgLow: est.co2eKgLow,
      co2eKgHigh: est.co2eKgHigh,
      factorSource: factor?.source ?? "estimated",
      factorId: est.factorId,
    };
    const r = await writeCarbonNote({ paymentId: bunqTxId, note });
    const noteId = r?.Response?.[0]?.Id?.id;
    appendAudit({
      orgId: ORG_ID,
      actor: "system",
      type: "bunq.note.written",
      payload: { txId: id, paymentId: bunqTxId, noteId, content: formatCarbonNote(note) },
    });
  } catch (e) {
    appendAudit({
      orgId: ORG_ID,
      actor: "system",
      type: "bunq.note.failed",
      payload: { txId: id, paymentId: bunqTxId, error: e instanceof Error ? e.message : String(e) },
    });
  }

  return NextResponse.json({ ok: true, id });
};
