import { notFound } from "next/navigation";
import { ShieldCheck, TreePine, Plane, Car } from "lucide-react";
import { getProofStats } from "@/lib/audit/proof";
import { fmtEur } from "@/lib/utils";
import { ProofRing, CountUp } from "@/components/ProofRing";
import { ProofDetail } from "@/components/ProofDetail";

export const dynamic = "force-dynamic";

export default async function ProofPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const stats = getProofStats(orgId);
  if (!stats) notFound();

  const hasData = stats.monthsTracked > 0;
  const verified = stats.chainIntegrity.valid;

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-12"
      style={{ background: "var(--bg-canvas)", color: "var(--fg-primary)" }}
    >
      <div className="w-full max-w-[440px] flex flex-col items-center proof-stagger">
        {/* ── 1. Verified badge ── */}
        <div>
          <div className="proof-verified-badge">
            <ShieldCheck className="h-3.5 w-3.5" />
            {verified ? "Verified" : "Unverified"}
          </div>
        </div>

        {/* ── 2. Business name ── */}
        <div className="flex flex-col items-center gap-2 mt-6 text-center">
          <h1
            className="text-[36px] leading-[1.0] tracking-[-0.02em] m-0"
            style={{ color: "var(--fg-primary)" }}
          >
            {stats.org.name}
          </h1>
          <span
            className="text-[13px]"
            style={{ color: "var(--fg-muted)" }}
          >
            Tracking since {stats.memberSince} · {stats.monthsTracked} month
            {stats.monthsTracked !== 1 ? "s" : ""} closed
          </span>
        </div>

        {/* ── 3. Hero ring ── */}
        {hasData && (
          <div className="mt-10 mb-2 flex flex-col items-center">
            <ProofRing
              value={stats.totalCo2eKg}
              label="Total tracked"
              unit="CO₂e tracked"
            />
          </div>
        )}

        {/* ── 4. Equivalencies — makes the number tangible ── */}
        {hasData && (
          <div className="w-full flex flex-col gap-3 mt-6">
            <div className="proof-equiv">
              <div
                className="proof-equiv-icon"
                style={{
                  background: "rgba(62,207,142,0.08)",
                  border: "1px solid var(--brand-green-border)",
                }}
              >
                <TreePine
                  className="h-4 w-4"
                  style={{ color: "var(--brand-green)" }}
                />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[15px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  <CountUp value={stats.treesEquivalent} /> trees
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  needed to absorb this for a year
                </span>
              </div>
            </div>

            <div className="proof-equiv">
              <div
                className="proof-equiv-icon"
                style={{
                  background: "rgba(95,185,255,0.08)",
                  border: "1px solid rgba(95,185,255,0.20)",
                }}
              >
                <Plane
                  className="h-4 w-4"
                  style={{ color: "var(--status-info)" }}
                />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[15px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  <CountUp value={stats.flightsEquivalent} /> flights
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Amsterdam → New York equivalent
                </span>
              </div>
            </div>

            <div className="proof-equiv">
              <div
                className="proof-equiv-icon"
                style={{
                  background: "rgba(247,185,85,0.08)",
                  border: "1px solid rgba(247,185,85,0.20)",
                }}
              >
                <Car
                  className="h-4 w-4"
                  style={{ color: "var(--status-warning)" }}
                />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[15px] tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  <CountUp value={stats.kmDrivenEquivalent} suffix=" km" />
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  driven by an average car
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Reserve + credits pill stats ── */}
        {hasData && (stats.totalReserveEur > 0 || stats.totalCreditsTonnes > 0) && (
          <div className="w-full flex gap-3 mt-8">
            {stats.totalReserveEur > 0 && (
              <div
                className="flex-1 rounded-[12px] px-4 py-4 flex flex-col items-center gap-1"
                style={{ border: "1px solid var(--border-default)" }}
              >
                <span
                  className="text-[22px] tabular-nums leading-none"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {fmtEur(stats.totalReserveEur, 0)}
                </span>
                <span
                  className="text-[11px] uppercase tracking-[1px]"
                  style={{
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-source-code-pro, monospace)",
                  }}
                >
                  Reserved
                </span>
              </div>
            )}
            {stats.totalCreditsTonnes > 0 && (
              <div
                className="flex-1 rounded-[12px] px-4 py-4 flex flex-col items-center gap-1"
                style={{
                  border: "1px solid var(--brand-green-border)",
                }}
              >
                <span
                  className="text-[22px] tabular-nums leading-none"
                  style={{ color: "var(--brand-green)" }}
                >
                  {stats.totalCreditsTonnes.toFixed(1)}t
                </span>
                <span
                  className="text-[11px] uppercase tracking-[1px]"
                  style={{
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-source-code-pro, monospace)",
                  }}
                >
                  Offset
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── 5b. Expandable detail breakdown ── */}
        {hasData && <ProofDetail stats={stats} />}

        {/* ── 6. No data placeholder ── */}
        {!hasData && (
          <div
            className="w-full rounded-[12px] px-6 py-12 flex flex-col items-center gap-3 text-center mt-10"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <span className="text-[28px]">🌱</span>
            <p
              className="text-[14px] m-0 max-w-[280px]"
              style={{ color: "var(--fg-secondary)" }}
            >
              This business has set up carbon tracking. Their first monthly
              close is coming soon.
            </p>
          </div>
        )}

        {/* ── 7. Chain verification (compact, not the hero) ── */}
        <div
          className="w-full mt-10 rounded-[12px] px-5 py-4 flex items-center justify-between"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full grid place-items-center"
              style={{
                border: `1px solid ${verified ? "var(--brand-green-border)" : "rgba(229,72,77,0.30)"}`,
                background: verified
                  ? "rgba(62,207,142,0.06)"
                  : "rgba(229,72,77,0.06)",
              }}
            >
              <ShieldCheck
                className="h-3.5 w-3.5"
                style={{
                  color: verified
                    ? "var(--brand-green)"
                    : "var(--status-danger)",
                }}
              />
            </div>
            <div className="flex flex-col">
              <span
                className="text-[13px]"
                style={{ color: "var(--fg-primary)" }}
              >
                {verified ? "Tamper-proof" : "Chain broken"}
              </span>
              <span
                className="text-[11px]"
                style={{ color: "var(--fg-muted)" }}
              >
                {stats.chainIntegrity.eventCount} events cryptographically chained
              </span>
            </div>
          </div>
          <span
            className="text-[12px] uppercase tracking-[1px] tabular-nums"
            style={{
              color: verified ? "var(--brand-green)" : "var(--status-danger)",
              fontFamily: "var(--font-source-code-pro, monospace)",
            }}
          >
            {verified ? "Intact" : "Broken"}
          </span>
        </div>

        {/* ── 8. Hash fingerprint + powered by ── */}
        <div className="flex flex-col items-center gap-4 mt-8 pb-6">
          <span
            className="text-[9px] tabular-nums break-all text-center leading-[1.8] max-w-[340px] select-all"
            style={{
              color: "var(--fg-faint)",
              fontFamily: "var(--font-source-code-pro, monospace)",
            }}
          >
            {stats.latestHash}
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--fg-faint)" }}
          >
            Verified by Carbo for bunq Business
          </span>
        </div>
      </div>
    </div>
  );
}
