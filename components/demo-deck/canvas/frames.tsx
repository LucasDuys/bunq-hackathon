"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedCounter } from "@/components/demo-deck/animated-counter";
import { ENTERPRISE, RECOMMENDATIONS } from "./data";
import { DAG_NODES, RECEIPT_OCR } from "@/app/launch/data";
import { DagFlow } from "@/app/launch/components/DagFlow";
import { ReceiptOCR } from "@/app/launch/components/ReceiptOCR";
import { BunqSubAccountsStage } from "@/app/launch/components/BunqSubAccountsStage";

// Mount-driven RAF timer. Returns ms since the consuming component mounted.
// AnimatePresence unmounts the frame when stage changes, so the timer
// naturally resets on next mount — exactly what DagFlow / ReceiptOCR want.
function useElapsedMs(): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setMs(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ms;
}

// Frames are static-but-fading backdrops that appear under the morphing
// elements at the right stage. They are NOT in the LayoutGroup — they have
// no shared layoutIds — so they fade in/out cleanly without trying to morph.

// ─── Stage 0 — Hero (Meet Carbo wordmark + value prop) ────────────────────
//
// Lives in the canvas, not the caption. That gives stage 0 the same
// caption-at-top chrome as every other stage and removes the v2 weird
// caption-position-swap glitch.

export function HeroFrame({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hero"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Exit must be snappy — the bright Carbo wordmark + textShadow glow
          // are visually loud, so a slow fade leaves a green ghost lingering
          // over stage 1's tx list. easeIn + 0.18s reads as a clean cut.
          exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-12"
        >
          <div className="flex flex-col items-center gap-8 text-center">
            <motion.span
              className="font-mono text-xs uppercase tracking-[0.32em] text-[var(--fg-muted)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              Meet
            </motion.span>

            <motion.h1
              className="text-7xl font-normal leading-[0.95] tracking-tight text-[var(--brand-green)] md:text-9xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0.34, 1], delay: 0.6 }}
              style={{ textShadow: "0 0 40px rgba(62, 207, 142, 0.25)" }}
            >
              Carbo
            </motion.h1>

            <motion.p
              className="max-w-[42ch] text-balance text-lg text-[var(--fg-secondary)] md:text-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4 }}
            >
              We get bunq enterprise clients{" "}
              <span className="text-[var(--fg-primary)]">4.5% off their annual spend</span>
              {" "}— and shrink their carbon footprint along the way.
            </motion.p>

            <motion.span
              className="mt-12 font-mono text-xs uppercase tracking-[0.32em] text-[var(--fg-faint)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.4, 1] }}
              transition={{ duration: 2.4, delay: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
            >
              Press space to begin
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Stage 0 — Hook backdrop (subtle radial pulse) ───────────────────────
export function HookBackdrop({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hook-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Snap exit so the green radial pulse doesn't bleed into stage 1.
          exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at center, var(--brand-green-soft) 0%, transparent 70%)",
              }}
              initial={{ width: 0, height: 0, opacity: 0 }}
              animate={{
                width: ["0px", "1100px"],
                height: ["0px", "1100px"],
                opacity: [0, 0.55, 0],
              }}
              transition={{
                duration: 4.5,
                ease: "easeOut",
                delay: i * 1.5,
                repeat: Infinity,
                repeatDelay: 0,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Stage 7 — Cost vs carbon matrix with explicit axes + quadrant titles ─
//
// v3.2: axis labels sit OUTSIDE the matrix grid in their own absolutely-
// positioned strips. The wrapper covers a wider canvas area (left/top/right/
// bottom of the matrix) and the matrix grid is offset within it. Math is
// calibrated so the matrix grid still lands at canvas (20%, 22%) – (80%, 78%),
// matching the rec-dot positions computed in stages.ts.

export function MatrixGrid({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="matrix"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-none absolute"
          // Wrapper that contains: Y-axis (left strip), X-axis (bottom strip),
          // matrix grid (centered). Computed so the matrix grid lands at
          // canvas (20%, 22%) – (80%, 78%).
          style={{ left: "12%", top: "14%", width: "76%", height: "70%" }}
        >
          {/* Y-axis label — vertical strip on the left, rotated text */}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: 0, top: "11.4%", width: "10.5%", height: "80%" }}
          >
            <span
              className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]"
              style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap" }}
            >
              ↑ HIGHER CARBON IMPACT &nbsp;&nbsp; LOWER ↓
            </span>
          </div>

          {/* X-axis label — horizontal strip on the bottom */}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: "10.5%", top: "92%", width: "78.9%", height: "8%" }}
          >
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)]">
              ← LOWER COST EFFORT &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; HIGHER COST EFFORT →
            </span>
          </div>

          {/* The 2×2 grid itself — sized to land at canvas (20,22)-(80,78) */}
          <div
            className="absolute"
            style={{ left: "10.5%", top: "11.4%", width: "78.9%", height: "80%" }}
          >
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl border border-[var(--border-default)]">
              <Quadrant
                corner="tl"
                title="Quick wins"
                hint="do these first"
                tone="win"
              />
              <Quadrant
                corner="tr"
                title="Green investments"
                hint="needs CFO sign-off"
                tone="invest"
              />
              <Quadrant
                corner="bl"
                title="Cost savers"
                hint="with caveats"
                tone="cost"
              />
              <Quadrant
                corner="br"
                title="Avoid"
                hint="don't bother"
                tone="avoid"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Quadrant({
  corner,
  title,
  hint,
  tone,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  title: string;
  hint: string;
  tone: "win" | "invest" | "cost" | "avoid";
}) {
  const bgs = {
    win: "rgba(62, 207, 142, 0.06)",
    invest: "rgba(247, 185, 85, 0.06)",
    cost: "rgba(137, 137, 137, 0.04)",
    avoid: "rgba(229, 72, 77, 0.05)",
  } as const;
  const labelColor = {
    win: "var(--brand-green)",
    invest: "var(--status-warning)",
    cost: "var(--fg-secondary)",
    avoid: "var(--status-danger)",
  } as const;
  const borderClasses =
    corner === "tl"
      ? "border-r border-b"
      : corner === "tr"
      ? "border-b"
      : corner === "bl"
      ? "border-r"
      : "";
  // v3.5: each quadrant's title sits in the OUTER corner of the quadrant
  // (away from matrix center) so it can never collide with the dots that
  // cluster in the upper-left of TL, the lower-left of BL, etc.
  const titlePos =
    corner === "tl"
      ? "left-3 top-3 text-left items-start"
      : corner === "tr"
      ? "right-3 top-3 text-right items-end"
      : corner === "bl"
      ? "left-3 bottom-3 text-left items-start"
      : "right-3 bottom-3 text-right items-end";
  return (
    <div
      className={`relative ${borderClasses} border-[var(--border-faint)]`}
      style={{ backgroundColor: bgs[tone] }}
    >
      <div className={`absolute flex max-w-[42%] flex-col gap-0.5 ${titlePos}`}>
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-[0.22em]"
          style={{ color: labelColor[tone] }}
        >
          {title}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          {hint}
        </div>
      </div>
    </div>
  );
}

