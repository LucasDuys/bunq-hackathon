import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, invoices } from "@/lib/db/client";

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId") ?? "org_acme_bv";
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const rows = db
    .select()
    .from(invoices)
    .where(eq(invoices.orgId, orgId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json(rows);
};
