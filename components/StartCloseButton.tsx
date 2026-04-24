"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

export const StartCloseButton = ({ month, latestRunId }: { month: string; latestRunId: string | null }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/close/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }) });
      const j = await res.json();
      if (j.id) router.push(`/close/${j.id}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={run} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      Run Carbon Close
    </Button>
  );
};
