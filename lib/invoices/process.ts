import { randomUUID } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, invoices, invoiceLineItems, transactions } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";
import { classifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { saveInvoiceFile } from "./storage";
import { extractInvoice, type InvoiceExtraction } from "./extract";

function parseInvoiceDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 1000) : null;
}

export function linkToTransaction(params: {
  orgId: string;
  merchantNorm: string;
  totalCents: number;
  invoiceDate: number | null;
  currency: string;
}): string | null {
  let candidates = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.orgId, params.orgId),
        eq(transactions.amountCents, params.totalCents),
        eq(transactions.merchantNorm, params.merchantNorm),
      ),
    )
    .all();

  if (candidates.length === 0) {
    candidates = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.orgId, params.orgId),
          eq(transactions.amountCents, params.totalCents),
        ),
      )
      .all();
  }

  if (candidates.length === 0) return null;

  if (params.invoiceDate && candidates.length > 1) {
    const windowSec = 7 * 86400;
    const filtered = candidates.filter(
      (tx) =>
        tx.timestamp >= params.invoiceDate! - windowSec &&
        tx.timestamp <= params.invoiceDate! + windowSec,
    );
    if (filtered.length > 0) candidates = filtered;
  }

  if (params.invoiceDate) {
    candidates.sort(
      (a, b) =>
        Math.abs(a.timestamp - params.invoiceDate!) -
        Math.abs(b.timestamp - params.invoiceDate!),
    );
  }

  return candidates[0].id;
}

export async function processInvoice(params: {
  orgId: string;
  fileBuffer: Buffer;
  fileName: string;
  mime: string;
  source: "upload" | "gmail";
  gmailMessageId?: string;
}): Promise<{ invoiceId: string; linked: boolean; linkedTxId: string | null; extraction: InvoiceExtraction | null }> {
  const invoiceId = `inv_${randomUUID()}`;

  const filePath = saveInvoiceFile({
    invoiceId,
    buffer: params.fileBuffer,
    originalName: params.fileName,
    mime: params.mime,
  });

  let extraction: InvoiceExtraction | null = null;
  let rawResponse = "";
  let status: "processed" | "failed" = "processed";
  let errorMessage: string | null = null;

  try {
    const result = await extractInvoice({
      fileBuffer: params.fileBuffer,
      mime: params.mime,
      fileName: params.fileName,
    });
    extraction = result.extraction;
    rawResponse = result.rawResponse;
  } catch (e) {
    status = "failed";
    errorMessage = (e as Error).message;
  }

  let merchantNorm: string | null = null;
  let category: string | null = null;
  let subCategory: string | null = null;
  let categoryConfidence: number | null = null;
  let classifierSource: string | null = null;
  let linkedTxId: string | null = null;

  if (extraction) {
    merchantNorm = normalizeMerchant(extraction.merchant);
    const cls = await classifyMerchant(extraction.merchant);
    category = cls.category;
    subCategory = cls.subCategory;
    categoryConfidence = cls.confidence;
    classifierSource = cls.source;

    linkedTxId = linkToTransaction({
      orgId: params.orgId,
      merchantNorm,
      totalCents: extraction.totalCents,
      invoiceDate: parseInvoiceDate(extraction.invoiceDate),
      currency: extraction.currency,
    });
  }

  db.insert(invoices)
    .values({
      id: invoiceId,
      orgId: params.orgId,
      filePath,
      fileName: params.fileName,
      fileMime: params.mime,
      fileSizeBytes: params.fileBuffer.length,
      source: params.source,
      gmailMessageId: params.gmailMessageId ?? null,
      merchantRaw: extraction?.merchant ?? null,
      merchantNorm,
      invoiceNumber: extraction?.invoiceNumber ?? null,
      invoiceDate: extraction ? parseInvoiceDate(extraction.invoiceDate) : null,
      dueDate: extraction ? parseInvoiceDate(extraction.dueDate) : null,
      subtotalCents: extraction?.subtotalCents ?? null,
      vatCents: extraction?.vatCents ?? null,
      totalCents: extraction?.totalCents ?? 0,
      currency: extraction?.currency ?? "EUR",
      category,
      subCategory,
      categoryConfidence,
      classifierSource,
      linkedTxId,
      extractionModel: status === "failed" ? "none" : "claude-sonnet-4-6",
      extractionRaw: rawResponse || null,
      status,
      errorMessage,
    })
    .run();

  if (extraction?.lineItems) {
    for (const item of extraction.lineItems) {
      db.insert(invoiceLineItems)
        .values({
          invoiceId,
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
  }

  appendAudit({
    orgId: params.orgId,
    actor: params.source === "gmail" ? "system" : "user",
    type: "invoice.ingested",
    payload: {
      invoiceId,
      fileName: params.fileName,
      source: params.source,
      status,
      merchant: extraction?.merchant ?? null,
      totalCents: extraction?.totalCents ?? 0,
      lineItemCount: extraction?.lineItems?.length ?? 0,
      linkedTxId,
      confidence: extraction?.confidence ?? 0,
    },
  });

  return { invoiceId, linked: !!linkedTxId, linkedTxId, extraction };
}
