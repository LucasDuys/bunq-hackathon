import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, invoices, invoiceLineItems } from "@/lib/db/client";
import { readInvoiceFile } from "@/lib/invoices/storage";
import { extractInvoice } from "@/lib/invoices/extract";
import { normalizeMerchant } from "@/lib/classify/rules";
import { classifyMerchant } from "@/lib/classify/merchant";
import { linkToTransaction } from "@/lib/invoices/process";
import { appendAudit } from "@/lib/audit/append";
import { existsSync } from "node:fs";
import path from "node:path";

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .all()[0];
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const fullPath = path.resolve(process.cwd(), invoice.filePath);
  if (!existsSync(fullPath)) {
    return NextResponse.json(
      { error: "File not found on disk — cannot reprocess" },
      { status: 404 },
    );
  }

  const fileBuffer = readInvoiceFile(invoice.filePath);

  let extraction;
  let rawResponse = "";
  try {
    const result = await extractInvoice({
      fileBuffer,
      mime: invoice.fileMime,
      fileName: invoice.fileName,
    });
    extraction = result.extraction;
    rawResponse = result.rawResponse;
  } catch (e) {
    db.update(invoices)
      .set({
        status: "failed",
        errorMessage: (e as Error).message,
      })
      .where(eq(invoices.id, id))
      .run();
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 422 },
    );
  }

  const merchantNorm = normalizeMerchant(extraction.merchant);
  const cls = await classifyMerchant(extraction.merchant);

  const invoiceDate = extraction.invoiceDate
    ? Math.floor(new Date(extraction.invoiceDate + "T00:00:00Z").getTime() / 1000)
    : null;

  const linkedTxId = linkToTransaction({
    orgId: invoice.orgId,
    merchantNorm,
    totalCents: extraction.totalCents,
    invoiceDate,
    currency: extraction.currency,
  });

  db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).run();

  db.update(invoices)
    .set({
      merchantRaw: extraction.merchant,
      merchantNorm,
      invoiceNumber: extraction.invoiceNumber,
      invoiceDate,
      dueDate: extraction.dueDate
        ? Math.floor(new Date(extraction.dueDate + "T00:00:00Z").getTime() / 1000)
        : null,
      subtotalCents: extraction.subtotalCents,
      vatCents: extraction.vatCents,
      totalCents: extraction.totalCents,
      currency: extraction.currency,
      category: cls.category,
      subCategory: cls.subCategory,
      categoryConfidence: cls.confidence,
      classifierSource: cls.source,
      linkedTxId,
      extractionModel: "claude-sonnet-4-6",
      extractionRaw: rawResponse,
      status: "processed",
      errorMessage: null,
    })
    .where(eq(invoices.id, id))
    .run();

  for (const item of extraction.lineItems) {
    db.insert(invoiceLineItems)
      .values({
        invoiceId: id,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        amountCents: item.amountCents,
        vatRatePct: item.vatRatePct,
        vatCents: item.vatCents,
        category: item.category,
      })
      .run();
  }

  appendAudit({
    orgId: invoice.orgId,
    actor: "user",
    type: "invoice.reprocessed",
    payload: {
      invoiceId: id,
      merchant: extraction.merchant,
      totalCents: extraction.totalCents,
      lineItemCount: extraction.lineItems.length,
      linkedTxId,
      confidence: extraction.confidence,
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    merchant: extraction.merchant,
    totalCents: extraction.totalCents,
    lineItems: extraction.lineItems.length,
    confidence: extraction.confidence,
    linked: !!linkedTxId,
    linkedTxId,
  });
};
