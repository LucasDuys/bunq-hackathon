import { NextResponse } from "next/server";
import { processInvoice } from "@/lib/invoices/process";
import { ALLOWED_MIMES, MAX_FILE_SIZE } from "@/lib/invoices/storage";

export const POST = async (req: Request) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, PDF` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const orgId = (formData.get("orgId") as string) ?? "org_acme_bv";

    const result = await processInvoice({
      orgId,
      fileBuffer: buffer,
      fileName: file.name,
      mime: file.type,
      source: "upload",
    });

    return NextResponse.json({
      ok: true,
      id: result.invoiceId,
      linked: result.linked,
      linkedTxId: result.linkedTxId,
      merchant: result.extraction?.merchant ?? null,
      totalCents: result.extraction?.totalCents ?? 0,
      lineItems: result.extraction?.lineItems?.length ?? 0,
      confidence: result.extraction?.confidence ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
};
