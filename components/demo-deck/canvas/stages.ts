// Per-stage layouts for every Element on the canvas.
//
// Each Element reads its layout for the current stage from this file.
// Motion's `layoutId` + `layout` props auto-FLIP-animate every transition;
// the only thing that "swaps" cleanly is the Caption.
//
// Coordinate system: percentages of the canvas (0–100). Canvas is 100% × 100%
// of the page area (minus the caption strip + indicator strip).

import type { AgentId, ClusterId, RecId, TxId } from "./data";

export type Pos = { left: string; top: string; width: string; height: string };

export type Shape =
  | "row"
  | "dot"
  | "cluster-member"
  | "rec-chip"
  | "matrix-dot"
  | "hidden";

export type ElementLayout = {
  pos: Pos;
  shape: Shape;
  opacity?: number;
  scale?: number;
  highlight?: boolean;
};

export type Caption = {
  eyebrow: string;
  headline: string;
  sub?: string;
};

export type StageConfig = {
  id: number;
  caption: Caption;
  txs: Partial<Record<TxId, ElementLayout>>;
  receipts: Partial<Record<TxId, ElementLayout>>;
  clusters: Partial<Record<ClusterId, ElementLayout>>;
  agents: Partial<Record<AgentId, ElementLayout>>;
  recs: Partial<Record<RecId, ElementLayout>>;
  frames: {
    hook?: boolean;
    receiptOcr?: boolean;
    dag?: boolean;
    bunqSub?: boolean;
    matrix?: boolean;
    csrdReport?: boolean;
    scale?: boolean;
    co2?: boolean;
    ask?: boolean;
  };
};

const HIDDEN: ElementLayout = {
  pos: { left: "50%", top: "50%", width: "0%", height: "0%" },
  shape: "hidden",
  opacity: 0,
};

// ─── Stage 1: webhook stream ───────────────────────────────────────────────
// 10 tx cards as a vertical list, centered.
const TX_LIST_LEFT = "30%";
const TX_LIST_WIDTH = "40%";
const TX_ROW_H = "6%";

const txRowAt = (index: number): ElementLayout => ({
  pos: {
    left: TX_LIST_LEFT,
    top: `${5 + index * 7}%`,
    width: TX_LIST_WIDTH,
    height: TX_ROW_H,
  },
  shape: "row",
});

const TX_IDS: TxId[] = [
  "tx-001",
  "tx-002",
  "tx-003",
  "tx-004",
  "tx-005",
  "tx-006",
  "tx-007",
  "tx-008",
  "tx-009",
  "tx-010",
];

// Stage 3 cluster member positions (around each centroid).
// Centroids are aligned with cluster halos (see CLUSTER_LAYOUTS).
const CLUSTER_CENTROIDS: Record<ClusterId, { left: number; top: number }> = {
  logistics: { left: 25, top: 36 },
  travel: { left: 75, top: 36 },
  goods: { left: 25, top: 76 },
  cloud: { left: 75, top: 76 },
};

const TX_TO_CLUSTER: Record<TxId, ClusterId> = {
  "tx-001": "logistics",
  "tx-002": "logistics",
  "tx-003": "logistics",
  "tx-004": "travel",
  "tx-005": "travel",
  "tx-006": "goods",
  "tx-007": "goods",
  "tx-010": "goods", // Albert Heijn — the receipt OCR'd in step 2
  "tx-008": "cloud",
  "tx-009": "cloud",
};

// Pre-computed offsets so cluster members sit in a clean ROW at the bottom
// of the halo, beneath the cluster label + stats. v3.2: previously the
// dots were scattered around the centroid and overlapped the text.
const TX_OFFSETS: Record<TxId, { dx: number; dy: number }> = {
  "tx-001": { dx: -4, dy: 8 }, // logistics 1
  "tx-002": { dx: 0, dy: 8 }, // logistics 2
  "tx-003": { dx: 4, dy: 8 }, // logistics 3
  "tx-004": { dx: -3, dy: 8 }, // travel 1
  "tx-005": { dx: 3, dy: 8 }, // travel 2
  "tx-006": { dx: -4, dy: 8 }, // goods 1
  "tx-007": { dx: 0, dy: 8 }, // goods 2
  "tx-010": { dx: 4, dy: 8 }, // goods 3 (Albert Heijn — moved from cloud)
  "tx-008": { dx: -3, dy: 8 }, // cloud 1
  "tx-009": { dx: 3, dy: 8 }, // cloud 2
};

