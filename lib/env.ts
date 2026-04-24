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
};
export { required };
