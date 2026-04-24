import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db, invoices } from "@/lib/db/client";
import { processInvoice } from "./process";
import { ALLOWED_MIMES } from "./storage";

export function isGmailConfigured(): boolean {
  if (env.gmailMock) return false;
  return !!(env.gmailClientId && env.gmailClientSecret && env.gmailRefreshToken);
}

function createGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    env.gmailClientId,
    env.gmailClientSecret,
  );
  oauth2.setCredentials({ refresh_token: env.gmailRefreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function isMessageProcessed(messageId: string): boolean {
  const row = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.gmailMessageId, messageId))
    .all();
  return row.length > 0;
}

export async function pollGmailInvoices(params: {
  orgId: string;
}): Promise<{ processed: number; errors: string[] }> {
  if (!isGmailConfigured()) {
    return { processed: 0, errors: ["Gmail not configured"] };
  }

  const gmail = createGmailClient();
  const errors: string[] = [];
  let processed = 0;

  const query = env.gmailPollAddress
    ? `to:${env.gmailPollAddress} has:attachment newer_than:7d`
    : "has:attachment newer_than:7d";

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 20,
  });

  const messages = listRes.data.messages ?? [];

  for (const msg of messages) {
    if (!msg.id) continue;
    if (isMessageProcessed(msg.id)) continue;

    try {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      const parts = fullMsg.data.payload?.parts ?? [];

      for (const part of parts) {
        if (!part.filename || !part.body?.attachmentId) continue;
        if (!ALLOWED_MIMES.has(part.mimeType ?? "")) continue;

        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: msg.id,
          id: part.body.attachmentId,
        });

        if (!attachment.data.data) continue;

        const buffer = Buffer.from(attachment.data.data, "base64");
        if (buffer.length > 10 * 1024 * 1024) continue; // skip >10MB

        await processInvoice({
          orgId: params.orgId,
          fileBuffer: buffer,
          fileName: part.filename,
          mime: part.mimeType ?? "application/pdf",
          source: "gmail",
          gmailMessageId: msg.id,
        });
        processed++;
      }
    } catch (e) {
      errors.push(`Message ${msg.id}: ${(e as Error).message}`);
    }
  }

  return { processed, errors };
}
