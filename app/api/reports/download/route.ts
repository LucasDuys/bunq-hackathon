import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a generated report PDF from data/exports/. Files there are NOT
 * under /public, so Next won't serve them statically. Hard guard: path must
 * start with "data/exports/" and must not contain "..".
 *
 *   GET /api/reports/download?path=data/exports/carbo-org_acme_bv-2026-04.pdf
 */
export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const rel = url.searchParams.get("path") ?? "";

  if (!rel.startsWith("data/exports/") || rel.includes("..")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const abs = resolve(process.cwd(), rel);
  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const filename = basename(abs);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
