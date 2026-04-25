import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { appendAudit } from "@/lib/audit/append";
import { enrichWithNarrative } from "@/lib/agent/annual-narrative";
import { buildAnnualReport } from "@/lib/reports/annual";
import { buildBriefing } from "@/lib/reports/briefing";
import { briefingDocument } from "@/lib/reports/render-briefing";
import { annualReportDocument } from "@/lib/reports/render-annual";

/**
 * Auto-generates the bunq-branded carbon report PDFs from a close run.
 * Reuses the existing renderers (briefingDocument / annualReportDocument);
 * adds filesystem persistence + an audit row so the dashboard can list
 * generated reports without re-rendering.
 *
 * Storage: data/exports/ (gitignored, same dir scripts/bunq-annual-export.ts uses).
 */

export const EXPORT_DIR_REL = `data${sep}exports`;
export const EXPORT_DIR = resolve(process.cwd(), "data", "exports");

export type ExportKind = "month" | "annual";

export type ExportResult = {
  kind: ExportKind;
  absPath: string;
  relPath: string; // "data/exports/..." — stable for audit + UI
  bytes: number;
  sha256: string;
  period: { label: string; startTs?: number; endTs?: number };
};

export const monthlyExportPath = (orgId: string, label: string): string => {
  // label is YYYY-MM
  return resolve(EXPORT_DIR, `carbo-${orgId}-${label}.pdf`);
};

export const annualExportPath = (orgId: string, year: number): string => {
  return resolve(EXPORT_DIR, `carbo-annual-${orgId}-${year}.pdf`);
};

const toRel = (abs: string): string => {
  // POSIX-style relPath for stable audit payloads + URL params, regardless of host OS sep.
  const cwd = process.cwd();
  const rel = abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs;
  return rel.split(sep).join("/");
};

const sha256Hex = (buf: Buffer | Uint8Array): string => {
  const h = createHash("sha256");
  h.update(buf);
  return h.digest("hex");
};

export const writeMonthlyReport = async (params: {
  orgId: string;
  label: string; // YYYY-MM
  closeRunId?: string;
}): Promise<ExportResult> => {
  const briefing = await buildBriefing({ orgId: params.orgId, kind: "month", label: params.label, skipNarrative: true });
  const buf = await renderToBuffer(briefingDocument(briefing));
  const data = buf instanceof Uint8Array ? Buffer.from(buf) : (buf as Buffer);

  await mkdir(EXPORT_DIR, { recursive: true });
  const absPath = monthlyExportPath(params.orgId, params.label);
  await writeFile(absPath, data);
  const relPath = toRel(absPath);
  const sha = sha256Hex(data);

  const result: ExportResult = {
    kind: "month",
    absPath,
    relPath,
    bytes: data.length,
    sha256: sha,
    period: {
      label: briefing.period.label,
      startTs: briefing.period.startTs,
      endTs: briefing.period.endTs,
    },
  };

  appendAudit({
    orgId: params.orgId,
    actor: "agent",
    type: "bunq.report.generated",
    payload: {
      kind: result.kind,
      relPath: result.relPath,
      bytes: result.bytes,
      sha256: result.sha256,
      period: result.period,
    },
    closeRunId: params.closeRunId ?? null,
  });

  return result;
};

export const writeAnnualReport = async (params: {
  orgId: string;
  year: number;
  closeRunId?: string;
}): Promise<ExportResult> => {
  const baseReport = await buildAnnualReport({ orgId: params.orgId, year: params.year });
  const enriched = await enrichWithNarrative(baseReport);
  const buf = await renderToBuffer(annualReportDocument(enriched));
  const data = buf instanceof Uint8Array ? Buffer.from(buf) : (buf as Buffer);

  await mkdir(EXPORT_DIR, { recursive: true });
  const absPath = annualExportPath(params.orgId, params.year);
  await writeFile(absPath, data);
  const relPath = toRel(absPath);
  const sha = sha256Hex(data);

  const yearStart = Math.floor(Date.UTC(params.year, 0, 1) / 1000);
  const yearEnd = Math.floor(Date.UTC(params.year + 1, 0, 1) / 1000);

  const result: ExportResult = {
    kind: "annual",
    absPath,
    relPath,
    bytes: data.length,
    sha256: sha,
    period: { label: String(params.year), startTs: yearStart, endTs: yearEnd },
  };

  appendAudit({
    orgId: params.orgId,
    actor: "agent",
    type: "bunq.report.generated",
    payload: {
      kind: result.kind,
      relPath: result.relPath,
      bytes: result.bytes,
      sha256: result.sha256,
      period: result.period,
    },
    closeRunId: params.closeRunId ?? null,
  });

  return result;
};
