/**
 * Fixture data for the /launch video. Single source of truth for every
 * scene; keep numbers consistent across spreadsheet, clusters, matrix, scale.
 */
import type {
  CursorKeyframe,
  DagNode,
  MatrixPoint,
  OCRRegion,
  PriorityCluster,
  ScaleTier,
  SceneSpec,
  TransactionRow,
} from "./types";

// ── S2: spreadsheet of transactions ───────────────────────────────────────────
// Two rows are deliberate "gaps" (tco2eKg & confidence null, isGap true).
export const TRANSACTIONS: TransactionRow[] = [
  {
    id: "tx_001",
    date: "2026-04-24",
    merchant: "Albert Heijn",
    amountEur: 487.2,
    category: "Catering",
    subCategory: null,
    tco2eKg: null,
    confidence: null,
    isGap: true,
  },
  {
    id: "tx_002",
    date: "2026-04-22",
    merchant: "Vendor invoice #4821",
    amountEur: 4280.0,
    category: "Office",
    subCategory: null,
    tco2eKg: null,
    confidence: null,
    isGap: true,
  },
  {
    id: "tx_003",
    date: "2026-04-23",
    merchant: "KLM AMS–FRA",
    amountEur: 312.5,
    category: "Travel",
    subCategory: "Flight · short-haul",
    tco2eKg: 184,
    confidence: 0.91,
  },
  {
    id: "tx_004",
    date: "2026-04-21",
    merchant: "AWS",
    amountEur: 1842.0,
    category: "Software",
    subCategory: "Cloud · compute",
    tco2eKg: 12,
    confidence: 0.78,
  },
  {
    id: "tx_005",
    date: "2026-04-20",
    merchant: "NS Reizigers",
    amountEur: 89.4,
    category: "Travel",
    subCategory: "Train · domestic",
    tco2eKg: 6,
    confidence: 0.94,
  },
  {
    id: "tx_006",
    date: "2026-04-18",
    merchant: "Coolblue Zakelijk",
    amountEur: 1259.0,
    category: "Office",
    subCategory: "Hardware · laptops",
    tco2eKg: 312,
    confidence: 0.82,
  },
  {
    id: "tx_007",
    date: "2026-04-16",
    merchant: "Vodafone Business",
    amountEur: 410.0,
    category: "Software",
    subCategory: "Telecom · mobile",
    tco2eKg: 4,
    confidence: 0.88,
  },
  {
    id: "tx_008",
    date: "2026-04-15",
    merchant: "Eneco Zakelijk",
    amountEur: 980.0,
    category: "Energy",
    subCategory: "Electricity · green tariff",
    tco2eKg: 22,
    confidence: 0.96,
  },
  {
    id: "tx_009",
    date: "2026-04-12",
    merchant: "Slack Technologies",
    amountEur: 240.0,
    category: "Software",
    subCategory: "SaaS · communication",
    tco2eKg: 1,
    confidence: 0.85,
  },
  {
    id: "tx_010",
    date: "2026-04-10",
    merchant: "Bol.com Business",
    amountEur: 612.3,
    category: "Office",
    subCategory: "Supplies · paper",
    tco2eKg: 18,
    confidence: 0.81,
  },
  {
    id: "tx_011",
    date: "2026-04-08",
    merchant: "Uber for Business",
    amountEur: 142.8,
    category: "Travel",
    subCategory: "Taxi · city",
    tco2eKg: 11,
    confidence: 0.86,
  },
  {
    id: "tx_012",
    date: "2026-04-05",
    merchant: "GitHub",
    amountEur: 84.0,
    category: "Software",
    subCategory: "SaaS · dev tools",
    tco2eKg: 0.5,
    confidence: 0.92,
  },
];

/** What the Albert Heijn gap row resolves to after S6/S7. */
export const ALBERT_HEIJN_RESOLVED: Pick<
  TransactionRow,
  "subCategory" | "tco2eKg" | "confidence"
> = {
  subCategory: "Catering · fresh produce",
  tco2eKg: 421,
  confidence: 0.87,
};

