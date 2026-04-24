import { createPublicKey } from "node:crypto";
import "dotenv/config";
import { eq } from "drizzle-orm";
import { bunqSessions, db, orgs } from "@/lib/db/client";
import { env } from "@/lib/env";
import { decodeKeyEnv } from "@/lib/bunq/signing";
import { loadContext, saveContext } from "@/lib/bunq/context";

const DEFAULT_ORG_ID = "org_acme_bv";
const SESSION_TTL_SECONDS = 60 * 60; // assume 1h; bunq actually grants longer but we re-auth aggressively

// bunq returns an array of tagged single-key objects; easier to keep loosely typed
// and pick by key than to narrow a TS union.
type BunqResp = { Response: Array<Record<string, unknown>> };

const pick = <T,>(resp: BunqResp, key: string): T | undefined => {
  const entry = resp.Response.find((x) => key in x);
  return entry ? (entry[key] as T) : undefined;
};

const post = async (path: string, body: unknown, extraHeaders: Record<string, string> = {}) => {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    "User-Agent": "carbo/0.1",
    "X-Bunq-Language": "en_US",
    "X-Bunq-Region": "nl_NL",
    "X-Bunq-Geolocation": "0 0 0 0 000",
    "X-Bunq-Client-Request-Id": crypto.randomUUID(),
    ...extraHeaders,
  };
  const resp = await fetch(`${env.bunqUrl}${path}`, { method: "POST", headers, body: bodyStr });
  if (!resp.ok) {
    throw new Error(`bunq POST ${path} -> ${resp.status} ${await resp.text()}`);
  }
  return await resp.json();
};

const ensureInstallation = async (publicKeyPem: string) => {
  const ctx = loadContext();
  if (ctx.installationToken && ctx.serverPublicKeyPem) {
    console.log("· installation already exists in context — skipping");
    return { installationToken: ctx.installationToken, serverPublicKeyPem: ctx.serverPublicKeyPem };
  }
  console.log("· POST /v1/installation");
  const r = (await post("/v1/installation", { client_public_key: publicKeyPem })) as BunqResp;
  const installationToken = pick<{ token: string }>(r, "Token")?.token;
  const serverPublicKeyPem = pick<{ server_public_key: string }>(r, "ServerPublicKey")?.server_public_key;
  if (!installationToken || !serverPublicKeyPem) throw new Error(`installation missing fields: ${JSON.stringify(r)}`);
  saveContext({ installationToken, serverPublicKeyPem });
  return { installationToken, serverPublicKeyPem };
};

const registerDevice = async (installationToken: string) => {
  console.log("· POST /v1/device-server");
  try {
    await post(
      "/v1/device-server",
      { description: "carbo-hackathon", secret: env.bunqKey },
      { "X-Bunq-Client-Authentication": installationToken },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ip address") || msg.includes("Permitted IP")) {
      console.error("device-server failed — your public IP isn't allowlisted on this sandbox key.");
      console.error("In sandbox you can usually re-mint a new key with `npm run bunq:sandbox-user` from the same IP.");
      throw e;
    }
    if (msg.includes("already") || msg.includes("400")) {
      console.log("  (device already registered — continuing)");
      return;
    }
    throw e;
  }
};

const createSession = async (installationToken: string) => {
  console.log("· POST /v1/session-server");
  const r = (await post(
    "/v1/session-server",
    { secret: env.bunqKey },
    { "X-Bunq-Client-Authentication": installationToken },
  )) as BunqResp;
  const sessionToken = pick<{ token: string }>(r, "Token")?.token;
  const user = pick<{ id: number; display_name: string }>(r, "UserCompany")
    ?? pick<{ id: number; display_name: string }>(r, "UserPerson");
  if (!sessionToken || !user) throw new Error(`session missing fields: ${JSON.stringify(r)}`);
  return { sessionToken, userId: String(user.id), userName: user.display_name };
};

const persistSession = (sessionToken: string, installationToken: string, serverPublicKeyPem: string) => {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  db.insert(bunqSessions).values({
    orgId: DEFAULT_ORG_ID,
    installationToken,
    sessionToken,
    serverPublicKey: serverPublicKeyPem,
    expiresAt,
  }).run();
};

const fetchMainAccountId = async (userId: string, sessionToken: string): Promise<string | undefined> => {
  // Sandbox users come with one default monetary-account-bank — grab its id so other scripts don't need to.
  const url = `${env.bunqUrl}/v1/user/${userId}/monetary-account-bank`;
  const resp = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "carbo/0.1",
      "X-Bunq-Language": "en_US",
      "X-Bunq-Region": "nl_NL",
      "X-Bunq-Geolocation": "0 0 0 0 000",
      "X-Bunq-Client-Request-Id": crypto.randomUUID(),
      "X-Bunq-Client-Authentication": sessionToken,
    },
  });
  if (!resp.ok) {
    console.warn(`(could not list monetary-account-bank: ${resp.status})`);
    return undefined;
  }
  const j = (await resp.json()) as { Response: Array<{ MonetaryAccountBank?: { id: number; description: string; status: string } }> };
  const main = j.Response.map((x) => x.MonetaryAccountBank).find((m) => m && m.status === "ACTIVE");
  return main ? String(main.id) : undefined;
};

const linkOrgToUser = (userId: string) => {
  // Make sure the org row exists; seed creates it but bootstrap should be runnable independently.
  db.insert(orgs).values({ id: DEFAULT_ORG_ID, name: env.defaultOrgName, bunqUserId: userId })
    .onConflictDoNothing().run();
  db.update(orgs).set({ bunqUserId: userId }).where(eq(orgs.id, DEFAULT_ORG_ID)).run();
};

const main = async () => {
  if (env.bunqMock) {
    console.error("BUNQ_MOCK is enabled — bootstrap only makes sense against the live sandbox.");
    console.error("Set BUNQ_MOCK=0 in .env.local and re-run.");
    process.exit(1);
  }
  if (!env.bunqKey) throw new Error("BUNQ_API_KEY is empty");
  if (!env.bunqPrivateKeyB64) throw new Error("BUNQ_PRIVATE_KEY_B64 is empty — run `npm run bunq:keygen` first");

  const privateKeyPem = decodeKeyEnv(env.bunqPrivateKeyB64);
  const publicKeyPem = createPublicKey(privateKeyPem).export({ type: "spki", format: "pem" }).toString();

  const { installationToken, serverPublicKeyPem } = await ensureInstallation(publicKeyPem);
  await registerDevice(installationToken);
  const { sessionToken, userId, userName } = await createSession(installationToken);

  persistSession(sessionToken, installationToken, serverPublicKeyPem);
  linkOrgToUser(userId);

  const mainAccountId = await fetchMainAccountId(userId, sessionToken);
  saveContext({ userId, mainAccountId });

  console.log(`\nBootstrap complete.`);
  console.log(`  user: ${userName} (id=${userId})`);
  console.log(`  main account id: ${mainAccountId ?? "(not found — check sandbox user state)"}`);
  console.log(`  session token cached in bunq_sessions`);
  console.log(`  installation + server pub key + ids cached in .bunq-context.json`);
  console.log(`\nNext: \`npm run bunq:create-reserve\` to create the Carbo Reserve sub-account.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
