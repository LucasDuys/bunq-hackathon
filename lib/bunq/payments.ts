import { appendAudit } from "@/lib/audit/append";
import { env } from "@/lib/env";
import { callBunq } from "./client";

const ORG_ID = "org_acme_bv";

export type IntraUserTransferParams = {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amountEur: number;
  description: string;
  token: string;
  closeRunId?: string | null;
};

/**
 * Intra-user transfer between sub-accounts. Zero per-call approval; immediate.
 * Honors DRY_RUN — when set, logs to the audit chain and returns a fake success
 * so the demo can complete without moving sandbox money.
 */
export const intraUserTransfer = async (params: IntraUserTransferParams) => {
  if (env.dryRun) {
    appendAudit({
      orgId: ORG_ID,
      actor: "system",
      type: "bunq.transfer.dry_run",
      payload: {
        from: params.fromAccountId,
        to: params.toAccountId,
        amountEur: params.amountEur,
        description: params.description,
      },
      closeRunId: params.closeRunId ?? null,
    });
    return { Response: [{ Id: { id: -1 } }], dryRun: true } as const;
  }

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