const txClusterMemberAt = (id: TxId): ElementLayout => {
  const c = CLUSTER_CENTROIDS[TX_TO_CLUSTER[id]];
  const o = TX_OFFSETS[id];
  return {
    pos: {
      left: `${c.left + o.dx}%`,
      top: `${c.top + o.dy}%`,
      width: "4%",
      height: "2.6%",
    },
    shape: "cluster-member",
  };
};

// v3.4: bumped halo to 30% × 28% (was 22% × 22%) so the cluster label,
// EUR stat, and confidence sub all sit comfortably in the top region with
// the tx-member dots (positioned at dy=+8 from centroid) clearly underneath.
const CLUSTER_HALO_LAYOUT = (id: ClusterId, opacity = 1): ElementLayout => {
  const c = CLUSTER_CENTROIDS[id];
  return {
    pos: {
      left: `${c.left - 15}%`,
      top: `${c.top - 14}%`,
      width: "30%",
      height: "28%",
    },
    shape: "dot",
    opacity,
  };
};

// Reference table for the matrix coordinates. Declared before STAGES so
// `matrixLayoutForApproved` (which references it) doesn't hit the TDZ when
// STAGES initializes.
//
// v3.5: dots are stacked (dot above, label below) and titles live in the
// OUTER corner of each quadrant — so dots stay close to their data points
// without colliding with either the title or each other's labels.
const REC_MATRIX: Record<Exclude<RecId, "rec-steel">, { x: number; y: number }> = {
  "rec-rail": { x: 0.18, y: 0.78 },     // TL — low cost · high carbon
  "rec-rail2": { x: 0.40, y: 0.58 },    // TL — middle, low cost · high carbon
  "rec-fedex": { x: 0.18, y: 0.38 },    // BL — low cost · mid-low carbon
  "rec-sea": { x: 0.74, y: 0.72 },      // TR — high cost · high carbon
  "rec-amazon": { x: 0.62, y: 0.30 },   // BR — mid cost · low carbon (caveats)
};

// Approved + caveat recs as matrix dots. Matrix grid lives in a 60% × 56%
// area centered at (50%, 50%) → spans canvas (20, 22) to (80, 78).
//
// v3.5: stacked layout — dot at top-center of the container, label below.
// The container is positioned so the DOT (not the container origin) lands
// exactly on the data point. Labels never extend horizontally into adjacent
// quadrants, so cross-divider drift is impossible.
function matrixLayoutForApproved(): Partial<Record<RecId, ElementLayout>> {
  const MATRIX = { cx: 50, cy: 50, w: 60, h: 56 };
  const CW = 11; // container width — fits longest shortened label at text-[10px]
  const CH = 7;  // container height — dot (~10px) + label (two lines)
  const positioned: RecId[] = [
    "rec-rail",
    "rec-sea",
    "rec-fedex",
    "rec-rail2",
    "rec-amazon",
  ];
  const out: Partial<Record<RecId, ElementLayout>> = {};
  for (const id of positioned) {
    const r = REC_MATRIX[id as Exclude<RecId, "rec-steel">];
    const cx = MATRIX.cx - MATRIX.w / 2 + r.x * MATRIX.w;
    const cy = MATRIX.cy - MATRIX.h / 2 + (1 - r.y) * MATRIX.h;
    out[id] = {
      pos: {
        // Center container horizontally on data point; dot sits at top of
        // container so the offset on top is small (~0.6%) to align dot center
        // with data y.
        left: `${cx - CW / 2}%`,
        top: `${cy - 0.6}%`,
        width: `${CW}%`,
        height: `${CH}%`,
      },
      shape: "matrix-dot",
    };
  }
  out["rec-steel"] = {
    pos: { left: "50%", top: "50%", width: "0%", height: "0%" },
    shape: "hidden",
    opacity: 0,
  };
  return out;
}

