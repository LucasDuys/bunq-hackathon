import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, gte, like, lt } from "drizzle-orm";
import { auditEvents, db, transactions } from "@/lib/db/client";
import {
  downloadAnnualOverviewContent,
  getAnnualOverview,
  requestAnnualOverview,
} from "@/lib/bunq/annual-export";
import { appendAudit } from "@/lib/audit/append";

/**
 * Generates a Carbo-enriched annual export.
 *
 * Two outputs land in data/exports/:
 *   1. carbo-annual-{year}.csv   — every transaction for the year, joined
 *      with its bunq.note.written audit row, so each row carries
 *      "kg CO2e | factor source | factor id | bunq note id". This is
 *      what the CSRD reviewer reads — it ties the bank's own carbon
 *      stamp to our local emission estimate.
 *   2. bunq-annual-{year}.pdf    — bunq's official annual overview
 *      (mock returns a stub PDF; live calls /v1/.../export-annual-overview).
 *
 * Usage:
 *   npm run bunq:annual-export -- --year=2026
 *   npm run bunq:annual-export -- --year=2025 --org=org_acme_bv
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const YEAR = Number(args.year ?? new Date().getUTCFullYear());
const ORG_ID = (args.org as string) ?? "org_acme_bv";

const csvEscape = (s: string | null | undefined) => {
  if (s === null || s === undefined) return "";
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const main = async () => {
  const exportDir = resolve(process.cwd(), "data", "exports");
  mkdirSync(exportDir, { recursive: true });

  const yearStart = Math.floor(Date.UTC(YEAR, 0, 1) / 1000);
  const yearEnd = Math.floor(Date.UTC(YEAR + 1, 0, 1) / 1000);

  // Pull every transaction for the year.
  const txs = db.select().from(transactions)
    .where(and(
      eq(transactions.orgId, ORG_ID),
      gte(transactions.timestamp, yearStart),
      lt(transactions.timestamp, yearEnd),
    ))
    .all();
  console.log(`Found ${txs.length} transactions for ${ORG_ID} in ${YEAR}`);

  // Pull every bunq.note.written audit row and index by txId.
  const noteRows = db.select({ payload: auditEvents.payload })
    .from(auditEvents)
    .where(and(eq(auditEvents.orgId, ORG_ID), like(auditEvents.type, "bunq.note.%")))
    .all();
  const notesByTx = new Map<string, { content?: string; noteId?: number; failed?: boolean }>();
  for (const r of noteRows) {
    try {
      const p = JSON.parse(r.payload) as { txId?: string; content?: string; noteId?: number; error?: string };
      if (p.txId) {
        notesByTx.set(p.txId, {
          content: p.content,
          noteId: p.noteId,
          failed: !!p.error,
        });
      }
    } catch { /* skip */ }
  }
  const notedCount = Array.from(notesByTx.values()).filter((n) => !!n.content).length;
  console.log(`  ${notedCount} of those have a Carbo carbon note`);

  // Build CSV with the carbon column joined in.
  const header = [
    "tx_id", "bunq_payment_id", "timestamp_iso", "merchant", "category", "sub_category",
    "amount_eur", "currency", "carbon_note", "bunq_note_id",
  ].join(",");
  const lines = [header];
  for (const t of txs) {
    const note = t.id ? notesByTx.get(t.id) : undefined;
    const iso = new Date(t.timestamp * 1000).toISOString();
    lines.push([
      t.id, t.bunqTxId ?? "", iso, csvEscape(t.merchantRaw), t.category ?? "", t.subCategory ?? "",
      (t.amountCents / 100).toFixed(2), t.currency, csvEscape(note?.content ?? ""), note?.noteId ?? "",
    ].join(","));
  }
  const csvPath = resolve(exportDir, `carbo-annual-${YEAR}.csv`);
  writeFileSync(csvPath, lines.join("\n") + "\n");
  console.log(`Wrote ${csvPath}`);

  // Trigger the bunq annual overview (mock returns canned id; live polls).
  console.log(`Requesting bunq ExportAnnualOverview for ${YEAR}…`);
  const r = await requestAnnualOverview({ year: YEAR });
  const exportId = r?.Response?.[0]?.Id?.id;
  if (!exportId) {
    console.error("no Id in response", JSON.stringify(r));
    process.exit(1);
  }
  console.log(`  bunq export id: ${exportId}`);

  // In live mode: poll until READY. Mock returns immediately.
  // (Mock callBunq returns a generic Id-only shape, not ExportAnnualOverview;
  // we don't gate the demo on a real status check.)
  await getAnnualOverview({ exportId }).catch(() => undefined);

  const pdfBuf = await downloadAnnualOverviewContent({ exportId });
  const pdfPath = resolve(exportDir, `bunq-annual-${YEAR}.pdf`);
  writeFileSync(pdfPath, pdfBuf);
  console.log(`Wrote ${pdfPath} (${pdfBuf.length} bytes)`);

  appendAudit({
    orgId: ORG_ID,
    actor: "system",
    type: "bunq.annual_export.generated",
    payload: { year: YEAR, exportId, txCount: txs.length, notedCount, csvPath, pdfPath },
  });

  console.log(`\nDone. CSRD reviewer reads ${csvPath} alongside ${pdfPath}.`);
  console.log(`  ${notedCount}/${txs.length} transactions carry a bank-side carbon note.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
