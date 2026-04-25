"use client";

/**
 * BunqSubAccountsStage — the S11P centerpiece. Recreates a bunq Business
 * "Sub-accounts" panel so the viewer literally sees:
 *
 *   1. Where the money lives today  → 4 sub-accounts with IBANs + balances.
 *   2. Where Carbo wants to move it → highlighted Operating ↘ Carbon Reserve route.
 *   3. The actual transfer happens   → a €412 puck arcs along an SVG path from
 *      the Operating row's amount cell to the Carbon Reserve row's amount cell,
 *      both balances counting in lockstep with the puck.
 *
 * Time-driven via `elapsedMs` so the parent scene controls choreography:
 *   proposeAt        → sub-accounts panel fades in
 *   transferStart    → €412 puck launches; balances start animating
 *   transferArrive   → puck lands; Carbon Reserve row flashes settled
 *   creditAt         → Puro.earth retirement chip drops in below
 *
 * No internal RAF — everything derives from elapsedMs so it's scrubber-friendly
 * and identical across playthroughs.
 */

import {
  ArrowDownRight,
  Banknote,
  Building2,
  Check,
  Leaf,
  Receipt,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

// ── Fixture data ─────────────────────────────────────────────────────────────

type AccountRow = {
  id: string;
  name: string;
  description: string;
  iban: string;
  balance: number;
  icon: ReactNode;
};

const ACCOUNTS: AccountRow[] = [
  {
    id: "operating",
    name: "Operating",
    description: "Daily ops · vendors · payroll out",
    iban: "NL12 BUNQ 0001 2345 67",
    balance: 28766.2,
    icon: <Building2 size={16} />,
  },
  {
    id: "carbon",
    name: "Carbon Reserve",
    description: "Climate liabilities · Puro.earth credits",
    iban: "NL12 BUNQ 0042 0420 18",
    balance: 1478.0,
    icon: <Leaf size={16} />,
  },
  {
    id: "tax",
    name: "Tax Reserve",
    description: "VAT + corporate tax",
    iban: "NL12 BUNQ 0035 8801 23",
    balance: 8200.0,
    icon: <Receipt size={16} />,
  },
  {
    id: "payroll",
    name: "Payroll Reserve",
    description: "EUR · monthly run-rate",
    iban: "NL12 BUNQ 0028 4912 09",
    balance: 18400.0,
    icon: <Wallet size={16} />,
  },
];

const FROM_ID = "operating";
const TO_ID = "carbon";
const TRANSFER_AMOUNT = 412.0;

// Layout constants — must agree with the row CSS below. Used to position
// the SVG arc precisely between the from/to amount cells.
const ROW_HEIGHT = 84;
const ROW_GAP = 6;

const FROM_INDEX = ACCOUNTS.findIndex((a) => a.id === FROM_ID);
const TO_INDEX = ACCOUNTS.findIndex((a) => a.id === TO_ID);

// ── Math helpers ─────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function fmtBalance(n: number): string {
  // bunq style: nl-NL formatting (dots for thousands, comma for decimals)
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export type BunqSubAccountsStageProps = {
  /** ms elapsed in the parent scene */
  elapsedMs: number;
  /** When the panel becomes visible (proposal state) */
  proposeAt: number;
  /** When the €412 puck launches (post-approval) */
  transferStart: number;
  /** When the puck arrives at the destination */
  transferArrive: number;
  /** When the Puro.earth credit chip drops in */
  creditAt: number;
};

export function BunqSubAccountsStage({
  elapsedMs,
  proposeAt,
  transferStart,
  transferArrive,
  creditAt,
}: BunqSubAccountsStageProps) {
  // Stage entrance.
  const enterT = easeOutCubic(
    clamp01((elapsedMs - proposeAt) / 360),
  );

  // Whether Carbo's "PROPOSED" route is highlighted (between propose and approve).
  const proposed = elapsedMs >= proposeAt && elapsedMs < transferStart;

  // 0..1 progress of the actual money movement.
  const rawT = (elapsedMs - transferStart) /
    Math.max(1, transferArrive - transferStart);
  const transferT = clamp01(rawT);
  const balanceT = easeInOutCubic(transferT);

  const transferring = elapsedMs >= transferStart && elapsedMs < transferArrive;
  const settled = elapsedMs >= transferArrive;
  const showCredit = elapsedMs >= creditAt;

  // Total assets ticker — reflects no net change (money just moves between
  // sub-accounts) but ticks visually so it feels live.
  const totalBalance = ACCOUNTS.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-canvas)",
        opacity: 0.4 + 0.6 * enterT,
        transform: `translateY(${(1 - enterT) * 8}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* ── Header strip ─────────────────────────────────────────────────── */}
      <Header
        totalBalance={totalBalance}
        proposed={proposed}
        transferring={transferring}
        settled={settled}
      />

      {/* ── Account rows ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "20px 80px 24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 8,
          }}
        >
          <CodeLabel>SUB-ACCOUNTS · 4 ACTIVE</CodeLabel>
          <CodeLabel muted>
            ROUTE · {fmtBalance(TRANSFER_AMOUNT)} EUR · OPERATING ↘ CARBON RESERVE
          </CodeLabel>
        </div>

        {/* The rows live in a positioning context so the SVG arc can overlay
            them precisely, regardless of how the column wraps in the camera. */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: ROW_GAP,
            }}
          >
            {ACCOUNTS.map((acc, i) => {
              const isFrom = acc.id === FROM_ID;
              const isTo = acc.id === TO_ID;
              const balance = isFrom
                ? acc.balance - TRANSFER_AMOUNT * balanceT
                : isTo
                  ? acc.balance + TRANSFER_AMOUNT * balanceT
                  : acc.balance;
              return (
                <Row
                  key={acc.id}
                  index={i}
                  acc={acc}
                  balance={balance}
                  isFrom={isFrom}
                  isTo={isTo}
                  proposed={proposed}
                  transferring={transferring}
                  settled={settled}
                />
              );
            })}
          </div>

          {/* SVG arc + flying €412 puck — sits on top of the rows. */}
          <TransferArc
            transferT={transferT}
            fromIndex={FROM_INDEX}
            toIndex={TO_INDEX}
            totalRows={ACCOUNTS.length}
            visible={transferring || settled}
            settled={settled}
          />
        </div>

        {/* Puro.earth credit chip — drops in after settle. */}
        <PuroCreditChip elapsedMs={elapsedMs - creditAt} visible={showCredit} />
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Header({
  totalBalance,
  proposed,
  transferring,
  settled,
}: {
  totalBalance: number;
  proposed: boolean;
  transferring: boolean;
  settled: boolean;
}) {
  const status = settled
    ? { tone: "var(--brand-green)", label: "TRANSFER SETTLED · 12:13:01" }
    : transferring
      ? { tone: "var(--status-warning)", label: "MOVING €412.00 · LIVE" }
      : proposed
        ? { tone: "var(--status-warning)", label: "AWAITING APPROVAL · DRY_RUN" }
        : { tone: "var(--fg-muted)", label: "IDLE" };

  return (
    <div
      style={{
        padding: "20px 28px 16px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--fg-muted)",
            marginBottom: 6,
          }}
        >
          <Banknote size={12} />
          <CodeLabel>BUNQ BUSINESS · APRIL 2026</CodeLabel>
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.018em",
            color: "var(--fg-primary)",
            margin: 0,
          }}
        >
          Sub-accounts
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <CodeLabel muted>TOTAL ASSETS</CodeLabel>
        <span
          style={{
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: "var(--fg-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          € {fmtBalance(totalBalance)}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            paddingLeft: 10,
            paddingRight: 10,
            height: 22,
            borderRadius: 9999,
            border: `1px solid ${status.tone}`,
            color: status.tone,
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 10.5,
            letterSpacing: "1.2px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: 9999,
              background: status.tone,
              animation:
                transferring || proposed
                  ? "ca-pulse-soft 1.4s ease-in-out infinite"
                  : undefined,
            }}
          />
          {status.label}
        </span>
      </div>
    </div>
  );
}

function Row({
  index,
  acc,
  balance,
  isFrom,
  isTo,
  proposed,
  transferring,
  settled,
}: {
  index: number;
  acc: AccountRow;
  balance: number;
  isFrom: boolean;
  isTo: boolean;
  proposed: boolean;
  transferring: boolean;
  settled: boolean;
}) {
  const involved = isFrom || isTo;

  // Border tone shifts by stage:
  //   idle / not involved   → faint
  //   proposed (Carbo lined it up, waiting on user)  → warning amber dashed for the route
  //   transferring          → warning solid
  //   settled               → strong (from) / brand green (to)
  const borderColor = !involved
    ? "var(--border-faint)"
    : settled && isTo
      ? "var(--brand-green)"
      : settled && isFrom
        ? "var(--border-strong)"
        : transferring
          ? "var(--status-warning)"
          : proposed
            ? "var(--brand-green-border)"
            : "var(--border-default)";

  const accentTone = isTo ? "var(--brand-green)" : "var(--status-warning)";

  // Delta label — visible during transfer + settle.
  const deltaSign = isFrom ? "−" : "+";
  const deltaActive = transferring || settled;
  const showDelta = involved && deltaActive;

  return (
    <div
      style={{
        position: "relative",
        height: ROW_HEIGHT,
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        alignItems: "center",
        gap: 16,
        padding: "0 18px",
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: involved
          ? settled && isTo
            ? "rgba(62, 207, 142, 0.05)"
            : transferring
              ? "rgba(247, 185, 85, 0.04)"
              : proposed
                ? "rgba(62, 207, 142, 0.025)"
                : "var(--bg-canvas)"
          : "var(--bg-canvas)",
        transition: "border-color 320ms ease-out, background 320ms ease-out",
      }}
    >
      {/* Left accent strip — only on the two involved rows. */}
      {involved ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            bottom: 10,
            width: 2,
            borderRadius: 9999,
            background:
              settled && isTo
                ? "var(--brand-green)"
                : transferring
                  ? "var(--status-warning)"
                  : proposed
                    ? "var(--brand-green)"
                    : "transparent",
            opacity: settled && isFrom ? 0.4 : 1,
            transition: "background 320ms ease-out, opacity 320ms ease-out",
          }}
        />
      ) : null}

      {/* Icon disc */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: involved
            ? settled && isTo
              ? "rgba(62, 207, 142, 0.14)"
              : "rgba(247, 185, 85, 0.10)"
            : "var(--bg-inset)",
          color: involved
            ? settled && isTo
              ? "var(--brand-green)"
              : "var(--status-warning)"
            : "var(--fg-muted)",
          transition: "background 320ms ease-out, color 320ms ease-out",
        }}
      >
        {acc.icon}
      </div>

      {/* Identity */}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: "var(--fg-primary)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {acc.name}
          </span>
          {isFrom ? (
            <RouteTag
              label="FROM"
              tone={settled ? "muted" : "warning"}
              proposed={proposed}
            />
          ) : null}
          {isTo ? (
            <RouteTag
              label="TO"
              tone={settled ? "success" : "warning"}
              proposed={proposed}
            />
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.4px",
            color: "var(--fg-muted)",
            minWidth: 0,
          }}
        >
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {acc.iban}
          </span>
          <span
            aria-hidden
            style={{
              width: 3,
              height: 3,
              borderRadius: 9999,
              background: "var(--fg-faint)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: 12,
              color: "var(--fg-secondary)",
              letterSpacing: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {acc.description}
          </span>
        </div>
      </div>

      {/* Amount cell — anchor for the SVG arc. */}
      <div
        data-account-amount={acc.id}
        style={{
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          minWidth: 180,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: involved
              ? settled && isTo
                ? "var(--brand-green)"
                : "var(--fg-primary)"
              : "var(--fg-primary)",
            fontVariantNumeric: "tabular-nums",
            transition: "color 320ms ease-out",
          }}
        >
          € {fmtBalance(balance)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 10.5,
            letterSpacing: "1.1px",
            color: showDelta ? accentTone : "var(--fg-faint)",
            fontVariantNumeric: "tabular-nums",
            opacity: showDelta ? 1 : 0,
            transform: `translateY(${showDelta ? 0 : -2}px)`,
            transition: "opacity 220ms ease-out, transform 220ms ease-out",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {settled && isTo ? <Check size={11} strokeWidth={2.5} /> : null}
          {showDelta
            ? `${deltaSign} € ${fmtBalance(TRANSFER_AMOUNT)}`
            : "·"}
        </span>
      </div>
    </div>
  );
}

function RouteTag({
  label,
  tone,
  proposed,
}: {
  label: "FROM" | "TO";
  tone: "warning" | "success" | "muted";
  proposed: boolean;
}) {
  const palette =
    tone === "success"
      ? { fg: "var(--brand-green)", border: "var(--brand-green)" }
      : tone === "warning"
        ? { fg: "var(--status-warning)", border: "var(--status-warning)" }
        : { fg: "var(--fg-muted)", border: "var(--border-default)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 18,
        padding: "0 7px",
        borderRadius: 9999,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 9.5,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        background: proposed ? "transparent" : "transparent",
      }}
    >
      {label}
    </span>
  );
}

/**
 * SVG arc + flying puck.
 *
 * The arc connects the right edge of the FROM row to the right edge of the TO
 * row, dipping outward (rightward) into the Stage's right padding so it reads
 * as money lifting up out of one account and landing into another. Both the
 * SVG path and the puck are pinned via `right: -ARC_OFFSET` so they overflow
 * the rows wrapper into the breathing room reserved for them.
 */
const ARC_DIP_X = 40;
const ARC_OFFSET = ARC_DIP_X + 16;

function TransferArc({
  transferT,
  fromIndex,
  toIndex,
  totalRows,
  visible,
  settled,
}: {
  transferT: number;
  fromIndex: number;
  toIndex: number;
  totalRows: number;
  visible: boolean;
  settled: boolean;
}) {
  // Coordinates inside the rows-container's bounding box.
  const fromY = fromIndex * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
  const toY = toIndex * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
  const midY = (fromY + toY) / 2;

  // Total height of the rows column (matches our positioning context).
  const totalHeight = totalRows * ROW_HEIGHT + (totalRows - 1) * ROW_GAP;

  // Quadratic bezier evaluation. Anchors are at x=0 (the rows wrapper's right
  // edge); control point is at (ARC_DIP_X, midY) — rightward in SVG coords.
  const t = transferT;
  const oneMinusT = 1 - t;
  const x = 2 * oneMinusT * t * ARC_DIP_X;
  const y =
    oneMinusT * oneMinusT * fromY +
    2 * oneMinusT * t * midY +
    t * t * toY;

  // Reveal the path as the puck travels. Use a generous over-estimate of the
  // path length so dasharray "gap" cleanly chases the puck.
  const totalLen = Math.abs(toY - fromY) + ARC_DIP_X * 2 + 64;
  const dash = totalLen * t;
  const gap = totalLen - dash;

  // Puck visibility — show during transit, plus a brief overshoot tail when
  // settled so the green flash lands on the destination row.
  const showPuck = visible && t > 0.001 && t < 0.999 && !settled;

  return (
    <>
      {/* SVG arc — overflows rightward into the Stage's right padding. */}
      <svg
        aria-hidden
        width={ARC_OFFSET}
        height={totalHeight}
        viewBox={`0 0 ${ARC_OFFSET} ${totalHeight}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          right: -ARC_OFFSET,
          top: 0,
          width: ARC_OFFSET,
          height: totalHeight,
          pointerEvents: "none",
          overflow: "visible",
          opacity: visible ? 1 : 0,
          transition: "opacity 260ms ease-out",
        }}
      >
        {/* Faint full route (always visible while arc is active) */}
        <path
          d={`M 0 ${fromY} Q ${ARC_DIP_X} ${midY} 0 ${toY}`}
          fill="none"
          stroke="var(--brand-green-border)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {/* Progress trail */}
        <path
          d={`M 0 ${fromY} Q ${ARC_DIP_X} ${midY} 0 ${toY}`}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ filter: "drop-shadow(0 0 6px rgba(62, 207, 142, 0.45))" }}
        />
      </svg>

      {/* Anchor element at top-right of rows; puck offsets via transform. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))`,
            opacity: showPuck ? 1 : 0,
            transition: "opacity 160ms ease-out",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 9999,
            background: "var(--brand-green)",
            color: "#08140c",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            boxShadow:
              "0 0 0 4px rgba(62, 207, 142, 0.20), 0 8px 24px rgba(62, 207, 142, 0.40)",
            whiteSpace: "nowrap",
          }}
        >
          <ArrowDownRight size={13} strokeWidth={2.5} />
          € {fmtBalance(TRANSFER_AMOUNT)}
        </div>
      </div>
    </>
  );
}

function PuroCreditChip({
  elapsedMs,
  visible,
}: {
  elapsedMs: number;
  visible: boolean;
}) {
  const enterT = visible ? clamp01(elapsedMs / 360) : 0;
  const eased = easeOutCubic(enterT);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        border: "1px solid var(--brand-green-border)",
        background: "rgba(62, 207, 142, 0.04)",
        opacity: eased,
        transform: `translateY(${(1 - eased) * 10}px)`,
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(62, 207, 142, 0.14)",
          color: "var(--brand-green)",
          flexShrink: 0,
        }}
      >
        <Leaf size={14} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "var(--fg-primary)",
              lineHeight: 1.2,
            }}
          >
            Puro.earth · 2.84 tCO₂e retired
          </span>
          <span
            style={{
              fontFamily:
                "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.6px",
              color: "var(--fg-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ID PURO-2026-04-25-A1F2
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: "var(--fg-secondary)",
            lineHeight: 1.3,
          }}
        >
          Gelderland Biochar Initiative · removal · &gt;100yr permanence
        </div>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 24,
          padding: "0 10px",
          borderRadius: 9999,
          border: "1px solid var(--brand-green)",
          color: "var(--brand-green)",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 10.5,
          letterSpacing: "1.2px",
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        <Check size={11} strokeWidth={2.5} />
        RETIRED
      </span>
    </div>
  );
}

// Local CodeLabel (avoids needing to bring in @/components/ui in this scene).
function CodeLabel({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: muted ? "var(--fg-faint)" : "var(--fg-muted)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </span>
  );
}
