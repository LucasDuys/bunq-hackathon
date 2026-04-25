import { callBunq } from "./client";
import { loadContext } from "./context";

/**
 * Write a Carbo carbon estimate as a NoteText on a bunq Payment.
 * Stores the audit data on the bank's side so the bunq export PDF
 * doubles as the CSRD evidence trail.
 *
 * Mock-mode: callBunq returns a canned id, no network.
 *
 * Note shape (single line, ≤140 chars to stay safe across export formats):
 *   "kg CO2e: 12.4 ±2.1 | factor: ADEME-2024 #4521 | run: r_a83"
 */

export type CarbonNote = {
  co2eKgPoint: number;
  co2eKgLow: number;
  co2eKgHigh: number;
  factorSource: string; // e.g. "ADEME-2024"
  factorId: string; // e.g. "ade_2024_food_groceries"
  closeRunId?: string;
};

export const formatCarbonNote = (n: CarbonNote): string => {
  const point = n.co2eKgPoint.toFixed(2);
  const halfRange = ((n.co2eKgHigh - n.co2eKgLow) / 2).toFixed(2);
  const run = n.closeRunId ? ` | run: ${n.closeRunId.slice(0, 12)}` : "";
  return `kg CO2e: ${point} ±${halfRange} | factor: ${n.factorSource} #${n.factorId}${run}`;
};

const resolveAccount = (overrideAccountId?: string): string | undefined => {
  if (overrideAccountId) return overrideAccountId;
  return loadContext().mainAccountId;
};

/**
 * POST /v1/user/{userId}/monetary-account/{accountId}/payment/{paymentId}/note-text
 */
export const writeCarbonNote = async (params: {
  paymentId: string;
  note: CarbonNote;
  userId?: string;
  accountId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";
  const accountId = resolveAccount(params.accountId) ?? "1";
  const content = formatCarbonNote(params.note);

  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${userId}/monetary-account/${accountId}/payment/${params.paymentId}/note-text`,
    body: { content },
    token: params.token,
  });
};

/**
 * POST /v1/user/{userId}/monetary-account/{accountId}/payment/{paymentId}/note-attachment
 * Attaches a previously-uploaded attachment (e.g. a receipt PDF) to the payment record.
 */
export const attachReceiptToPayment = async (params: {
  paymentId: string;
  attachmentId: number;
  description: string;
  userId?: string;
  accountId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";
  const accountId = resolveAccount(params.accountId) ?? "1";

  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${userId}/monetary-account/${accountId}/payment/${params.paymentId}/note-attachment`,
    body: { description: params.description, attachment_id: params.attachmentId },
    token: params.token,
  });
};
