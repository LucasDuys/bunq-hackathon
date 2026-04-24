import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { decodeKeyEnv, signBody } from "./signing";

/**
 * Minimal bunq API client. Signs requests with RSA-SHA256.
 * In BUNQ_MOCK mode, returns canned responses so the rest of the app works offline.
 * See research/08-bunq-primitives.md.
 */

type Method = "GET" | "POST" | "PUT" | "DELETE";

export type BunqCallOptions = {
  method: Method;
  path: string; // e.g. "/v1/user/{uid}/monetary-account-bank"
  body?: unknown;
  token?: string;
};

const UA = "carbon-autopilot/0.1";

const headersFor = (opts: { token?: string; bodyStr: string; privateKeyPem?: string }) => {
  const h: Record<string, string> = {
    "Cache-Control": "no-cache",
    "User-Agent": UA,
    "X-Bunq-Language": "en_US",
    "X-Bunq-Region": "nl_NL",
    "X-Bunq-Client-Request-Id": randomUUID(),
    "X-Bunq-Geolocation": "0 0 0 0 000",
  };
  if (opts.token) h["X-Bunq-Client-Authentication"] = opts.token;
  if (opts.privateKeyPem && opts.bodyStr.length > 0) {
    h["X-Bunq-Client-Signature"] = signBody(opts.privateKeyPem, opts.bodyStr);
  }
  return h;
};

const MOCK_RESPONSES: Record<string, unknown> = {
  "POST /v1/installation": { Response: [{ Id: { id: 1 } }, { Token: { token: "mock_install_token" } }, { ServerPublicKey: { server_public_key: "-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----" } }] },
  "POST /v1/device-server": { Response: [{ Id: { id: 1 } }] },
  "POST /v1/session-server": {
    Response: [
      { Id: { id: 1 } },
      { Token: { token: "mock_session_token" } },
      { UserCompany: { id: 42, display_name: "Acme BV" } },
    ],
  },
};

export const callBunq = async <T = unknown>(opts: BunqCallOptions): Promise<T> => {
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";

  if (env.bunqMock) {
    const key = `${opts.method} ${opts.path}`;
    if (key in MOCK_RESPONSES) return MOCK_RESPONSES[key] as T;
    // Generic mock: acknowledge with an Id
    return { Response: [{ Id: { id: Math.floor(Math.random() * 10_000) } }] } as T;
  }

  const privateKeyPem = env.bunqPrivateKeyB64 ? decodeKeyEnv(env.bunqPrivateKeyB64) : undefined;
  const headers = headersFor({ token: opts.token, bodyStr, privateKeyPem });
  const url = `${env.bunqUrl}${opts.path}`;
  const resp = await fetch(url, { method: opts.method, headers, body: bodyStr || undefined });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`bunq ${opts.method} ${opts.path} -> ${resp.status} ${text}`);
  }
  return (await resp.json()) as T;
};
