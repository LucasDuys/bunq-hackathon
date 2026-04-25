/**
 * Shared contracts for the /launch route — the Carbo launch video.
 *
 * Every component in app/launch/components consumes these types.
 * Scenes consume SceneProps to know how far they are through their slot.
 */

// ── Spreadsheet (S2, S7, S9) ──────────────────────────────────────────────────

export type TransactionRow = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  merchant: string;
  amountEur: number;
  category: string;
  subCategory: string | null;
  tco2eKg: number | null; // null = data gap
  confidence: number | null; // null = pending
  isGap?: boolean; // visual highlight for the missing-data rows
};

export type PriorityCluster = {
  id: string;
  category: string;
  subLabel: string;
  annualSpendEur: number;
  tco2e: number;
  color: string; // CSS var ref like 'var(--cat-travel)'
};

// ── Vision / OCR (S6) ─────────────────────────────────────────────────────────

export type OCRCategory = "merchant" | "date" | "item" | "total" | "vat";

export type OCRRegion = {
  /** Box in PERCENT of the receipt's rendered dims (0..100), not pixels. */
  box: { x: number; y: number; w: number; h: number };
  text: string;
  category?: OCRCategory;
  /** Delay (ms) into the OCR scene when this region highlights. */
  delay: number;
  /** Index into the lifted-text sidebar list. Omit for items that stay on the receipt. */
  liftToSlot?: number;
};

// ── Cursor (S4) ───────────────────────────────────────────────────────────────

export type CursorAction = "show" | "hover" | "press" | "drag" | "release" | "exit";

export type CursorKeyframe = {
  /** ms into the scene */
  at: number;
  /** position in viewport pixels (1920x1080 reference) */
  x: number;
  y: number;
  action: CursorAction;
};

// ── DAG (S11) ─────────────────────────────────────────────────────────────────

export type DagAgentId =
  | "spend_emissions_baseline_agent"
  | "research_agent"
  | "green_alternatives_agent"
  | "cost_savings_agent"
  | "green_judge_agent"
  | "cost_judge_agent"
  | "carbon_credit_incentive_strategy_agent"
  | "executive_report_agent";

export type DagNode = {
  id: DagAgentId;
  label: string;
  /** Tier 1..6 — see lib/agents/dag/index.ts */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  model: "DETERMINISTIC" | "SONNET 4.6";
  /** Tag pairs that fire simultaneously. */
  parallelGroup?: "tier3" | "tier4";
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  /** lucide-react icon name */
  icon: string;
};

// ── Matrix (S13) ──────────────────────────────────────────────────────────────

export type Quadrant = "win_win" | "pay_to_decarbonize" | "status_quo_trap" | "avoid";

export type MatrixPoint = {
  id: string;
  baseline: string;
  alternative: string;
  /** Negative = saving */
  costDeltaEur: number;
  /** Negative = reduction (tCO2e) */
  co2eDelta: number;
  quadrant: Quadrant;
};

// ── Scale (S15) ───────────────────────────────────────────────────────────────

export type ScaleTier = {
  label: string;
  multiplier: number;
  netEur: number;
  tco2e: number;
  carEquivalents: number;
};

// ── Scene contract ────────────────────────────────────────────────────────────

export type SceneProps = {
  /** Milliseconds elapsed within this scene's slot (0 at scene start). */
  elapsedMs: number;
  /** Total duration of this scene's slot. */
  durationMs: number;
  /** 0..1 progress through the slot. */
  progress: number;
};

// ── Timeline (used by LaunchTimeline) ─────────────────────────────────────────

export type SceneId =
  | "S01"
  | "S01D"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07A"
  | "S10"
  | "S11"
  | "S11A"
  | "S11R"
  | "S11P"
  | "S12"
  | "S13"
  | "S13B"
  | "S13C"
  | "S14"
  | "S15"
  | "S16";

export type SceneSpec = {
  id: SceneId;
  /** Milliseconds the scene occupies on the master timeline. */
  durationMs: number;
  /** Optional title-card text (applies to title scenes only). */
  title?: string;
  /**
   * Optional caption rendered above the MacWindow during product scenes.
   * Source-code-pro 11px uppercase. Mirrors "Using Github: searched channels …"
   * narration in the ChatGPT-5.5 launch reference video.
   */
  caption?: string;
  /**
   * Optional HEADER-level (Inter 400, ~clamp 56–88px) text rendered above the
   * MacWindow on product scenes. Camera zooms past it as it pushes into the
   * window content — the header naturally exits the top of the frame.
   */
  header?: string;
  /** Per-scene leaf opacity override (default 0.35). */
  leafOpacity?: number;
};
