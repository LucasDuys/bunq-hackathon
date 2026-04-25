"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";

export function ProofFloatingBadge({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/proof/")) return null;

  return (
    <Link
      href={`/proof/${orgId}`}
      className="proof-fab"
      aria-label="Proof of Green — view your verified carbon report"
    >
      <span className="proof-fab-icon">
        <Leaf className="h-4 w-4" />
      </span>
      <span className="proof-fab-label">Proof of Green</span>
    </Link>
  );
}
