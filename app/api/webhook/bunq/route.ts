import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { appendAudit } from "@/lib/audit/append";
import { classifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { db, transactions } from "@/lib/db/client";
import { env } from "@/lib/env";
import { BUNQ_SIG_HEADER, verifyWebhook, type BunqWebhookEvent } from "@/lib/bunq/webhook";

export const POST = async (req: Request) => {
  const raw = await req.text();
  const sig = req.headers.get(BUNQ_SIG_HEADER);

  if (!env.bunqMock) {
    // Real signature verify requires server public key from installation; stubbed for now.
    const serverKey = process.env.BUNQ_SERVER_PUBLIC_KEY_PEM;
    if (!serverKey || !verifyWebhook(raw, sig, serverKey)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let event: BunqWebhookEvent;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const payment = event.NotificationUrl?.object.Payment;
  if (!payment) {
    return NextResponse.json({ ok: true, note: "no payment in event" });
  }

  const amountEur = Math.abs(Number(payment.amount.value));
  const merchantRaw = payment.counterparty_alias.display_name;
  const norm = normalizeMerchant(merchantRaw);
  const cls = await classifyMerchant(merchantRaw, payment.description);

  const orgId = "org_acme_bv"; // single-tenant hackathon
  const id = `tx_${randomUUID()}`;
  db.insert(transactions).values({
    id,
    orgId,
    bunqTxId: String(payment.id),
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

  appendAudit({ orgId, actor: "webhook", type: "tx.ingested", payload: { id, merchantRaw, amountEur, category: cls.category, confidence: cls.confidence } });
  return NextResponse.json({ ok: true, id });
};