// ─── Stage 8 — Three stacked stat cards (replaces the bar chart) ─────────
export function ScaleStatCards({ visible }: { visible: boolean }) {
  const cards = [
    {
      key: "company-yr",
      label: "Per company · per year",
      value: ENTERPRISE.perCompanyYearEur,
      hint: "5% of an enterprise's €5M annual spend",
      climactic: false,
    },
    {
      key: "company-5yr",
      label: "Per company · over 5 years",
      value: ENTERPRISE.perCompanyFiveYearEur,
      hint: "Compounding behavioural change month over month",
      climactic: false,
    },
    {
      key: "fleet",
      label: "1,000 bunq enterprise clients · per year",
      value: ENTERPRISE.fleetYearEur,
      hint: "If Carbo rolls out at network scale",
      climactic: true,
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="scale-stats"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-12"
        >
          <div className="flex w-full max-w-3xl flex-col gap-3">
            {cards.map((c, i) => (
              <div key={c.key} className="flex flex-col items-stretch gap-3">
                <motion.div
                  className={`rounded-2xl border px-8 py-6 ${
                    c.climactic
                      ? "border-[var(--brand-green-border)] bg-[var(--brand-green-soft)]"
                      : "border-[var(--border-default)] bg-[var(--bg-button)]"
                  }`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.32, 0.72, 0.34, 1],
                    delay: 0.2 + i * 0.4,
                  }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">
                        {c.label}
                      </span>
                      <span className="mt-1 text-sm text-[var(--fg-secondary)] md:text-base">
                        {c.hint}
                      </span>
                    </div>
                    <span
                      className={`whitespace-nowrap text-5xl font-normal leading-none tabular-nums md:text-6xl ${
                        c.climactic
                          ? "text-[var(--brand-green)]"
                          : "text-[var(--fg-primary)]"
                      }`}
                    >
                      <AnimatedCounter
                        value={c.value}
                        duration={c.climactic ? 1.6 : 1.2}
                        delay={0.3 + i * 0.4}
                        prefix="€"
                        format={(n) => {
                          if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
                          if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
                          return n.toString();
                        }}
                      />
                    </span>
                  </div>
                </motion.div>

                {i < cards.length - 1 && (
                  <motion.div
                    className="flex justify-center text-[var(--fg-muted)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.4 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 3v10M4 9l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Stage 9 — Baseline vs After CO2 with delta arrow ────────────────────
export function CO2Comparison({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="co2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-none absolute"
          style={{ left: "8%", top: "16%", width: "84%", height: "70%" }}
        >
          <div className="relative grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-6">
            <ReportCard
              eyebrow="Baseline · today"
              tco2e={ENTERPRISE.baselineTco2e}
              method="spend_based · pre-Carbo"
              tone="dim"
            />

            {/* Delta arrow / chip in the middle */}
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0.34, 1], delay: 1.4 }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="var(--brand-green)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="rounded-full border border-[var(--brand-green-border)] bg-[var(--brand-green-soft)] px-4 py-2 font-mono text-base font-medium tabular-nums text-[var(--brand-green)] md:text-lg">
                −{ENTERPRISE.reductionPct}%
              </span>
            </motion.div>

            <ReportCard
              eyebrow="After Carbo · 12 months"
              tco2e={ENTERPRISE.afterTco2e}
              method="refined + green-alt switches"
              tone="bright"
              esrs="ESRS E1-6 / E1-7"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReportCard({
  eyebrow,
  tco2e,
  method,
  tone,
  esrs,
}: {
  eyebrow: string;
  tco2e: number;
  method: string;
  tone: "dim" | "bright";
  esrs?: string;
}) {
  const accent = tone === "bright" ? "var(--brand-green)" : "var(--fg-muted)";
  return (
    <div
      className="flex h-full flex-col justify-between rounded-2xl border bg-[var(--bg-button)] p-8"
      style={{
        borderColor:
          tone === "bright" ? "var(--brand-green-border)" : "var(--border-default)",
      }}
    >
      <div>
        <div
          className="font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </div>
        {esrs && (
          <div className="mt-2 font-mono text-xs text-[var(--fg-muted)]">
            {esrs} · audit-ready
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className="text-7xl font-normal leading-none tabular-nums md:text-8xl"
          style={{
            color:
              tone === "bright" ? "var(--fg-primary)" : "var(--fg-secondary)",
          }}
        >
          <AnimatedCounter
            value={tco2e}
            duration={1.6}
            delay={tone === "bright" ? 0.6 : 0.2}
          />
        </span>
        <span className="text-2xl text-[var(--fg-secondary)]">tCO₂e / yr</span>
      </div>

      <div className="text-sm text-[var(--fg-secondary)]">{method}</div>
    </div>
  );
}

// ─── DAG flow stage — split layout (text left, DAG right) ─────────────────
//
// Owns its own caption — the top Caption strip is suppressed for stage 6.
// `position: fixed inset-0` so it escapes the canvas's pt-80 padding and
// uses the full viewport — the DAG can render at a much larger scale.

export function DagFlowFrame({
  visible,
  caption,
}: {
  visible: boolean;
  caption: { eyebrow: string; headline: string; sub?: string };
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="dag-flow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-30"
        >
          <div className="grid h-full w-full grid-cols-12 items-center gap-6 px-12 py-12">
            {/* Left column — caption */}
            <motion.div
              className="col-span-5 flex flex-col gap-5"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            >
              <span className="font-mono text-sm uppercase tracking-[0.22em] text-[var(--brand-green)]">
                {caption.eyebrow}
              </span>
              <h1 className="max-w-[22ch] text-balance text-4xl font-normal leading-[1.05] tracking-tight text-[var(--fg-primary)] md:text-5xl">
                {caption.headline}
              </h1>
              {caption.sub && (
                <p className="max-w-[40ch] text-balance text-base text-[var(--fg-secondary)] md:text-lg">
                  {caption.sub}
                </p>
              )}
            </motion.div>

            {/* Right column — the DAG */}
            <div className="col-span-7 flex h-full items-center justify-center overflow-hidden">
              <DagFlowScaled />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DagFlowScaled() {
  const ms = useElapsedMs();
  return (
    <div
      style={{
        transform: "scale(0.78)",
        transformOrigin: "center center",
      }}
    >
      <DagFlow nodes={DAG_NODES} elapsedMs={ms} durationMs={5500} />
    </div>
  );
}

// ─── Receipt OCR stage — uses the launch-route ReceiptOCR component ──────
//
// v3.6: split layout matching the DAG stage. Caption sits LEFT, vertically
// centered. Receipt scene fills the RIGHT 7/12 columns at scale 0.85 — much
// larger than v3.5's 0.62 because `fixed inset-0` escapes the canvas-inner
// pt-80 padding and gives the receipt the full viewport height to render in.
// tx-010 (the focus card, see stages.ts) morphs to the BOTTOM-RIGHT of the
// canvas-inner area so it reads as the artifact the receipt belongs to.

export function ReceiptOCRFrame({
  visible,
  caption,
}: {
  visible: boolean;
  caption: { eyebrow: string; headline: string; sub?: string };
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="receipt-ocr"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-30"
        >
          <div className="grid h-full w-full grid-cols-12 items-stretch gap-6 px-12 py-12">
            {/* Left — caption, vertically centered */}
            <motion.div
              className="col-span-5 flex flex-col justify-center gap-5"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            >
              <span className="font-mono text-sm uppercase tracking-[0.22em] text-[var(--brand-green)]">
                {caption.eyebrow}
              </span>
              <h1 className="max-w-[24ch] text-balance text-4xl font-normal leading-[1.05] tracking-tight text-[var(--fg-primary)] md:text-5xl">
                {caption.headline}
              </h1>
              {caption.sub && (
                <p className="max-w-[44ch] text-balance text-base text-[var(--fg-secondary)] md:text-lg">
                  {caption.sub}
                </p>
              )}
            </motion.div>

            {/* Right — receipt, anchored toward top so the bottom of the
                viewport stays clear for the tx-010 card morphing in. */}
            <motion.div
              className="col-span-7 flex h-full items-start justify-center overflow-hidden pt-2"
              initial={{ opacity: 0, y: 60, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0.34, 1] }}
            >
              <ReceiptOCRScaled />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReceiptOCRScaled() {
  const ms = useElapsedMs();
  return (
    <div
      style={{
        transform: "scale(0.85)",
        transformOrigin: "top center",
      }}
    >
      <ReceiptOCR regions={RECEIPT_OCR} elapsedMs={ms} durationMs={6500} />
    </div>
  );
}

// ─── Bunq sub-accounts stage — uses the launch-route component ───────────
//
// Shows 4 bunq Business sub-accounts (Operating, Carbon Reserve, Tax,
// Payroll). Animates a €412 puck from Operating → Carbon Reserve over ~2s,
// then a Puro.earth credit-retirement chip drops in. This is the visual
// proof of the sub-account auto-funding mechanism (lib/bunq/payments.ts +
// lib/policy/evaluate.ts) — the policy DSL computes the EUR amount, the
// signed bunq client moves the money intra-user, the audit chain logs it.

export function BunqSubAccountsFrame({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="bunq-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <BunqSubAccountsScaled />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BunqSubAccountsScaled() {
  const ms = useElapsedMs();
  return (
    <div
      style={{
        width: 760,
        height: 460,
        transform: "scale(0.92)",
        transformOrigin: "center center",
      }}
    >
      <BunqSubAccountsStage
        elapsedMs={ms}
        proposeAt={300}
        transferStart={1500}
        transferArrive={3500}
        creditAt={4500}
      />
    </div>
  );
}

// ─── Stage 10 — Ask (closing) ────────────────────────────────────────────
export function AskFrame({ visible }: { visible: boolean }) {
  // Top recommendations get listed in the closing frame so the pitch ends
  // on something concrete.
  const top3 = RECOMMENDATIONS.filter(
    (r) => r.verdict === "approved" && r.savingEur > 0,
  ).slice(0, 3);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ask"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center px-12"
        >
          <div className="flex w-full max-w-3xl flex-col gap-8">
            <ul className="flex flex-col gap-4">
              {[
                "One bunq Business enterprise pilot.",
                "An EU carbon-credit registry partner.",
                "Audit-ready CSRD output by month one.",
              ].map((line, i) => (
                <motion.li
                  key={line}
                  className="flex items-baseline gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-button)] px-6 py-5 text-xl text-[var(--fg-primary)] md:text-2xl"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.18 }}
                >
                  <span className="text-[var(--brand-green)]">→</span>
                  {line}
                </motion.li>
              ))}
            </ul>
            <motion.a
              href="https://github.com"
              className="self-center font-mono text-sm uppercase tracking-[0.18em] text-[var(--brand-green)] underline-offset-4 hover:underline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.2 }}
            >
              github.com/carbo →
            </motion.a>
            {top3.length > 0 && (
              <motion.p
                className="mt-2 self-center font-mono text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.4 }}
              >
                Built in 12 hours · bunq Hackathon 7.0
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