// Stage 8: recs morph into the 3-bar layout. Same recs, redistributed across
// the 3 bar columns so the morph is visually traced.
function scaleLayoutForApproved(): Partial<Record<RecId, ElementLayout>> {
  return {
    "rec-rail": {
      pos: { left: "20%", top: "35%", width: "12%", height: "55%" },
      shape: "matrix-dot",
      opacity: 0,
    },
    "rec-sea": {
      pos: { left: "44%", top: "20%", width: "12%", height: "70%" },
      shape: "matrix-dot",
      opacity: 0,
    },
    "rec-fedex": {
      pos: { left: "68%", top: "10%", width: "12%", height: "80%" },
      shape: "matrix-dot",
      opacity: 0,
    },
    "rec-rail2": {
      pos: { left: "20%", top: "35%", width: "12%", height: "55%" },
      shape: "matrix-dot",
      opacity: 0,
    },
    "rec-amazon": {
      pos: { left: "44%", top: "20%", width: "12%", height: "70%" },
      shape: "matrix-dot",
      opacity: 0,
    },
    "rec-steel": {
      pos: { left: "50%", top: "50%", width: "0%", height: "0%" },
      shape: "hidden",
      opacity: 0,
    },
  };
}

// ─── Stages ────────────────────────────────────────────────────────────────

