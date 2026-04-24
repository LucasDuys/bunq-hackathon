import { randomUUID } from "node:crypto";
import { appendAudit } from "@/lib/audit/append";
import { CREDIT_PROJECTS } from "@/lib/credits/projects";
import { db, creditProjects, emissionFactors, orgs, policies, transactions } from "@/lib/db/client";
import { FACTORS } from "@/lib/factors";
import { DEFAULT_POLICY } from "@/lib/policy/schema";
import { classifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { env } from "@/lib/env";

type SeedTx = { merchant: string; desc: string; amountEur: number; daysAgo: number };

// Deterministic set of 60 transactions across 90 days. Mix of clearly-classifiable
// and ambiguous merchants so the agent has work to do.
const TXS: SeedTx[] = [
  // Travel — clear
  { merchant: "KLM Royal Dutch Airlines", desc: "AMS-LHR return", amountEur: 412, daysAgo: 7 },
  { merchant: "KLM Royal Dutch Airlines", desc: "AMS-BCN", amountEur: 298, daysAgo: 24 },
  { merchant: "Transavia", desc: "AMS-LIS", amountEur: 187, daysAgo: 56 },
  { merchant: "Lufthansa", desc: "AMS-FRA conference", amountEur: 340, daysAgo: 31 },
  { merchant: "NS International", desc: "Thalys to Paris", amountEur: 128, daysAgo: 14 },
  { merchant: "Deutsche Bahn", desc: "ICE Berlin", amountEur: 89, daysAgo: 42 },
  { merchant: "Booking.com", desc: "Hotel Paris 2 nights", amountEur: 340, daysAgo: 14 },
  { merchant: "NH Hotels Amsterdam", desc: "Client offsite", amountEur: 520, daysAgo: 19 },
  { merchant: "Uber BV", desc: "Airport transfer", amountEur: 62, daysAgo: 8 },
  { merchant: "Bolt Netherlands", desc: "Late night taxi", amountEur: 28, daysAgo: 22 },

  // Food — clear + ambiguous
  { merchant: "Albert Heijn 1411", desc: "Office groceries", amountEur: 87, daysAgo: 2 },
  { merchant: "Albert Heijn 1411", desc: "Office groceries", amountEur: 64, daysAgo: 16 },
  { merchant: "Thuisbezorgd", desc: "Team Friday lunch", amountEur: 142, daysAgo: 3 },
  { merchant: "Deliveroo NL", desc: "Team lunch", amountEur: 98, daysAgo: 10 },
  { merchant: "Loetje Centraal", desc: "Client dinner", amountEur: 420, daysAgo: 18 },
  { merchant: "The Butcher Social", desc: "Board dinner", amountEur: 580, daysAgo: 25 },
  { merchant: "Starbucks Damrak", desc: "Coffee", amountEur: 22, daysAgo: 5 },
  { merchant: "Catering Company BV", desc: "Offsite catering", amountEur: 1240, daysAgo: 45 },
  { merchant: "Sla Amsterdam", desc: "Plant-based lunch", amountEur: 68, daysAgo: 12 },

  // Cloud — clear + ambiguous "Amazon"
  { merchant: "AWS EMEA", desc: "Monthly infra", amountEur: 2340, daysAgo: 6 },
  { merchant: "AWS EMEA", desc: "Monthly infra", amountEur: 2110, daysAgo: 36 },
  { merchant: "AWS EMEA", desc: "Monthly infra", amountEur: 1890, daysAgo: 66 },
  { merchant: "Google Cloud EMEA", desc: "Bigquery", amountEur: 430, daysAgo: 11 },
  { merchant: "Vercel Inc", desc: "Hosting", amountEur: 120, daysAgo: 8 },
  { merchant: "GitHub", desc: "Enterprise seats", amountEur: 420, daysAgo: 30 },
  { merchant: "Notion Labs", desc: "Team workspace", amountEur: 96, daysAgo: 15 },
  { merchant: "Figma Inc", desc: "Design team seats", amountEur: 180, daysAgo: 15 },
  { merchant: "Linear", desc: "Issue tracking", amountEur: 64, daysAgo: 15 },
  { merchant: "Slack Technologies", desc: "Pro seats", amountEur: 210, daysAgo: 30 },
  { merchant: "OpenAI", desc: "API usage", amountEur: 340, daysAgo: 20 },
  { merchant: "Anthropic", desc: "API usage", amountEur: 280, daysAgo: 20 },

  // Procurement — ambiguous Amazon (key uncertainty cluster)
  { merchant: "Amazon EU", desc: "Order ref 111-2345", amountEur: 1840, daysAgo: 9 },
  { merchant: "Amazon EU", desc: "Order ref 111-2346", amountEur: 2340, daysAgo: 21 },
  { merchant: "Amazon EU", desc: "Order ref 111-2347", amountEur: 1420, daysAgo: 40 },
  { merchant: "Amazon EU", desc: "Order ref 111-2348", amountEur: 3600, daysAgo: 58 },
  { merchant: "Coolblue", desc: "Monitor", amountEur: 480, daysAgo: 12 },
  { merchant: "MediaMarkt", desc: "Office AV", amountEur: 720, daysAgo: 35 },
  { merchant: "Bol.com", desc: "Office supplies", amountEur: 240, daysAgo: 27 },
  { merchant: "IKEA BV", desc: "Office chairs", amountEur: 1280, daysAgo: 48 },

  // Services — ambiguous "services"
  { merchant: "Consultancy XYZ BV", desc: "Q1 services", amountEur: 3400, daysAgo: 29 },
  { merchant: "KPMG Advisory", desc: "Audit prep", amountEur: 2200, daysAgo: 37 },
  { merchant: "Notary Jansen", desc: "Legal filing", amountEur: 420, daysAgo: 50 },
  { merchant: "Google Ads", desc: "Q1 campaign", amountEur: 1800, daysAgo: 15 },
  { merchant: "LinkedIn Ads", desc: "Recruitment", amountEur: 980, daysAgo: 23 },
  { merchant: "Meta Ads", desc: "Q1 campaign", amountEur: 720, daysAgo: 52 },

  // Fuel & utilities
  { merchant: "Shell Station A2", desc: "Fleet refuel", amountEur: 380, daysAgo: 13 },
  { merchant: "Shell Station A2", desc: "Fleet refuel", amountEur: 340, daysAgo: 43 },
  { merchant: "Eneco", desc: "Office electricity", amountEur: 540, daysAgo: 28 },
  { merchant: "Greenchoice", desc: "Warehouse electricity", amountEur: 290, daysAgo: 28 },

  // Padding for 60 total
  { merchant: "Albert Heijn 2201", desc: "Groceries", amountEur: 42, daysAgo: 33 },
  { merchant: "Bolt", desc: "Taxi", amountEur: 19, daysAgo: 38 },
  { merchant: "Starbucks Schiphol", desc: "Coffee", amountEur: 14, daysAgo: 7 },
  { merchant: "Sixt NL", desc: "Rental car", amountEur: 380, daysAgo: 55 },
  { merchant: "Booking.com", desc: "Berlin 1 night", amountEur: 180, daysAgo: 44 },
  { merchant: "Notion Labs", desc: "Add-on seats", amountEur: 48, daysAgo: 44 },
  { merchant: "Coolblue", desc: "Headphones", amountEur: 210, daysAgo: 60 },
  { merchant: "Vercel Inc", desc: "Pro plan upgrade", amountEur: 40, daysAgo: 68 },
  { merchant: "AWS EMEA", desc: "Data transfer", amountEur: 240, daysAgo: 72 },
  { merchant: "Amazon EU", desc: "Order ref 111-2350", amountEur: 920, daysAgo: 77 },
  { merchant: "KLM Royal Dutch Airlines", desc: "AMS-CPH", amountEur: 265, daysAgo: 80 },
  { merchant: "KPMG Advisory", desc: "Tax consult", amountEur: 1400, daysAgo: 82 },
];

const upsertFactors = () => {
  for (const f of FACTORS) {
    db.insert(emissionFactors).values({
      id: f.id,
      category: f.category,
      subCategory: f.subCategory,
      factorKgPerEur: f.factorKgPerEur,
      uncertaintyPct: f.uncertaintyPct,
      region: f.region,
      source: f.source,
      tier: f.tier,
    }).onConflictDoNothing().run();
  }
};

const upsertCredits = () => {
  for (const p of CREDIT_PROJECTS) {
    db.insert(creditProjects).values({
      id: p.id,
      name: p.name,
      type: p.type,
      region: p.region,
      country: p.country,
      pricePerTonneEur: p.pricePerTonneEur,
      description: p.description,
      registry: p.registry,
    }).onConflictDoNothing().run();
  }
};

const run = async () => {
  console.log("Seeding…");
  const orgId = "org_acme_bv";

  // Org + policy
  db.insert(orgs).values({ id: orgId, name: env.defaultOrgName, bunqUserId: "42", reserveAccountId: "reserve_1", creditsAccountId: "credits_1" }).onConflictDoNothing().run();
  db.insert(policies).values({ id: "pol_default", orgId, rules: JSON.stringify(DEFAULT_POLICY), active: true }).onConflictDoNothing().run();

  upsertFactors();
  upsertCredits();

  appendAudit({ orgId, actor: "system", type: "org.seeded", payload: { name: env.defaultOrgName } });

  // Transactions
  let count = 0;
  for (const t of TXS) {
    const ts = Math.floor(Date.now() / 1000) - t.daysAgo * 86400;
    const merchantNorm = normalizeMerchant(t.merchant);
    const cls = await classifyMerchant(t.merchant, t.desc);
    const id = `tx_${randomUUID()}`;
    db.insert(transactions).values({
      id,
      orgId,
      bunqTxId: `bunq_${count}`,
      merchantRaw: t.merchant,
      merchantNorm,
      amountCents: Math.round(t.amountEur * 100),
      currency: "EUR",
      timestamp: ts,
      accountId: "main",
      description: t.desc,
      category: cls.category,
      subCategory: cls.subCategory,
      categoryConfidence: cls.confidence,
      classifierSource: cls.source,
    }).onConflictDoNothing().run();
    count += 1;
  }
  appendAudit({ orgId, actor: "system", type: "transactions.seeded", payload: { count } });
  console.log(`Seeded ${count} transactions.`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
