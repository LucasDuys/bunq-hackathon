import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, invoices } from "@/lib/db/client";
import { readInvoiceFile } from "@/lib/invoices/storage";
import { existsSync } from "node:fs";
import path from "node:path";

export const GET = async (
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
      { error: "File not found on disk" },
      { status: 404 },
    );
  }

  const buffer = readInvoiceFile(invoice.filePath);
  const safeName = invoice.fileName.replace(/["\r\n\\]/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": invoice.fileMime,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Length": String(buffer.length),
    },
  });
};
