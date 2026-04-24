import { existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { env } from "@/lib/env";

const dbPath = env.dbUrl.replace(/^file:/, "");
const walPath = `${dbPath}-wal`;
const shmPath = `${dbPath}-shm`;

for (const p of [dbPath, walPath, shmPath]) {
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`deleted ${p}`);
  }
}
execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
console.log("Demo reset complete.");
