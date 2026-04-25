"use client";

/**
 * ReceiptOCR — S06.
 *
 * A simulated Albert Heijn paper receipt (printed kassabon) sitting on a dark
 * MacWindow canvas, with a vision-OCR animation overlaid:
 *
 *   1. A 2px brand-green scan line sweeps top→bottom over the first 2.5s.
 *   2. As the scan line crosses a region, that region highlights (yellow
 *      outline + soft yellow fill, 200ms ease-out). Each region also has its
 *      own `delay` — whichever fires LATER wins.
 *   3. 400ms after a region highlights, regions with `liftToSlot` clone
 *      themselves and fly to the right-side EXTRACTED sidebar over 700ms,
 *      with a tiny 1.0→1.15→1.0 spring scale.
 *
 * The receipt body is 360 × 720, rotated -1.5deg, with paper grain (SVG
 * <feTurbulence>), perforated/torn top + bottom edges (SVG path), warm
 * off-white (#f7f3ea), Albert Heijn teal logo, dotted leaders, double-line
 * TOTAAL row, and a deterministic QR-ish footer mark.
 *
 * Region text is positioned ON TOP of the static receipt chrome — the regions
 * ARE the OCR-able fields (merchant, date, items, VAT, total). Static chrome
 * supplies the surrounding decorations: logo, address, prices on items,
 * footer, QR.
 *
 * The receipt body's drop-shadow is an explicit DESIGN.md exception: this is
 * a simulated piece of physical paper, not Carbo UI. Carbo-aesthetic surfaces
 * (the EXTRACTED sidebar) still use design tokens.
 */

import { useId, useMemo } from "react";
import type { CSSProperties } from "react";
import type { OCRRegion } from "../types";

type Slot = { x: number; y: number };

type Props = {
  regions: OCRRegion[];
  elapsedMs: number;
  /** Total OCR scene duration (default 13s). Drives lift timing budgeting. */
  durationMs?: number;
  /** Where lifted regions fly to. Defaults to a sidebar list at right. */
  liftSidebarSlots?: Slot[];
};

// ── Timing ────────────────────────────────────────────────────────────────
const SCAN_DURATION_MS = 2500;
const HIGHLIGHT_FADE_MS = 200;
const LIFT_DELAY_MS = 400;
const LIFT_DURATION_MS = 700;

// ── Paper geometry ────────────────────────────────────────────────────────
const RECEIPT_W = 360;
const RECEIPT_H = 720;
const RECEIPT_ROTATE = -1.5; // deg, slight tilt for natural feel
const PAPER_FILL = "#f7f3ea"; // warm off-white
const PAPER_INK = "#1a1a1a"; // near-black ink
const PAPER_INK_2 = "#2a2a2a"; // store name ink
const PAPER_INK_3 = "#4a4a4a"; // address ink
const PAPER_INK_4 = "#6a6a6a"; // tertiary, KvK / dashes
const AH_TEAL = "#00ade6"; // Albert Heijn brand teal

// ── Sidebar geometry ──────────────────────────────────────────────────────
const SIDEBAR_W = 300;
const SIDEBAR_GAP = 80; // distance between receipt and sidebar
const SIDEBAR_ROW_H = 48;
const SIDEBAR_ROW_GAP = 6;
const SIDEBAR_PAD_X = 20;
const SIDEBAR_PAD_TOP = 56; // room for "EXTRACTED" header
const SIDEBAR_NUMBER_COL_W = 32; // width of the leading "01" column

// Total horizontal envelope for the scene container.
// We pad the receipt's bounding box for the rotation overhang.
const ROTATION_PAD = 24;

