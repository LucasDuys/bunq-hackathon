import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // better-sqlite3 is native; keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
};

export default nextConfig;
