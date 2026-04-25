import { NextResponse } from "next/server";
import { isGmailConfigured, pollGmailInvoices } from "@/lib/invoices/gmail";
import { appendAudit } from "@/lib/audit/append";

export const POST = async (req: Request) => {
  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: "Gmail not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_MOCK=false" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { orgId?: string };
  const orgId = body.orgId ?? "org_acme_bv";

  const result = await pollGmailInvoices({ orgId });

  appendAudit({
    orgId,
    actor: "system",
    type: "gmail.polled",
    payload: result,
  });

  return NextResponse.json({ ok: true, ...result });
};