export function ReceiptOCR({
  regions,
  elapsedMs,
  durationMs = 13_000,
  liftSidebarSlots,
}: Props) {
  // Deterministic ids so SSR and CSR agree on filter URLs.
  const grainId = useId();
  const grainFilterId = `grain-${grainId.replace(/[:]/g, "")}`;

  // Order regions by visual top-to-bottom for both rendering and scan timing.
  const ordered = useMemo(
    () => [...regions].sort((a, b) => a.box.y - b.box.y),
    [regions]
  );

  // Regions that get lifted into the sidebar.
  const liftRegions = useMemo(
    () => ordered.filter((r) => r.liftToSlot !== undefined),
    [ordered]
  );

  // Default sidebar slot positions (absolute within the OCR scene container).
  // The slot lands inside each numbered row, just past the "01" column, where
  // the value text actually renders — so the flying clone visually merges with
  // the row's value cell when lift completes.
  const defaultSlots: Slot[] = useMemo(() => {
    const sidebarLeft = ROTATION_PAD + RECEIPT_W + SIDEBAR_GAP;
    const baseX =
      sidebarLeft + SIDEBAR_PAD_X + SIDEBAR_NUMBER_COL_W + 12;
    // Where the value column's text top-left sits inside the first row.
    // Sidebar padding-top (20) + EXTRACTED header (~17) + header margin (20)
    // + (row_h - text_h)/2 = 20 + 17 + 20 + (48-14)/2 = 74. Then add the
    // outer rotation pad to get container coordinates.
    const baseY = ROTATION_PAD + 74;
    const maxSlot = liftRegions.reduce(
      (m, r) => Math.max(m, r.liftToSlot ?? -1),
      -1
    );
    return Array.from({ length: maxSlot + 1 }, (_, i) => ({
      x: baseX,
      y: baseY + i * (SIDEBAR_ROW_H + SIDEBAR_ROW_GAP),
    }));
  }, [liftRegions]);

  const slots = liftSidebarSlots ?? defaultSlots;

  const containerW =
    ROTATION_PAD * 2 + RECEIPT_W + SIDEBAR_GAP + SIDEBAR_W;
  const containerH = Math.max(
    RECEIPT_H + ROTATION_PAD * 2,
    SIDEBAR_PAD_TOP + slots.length * (SIDEBAR_ROW_H + SIDEBAR_ROW_GAP) + 32
  );

  // Static prices, indexed by item region order. Aligned to the items in
  // RECEIPT_OCR (Sla, Yoghurt, Kipfilet, Volkoren, Komkommer, Olijfolie).
  // These are receipt chrome — not OCR-able regions — but they keep the
  // paper looking real. Sum approximately matches the region TOTAAL.
  const itemPrices = useMemo<Record<string, string>>(
    () => ({
      "Sla Eikenblad 200g": "1,79",
      "Volle Yoghurt 1L": "1,49",
      "Kipfilet 500g": "6,49",
      "Volkoren brood": "2,29",
      "Komkommer · 2x": "1,98",
      "Olijfolie 750ml": "8,99",
    }),
    []
  );

  // Optional sub-lines (e.g. weight/unit price) keyed by item name.
  const itemSublines = useMemo<Record<string, string>>(
    () => ({
      "Kipfilet 500g": "0,500 kg × €12,98/kg",
      "Komkommer · 2x": "2 × €0,99",
    }),
    []
  );

  return (
    <div
      style={{
        position: "relative",
        width: containerW,
        height: containerH,
      }}
    >
      <ReceiptKeyframes />

      {/* Paper grain SVG filter — defined once, referenced by the receipt
          body and the grain overlay. */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <filter id={grainFilterId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={2}
              stitchTiles="stitch"
              seed={4}
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"
            />
          </filter>
        </defs>
      </svg>

      {/* The paper receipt — rotated, centered. */}
      <div
        style={{
          position: "absolute",
          left: ROTATION_PAD,
          top: ROTATION_PAD,
          width: RECEIPT_W,
          height: RECEIPT_H,
          transform: `rotate(${RECEIPT_ROTATE}deg)`,
          transformOrigin: "50% 50%",
          // EXCEPTION to DESIGN.md no-shadows: simulated physical paper, not
          // Carbo UI surface. Justified to make the receipt float in the
          // dark MacWindow interior.
          filter:
            "drop-shadow(0 30px 40px rgba(0, 0, 0, 0.55)) drop-shadow(0 8px 12px rgba(0, 0, 0, 0.35))",
          willChange: "transform",
        }}
      >
        {/* Outer SVG draws the perforated edges — this defines the actual
            paper silhouette via a clip-path on the <foreignObject>. */}
        <PaperSilhouette
          grainFilterId={grainFilterId}
          itemPrices={itemPrices}
          itemSublines={itemSublines}
          ordered={ordered}
          elapsedMs={elapsedMs}
          durationMs={durationMs}
        />
      </div>

      {/* The EXTRACTED sidebar — receives lifted clones */}
      <ExtractedSidebar
        regions={liftRegions}
        slots={slots}
        elapsedMs={elapsedMs}
      />

      {/* Lifted clones — animate from receipt position to sidebar slot.
          These live OUTSIDE the rotated paper so they fly in screen space.
          Once the lift settles (progress = 1) we hand off the value to the
          sidebar row and unmount the clone, so the value never appears
          twice in the same place. */}
      {liftRegions.map((region) => {
        const triggerAt = computeRegionTriggerAt(region);
        const liftAt = triggerAt + LIFT_DELAY_MS;
        if (elapsedMs < liftAt) return null;
        const slotIdx = region.liftToSlot ?? 0;
        const slot = slots[slotIdx];
        if (!slot) return null;
        const rawProgress = (elapsedMs - liftAt) / LIFT_DURATION_MS;
        // Once the clone has fully landed, the sidebar row owns the text.
        // We unmount the clone slightly before the visual handoff completes
        // (the sidebar row fades in over 200ms starting at the same instant)
        // to avoid a 1-frame double-render on top of the row's value cell.
        if (rawProgress >= 1) return null;
        const liftProgress = clamp01(rawProgress);

        // Origin in container coordinates: percent of receipt → px, then
        // offset by the rotation pad. We approximate the rotation by ignoring
        // it for the start point — the rotation is small (-1.5deg) so the
        // drift is < 4px and reads as natural.
        const fromX = ROTATION_PAD + (region.box.x / 100) * RECEIPT_W + 4;
        const fromY =
          ROTATION_PAD + (region.box.y / 100) * RECEIPT_H + 6;

        // Spring scale: 1.0 → 1.15 → 1.0 across the lift
        const scale =
          liftProgress < 0.5
            ? 1 + 0.3 * liftProgress // 1 → 1.15 over first half
            : 1.15 - 0.3 * (liftProgress - 0.5); // 1.15 → 1.0
        const eased = easeOutSpring(liftProgress);
        const cx = fromX + (slot.x - fromX) * eased;
        const cy = fromY + (slot.y - fromY) * eased;
        // Fade out as we land, so the handoff to the sidebar row is seamless.
        const cloneOpacity =
          liftProgress > 0.85 ? Math.max(0, 1 - (liftProgress - 0.85) / 0.15) : 1;

        return (
          <span
            key={`lift-${slotIdx}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${cx}px, ${cy}px) scale(${scale})`,
              transformOrigin: "0 0",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "var(--fg-primary)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 5,
              willChange: "transform",
              fontVariantNumeric: "tabular-nums",
              opacity: cloneOpacity,
            }}
          >
            {region.text}
          </span>
        );
      })}
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Cubic-bezier(0.32, 0.72, 0, 1) close-enough easing for the 700ms lift. */
function easeOutSpring(t: number) {
  // 1 - (1 - t)^3 — standard ease-out cubic, very close to (0.32, 0.72, 0, 1)
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * The trigger time for a region is whichever is later:
 *  - The scan line crossing the region's vertical center.
 *  - The region's own `delay`.
 */
function computeRegionTriggerAt(region: OCRRegion) {
  const yCenterPct = region.box.y + region.box.h / 2; // 0..100
  const scanCrossAt = (yCenterPct / 100) * SCAN_DURATION_MS;
  return Math.max(scanCrossAt, region.delay);
}

/* ── Paper body ─────────────────────────────────────────────────────────── */

/**
 * The paper silhouette. Renders:
 *   - Outer SVG with perforated top + bottom edges (clip-path)
 *   - Paper fill + grain overlay
 *   - Static chrome (logo, address, item prices, dotted leaders, totals
 *     header, footer, QR)
 *   - Dynamic regions (overlaid via percent-positioned absolute boxes)
 *   - Scan line (the green 2px sweeper)
 */
function PaperSilhouette({
  grainFilterId,
  itemPrices,
  itemSublines,
  ordered,
  elapsedMs,
  durationMs,
}: {
  grainFilterId: string;
  itemPrices: Record<string, string>;
  itemSublines: Record<string, string>;
  ordered: OCRRegion[];
  elapsedMs: number;
  durationMs: number;
}) {
  // Build the perforated top & bottom edges as an SVG path that defines the
  // paper silhouette. We use a series of curves (~6px tall) for a torn-paper
  // look. The path is also used as a clip-path on the foreign HTML so the
  // edges appear truly torn.
  const perfPath = useMemo(() => buildPerforationPath(RECEIPT_W, RECEIPT_H), []);

  return (
    <svg
      width={RECEIPT_W}
      height={RECEIPT_H}
      viewBox={`0 0 ${RECEIPT_W} ${RECEIPT_H}`}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`paper-clip-${grainFilterId}`}>
          <path d={perfPath} />
        </clipPath>
      </defs>

      {/* Paper fill */}
      <path d={perfPath} fill={PAPER_FILL} />

      {/* Subtle warm vignette gradient on top */}
      <defs>
        <linearGradient id={`paper-warm-${grainFilterId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f9f5ec" stopOpacity="1" />
          <stop offset="50%" stopColor="#f7f3ea" stopOpacity="1" />
          <stop offset="100%" stopColor="#f3eee3" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={perfPath} fill={`url(#paper-warm-${grainFilterId})`} />

      {/* Grain overlay — a black layer with the noise filter applied */}
      <g clipPath={`url(#paper-clip-${grainFilterId})`}>
        <rect
          x="0"
          y="0"
          width={RECEIPT_W}
          height={RECEIPT_H}
          fill="black"
          filter={`url(#${grainFilterId})`}
        />
      </g>

      {/* All HTML content lives inside a <foreignObject>, clipped to the
          torn-paper silhouette. */}
      <foreignObject
        x="0"
        y="0"
        width={RECEIPT_W}
        height={RECEIPT_H}
        clipPath={`url(#paper-clip-${grainFilterId})`}
      >
        <div
          // @ts-expect-error — xmlns on a div inside foreignObject is valid SVG
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            position: "relative",
            width: RECEIPT_W,
            height: RECEIPT_H,
            color: PAPER_INK,
            fontFamily:
              "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 12,
            lineHeight: 1.4,
            fontVariantNumeric: "tabular-nums",
            overflow: "hidden",
          }}
        >
          {/* ── Static chrome ─────────────────────────────────────────── */}
          <ReceiptHeader />
          <ReceiptMetaRow />
          <ItemPriceLadder
            ordered={ordered}
            itemPrices={itemPrices}
            itemSublines={itemSublines}
          />
          <TotalsChrome />
          <ReceiptFooter />

          {/* ── Dynamic OCR regions — positioned via percent boxes ────── */}
          {ordered.map((region, idx) => {
            const triggerAt = computeRegionTriggerAt(region);
            const highlighted = elapsedMs >= triggerAt;
            const liftAt = triggerAt + LIFT_DELAY_MS;
            const lifting =
              region.liftToSlot !== undefined &&
              elapsedMs >= liftAt &&
              elapsedMs <= durationMs + LIFT_DURATION_MS;
            const liftProgress = lifting
              ? clamp01((elapsedMs - liftAt) / LIFT_DURATION_MS)
              : region.liftToSlot !== undefined && elapsedMs > liftAt
                ? 1
                : 0;
            return (
              <RegionText
                key={`r-${idx}`}
                region={region}
                highlighted={highlighted}
                liftProgress={liftProgress}
              />
            );
          })}

          {/* ── Scan line ──────────────────────────────────────────────── */}
          <ScanLine elapsedMs={elapsedMs} />
        </div>
      </foreignObject>
    </svg>
  );
}

/** Albert Heijn header: teal logo mark + store name + address + KvK. */
function ReceiptHeader() {
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        // Reserve the top ~140px area; merchant region overlays around y=4-12%
        // so the AH logo sits ABOVE the merchant region's text.
      }}
    >
      {/* AH teal logo mark — recognisable enough at 80×32 with weight 500. */}
      <div
        style={{
          width: 80,
          height: 32,
          background: AH_TEAL,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          // Inter 500 reads bold enough at this small size; DESIGN.md forbids
          // weight 700 so we max out at 500 even on a brand mark.
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "0.5px",
        }}
      >
        AH
      </div>
      {/* Address lines reserved as static chrome below the merchant region.
          The merchant region (y≈4-12%) overlays the LOGO area; address sits
          below it, well clear of any region box. */}
      <div style={{ height: 56 }} />
      <div
        style={{
          fontSize: 10,
          color: PAPER_INK_3,
          textAlign: "center",
        }}
      >
        Soestdijkseweg Zuid 234, Bilthoven
      </div>
      <div
        style={{
          fontSize: 9,
          color: PAPER_INK_4,
          textAlign: "center",
        }}
      >
        T 030 220 8800 · KvK 35012085
      </div>
      {/* Dashed separator — full width minus 16px margins */}
      <div
        style={{
          width: RECEIPT_W - 32,
          marginTop: 8,
          borderBottom: `1px dashed ${PAPER_INK_4}`,
        }}
      />
    </div>
  );
}