// ── S6: receipt OCR regions (Albert Heijn) ───────────────────────────────────
// Boxes are PERCENT of the receipt's rendered box (responsive).
export const RECEIPT_OCR: OCRRegion[] = [
  { box: { x: 8, y: 4, w: 50, h: 8 }, text: "Albert Heijn", category: "merchant", delay: 600, liftToSlot: 0 },
  { box: { x: 8, y: 14, w: 60, h: 4 }, text: "Bilthoven  ·  24-04-2026", category: "date", delay: 900, liftToSlot: 1 },
  { box: { x: 6, y: 30, w: 80, h: 5 }, text: "Sla Eikenblad 200g", category: "item", delay: 1300 },
  { box: { x: 6, y: 36, w: 80, h: 5 }, text: "Volle Yoghurt 1L", category: "item", delay: 1500 },
  { box: { x: 6, y: 42, w: 80, h: 5 }, text: "Kipfilet 500g", category: "item", delay: 1700 },
  { box: { x: 6, y: 48, w: 80, h: 5 }, text: "Volkoren brood", category: "item", delay: 1900 },
  { box: { x: 6, y: 54, w: 80, h: 5 }, text: "Komkommer · 2x", category: "item", delay: 2100 },
  { box: { x: 6, y: 60, w: 80, h: 5 }, text: "Olijfolie 750ml", category: "item", delay: 2300, liftToSlot: 2 },
  { box: { x: 6, y: 75, w: 70, h: 5 }, text: "BTW 9%      €40,20", category: "vat", delay: 2700, liftToSlot: 3 },
  { box: { x: 6, y: 82, w: 80, h: 6 }, text: "TOTAAL    €487,20", category: "total", delay: 3000, liftToSlot: 4 },
];

// ── S4: cursor choreography for drag-drop of receipt ─────────────────────────
// Coordinates assume a 1920x1080 reference frame.
export const DRAG_DROP_CURSOR: CursorKeyframe[] = [
  { at: 0, x: 1820, y: 150, action: "show" },
  { at: 700, x: 1500, y: 320, action: "hover" }, // hovering "Documents" stack
  { at: 1100, x: 1500, y: 320, action: "press" }, // grab the receipt icon
  { at: 1500, x: 1100, y: 500, action: "drag" }, // dragging across
  { at: 2400, x: 700, y: 750, action: "drag" }, // approaching drop zone
  { at: 2900, x: 700, y: 750, action: "release" }, // drop
  { at: 3500, x: 1900, y: 200, action: "exit" },
];

// ── S9: priority clusters (output of spend_emissions_baseline_agent) ──────────
export const PRIORITY_CLUSTERS: PriorityCluster[] = [
  {
    id: "cluster_travel",
    category: "Travel",
    subLabel: "KLM short-haul EU + taxi",
    annualSpendEur: 48600,
    tco2e: 73.9,
    color: "var(--cat-travel)",
  },
  {
    id: "cluster_office",
    category: "Office hardware",
    subLabel: "Coolblue + vendor invoices",
    annualSpendEur: 31200,
    tco2e: 18.4,
    color: "var(--cat-goods)",
  },
  {
    id: "cluster_saas",
    category: "SaaS",
    subLabel: "AWS + Slack + GitHub overlap",
    annualSpendEur: 19800,
    tco2e: 4.1,
    color: "var(--cat-digital)",
  },
  {
    id: "cluster_food",
    category: "Catering",
    subLabel: "Albert Heijn + delivery",
    annualSpendEur: 14400,
    tco2e: 9.2,
    color: "var(--cat-services)",
  },
];

// ── S11: 8-agent DAG, 6 tiers, 2 parallel pairs ──────────────────────────────
// Mirrors lib/agents/dag/index.ts exactly.
export const DAG_NODES: DagNode[] = [
  {
    id: "spend_emissions_baseline_agent",
    label: "Spend & Emissions Baseline",
    tier: 1,
    model: "DETERMINISTIC",
    latencyMs: 420,
    inputTokens: 0,
    outputTokens: 0,
    cached: true,
    icon: "Calculator",
  },
  {
    id: "research_agent",
    label: "Research",
    tier: 2,
    model: "SONNET 4.6",
    latencyMs: 1820,
    inputTokens: 2400,
    outputTokens: 980,
    cached: false,
    icon: "Search",
  },
  {
    id: "green_alternatives_agent",
    label: "Green Alternatives",
    tier: 3,
    model: "SONNET 4.6",
    parallelGroup: "tier3",
    latencyMs: 1840,
    inputTokens: 3200,
    outputTokens: 2100,
    cached: false,
    icon: "Leaf",
  },
  {
    id: "cost_savings_agent",
    label: "Cost Savings",
    tier: 3,
    model: "SONNET 4.6",
    parallelGroup: "tier3",
    latencyMs: 1780,
    inputTokens: 3150,
    outputTokens: 1950,
    cached: false,
    icon: "Wallet",
  },
  {
    id: "green_judge_agent",
    label: "Green Judge",
    tier: 4,
    model: "SONNET 4.6",
    parallelGroup: "tier4",
    latencyMs: 980,
    inputTokens: 2700,
    outputTokens: 900,
    cached: false,
    icon: "ShieldCheck",
  },
  {
    id: "cost_judge_agent",
    label: "Cost Judge",
    tier: 4,
    model: "SONNET 4.6",
    parallelGroup: "tier4",
    latencyMs: 1020,
    inputTokens: 2650,
    outputTokens: 880,
    cached: false,
    icon: "ShieldCheck",
  },
  {
    id: "carbon_credit_incentive_strategy_agent",
    label: "Credit & Incentive Strategy",
    tier: 5,
    model: "SONNET 4.6",
    latencyMs: 1340,
    inputTokens: 4100,
    outputTokens: 1450,
    cached: false,
    icon: "Coins",
  },
  {
    id: "executive_report_agent",
    label: "Executive Report",
    tier: 6,
    model: "SONNET 4.6",
    latencyMs: 1620,
    inputTokens: 3900,
    outputTokens: 1850,
    cached: false,
    icon: "FileText",
  },
];

