import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, invoices, invoiceLineItems } from "@/lib/db/client";

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).all()[0];
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  const items = db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .all();
  return NextResponse.json({ ...invoice, lineItems: items });
};
