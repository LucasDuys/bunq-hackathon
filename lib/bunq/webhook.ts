import { verifySignature } from "./signing";

export const BUNQ_SIG_HEADER = "x-bunq-server-signature";

export const verifyWebhook = (rawBody: string, signatureB64: string | null, serverPublicKeyPem: string): boolean => {
  if (!signatureB64) return false;
  try {
    return verifySignature(serverPublicKeyPem, rawBody, signatureB64);
  } catch {
    return false;
  }
};

export type BunqWebhookEvent = {
  NotificationUrl?: {
    target_url: string;
    category: string;
    event_type: string;
    object: {
      Payment?: {
        id: number;
        created: string;
        amount: { value: string; currency: string };
        description: string;
        counterparty_alias: { display_name: string; iban?: string };
        monetary_account_id: number;
      };
    };
  };
};