// ── S13: alternatives matrix (win-win + adjacent quadrants) ──────────────────
export const MATRIX_POINTS: MatrixPoint[] = [
  {
    id: "p1",
    baseline: "KLM AMS–FRA flights",
    alternative: "Rail (NS + ICE)",
    costDeltaEur: -9400,
    co2eDelta: -73.9,
    quadrant: "win_win",
  },
  {
    id: "p2",
    baseline: "Confluence",
    alternative: "Drop · use Notion",
    costDeltaEur: -3700,
    co2eDelta: -0.8,
    quadrant: "win_win",
  },
  {
    id: "p3",
    baseline: "Beef-heavy catering",
    alternative: "Plant-forward menu",
    costDeltaEur: -1800,
    co2eDelta: -12.4,
    quadrant: "win_win",
  },
  {
    id: "p4",
    baseline: "New Coolblue laptops",
    alternative: "Refurbished hardware",
    costDeltaEur: -4300,
    co2eDelta: -8.1,
    quadrant: "win_win",
  },
  {
    id: "p5",
    baseline: "Grey-grid electricity",
    alternative: "Renewable PPA",
    costDeltaEur: 1200,
    co2eDelta: -22.0,
    quadrant: "pay_to_decarbonize",
  },
  {
    id: "p6",
    baseline: "Same-day shipping",
    alternative: "Standard 3-day",
    costDeltaEur: -2100,
    co2eDelta: -3.6,
    quadrant: "win_win",
  },
];

// ── S15: scale slider tiers ──────────────────────────────────────────────────
export const SCALE_TIERS: ScaleTier[] = [
  { label: "Mock company", multiplier: 1, netEur: 28766, tco2e: 76, carEquivalents: 16 },
  { label: "Mid-market (×100)", multiplier: 100, netEur: 2876600, tco2e: 7600, carEquivalents: 1610 },
  { label: "Enterprise (×500)", multiplier: 500, netEur: 14383000, tco2e: 38000, carEquivalents: 8050 },
];

// ── Master timeline ──────────────────────────────────────────────────────────
// 16 scenes, ≈2:20 total. Adjust durationMs here to retime without touching scene code.
// Leaf only appears on title cards. Product scenes (and the final lockup) get leafOpacity 0
// so the 400ms CSS opacity transition on Leaf fades it out cleanly at scene boundaries.
export const TIMELINE: SceneSpec[] = [
  { id: "S01", durationMs: 4000, title: "Your books already know your carbon.", leafOpacity: 0.4 },
  { id: "S01D", durationMs: 9000, leafOpacity: 0 },
  { id: "S02", durationMs: 10000, leafOpacity: 0 },
  { id: "S03", durationMs: 4000, title: "Some spend doesn’t explain itself.", leafOpacity: 0.4 },
  { id: "S04", durationMs: 14000, leafOpacity: 0 },
  { id: "S05", durationMs: 3000, title: "Vision reads what bank text won’t.", leafOpacity: 0.4 },
  { id: "S06", durationMs: 16000, leafOpacity: 0 },
  { id: "S07", durationMs: 10000, leafOpacity: 0 },
  { id: "S08", durationMs: 4000, title: "Now the agents have something to reason over.", leafOpacity: 0.4 },
  { id: "S09", durationMs: 12000, leafOpacity: 0 },
  { id: "S10", durationMs: 4000, title: "Eight agents. Five tiers. Two parallel fan-outs.", leafOpacity: 0.4 },
  { id: "S11", durationMs: 20000, leafOpacity: 0 },
  { id: "S12", durationMs: 4000, title: "Cheaper. Lower carbon. Validated.", leafOpacity: 0.4 },
  { id: "S13", durationMs: 12000, leafOpacity: 0 },
  { id: "S13C", durationMs: 10000, leafOpacity: 0 },
  { id: "S14", durationMs: 4000, title: "At scale, this is millions.", leafOpacity: 0.4 },
  { id: "S15", durationMs: 12000, leafOpacity: 0 },
  { id: "S15I", durationMs: 10000, leafOpacity: 0 },
  { id: "S16", durationMs: 6000, leafOpacity: 0 },
];

export const TOTAL_DURATION_MS = TIMELINE.reduce((s, t) => s + t.durationMs, 0);
