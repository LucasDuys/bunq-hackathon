import { notFound } from "next/navigation";
import { getProofStats } from "@/lib/audit/proof";
import { GreenDashboard } from "@/components/GreenDashboard";

export const dynamic = "force-dynamic";

export default async function GreenReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const stats = getProofStats(orgId);
  if (!stats || stats.monthsTracked === 0) notFound();

  return <GreenDashboard stats={stats} />;
}
