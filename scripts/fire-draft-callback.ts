import "dotenv/config";

/**
 * Demo shortcut: synthesize a bunq DRAFT_PAYMENT webhook delivery so you can
 * exercise the over-threshold approval flow without a real CFO bunq user.
 *
 * Usage:
 *   npm run dev:fire-draft -- --draft=<id>            # accept (default)
 *   npm run dev:fire-draft -- --draft=<id> --reject   # reject
 *   PORT=3001 npm run dev:fire-draft -- --draft=42
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const draftId = args.draft ? Number(args.draft) : undefined;
if (!draftId || Number.isNaN(draftId)) {
  console.error("Pass --draft=<id> (find it in the bunq.draft.created audit row).");
  process.exit(1);
}

const status = args.reject ? "REJECTED" : "ACCEPTED";
const port = process.env.PORT ?? "3000";
const url = `http://localhost:${port}/api/bunq/draft-callback`;

const payload = {
  NotificationUrl: {
    target_url: url,
    category: "DRAFT_PAYMENT",
    event_type: status === "ACCEPTED" ? "DRAFT_PAYMENT_ACCEPTED" : "DRAFT_PAYMENT_REJECTED",
    object: {
      DraftPayment: { id: draftId, status },
    },
  },
};

const main = async () => {
  console.log(`POST ${url}`);
  console.log(`  draftId: ${draftId}`);
  console.log(`  status:  ${status}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await resp.text();
  console.log(`  -> ${resp.status} ${body}`);
  if (!resp.ok) process.exit(1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
