import { callBunq } from "./client";

/** Intra-user transfer between sub-accounts. Zero per-call approval; immediate. */
export const intraUserTransfer = async (params: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amountEur: number;
  description: string;
  token: string;
}) => {
  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${params.userId}/monetary-account-bank/${params.fromAccountId}/payment`,
    body: {
      amount: { value: params.amountEur.toFixed(2), currency: "EUR" },
      counterparty_alias: { type: "IBAN", value: `INTERNAL:${params.toAccountId}`, name: "Carbo Reserve" },
      description: params.description,
    },
    token: params.token,
  });
};
