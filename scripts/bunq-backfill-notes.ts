import "dotenv/config";
import { eq } from "drizzle-orm";
import { appendAudit } from "@/lib/audit/append";
import { auditEvents, db, transactions } from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { factorById } from "@/lib/factors";
import { formatCarbonNote, writeCarbonNote } from "@/lib/bunq/notes";

/**
 * Walk every transaction without a `bunq.note.written` audit row and write a
 * Carbo carbon estimate as a NoteText on the bunq Payment record. Idempotent —
 * re-running skips already-noted transactions.
 *
 * Usage:
 *   npm run bunq:backfill-notes
 *   npm run bunq:backfill-notes -- --org=org_acme_bv --limit=100
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const ORG_ID = (args.org as string) ?? "org_acme_bv";
const LIMIT = args.limit ? Number(args.limit) : Infinity;

const main = async () => {
  // Pull every tx for the org.
  const txs = db.select().from(transactions).where(eq(transactions.orgId, ORG_ID)).all();
  console.log(`Found ${txs.length} transactions for org=${ORG_ID}`);

  // Load all bunq.note.written rows so we can dedupe in-memory.
  const noted = db.select({ payload: auditEvents.payload })
    .from(auditEvents)
    .where(eq(auditEvents.type, "bunq.note.written"))
    .all();
  const notedTxIds = new Set<string>();
  for (const r of noted) {
    try {
      const p = JSON.parse(r.payload) as { txId?: string };
      if (p.txId) notedTxIds.add(p.txId);
    } catch { /* skip */ }
  }
  console.log(`  ${notedTxIds.size} already have a NoteText; skipping those.`);

  let written = 0;
  let failed = 0;
  for (const tx of txs) {
    if (written >= LIMIT) break;
    if (notedTxIds.has(tx.id)) continue;
    if (!tx.bunqTxId) continue;

    const est = estimateEmission({
      category: tx.category ?? "other",
      subCategory: tx.subCategory,
      amountEur: tx.amountCents / 100,
      classifierConfidence: tx.categoryConfidence ?? 0.5,
    });
    const factor = factorById(est.factorId);
    const note = {
      co2eKgPoint: est.co2eKgPoint,
      co2eKgLow: est.co2eKgLow,
      co2eKgHigh: est.co2eKgHigh,
      factorSource: factor?.source ?? "estimated",
      factorId: est.factorId,
    };

    try {
      const r = await writeCarbonNote({ paymentId: tx.bunqTxId, note });
      const noteId = r?.Response?.[0]?.Id?.id;
      appendAudit({
        orgId: ORG_ID,
        actor: "system",
        type: "bunq.note.written",
        payload: { txId: tx.id, paymentId: tx.bunqTxId, noteId, content: formatCarbonNote(note), backfill: true },
      });
      written += 1;
      if (written % 50 === 0) console.log(`  wrote ${written}/${txs.length - notedTxIds.size}`);
    } catch (e) {
      failed += 1;
      appendAudit({
        orgId: ORG_ID,
        actor: "system",
        type: "bunq.note.failed",
        payload: { txId: tx.id, paymentId: tx.bunqTxId, error: e instanceof Error ? e.message : String(e), backfill: true },
      });
    }
  }
  console.log(`Backfill complete. Wrote ${written}, failed ${failed}.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
