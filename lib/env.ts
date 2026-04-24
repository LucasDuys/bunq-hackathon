const required = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};
const flag = (key: string, dflt = false) => {
  const v = process.env[key];
  if (v === undefined) return dflt;
  return v === "1" || v.toLowerCase() === "true";
};
const intOr = (key: string, dflt: number) => {
  const v = process.env[key];
  if (v === undefined) return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

export const env = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicMock: flag("ANTHROPIC_MOCK", true),
  bunqKey: process.env.BUNQ_API_KEY ?? "",
  bunqUrl: process.env.BUNQ_API_URL ?? "https://public-api.sandbox.bunq.com",
  bunqMock: flag("BUNQ_MOCK", true),
  bunqPrivateKeyB64: process.env.BUNQ_PRIVATE_KEY_B64 ?? "",
  bunqWebhookUrl: process.env.BUNQ_WEBHOOK_URL ?? "",
  dbUrl: process.env.DATABASE_URL ?? "file:./data/carbon.db",
  dryRun: flag("DRY_RUN", true),
  maxToolCalls: Number(process.env.MAX_TOOL_CALLS ?? "8"),
  defaultOrgName: process.env.DEFAULT_ORG_NAME ?? "Acme BV",
  // Research agent (plans/matrix-research.md)
  researchDisabled: flag("RESEARCH_DISABLED", false),
  researchMaxSearchesPerCluster: intOr("RESEARCH_MAX_SEARCHES_PER_CLUSTER", 3),
  researchCacheTtlDays: intOr("RESEARCH_CACHE_TTL_DAYS", 30),
  researchConcurrency: intOr("RESEARCH_CONCURRENCY", 4),
  researchMaxClusters: intOr("RESEARCH_MAX_CLUSTERS", 20),
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  gmailPollAddress: process.env.GMAIL_POLL_ADDRESS ?? "",
  gmailMock: flag("GMAIL_MOCK", true),
};
export { required };