/** The tiny meta row: date, time, kassa, medewerker. Sits below header. */
function ReceiptMetaRow() {
  return (
    <div
      style={{
        position: "absolute",
        // Pushed below the header's dashed separator (which lands ~y=170 after
        // the address + KvK lines) so the meta row no longer reads as struck
        // through. Sits cleanly above the items list which starts at y=30%.
        top: 196,
        left: 16,
        right: 16,
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 10,
        color: PAPER_INK_3,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>24-04-2026</span>
      <span>14:32</span>
      <span>Kassa 03</span>
      <span>Med. 8821</span>
    </div>
  );
}

/**
 * Item price ladder — renders dotted leader + price on the right edge of
 * each item region, plus optional sub-line (weight / unit price). The item
 * NAME comes from the region; the price is static chrome.
 */
function ItemPriceLadder({
  ordered,
  itemPrices,
  itemSublines,
}: {
  ordered: OCRRegion[];
  itemPrices: Record<string, string>;
  itemSublines: Record<string, string>;
}) {
  // Slight inconsistent vertical spacing for realism — we trust the regions'
  // own y values which are already 6% apart, but we add tiny px jitter on the
  // sub-line to avoid mechanical perfection.
  const items = ordered.filter((r) => r.category === "item");

  return (
    <>
      {items.map((r, i) => {
        const yPx = (r.box.y / 100) * RECEIPT_H;
        const price = itemPrices[r.text];
        const subline = itemSublines[r.text];
        return (
          <div key={`price-${i}`}>
            {/* Dotted leader — a thin row of dots between the item area
                and the price. We render it as a wide div with a dashed
                bottom border that is masked by the region text + price. */}
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                top: yPx + 14,
                height: 1,
                borderBottom: `1px dotted ${PAPER_INK_4}`,
                opacity: 0.65,
                pointerEvents: "none",
              }}
            />
            {/* Price — right-aligned, sits over the leader. */}
            {price ? (
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: yPx + 4,
                  fontSize: 12,
                  color: PAPER_INK,
                  background: PAPER_FILL,
                  paddingLeft: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                €{price}
              </div>
            ) : null}
            {/* Optional sub-line (e.g. unit price) */}
            {subline ? (
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  top: yPx + 18,
                  fontSize: 10,
                  color: PAPER_INK_4,
                  fontStyle: "normal",
                  letterSpacing: "0.3px",
                }}
              >
                {subline}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/**
 * Totals block chrome:
 *   - Subtotal label + price (static)
 *   - "BTW 9% €40,20" comes from the VAT region; we add the BTW 21% line as
 *     static chrome
 *   - TOTAAL row gets a 3px double top border + bigger type
 *   - Bonuskaart spaartegoed line
 */
function TotalsChrome() {
  // Region anchors: vat at y=75%, total at y=82%.
  // Chrome sits in the gaps and around them.
  const subtotalY = (70 / 100) * RECEIPT_H; // above VAT (y=75)
  const btw21Y = (78 / 100) * RECEIPT_H; // between VAT and TOTAAL
  const totalDividerY = (81.5 / 100) * RECEIPT_H; // double rule above TOTAAL
  const bonusY = (89 / 100) * RECEIPT_H; // below TOTAAL

  return (
    <>
      {/* Dashed separator above the totals block */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: subtotalY - 8,
          borderBottom: `1px dashed ${PAPER_INK_4}`,
        }}
      />

      {/* Subtotal — static label + price (region list has no subtotal) */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: subtotalY,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: PAPER_INK_2,
        }}
      >
        <span>Subtotaal</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>€447,00</span>
      </div>

      {/* (Removed: BTW 21% chrome overlapped the BTW 9% region's box at y=75–80%
           — the receipt only carries 9% items, so this line is unneeded.) */}

      {/* Double-rule above TOTAAL — two stacked 1px lines = 3px feel */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: totalDividerY,
          height: 3,
          borderTop: `1px solid ${PAPER_INK}`,
          borderBottom: `1px solid ${PAPER_INK}`,
        }}
      />

      {/* Bonuskaart spaartegoed — small grey line below TOTAAL */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: bonusY,
          fontSize: 10,
          color: PAPER_INK_4,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>AH Bonuskaart spaartegoed</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>€4,82</span>
      </div>
    </>
  );
}

/** Footer: thank-you line + small QR-code-like square pattern. */
function ReceiptFooter() {
  // Generate a deterministic 12×12 grid from a hash of a fixed seed string.
  // This isn't a real QR code; it's visual flavour that always renders the
  // same pattern across re-renders.
  const cells = useMemo(() => buildQrPattern("albert-heijn-2026-04-24", 12), []);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: (94 / 100) * RECEIPT_H,
          textAlign: "center",
          fontSize: 10,
          color: PAPER_INK_3,
          letterSpacing: "0.5px",
        }}
      >
        Bedankt voor uw bezoek bij Albert Heijn
      </div>
      {/* QR-like 12×12 grid */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: (97 / 100) * RECEIPT_H,
          transform: "translateX(-50%)",
          display: "grid",
          gridTemplateColumns: "repeat(12, 2px)",
          gridTemplateRows: "repeat(12, 2px)",
          gap: 0,
        }}
        aria-hidden="true"
      >
        {cells.map((on, i) => (
          <div
            key={`qr-${i}`}
            style={{
              width: 2,
              height: 2,
              background: on ? PAPER_INK : "transparent",
            }}
          />
        ))}
      </div>
    </>
  );
}

