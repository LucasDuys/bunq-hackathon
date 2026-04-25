// Seed for the morphing canvas. Numbers are illustrative-but-defensible
// for a typical bunq Business mid-market enterprise (~€5M / yr through bunq).

export type TxId = `tx-${string}`;
export type ClusterId = "logistics" | "travel" | "goods" | "cloud";
export type AgentId = "research" | "green_alt" | "cost_savings";
export type RecId = `rec-${string}`;

export type Transaction = {
  id: TxId;
  merchant: string;
  amountEur: number;
  category: ClusterId;
  receiptKind: "invoice" | "receipt";
};

export type Cluster = {
  id: ClusterId;
  label: string;
  totalEur: number;
  tco2e: number;
  confidence: number; // 0..1
  priority: "high" | "medium" | "low";
};

export type Agent = {
  id: AgentId;
  label: string;
  role: string;
};

export type Recommendation = {
  id: RecId;
  fromCluster: ClusterId;
  title: string;
  savingEur: number;
  carbonKg: number;
  verdict: "approved" | "approved_caveats" | "rejected";
  // Cost matrix quadrant: x = cost effort (0..1), y = carbon impact (0..1)
  matrix: { x: number; y: number };
};

export const TRANSACTIONS: Transaction[] = [
  { id: "tx-001", merchant: "DHL · air freight", amountEur: 52_400, category: "logistics", receiptKind: "invoice" },
  { id: "tx-002", merchant: "FedEx Express", amountEur: 38_200, category: "logistics", receiptKind: "invoice" },
  { id: "tx-003", merchant: "Maersk shipping", amountEur: 71_800, category: "logistics", receiptKind: "invoice" },
  { id: "tx-004", merchant: "Lufthansa", amountEur: 18_900, category: "travel", receiptKind: "receipt" },
  { id: "tx-005", merchant: "KLM", amountEur: 12_400, category: "travel", receiptKind: "receipt" },
  { id: "tx-006", merchant: "Amazon Business", amountEur: 24_300, category: "goods", receiptKind: "invoice" },
  { id: "tx-007", merchant: "ArcelorMittal", amountEur: 45_000, category: "goods", receiptKind: "invoice" },
  { id: "tx-008", merchant: "AWS · eu-west", amountEur: 8_200, category: "cloud", receiptKind: "invoice" },
  { id: "tx-009", merchant: "Google Cloud", amountEur: 6_400, category: "cloud", receiptKind: "invoice" },
  { id: "tx-010", merchant: "Albert Heijn · catering", amountEur: 487, category: "goods", receiptKind: "receipt" },
];

export const CLUSTERS: Cluster[] = [
  { id: "logistics", label: "Logistics", totalEur: 162_400, tco2e: 96, confidence: 0.34, priority: "high" },
  { id: "travel", label: "Travel", totalEur: 31_300, tco2e: 41, confidence: 0.42, priority: "high" },
  { id: "goods", label: "Goods", totalEur: 69_787, tco2e: 28, confidence: 0.55, priority: "medium" },
  { id: "cloud", label: "Cloud · Energy", totalEur: 14_600, tco2e: 4, confidence: 0.78, priority: "low" },
];

export const AGENTS: Agent[] = [
  { id: "research", label: "Research", role: "web search · cited" },
  { id: "green_alt", label: "Green Alt", role: "lower-carbon switches" },
  { id: "cost_savings", label: "Cost Savings", role: "vendor + bulk" },
];

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-rail",
    fromCluster: "logistics",
    title: "Switch DHL air → DB Schenker rail (NL→DE)",
    savingEur: 18_400,
    carbonKg: 14_200,
    verdict: "approved",
    matrix: { x: 0.25, y: 0.85 }, // low cost, high carbon win → quick win
  },
  {
    id: "rec-sea",
    fromCluster: "logistics",
    title: "Maersk · low-sulphur fuel premium",
    savingEur: 4_800,
    carbonKg: 8_100,
    verdict: "approved",
    matrix: { x: 0.7, y: 0.7 }, // high cost, high carbon win → green investment
  },
  {
    id: "rec-fedex",
    fromCluster: "logistics",
    title: "FedEx → consolidate weekly shipments",
    savingEur: 7_200,
    carbonKg: 3_600,
    verdict: "approved",
    matrix: { x: 0.2, y: 0.5 }, // low cost, mid carbon → quick win
  },
  {
    id: "rec-rail2",
    fromCluster: "travel",
    title: "Replace EU short-haul flights with rail",
    savingEur: 6_900,
    carbonKg: 11_800,
    verdict: "approved",
    matrix: { x: 0.3, y: 0.9 }, // low cost, high carbon win
  },
  {
    id: "rec-amazon",
    fromCluster: "goods",
    title: "Amazon · switch to refurb electronics",
    savingEur: 2_400,
    carbonKg: 1_900,
    verdict: "approved_caveats",
    matrix: { x: 0.55, y: 0.35 },
  },
  {
    id: "rec-steel",
    fromCluster: "goods",
    title: "ArcelorMittal · switch to scope-3-low spec",
    savingEur: 0,
    carbonKg: 12_000,
    verdict: "rejected", // judge: zero sources / unclear price
    matrix: { x: 0.85, y: 0.6 },
  },
];

// Roll-up — used by stage 8 + stage 9 counters.
export const ENTERPRISE = {
  annualSpendEur: 5_000_000,
  savingsRatePct: 4.5,
  perCompanyYearEur: 225_000,
  perCompanyFiveYearEur: 1_125_000,
  fleetCompanies: 1_000,
  fleetYearEur: 225_000_000,

  baselineTco2e: 240,
  afterTco2e: 150,
  reductionPct: 37.5,
} as const;