export const STAGES: StageConfig[] = [
  // 0 — HOOK
  {
    id: 0,
    caption: {
      eyebrow: "Step 0 · The pitch",
      headline: "Carbon accounting that pays for itself.",
      sub: "bunq Hackathon 7.0 · 12-hour build · 4-person team",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {},
    frames: { hook: true },
  },

  // 1 — INGEST: webhook stream of transactions
  // Receipts pre-staged off-canvas right (opacity 0) so the stage 1 → 2
  // transition is a clean horizontal slide-in, not a diagonal pop from center.
  {
    id: 1,
    caption: {
      eyebrow: "Step 1 · Webhook ingest",
      headline: "Every bunq transaction streams into Carbo within a second.",
      sub: "Here's one enterprise client's last quarter — 10 representative lines.",
    },
    txs: Object.fromEntries(TX_IDS.map((id, i) => [id, txRowAt(i)])) as Partial<
      Record<TxId, ElementLayout>
    >,
    receipts: Object.fromEntries(
      TX_IDS.map((id, i) => [
        id,
        {
          pos: {
            left: "115%",
            top: `${5 + i * 7}%`,
            width: "12%",
            height: TX_ROW_H,
          },
          shape: "row" as const,
          opacity: 0,
        },
      ]),
    ) as Partial<Record<TxId, ElementLayout>>,
    clusters: {},
    agents: {},
    recs: {},
    frames: {},
  },

  // 2 — MULTI-MODAL OCR (uses the launch route's ReceiptOCR component).
  //
  // v3.5: stages 1 → 2 are ONE morph, not a slide swap. All 10 tx rows
  // travel together from the centered list to a thin left column. tx-010
  // (Albert Heijn) keeps full opacity and gains a "needs receipt" treatment
  // so the viewer sees WHY the receipt matters; the other 9 fade to 0.12 in
  // their new positions. The receipt OCR scene then rises into the right
  // 65% of the canvas using the deck's standard morph easing — same motion
  // language, no transition-between-pages feel.
  {
    id: 2,
    caption: {
      eyebrow: "Step 2 · One transaction needs more detail",
      headline: "Albert Heijn · €487 — line items, VAT, the date in their format.",
      sub: "Carbo flags any line whose category-confidence drops under 0.55 — this one landed at 0.42 with no sub-category. The receipt fills in the rest, OCR'd live as it lands.",
    },
    txs: Object.fromEntries(
      TX_IDS.map((id, i) => {
        if (id === "tx-010") {
          // Focus card: morphs diagonally from the bottom of the centered
          // list (stage 1) to the BOTTOM-RIGHT of the canvas — visually the
          // artifact that the receipt belongs to. Caption sits opposite, on
          // the LEFT side; receipt fills the upper-right.
          return [
            id,
            {
              pos: { left: "67%", top: "82%", width: "30%", height: "14%" },
              shape: "row" as const,
              opacity: 1,
              highlight: true,
            },
          ];
        }
        // Others fade to nothing in their stage-1 positions — no movement,
        // just dissolve. Positions are kept so stage 2 → 3 morphs them
        // cleanly from the centered list into cluster halos.
        return [id, { ...txRowAt(i), opacity: 0 }];
      }),
    ) as Partial<Record<TxId, ElementLayout>>,
    // Receipts stay parked off-canvas right with opacity 0 — the receipt
    // scene itself is rendered by ReceiptOCRFrame (frames.tsx).
    receipts: Object.fromEntries(
      TX_IDS.map((id, i) => [
        id,
        {
          pos: {
            left: "115%",
            top: `${5 + i * 7}%`,
            width: "12%",
            height: TX_ROW_H,
          },
          shape: "row" as const,
          opacity: 0,
        },
      ]),
    ) as Partial<Record<TxId, ElementLayout>>,
    clusters: {},
    agents: {},
    recs: {},
    frames: { receiptOcr: true },
  },

  // 3 — CLUSTER: tx cards snap into 4 category clusters
  {
    id: 3,
    caption: {
      eyebrow: "Step 3 · Group spend by carbon category",
      headline: "Carbon emissions concentrate in just a few categories.",
      sub: "Carbo groups every transaction so you can see where the real impact lives.",
    },
    txs: Object.fromEntries(
      TX_IDS.map((id) => [id, txClusterMemberAt(id)]),
    ) as Partial<Record<TxId, ElementLayout>>,
    // Slide receipts out off-canvas right (mirror of how they came in).
    receipts: Object.fromEntries(
      TX_IDS.map((id, i) => [
        id,
        {
          pos: {
            left: "115%",
            top: `${5 + i * 7}%`,
            width: "12%",
            height: TX_ROW_H,
          },
          shape: "row" as const,
          opacity: 0,
        },
      ]),
    ) as Partial<Record<TxId, ElementLayout>>,
    clusters: {
      logistics: CLUSTER_HALO_LAYOUT("logistics"),
      travel: CLUSTER_HALO_LAYOUT("travel"),
      goods: CLUSTER_HALO_LAYOUT("goods"),
      cloud: CLUSTER_HALO_LAYOUT("cloud"),
    },
    agents: {},
    recs: {},
    frames: {},
  },

  // 4 — PRIORITIZE: high-impact clusters glow, low-impact dim
  {
    id: 4,
    caption: {
      eyebrow: "Step 4 · Focus on the high-impact clusters",
      headline: "80% of your carbon impact lives in 2 of these 4 clusters.",
      sub: "Carbo asks refinement questions only on those — not on the noise.",
    },
    txs: Object.fromEntries(
      TX_IDS.map((id) => {
        const cluster = TX_TO_CLUSTER[id];
        const dim = cluster === "goods" || cluster === "cloud";
        return [
          id,
          {
            ...txClusterMemberAt(id),
            opacity: dim ? 0.25 : 1,
          },
        ];
      }),
    ) as Partial<Record<TxId, ElementLayout>>,
    receipts: {},
    clusters: {
      logistics: { ...CLUSTER_HALO_LAYOUT("logistics"), highlight: true },
      travel: { ...CLUSTER_HALO_LAYOUT("travel"), highlight: true },
      goods: CLUSTER_HALO_LAYOUT("goods", 0.25),
      cloud: CLUSTER_HALO_LAYOUT("cloud", 0.25),
    },
    agents: {},
    recs: {},
    frames: {},
  },

  // 5 — AGENTS: zoom into Logistics; 3 agents fan out; recs emerge
  {
    id: 5,
    caption: {
      eyebrow: "Step 5 · Three agents work each cluster",
      headline: "Research, green-alt, cost-savings — running in parallel.",
      sub: "Each agent searches the web for greener and cheaper alternatives, then writes its findings as a JSON output.",
    },
    // v3.4: 3-column balanced layout — cluster (left) | agents (middle) |
    // rec outputs (right), each ~25% wide with comfortable padding so the
    // text doesn't cram the cards.
    txs: Object.fromEntries(
      TX_IDS.map((id) => {
        const cluster = TX_TO_CLUSTER[id];
        if (cluster !== "logistics") {
          return [id, { ...txClusterMemberAt(id), opacity: 0 }];
        }
        // Logistics tx dots sit at the bottom of the focus cluster card
        const idx = TX_IDS.filter((t) => TX_TO_CLUSTER[t] === "logistics").indexOf(id);
        return [
          id,
          {
            pos: {
              left: `${10 + idx * 5}%`,
              top: "70%",
              width: "4%",
              height: "2.6%",
            },
            shape: "cluster-member" as const,
          },
        ];
      }),
    ) as Partial<Record<TxId, ElementLayout>>,
    receipts: {},
    clusters: {
      logistics: {
        pos: { left: "5%", top: "20%", width: "25%", height: "60%" },
        shape: "dot",
        highlight: true,
      },
      travel: { ...CLUSTER_HALO_LAYOUT("travel"), opacity: 0 },
      goods: { ...CLUSTER_HALO_LAYOUT("goods"), opacity: 0 },
      cloud: { ...CLUSTER_HALO_LAYOUT("cloud"), opacity: 0 },
    },
    agents: {
      research: {
        pos: { left: "37%", top: "23%", width: "23%", height: "16%" },
        shape: "rec-chip",
      },
      green_alt: {
        pos: { left: "37%", top: "42%", width: "23%", height: "16%" },
        shape: "rec-chip",
      },
      cost_savings: {
        pos: { left: "37%", top: "61%", width: "23%", height: "16%" },
        shape: "rec-chip",
      },
    },
    recs: {
      "rec-rail": {
        pos: { left: "67%", top: "23%", width: "28%", height: "16%" },
        shape: "rec-chip",
      },
      "rec-sea": {
        pos: { left: "67%", top: "42%", width: "28%", height: "16%" },
        shape: "rec-chip",
      },
      "rec-fedex": {
        pos: { left: "67%", top: "61%", width: "28%", height: "16%" },
        shape: "rec-chip",
      },
    },
    frames: {},
  },

  // 6 — DAG WALKTHROUGH (uses the launch route's DagFlow component).
  // Pulls back to the full 8-agent pipeline so the viewer sees what stage 5
  // was a zoom of: Baseline → Research → [Green Alt ‖ Cost Savings] →
  // [Green Judge ‖ Cost Judge] → Credit Strategy → Executive Report.
  {
    id: 6,
    caption: {
      eyebrow: "Step 6 · The 8-agent DAG, end to end",
      headline: "Every cluster runs through the same 8-agent pipeline.",
      sub: "Two parallel pairs (proposers + judges). Code adjudicates the math at every tier.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {},
    frames: { dag: true },
  },

  // 7 — JUDGES: synthesize. Approved go green; rejected fade red.
  {
    id: 7,
    caption: {
      eyebrow: "Step 7 · Each claim gets a verdict",
      headline: "5 approved. 1 with caveats. 1 rejected.",
      sub: "ArcelorMittal's switch was rejected — zero source citations. Even a confident LLM can't push it through.",
    },
    txs: {}, // tx fade — focus is on the verdict column
    receipts: {},
    clusters: {
      logistics: { ...CLUSTER_HALO_LAYOUT("logistics"), opacity: 0 },
      travel: { ...CLUSTER_HALO_LAYOUT("travel"), opacity: 0 },
      goods: { ...CLUSTER_HALO_LAYOUT("goods"), opacity: 0 },
      cloud: { ...CLUSTER_HALO_LAYOUT("cloud"), opacity: 0 },
    },
    // Agents fade out completely — they did their job in stage 5; their lingering
    // presence in v3.0 made the slide feel cluttered.
    agents: {
      research: {
        pos: { left: "10%", top: "50%", width: "0%", height: "0%" },
        shape: "hidden",
        opacity: 0,
      },
      green_alt: {
        pos: { left: "10%", top: "50%", width: "0%", height: "0%" },
        shape: "hidden",
        opacity: 0,
      },
      cost_savings: {
        pos: { left: "10%", top: "50%", width: "0%", height: "0%" },
        shape: "hidden",
        opacity: 0,
      },
    },
    // Recs centered. Wider chips so a stranger can read every title + saving.
    recs: {
      "rec-rail": {
        pos: { left: "20%", top: "8%", width: "60%", height: "12%" },
        shape: "rec-chip",
      },
      "rec-rail2": {
        pos: { left: "20%", top: "22%", width: "60%", height: "12%" },
        shape: "rec-chip",
      },
      "rec-sea": {
        pos: { left: "20%", top: "36%", width: "60%", height: "12%" },
        shape: "rec-chip",
      },
      "rec-fedex": {
        pos: { left: "20%", top: "50%", width: "60%", height: "12%" },
        shape: "rec-chip",
      },
      "rec-amazon": {
        pos: { left: "20%", top: "64%", width: "60%", height: "12%" },
        shape: "rec-chip",
      },
      "rec-steel": {
        pos: { left: "20%", top: "78%", width: "60%", height: "12%" },
        shape: "rec-chip",
        opacity: 0.45,
      },
    },
    frames: {},
  },

  // 8 — MATRIX: approved chips morph into matrix dots
  {
    id: 8,
    caption: {
      eyebrow: "Step 8 · Cost vs carbon matrix",
      headline: "Each approved switch is plotted by cost effort and carbon impact.",
      sub: "Quick wins (top-left) go first. Green investments (top-right) need CFO sign-off.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: matrixLayoutForApproved(),
    frames: { matrix: true },
  },

  // 9 — BUNQ SUB-ACCOUNT FUNDING: policy → intra-user transfer → audit chain
  // The "where the money actually moves" stage. Carbo computes a reserve
  // amount from the policy DSL (lib/policy/evaluate.ts), the signed bunq
  // client does an intra-user transfer to the Carbon Reserve sub-account
  // (lib/bunq/payments.ts), and the audit chain logs it. Funds are then
  // used to retire Puro.earth credits.
  {
    id: 9,
    caption: {
      eyebrow: "Step 9 · Bunq Reserve sub-account · auto-funded",
      headline: "Carbo moves the carbon-credit money for you.",
      sub: "Policy DSL computes the EUR amount per category. Signed RSA-SHA256 intra-user transfer to the Carbon Reserve sub-account. Hash-chained audit row.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {},
    frames: { bunqSub: true },
  },

  // 10 — CSRD REPORT: every monthly close auto-renders the source PDF.
  // The right side renders a stylised facsimile of the real report
  // (lib/reports/render-briefing.tsx) — forest-950 header band, mint-500
  // accent, paper body — that visually assembles itself top-to-bottom.
  // Savings stats (6–12 weeks of staff time, €15–40k consultant fees,
  // −80% assembly hours) sit under the caption on the left.
  {
    id: 10,
    caption: {
      eyebrow: "Step 10 · The report writes itself",
      headline: "Every monthly close auto-generates a CSRD ESRS E1 source PDF.",
      sub: "Bunq-branded, per-row factor citations, audit chain attached. What used to take a 50-person SME 6–12 weeks of Q1 staff work, gone.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {},
    frames: { csrdReport: true },
  },

  // 11 — SCALE: matrix dots lift into 3 climbing bars
  {
    id: 11,
    caption: {
      eyebrow: "Step 11 · The math at scale",
      headline: "What 4.5% looks like across one company, over time, across bunq's network.",
      sub: "If every quick win is taken — these are the numbers it adds up to.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: scaleLayoutForApproved(),
    frames: { scale: true },
  },

  // 12 — CO2 PROOF: baseline vs after, side-by-side
  {
    id: 12,
    caption: {
      eyebrow: "Step 12 · Carbon cut, audit-ready",
      headline: "Same business. Same volumes. Different decisions.",
      sub: "From 240 to 150 tCO₂e per year — and a CSRD ESRS E1 report you can hand to an auditor.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {}, // recs fade
    frames: { co2: true },
  },

  // 13 — ASK
  {
    id: 13,
    caption: {
      eyebrow: "Step 13 · The ask",
      headline: "Pilot it with one bunq Business enterprise.",
      sub: "Audit-ready CSRD output by month one. We just need a sandbox slot and a credit-registry partner.",
    },
    txs: {},
    receipts: {},
    clusters: {},
    agents: {},
    recs: {},
    frames: { ask: true },
  },
];

// Re-export so element components can read it without re-deriving.
export { HIDDEN };
