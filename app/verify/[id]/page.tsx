import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck, Hash, Calendar, Leaf } from "lucide-react";
import { verifyChain } from "@/lib/audit/append";
import { computeCloseDigest } from "@/lib/audit/digest";
import { getCloseRun } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ digest?: string }>;
}) {
  const { id } = await params;
  const { digest: expectedDigest } = await searchParams;

  const run = getCloseRun(id);
  if (!run) notFound();

  const result = computeCloseDigest(id);
  if (!result) notFound();

  const chain = verifyChain(run.orgId);
  const digestMatch = expectedDigest ? expectedDigest === result.digest : null;
  const allValid = chain.valid && (digestMatch === null || digestMatch);

  const co2eKg = result.payload.co2eKg;
  const confidence = result.payload.confidence;
  const confidencePct = Math.round(confidence * 100);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-canvas)", color: "var(--fg-primary)" }}
    >
      <div className="w-full max-w-[440px] flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Leaf
            className="h-5 w-5"
            style={{ color: "var(--brand-green)" }}
            aria-hidden="true"
          />
          <span
            className="text-[14px]"
            style={{
              fontWeight: 500,
              color: "var(--fg-primary)",
            }}
          >
            Carbo
          </span>
        </div>

        {/* Status icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            border: `2px solid ${allValid ? "var(--brand-green)" : "var(--status-danger)"}`,
            background: allValid
              ? "rgba(62,207,142,0.08)"
              : "rgba(229,72,77,0.08)",
          }}
        >
          {allValid ? (
            <CheckCircle2
              className="h-10 w-10"
              style={{ color: "var(--brand-green)" }}
            />
          ) : (
            <XCircle
              className="h-10 w-10"
              style={{ color: "var(--status-danger)" }}
            />
          )}
        </div>

        {/* Headline */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1
            className="text-[28px] leading-[1.1] tracking-[-0.015em] m-0"
            style={{ color: "var(--fg-primary)" }}
          >
            {allValid ? "Audit chain verified" : "Verification failed"}
          </h1>
          <p
            className="text-[14px] leading-[1.5] m-0 max-w-[320px]"
            style={{ color: "var(--fg-secondary)" }}
          >
            {allValid
              ? "Every event in this carbon close is cryptographically chained. No records have been altered."
              : "The audit chain or digest does not match. This record may have been modified."}
          </p>
        </div>

        {/* Stats card */}
        <div
          className="w-full rounded-[12px] flex flex-col"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <div
            className="px-5 py-4 flex flex-col gap-1"
            style={{ borderBottom: "1px solid var(--border-faint)" }}
          >
            <span
              className="text-[12px] uppercase tracking-[1.2px]"
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-source-code-pro, monospace)",
              }}
            >
              Carbon close · {result.payload.month}
            </span>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            {/* CO2e */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Leaf
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--brand-green)" }}
                  aria-hidden="true"
                />
                <span
                  className="text-[13px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Emissions
                </span>
              </div>
              <span
                className="text-[14px] tabular-nums"
                style={{ color: "var(--fg-primary)" }}
              >
                {fmtKg(co2eKg)}
              </span>
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className="h-4 w-4 shrink-0"
                  style={{
                    color:
                      confidence >= 0.85
                        ? "var(--confidence-high)"
                        : confidence >= 0.6
                          ? "var(--confidence-medium)"
                          : "var(--confidence-low)",
                  }}
                  aria-hidden="true"
                />
                <span
                  className="text-[13px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Confidence
                </span>
              </div>
              <span
                className="text-[14px] tabular-nums"
                style={{ color: "var(--fg-primary)" }}
              >
                {confidencePct}%
              </span>
            </div>

            {/* Reserve */}
            {result.payload.reserveEur > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--fg-muted)" }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    Reserve transferred
                  </span>
                </div>
                <span
                  className="text-[14px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {fmtEur(result.payload.reserveEur, 0)}
                </span>
              </div>
            )}

            {/* Approved at */}
            {result.payload.approvedAt && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--brand-green)" }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    Approved
                  </span>
                </div>
                <span
                  className="text-[14px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {new Date(result.payload.approvedAt * 1000).toLocaleDateString(
                    "en-NL",
                    { day: "2-digit", month: "short", year: "numeric" },
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Chain integrity */}
          <div
            className="px-5 py-4 flex flex-col gap-3"
            style={{ borderTop: "1px solid var(--border-faint)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Hash
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--fg-muted)" }}
                  aria-hidden="true"
                />
                <span
                  className="text-[13px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Chain events
                </span>
              </div>
              <span
                className="text-[14px] tabular-nums"
                style={{ color: "var(--fg-primary)" }}
              >
                {result.payload.auditEventCount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span
                className="text-[13px]"
                style={{ color: "var(--fg-secondary)" }}
              >
                SHA-256 chain
              </span>
              <span
                className="text-[12px] tabular-nums"
                style={{
                  color: chain.valid
                    ? "var(--brand-green)"
                    : "var(--status-danger)",
                  fontFamily: "var(--font-source-code-pro, monospace)",
                }}
              >
                {chain.valid ? "INTACT" : `BROKEN @ #${chain.brokenAtId}`}
              </span>
            </div>

            {digestMatch !== null && (
              <div className="flex items-center justify-between">
                <span
                  className="text-[13px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Run digest
                </span>
                <span
                  className="text-[12px] tabular-nums"
                  style={{
                    color: digestMatch
                      ? "var(--brand-green)"
                      : "var(--status-danger)",
                    fontFamily: "var(--font-source-code-pro, monospace)",
                  }}
                >
                  {digestMatch ? "MATCH" : "MISMATCH"}
                </span>
              </div>
            )}
          </div>

          {/* Hash preview */}
          <div
            className="px-5 py-3"
            style={{ borderTop: "1px solid var(--border-faint)" }}
          >
            <span
              className="text-[11px] tabular-nums break-all leading-[1.6]"
              style={{
                color: "var(--fg-faint)",
                fontFamily: "var(--font-source-code-pro, monospace)",
              }}
            >
              {result.payload.lastHash}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3">
          <p
            className="text-[12px] text-center max-w-[320px]"
            style={{ color: "var(--fg-faint)" }}
          >
            Verified by Carbo for bunq Business. Each audit event is
            SHA-256 chained — altering any record breaks the chain.
          </p>
          <Link
            href={`/close/${id}`}
            className="text-[13px] no-underline"
            style={{ color: "var(--brand-green-link)" }}
          >
            View full close run
          </Link>
        </div>
      </div>
    </div>
  );
}