/* ── Region text ────────────────────────────────────────────────────────── */

function RegionText({
  region,
  highlighted,
  liftProgress,
}: {
  region: OCRRegion;
  highlighted: boolean;
  liftProgress: number;
}) {
  const isHeader = region.category === "merchant";
  const isTotal = region.category === "total";
  const isVat = region.category === "vat";
  const isItem = region.category === "item";

  // Once the lift is essentially complete (>0.95) the original text disappears
  // entirely — leaving a 0.18 ghost was creating a doubled/struck-through look
  // when the dotted leader showed through behind faded item text. Hard cut to 0
  // also kills the merchant/date/total ghosts on the receipt body.
  const sourceOpacity = liftProgress > 0.95 ? 0 : 1;

  // Visual treatment per category — different from the chrome but still
  // readable as ink on paper.
  const fontSize = isHeader ? 16 : isTotal ? 14 : isVat ? 12 : 12;
  const fontWeight = isHeader || isTotal ? 500 : 400;
  const color = isHeader ? PAPER_INK_2 : PAPER_INK;

  // Total uses tabular-nums and right-aligns its price; we keep it as a
  // single string from the region for the OCR animation, but justify it.
  const justify = isTotal || isVat ? "space-between" : "flex-start";

  const containerStyle: CSSProperties = {
    position: "absolute",
    left: `${region.box.x}%`,
    top: `${region.box.y}%`,
    width: `${region.box.w}%`,
    height: `${region.box.h}%`,
    display: "flex",
    alignItems: "center",
    justifyContent: justify,
    paddingLeft: isHeader ? 0 : 4,
    paddingRight: isHeader ? 0 : 4,
    fontSize,
    fontWeight,
    color,
    background: "rgba(247, 185, 85, 0)",
    border: "1.5px solid rgba(247, 185, 85, 0)",
    borderRadius: 3,
    boxSizing: "border-box",
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: "opacity 200ms ease-out",
    opacity: sourceOpacity,
    animation: highlighted
      ? `ocr-region-highlight ${HIGHLIGHT_FADE_MS}ms ease-out forwards`
      : undefined,
    fontVariantNumeric: "tabular-nums",
    // Items get a subtle left padding so the dotted leader peeks behind them
    paddingTop: 0,
  };

  // Special handling: TOTAAL and BTW are formatted "LABEL  PRICE" — we split
  // on the price marker so we can right-align the number cleanly while still
  // letting the OCR highlight wrap the entire region.
  if (isTotal || isVat) {
    const text = region.text;
    const euroIdx = text.indexOf("€");
    if (euroIdx > 0) {
      const label = text.slice(0, euroIdx).trim();
      const price = text.slice(euroIdx);
      return (
        <div style={containerStyle}>
          <span>{label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
        </div>
      );
    }
  }

  // Header (merchant) is centered to align with the static logo above it.
  if (isHeader) {
    return (
      <div
        style={{
          ...containerStyle,
          justifyContent: "center",
          letterSpacing: "0.3px",
        }}
      >
        {region.text}
      </div>
    );
  }

  // Items — pad-left a bit to allow visual room for nothing on the left
  // (no bullet marker) and let the dotted leader & price sit on the right.
  if (isItem) {
    return (
      <div
        style={{
          ...containerStyle,
          paddingRight: 60, // reserve room for the price column
          background: containerStyle.background, // keep highlight bg
        }}
      >
        <span
          style={{
            background: PAPER_FILL,
            paddingRight: 6,
            // The bg behind item name occludes the dotted leader directly
            // under the name, leaving leader visible only between name & price.
          }}
        >
          {region.text}
        </span>
      </div>
    );
  }

  return <div style={containerStyle}>{region.text}</div>;
}

/* ── Scan line ──────────────────────────────────────────────────────────── */

function ScanLine({ elapsedMs }: { elapsedMs: number }) {
  if (elapsedMs > SCAN_DURATION_MS + 200) return null;
  const pct = clamp01(elapsedMs / SCAN_DURATION_MS) * 100;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: `${pct}%`,
        height: 2,
        background: "var(--brand-green)",
        // brand-green-soft glow without dragging in a token; matches DESIGN
        // token semantics.
        filter: "drop-shadow(0 0 8px rgba(62, 207, 142, 0.55))",
        boxShadow: "0 0 12px rgba(62, 207, 142, 0.35)",
        pointerEvents: "none",
        zIndex: 3,
        opacity:
          elapsedMs > SCAN_DURATION_MS
            ? Math.max(0, 1 - (elapsedMs - SCAN_DURATION_MS) / 200)
            : 1,
      }}
    />
  );
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

