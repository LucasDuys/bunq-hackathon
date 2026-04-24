import { callBunq } from "@/lib/bunq/client";
import { env } from "@/lib/env";

const userId = process.env.BUNQ_USER_ID ?? "42";
const accountId = process.env.BUNQ_ACCOUNT_ID ?? "1";
const token = process.env.BUNQ_SESSION_TOKEN ?? "mock_session_token";

const url = env.bunqWebhookUrl;
if (!url) {
  console.error("BUNQ_WEBHOOK_URL must be set in .env.local");
  process.exit(1);
}

const r = await callBunq({
  method: "POST",
  path: `/v1/user/${userId}/monetary-account/${accountId}/notification-filter-url`,
  body: {
    notification_filters: [
      { category: "MUTATION", notification_target: url },
    ],
  },
  token,
});
console.log("Registered:", JSON.stringify(r, null, 2));
