"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Spawns a fresh close run for the same month and routes to it. The previous
 * run stays in the ledger — close runs are append-only by design — but the new
 * run becomes the current one for the month.
 */
export const RerunCloseButton = ({
  month,
  size = "sm",
  variant = "ghost",
}: {
  month: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
}) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        `Run a fresh close for ${month}? The existing run stays in the ledger; the new run becomes current.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/close/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (j.id) {
        router.push(`/close/${j.id}`);
        router.refresh();
        return;
      }
      setError(j.error ?? "Failed to start a new close");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={run}
        disabled={busy}
        size={size}
        variant={variant}
        className="gap-1.5"
        aria-label={`Run a new close for ${month}`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        Run new close
      </Button>
      {error && (
        <span
          className="text-[12px]"
          style={{ color: "var(--status-danger)" }}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
};