function ExtractedSidebar({
  regions,
  slots,
  elapsedMs,
}: {
  regions: OCRRegion[];
  slots: Slot[];
  elapsedMs: number;
}) {
  const sidebarLeft = ROTATION_PAD + RECEIPT_W + SIDEBAR_GAP;
  const sidebarHeight = Math.max(
    SIDEBAR_PAD_TOP + slots.length * (SIDEBAR_ROW_H + SIDEBAR_ROW_GAP) + 24,
    280
  );

  // Sort once so the row order matches the slot order (0..4).
  const orderedRegions = regions
    .slice()
    .sort((a, b) => (a.liftToSlot ?? 0) - (b.liftToSlot ?? 0));

  // The most recently triggered (still pre-occupied) region is the "active"
  // one — we paint a brand-green left edge on its row to mirror the scan
  // line's progress through the receipt.
  let activeIdx = -1;
  for (let i = 0; i < orderedRegions.length; i++) {
    const triggerAt = computeRegionTriggerAt(orderedRegions[i]);
    if (elapsedMs >= triggerAt) activeIdx = i;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: sidebarLeft,
        top: ROTATION_PAD,
        width: SIDEBAR_W,
        height: sidebarHeight,
        // Slightly elevated dark surface to read against the MacWindow's
        // #171717 interior. Not pure canvas — we want a card feel.
        background: "#1f1f1f",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: `20px ${SIDEBAR_PAD_X}px`,
        color: "var(--fg-primary)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily:
            "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          marginBottom: 20,
        }}
      >
        Extracted via vision
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SIDEBAR_ROW_GAP,
        }}
      >
        {orderedRegions.map((region, i) => {
          const triggerAt = computeRegionTriggerAt(region);
          const liftAt = triggerAt + LIFT_DELAY_MS;
          // The sidebar row is "occupied" once the lift has essentially
          // settled. Until then we show an empty placeholder row.
          const occupied = elapsedMs >= liftAt + LIFT_DURATION_MS - 100;
          const isActive = i === activeIdx && !occupied;
          const slotIdx = region.liftToSlot ?? i;
          return (
            <SidebarRow
              key={`slot-${slotIdx}`}
              index={slotIdx + 1}
              text={region.text}
              occupied={occupied}
              active={isActive}
            />
          );
        })}
      </div>
    </div>
  );
}

