import { defineConfig } from "drizzle-kit";

const url = (process.env.DATABASE_URL ?? "file:./data/carbon.db").replace(/^file:/, "");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
});
