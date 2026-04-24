import "dotenv/config";

/**
 * POST a synthetic bunq MUTATION event to the local webhook handler.
 * Bypasses bunq entirely — useful for demo + dev when running in mock mode.
 *
 * Usage:
 *   npm run dev:fire                            # random merchant from the pool
 *   MERCHANT="Loetje Centraal" AMOUNT=84.50 npm run dev:fire
 *   PORT=3001 npm run dev:fire
 */

type Pick = { merchant: string; description: string; amountEur: number };

const POOL: Pick[] = [
  { merchant: "Loetje Centraal", description: "Client dinner", amountEur: 84.5 },
  { merchant: "Albert Heijn 1411", description: "Office groceries", amountEur: 47.2 },
  { merchant: "KLM Royal Dutch Airlines", description: "AMS-CDG", amountEur: 312 },
  { merchant: "Uber BV", description: "Airport transfer", amountEur: 38.4 },
  { merchant: "AWS EMEA", description: "Lambda + S3", amountEur: 241 },
  { merchant: "Amazon EU", description: "Order ref 111-9001", amountEur: 1280 },
  { merchant: "Thuisbezorgd", description: "Team Friday lunch", amountEur: 96 },
  { merchant: "Shell Station A2", description: "Fleet refuel", amountEur: 73 },
];

const port = process.env.PORT ?? "3000";
const url = `http://localhost:${port}/api/webhook/bunq`;

const choice = (() => {
  const m = process.env.MERCHANT;
  const a = process.env.AMOUNT;
  if (m && a) return { merchant: m, description: process.env.DESCRIPTION ?? "manual fire", amountEur: Number(a) };
  return POOL[Math.floor(Math.random() * POOL.length)];
})();

const payload = {
  NotificationUrl: {
    target_url: url,
    category: "MUTATION",
    event_type: "PAYMENT_CREATED",
    object: {
      Payment: {
        id: Math.floor(Date.now() / 1000),
        created: new Date().toISOString(),
        amount: { value: (-choice.amountEur).toFixed(2), currency: "EUR" },
        description: choice.description,
        counterparty_alias: { display_name: choice.merchant, iban: "NL00BUNQ0000000000" },
        monetary_account_id: 1,
      },
    },
  },
};

const main = async () => {
  console.log(`POST ${url}`);
  console.log(`  merchant: ${choice.merchant}`);
  console.log(`  amount:   EUR ${choice.amountEur.toFixed(2)}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await resp.text();
  if (!resp.ok) {
    console.error(`  -> ${resp.status} ${body}`);
    process.exit(1);
  }
  console.log(`  -> ${resp.status} ${body}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
