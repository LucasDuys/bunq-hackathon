/**
 * The Carbo Report Agent — produces the bunq-branded carbon report PDF.
 *
 * # When it runs
 *
 *   1. Automatically, after every `close.completed` audit row inside
 *      `lib/agent/close.ts approveAndExecute()`. The hook there calls
 *      `writeMonthlyReport`, and on December closes also `writeAnnualReport`.
 *
 *   2. Manually:
 *        npm run reports:mock      → fixture-driven mock PDF (no DB needed)
 *        GET /briefing/pdf?...     → on-demand re-render
 *        GET /report/annual/.../pdf
 *
 * # What it produces
 *
 *   - A buffer rendered via `@react-pdf/renderer` from the team's
 *     `briefingDocument` (monthly) or `annualReportDocument` (annual).
 *   - Persisted under `data/exports/`:
 *       carbo-{orgId}-{YYYY}-{MM}.pdf       (monthly)
 *       carbo-annual-{orgId}-{YYYY}.pdf     (annual)
 *   - A `bunq.report.generated` audit row carrying file path, byte size,
 *     SHA-256 of the PDF, and the period covered. The dashboard
 *     "Reports" panel reads from this audit type.
 *
 * # Failure semantics
 *
 *   Non-fatal. If render or write fails, the close still completes; an
 *   audit row of type `bunq.report.failed` captures the error. The
 *   on-demand HTTP routes remain available as a manual fallback.
 *
 * # Where the actual implementation lives
 *
 *   `lib/reports/auto-export.ts` — the writeMonthlyReport / writeAnnualReport
 *   functions. This file is a thin facade: a stable name ("the Report
 *   Agent") for the team to import, plus a `runReportAgent` convenience
 *   that chooses the right call based on whether a `label` (monthly) or
 *   a `year` (annual) was provided.
 */

import {
  writeAnnualReport,
  writeMonthlyReport,
  type ExportResult,
} from "@/lib/reports/auto-export";

export { writeAnnualReport, writeMonthlyReport };
export type { ExportResult };

export type RunReportAgentInput =
  | { orgId: string; label: string; closeRunId?: string } // monthly: label = YYYY-MM
  | { orgId: string; year: number; closeRunId?: string }; // annual

/**
 * Single entry point. Picks the right writer based on inputs.
 */
export const runReportAgent = async (input: RunReportAgentInput): Promise<ExportResult> => {
  if ("label" in input) {
    return writeMonthlyReport({ orgId: input.orgId, label: input.label, closeRunId: input.closeRunId });
  }
  return writeAnnualReport({ orgId: input.orgId, year: input.year, closeRunId: input.closeRunId });
};
