import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { appendAudit } from "@/lib/audit/append";
import type { CarbonBriefing } from "@/lib/reports/briefing-schema";
import { briefingDocument } from "@/lib/reports/render-briefing";

/**
 * Renders a mock bunq Carbo monthly carbon report to
 * data/exports/mock-bunq-carbo-monthly.pdf using a hardcoded fixture —
 * no database, no close run, no live bunq involvement. Useful for handing
 * the document to a stakeholder or judge in isolation.
 *
 *   npm run reports:mock
 */

const ORG_ID = "org_acme_bv";
const ORG_NAME = "Acme BV";

// March 2026 fixture — chosen so the cover renders "March 2026"; numbers
// are plausible for a 50-person Dutch software SME (Acme BV reference profile).
const fixture: CarbonBriefing = {
  orgId: ORG_ID,
  orgName: ORG_NAME,
  generatedAt: new Date().toISOString(),
  period: {
    kind: "month",
    label: "2026-03",
    startTs: Math.floor(Date.UTC(2026, 2, 1) / 1000),
    endTs: Math.floor(Date.UTC(2026, 3, 1) / 1000),
    priorLabel: "2026-02",
  },
  summary: {
    totalCo2eKg: 9433.6,
    totalSpendEur: 24155,
    txCount: 89,
    confidence: 0.36,
    deltaCo2ePct: 12,
    deltaSpendPct: 8,
    reserveBalanceEur: 624.98,
  },
  topCategories: [
    { category: "other", spendEur: 9079, co2eKg: 2724.5, sharePct: 29 },
    { category: "procurement", spendEur: 6139, co2eKg: 2592.1, sharePct: 27 },
    { category: "fuel", spendEur: 523, co2eKg: 1308.0, sharePct: 14 },
    { category: "utilities", spendEur: 830, co2eKg: 996.2, sharePct: 11 },
    { category: "travel", spendEur: 1953, co2eKg: 879.4, sharePct: 9 },
  ],
  topMerchants: [
    { merchantNorm: "coolblue", merchantRaw: "Coolblue", txCount: 4, spendEur: 3007, co2eKg: 1503.5, sharePct: 16, category: "procurement" },
    { merchantNorm: "consultancy_xyz_bv", merchantRaw: "Consultancy XYZ BV", txCount: 1, spendEur: 3400, co2eKg: 1020.0, sharePct: 11, category: "other" },
    { merchantNorm: "shell_station_a2", merchantRaw: "Shell Station A2", txCount: 1, spendEur: 340, co2eKg: 850.0, sharePct: 9, category: "fuel" },
    { merchantNorm: "eneco", merchantRaw: "Eneco", txCount: 1, spendEur: 540, co2eKg: 648.0, sharePct: 7, category: "utilities" },
    { merchantNorm: "aws_emea", merchantRaw: "AWS EMEA", txCount: 1, spendEur: 2110, co2eKg: 633.0, sharePct: 7, category: "other" },
  ],
  anomalies: [
    {
      kind: "merchant_surge",
      subject: "Coolblue",
      deltaPct: 239,
      currentCo2eKg: 1503,
      priorCo2eKg: 444,
      message: "Coolblue CO₂e up 239% vs last period (444 → 1503 kg).",
    },
    {
      kind: "new_high_emitter",
      subject: "Consultancy XYZ BV",
      deltaPct: null,
      currentCo2eKg: 1020,
      priorCo2eKg: null,
      message: "Consultancy XYZ BV is new this period — 1020 kg CO₂e on 1 tx.",
    },
    {
      kind: "new_high_emitter",
      subject: "Shell Station A2",
      deltaPct: null,
      currentCo2eKg: 850,
      priorCo2eKg: null,
      message: "Shell Station A2 is new this period — 850 kg CO₂e on 1 tx.",
    },
    {
      kind: "new_high_emitter",
      subject: "Eneco",
      deltaPct: null,
      currentCo2eKg: 648,
      priorCo2eKg: null,
      message: "Eneco is new this period — 648 kg CO₂e on 1 tx.",
    },
  ],
  swaps: [
    {
      from: "Coolblue",
      to: "Refurbished electronics + consolidated bulk orders",
      expectedSavingKg: 676,
      expectedSavingPct: 45,
      rationale:
        "Manufacturing dominates electronics Cat-1 emissions (>70%). Refurb units have 60-70% lower embodied CO₂e per device; bulk consolidation cuts logistics emissions further.",
      currentCo2eKg: 1503,
      currentSpendEur: 3007,
      generatedBy: "category_rule",
    },
    {
      from: "Shell Station A2",
      to: "Electrify fleet, contract renewable charging",
      expectedSavingKg: 595,
      expectedSavingPct: 70,
      rationale:
        "EVs charged on Dutch grid emit ~70% less per km than diesel. Lease electrification typically pays back in 24 months at current TCO.",
      currentCo2eKg: 850,
      currentSpendEur: 340,
      generatedBy: "category_rule",
    },
    {
      from: "utilities",
      to: "Switch electricity contract to 100% renewable (Greenchoice / Pure Energie)",
      expectedSavingKg: 847,
      expectedSavingPct: 85,
      rationale:
        "Market-based Scope 2 drops to ~0 when matched with EU-issued GoOs; cost delta is typically <5% on commercial contracts.",
      currentCo2eKg: 996,
      currentSpendEur: 830,
      generatedBy: "category_rule",
    },
  ],
  reserve: {
    recommendedTonnes: 9.43,
    recommendedSpendEur: 931,
    projectMix: [
      { projectId: "biochar-nl-gelderland", projectName: "Gelderland Biochar Initiative", tonnes: 4.72, eur: 684 },
      { projectId: "reforestation-ee-baltic", projectName: "Baltic Forest Restoration", tonnes: 1.89, eur: 72 },
      { projectId: "peatland-ie-midlands", projectName: "Irish Midlands Peatland Restoration", tonnes: 2.83, eur: 175 },
    ],
  },
  narrative:
    "March emissions rose 12% versus February, driven by a single large procurement order from Coolblue and a one-off consultancy engagement. Reserve coverage held at full offset against the recommended EU-removal mix.",
};

const main = async () => {
  console.log("Rendering mock bunq Carbo monthly report…");
  const buf = await renderToBuffer(briefingDocument(fixture));
  const data = buf instanceof Uint8Array ? Buffer.from(buf) : (buf as Buffer);

  const exportDir = resolve(process.cwd(), "data", "exports");
  await mkdir(exportDir, { recursive: true });
  const absPath = resolve(exportDir, "mock-bunq-carbo-monthly.pdf");
  await writeFile(absPath, data);
  const sha = createHash("sha256").update(data).digest("hex");

  console.log(`  wrote ${absPath}`);
  console.log(`  bytes: ${data.length}`);
  console.log(`  sha256: ${sha}`);

  // Best-effort audit: only if a DB exists. If migrate hasn't run, skip silently.
  try {
    appendAudit({
      orgId: ORG_ID,
      actor: "system",
      type: "bunq.report.mock_generated",
      payload: {
        relPath: "data/exports/mock-bunq-carbo-monthly.pdf",
        bytes: data.length,
        sha256: sha,
        period: { label: fixture.period.label, kind: fixture.period.kind },
      },
    });
    console.log("  audit row appended (bunq.report.mock_generated)");
  } catch {
    console.log("  (no DB present, skipped audit row)");
  }

  console.log("\nOpen the PDF to eyeball the cover page, KPI cards, share bars, and footer copy.");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
