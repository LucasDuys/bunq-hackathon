import { callBunq } from "./client";
import { loadContext } from "./context";

/**
 * bunq DraftPayment wrappers — used for over-threshold close runs.
 * The agent fires a DraftPayment to the CFO's bunq user; CFO opens
 * the bunq app and taps approve/reject. Money moves only on accept.
 *
 * Mock-mode: callBunq returns a canned id, no network. Demo can then
 * POST a synthetic callback to /api/bunq/draft-callback to simulate
 * the CFO approving.
 */

export type DraftStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

/**
 * POST /v1/user/{userId}/monetary-account/{fromAccountId}/draft-payment
 *
 * Returns the created DraftPayment id; the actual approval comes via
 * a DRAFT_PAYMENT webhook callback that bunq fires when the CFO acts.
 */
export const createDraftPayment = async (params: {
  fromAccountId: string;
  toAccountId: string;
  amountEur: number;
  description: string;
  numberOfRequiredAccepts?: number;
  userId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";

  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${userId}/monetary-account-bank/${params.fromAccountId}/draft-payment`,
    body: {
      amount: { value: params.amountEur.toFixed(2), currency: "EUR" },
      counterparty_alias: { type: "IBAN", value: `INTERNAL:${params.toAccountId}`, name: "Carbo Reserve" },
      description: params.description,
      number_of_required_accepts: params.numberOfRequiredAccepts ?? 1,
    },
    token: params.token,
  });
};

/**
 * GET /v1/user/{userId}/monetary-account/{fromAccountId}/draft-payment/{draftId}
 *
 * Backstop poll in case the webhook callback is dropped. Returns the
 * authoritative status + the resulting Payment.id once accepted.
 */
export const getDraftPayment = async (params: {
  draftId: number;
  fromAccountId: string;
  userId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";

  return callBunq<{
    Response: Array<{ DraftPayment?: { id: number; status: DraftStatus; payment?: { id: number } } }>;
  }>({
    method: "GET",
    path: `/v1/user/${userId}/monetary-account-bank/${params.fromAccountId}/draft-payment/${params.draftId}`,
    token: params.token,
  });
};
