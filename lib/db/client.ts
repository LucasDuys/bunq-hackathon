import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

const resolveDbPath = (url: string) => {
  if (url.startsWith("file:")) return url.slice(5);
  return url;
};

const dbPath = resolveDbPath(env.dbUrl);
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
export * from "./schema";
