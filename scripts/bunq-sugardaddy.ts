import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { bunqSessions, db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { callBunq } from "@/lib/bunq/client";
import { loadContext } from "@/lib/bunq/context";

const DEFAULT_ORG_ID = "org_acme_bv";
const SUGARDADDY_EMAIL = "sugardaddy@bunq.com";
const TOPUP_EUR = Number(process.env.SUGARDADDY_AMOUNT ?? "500");

const latestSessionToken = (orgId: string): string => {
  const row = db.select().from(bunqSessions).where(eq(bunqSessions.orgId, orgId)).orderBy(desc(bunqSessions.id)).limit(1).all()[0];
  if (!row) throw new Error("no bunq session — run `npm run bunq:bootstrap` first");
  return row.sessionToken;
};

const main = async () => {
  if (env.bunqMock) {
    console.error("BUNQ_MOCK is enabled — sugardaddy seeding only makes sense against the live sandbox.");
    process.exit(1);
  }
  const ctx = loadContext();
  if (!ctx.userId) throw new Error("missing userId in context — run `npm run bunq:bootstrap` first");
  const accountId = process.env.SUGARDADDY_ACCOUNT_ID ?? ctx.mainAccountId;
  if (!accountId) {
    throw new Error("no main account id — pass SUGARDADDY_ACCOUNT_ID=<id> or set ctx.mainAccountId. Find via `GET /v1/user/<uid>/monetary-account-bank`.");
  }
  const token = latestSessionToken(DEFAULT_ORG_ID);

  console.log(`Requesting EUR ${TOPUP_EUR} from ${SUGARDADDY_EMAIL} into account ${accountId}…`);
  const r = await callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${ctx.userId}/monetary-account-bank/${accountId}/request-inquiry`,
    body: {
      amount_inquired: { value: TOPUP_EUR.toFixed(2), currency: "EUR" },
      counterparty_alias: { type: "EMAIL", value: SUGARDADDY_EMAIL, name: "Sugar Daddy" },
      description: "carbo demo seed",
      allow_bunqme: false,
    },
    token,
  });

  const id = r.Response.find((x) => x.Id)?.Id?.id;
  console.log(`RequestInquiry created (id=${id}). Sugardaddy auto-accepts within seconds; check balance.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