function SidebarRow({
  index,
  text,
  occupied,
  active,
}: {
  index: number;
  text: string;
  occupied: boolean;
  active: boolean;
}) {
  // Two-digit, leading-zero number — Source Code Pro, uppercase tracking,
  // muted by default, brand-green when occupied. Borrowed from DESIGN.md
  // §3.2 "Code Label" + KPI label conventions.
  const numLabel = String(index).padStart(2, "0");
  const accent = occupied
    ? "var(--brand-green)"
    : active
      ? "var(--brand-green)"
      : "transparent";

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: `${SIDEBAR_NUMBER_COL_W}px 1fr`,
        alignItems: "center",
        gap: 12,
        height: SIDEBAR_ROW_H,
        padding: "0 4px 0 12px",
        borderRadius: 6,
        background: occupied
          ? "rgba(62, 207, 142, 0.04)"
          : active
            ? "var(--bg-inset)"
            : "transparent",
        transition:
          "background 250ms ease-out, color 250ms ease-out",
      }}
    >
      {/* 2px brand-green left edge when occupied or active — the row's only
          accent. Mirrors the sidebar nav active state in DESIGN.md §4.6. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 2,
          background: accent,
          borderRadius: 2,
          opacity: accent === "transparent" ? 0 : 1,
          transition: "opacity 250ms ease-out, background 250ms ease-out",
        }}
      />
      {/* "01" — Source Code Pro 12, uppercase, 1.2px tracking */}
      <div
        style={{
          fontFamily:
            "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: occupied ? "var(--fg-secondary)" : "var(--fg-faint)",
          fontVariantNumeric: "tabular-nums",
          transition: "color 250ms ease-out",
        }}
      >
        {numLabel}
      </div>
      {/* The value — Inter 14, weight 400. Hidden until the row is
          occupied so it can't read as duplicated against the flying clone. */}
      <div
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 400,
          color: occupied ? "var(--fg-primary)" : "var(--fg-faint)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontVariantNumeric: "tabular-nums",
          opacity: occupied ? 1 : 0,
          transition: "opacity 250ms ease-out, color 250ms ease-out",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/* ── Keyframes ──────────────────────────────────────────────────────────── */

