import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { bunqSessions, db, orgs } from "@/lib/db/client";
import { env } from "@/lib/env";
import { createSubAccount } from "@/lib/bunq/accounts";
import { loadContext, saveContext } from "@/lib/bunq/context";

const DEFAULT_ORG_ID = "org_acme_bv";
const RESERVE_DESCRIPTION = "Carbo Reserve";

const latestSessionToken = (orgId: string): string => {
  const row = db.select().from(bunqSessions).where(eq(bunqSessions.orgId, orgId)).orderBy(desc(bunqSessions.id)).limit(1).all()[0];
  if (!row) throw new Error("no bunq session — run `npm run bunq:bootstrap` first");
  return row.sessionToken;
};

const main = async () => {
  if (env.bunqMock) {
    console.error("BUNQ_MOCK is enabled — sub-account creation only makes sense against the live sandbox.");
    process.exit(1);
  }
  const ctx = loadContext();
  if (!ctx.userId) throw new Error("missing userId in context — run `npm run bunq:bootstrap` first");
  if (ctx.reserveAccountId) {
    console.log(`Reserve sub-account already exists: id=${ctx.reserveAccountId}. Nothing to do.`);
    return;
  }

  const token = latestSessionToken(DEFAULT_ORG_ID);
  console.log(`Creating "${RESERVE_DESCRIPTION}" sub-account for user ${ctx.userId}…`);
  const r = await createSubAccount(ctx.userId, token, RESERVE_DESCRIPTION);
  const newId = r.Response.find((x) => x.Id)?.Id?.id;
  if (!newId) throw new Error(`unexpected response: ${JSON.stringify(r)}`);

  const reserveAccountId = String(newId);
  saveContext({ reserveAccountId });
  db.update(orgs).set({ reserveAccountId }).where(eq(orgs.id, DEFAULT_ORG_ID)).run();

  console.log(`Created sub-account id=${reserveAccountId}. Persisted to .bunq-context.json + orgs.reserve_account_id.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
