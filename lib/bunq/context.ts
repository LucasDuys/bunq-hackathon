import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTEXT_PATH = resolve(process.cwd(), ".bunq-context.json");

export type BunqContext = {
  installationToken?: string;
  serverPublicKeyPem?: string;
  userId?: string;
  mainAccountId?: string;
  reserveAccountId?: string;
  creditsAccountId?: string;
};

export const loadContext = (): BunqContext => {
  if (!existsSync(CONTEXT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONTEXT_PATH, "utf8")) as BunqContext;
  } catch {
    return {};
  }
};

export const saveContext = (patch: Partial<BunqContext>) => {
  const next = { ...loadContext(), ...patch };
  writeFileSync(CONTEXT_PATH, JSON.stringify(next, null, 2));
  return next;
};

export const requireContext = <K extends keyof BunqContext>(key: K): NonNullable<BunqContext[K]> => {
  const ctx = loadContext();
  const v = ctx[key];
  if (v === undefined || v === null) {
    throw new Error(`bunq context missing "${String(key)}" — run \`npm run bunq:bootstrap\` first`);
  }
  return v as NonNullable<BunqContext[K]>;
};

export { CONTEXT_PATH };