function ReceiptKeyframes() {
  return (
    <style>{`
      @keyframes ocr-region-highlight {
        from { background-color: rgba(247, 185, 85, 0); border-color: rgba(247, 185, 85, 0); }
        to   { background-color: rgba(247, 185, 85, 0.18); border-color: rgba(247, 185, 85, 1); }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes ocr-region-highlight {
          from, to { background-color: rgba(247, 185, 85, 0.10); border-color: rgba(247, 185, 85, 0.85); }
        }
      }
    `}</style>
  );
}

/* ── Geometry helpers ───────────────────────────────────────────────────── */

/**
 * Build the SVG path for a paper rectangle with perforated/torn top + bottom
 * edges. The sides are straight; top and bottom use a series of small curves
 * (~6px tall) for a tactile torn-paper look.
 *
 * Path is closed and suitable for both fill and clip-path.
 */
function buildPerforationPath(w: number, h: number): string {
  const PERF_H = 6;
  const TOOTH_W = 12;
  const teeth = Math.floor(w / TOOTH_W);
  const adjW = teeth * TOOTH_W; // ensure exact tiling
  // We'll center any leftover horizontally
  const xOffset = (w - adjW) / 2;

  // Top edge: start at top-left of the perf zone, then series of curves
  // alternating up and down to make a torn look.
  let topPath = `M ${xOffset},${PERF_H} `;
  for (let i = 0; i < teeth; i++) {
    const x0 = xOffset + i * TOOTH_W;
    const x1 = x0 + TOOTH_W / 2;
    const x2 = x0 + TOOTH_W;
    // Up-bump then down-bump for a wavy torn look. Use Q (quadratic).
    const upY = i % 2 === 0 ? 0 : 3;
    const ctlY = i % 2 === 0 ? -2 : 5;
    topPath += `Q ${x1},${ctlY} ${x2},${upY} `;
  }
  // Right side
  topPath += `L ${xOffset + adjW},${h - PERF_H} `;

  // Bottom edge: mirror, going right-to-left
  for (let i = teeth - 1; i >= 0; i--) {
    const x0 = xOffset + i * TOOTH_W;
    const x1 = x0 + TOOTH_W / 2;
    const upY = i % 2 === 0 ? h : h - 3;
    const ctlY = i % 2 === 0 ? h + 2 : h - 5;
    topPath += `Q ${x1},${ctlY} ${x0},${upY} `;
  }
  // Left side back to start
  topPath += `L ${xOffset},${PERF_H} Z`;

  return topPath;
}

/**
 * Produce a deterministic 12×12 boolean grid from a string seed. Not a real
 * QR code — just a recognisable square pattern with consistent visual weight.
 */
function buildQrPattern(seed: string, size: number): boolean[] {
  // Tiny mulberry32-style PRNG keyed off the seed hash.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }

  const cells: boolean[] = [];
  let state = h;
  const next = () => {
    // Mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Force the three "finder" corners (top-left, top-right, bottom-left)
      // to be solid 3×3 squares with a 1px ring inside — like a real QR.
      const inTL = x < 3 && y < 3;
      const inTR = x >= size - 3 && y < 3;
      const inBL = x < 3 && y >= size - 3;
      if (inTL || inTR || inBL) {
        // Corner = solid black except inner cell
        const localX = inTR ? x - (size - 3) : x;
        const localY = inBL ? y - (size - 3) : y;
        const isInner = localX === 1 && localY === 1;
        cells.push(!isInner);
      } else {
        cells.push(next() > 0.55);
      }
    }
  }

  return cells;
}
