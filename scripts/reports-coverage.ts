/**
 * Validate every fixture in fixtures/reports/*.json against the schema
 * and print a per-field fill-rate table. Run: npm run reports:coverage
 */
import fs from "node:fs";
import path from "node:path";
import { carbonReportSchema, type CarbonReport } from "@/lib/reports/schema";

const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "reports");

const countNonNull = (value: unknown, prefix: string, counts: Map<string, { total: number; filled: number }>) => {
  if (value === null || value === undefined) {
    const c = counts.get(prefix) ?? { total: 0, filled: 0 };
    c.total += 1;
    counts.set(prefix, c);
    return;
  }
  if (Array.isArray(value)) {
    const c = counts.get(prefix) ?? { total: 0, filled: 0 };
    c.total += 1;
    if (value.length > 0) c.filled += 1;
    counts.set(prefix, c);
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === "object" && value[i] !== null) {
        for (const [k, v] of Object.entries(value[i] as object)) {
          countNonNull(v, `${prefix}[].${k}`, counts);
        }
      }
    }
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      countNonNull(v, `${prefix}.${k}`, counts);
    }
    return;
  }
  const c = counts.get(prefix) ?? { total: 0, filled: 0 };
  c.total += 1;
  c.filled += 1;
  counts.set(prefix, c);
};

const main = () => {
  if (!fs.existsSync(FIXTURE_DIR)) {
    console.error(`No fixtures at ${FIXTURE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("No JSON fixtures found");
    process.exit(1);
  }

  const reports: CarbonReport[] = [];
  let failures = 0;
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), "utf8"));
    const result = carbonReportSchema.safeParse(raw);
    if (!result.success) {
      failures += 1;
      console.error(`FAIL ${f}`);
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      continue;
    }
    reports.push(result.data);
    console.log(`OK   ${f} — ${result.data.company} ${result.data.reportingYear} (${result.data.framework})`);
  }

  if (failures > 0) {
    console.error(`\n${failures} fixture(s) failed validation`);
    process.exit(1);
  }

  const counts = new Map<string, { total: number; filled: number }>();
  for (const r of reports) {
    for (const [k, v] of Object.entries(r)) {
      countNonNull(v, k, counts);
    }
  }

  const entries = Array.from(counts.entries())
    .filter(([k]) => !k.startsWith("_extraction"))
    .map(([k, { total, filled }]) => ({
      field: k,
      filled,
      total,
      pct: total === 0 ? 0 : (filled / total) * 100,
    }))
    .sort((a, b) => (b.pct - a.pct) || a.field.localeCompare(b.field));

  console.log(`\n=== Fill rate across ${reports.length} fixture(s) ===\n`);
  console.log("| Field | Filled | Total | Fill % |");
  console.log("|---|---:|---:|---:|");
  for (const e of entries) {
    console.log(`| \`${e.field}\` | ${e.filled} | ${e.total} | ${e.pct.toFixed(0)}% |`);
  }

  const required = entries.filter((e) => e.pct >= 80).length;
  const optional = entries.filter((e) => e.pct < 80 && e.pct >= 20).length;
  const rare = entries.filter((e) => e.pct < 20).length;
  console.log(`\nSummary: ${required} reliably-filled, ${optional} sometimes-filled, ${rare} rarely-filled fields.`);
};

main();
