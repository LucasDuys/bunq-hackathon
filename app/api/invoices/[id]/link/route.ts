import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, invoices, transactions } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { txId?: string };

  if (!body.txId) {
    return NextResponse.json({ error: "txId required" }, { status: 400 });
  }

  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).all()[0];
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const tx = db.select().from(transactions).where(eq(transactions.id, body.txId)).all()[0];
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  db.update(invoices).set({ linkedTxId: body.txId }).where(eq(invoices.id, id)).run();

  appendAudit({
    orgId: invoice.orgId,
    actor: "user",
    type: "invoice.linked",
    payload: { invoiceId: id, txId: body.txId },
  });

  return NextResponse.json({ ok: true });
};
