"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { ResearchProgressOverlay } from "@/components/ResearchProgressOverlay";

export const RunImpactResearch = ({ hasData }: { hasData: boolean }) => {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    if (running) return;
    setDone(false);
    setRunning(true);
    try {
      await fetch("/api/impacts/research", { method: "POST" });
      setDone(true);
      window.setTimeout(() => router.refresh(), 350);
      window.setTimeout(() => {
        setRunning(false);
        setDone(false);
      }, 950);
    } catch {
      setRunning(false);
      setDone(false);
    }
  };

  return (
    <>
      <Button
        onClick={run}
        disabled={running}
        variant="primary"
        aria-label={hasData ? "Refresh impact research" : "Run impact research"}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {running ? "Researching…" : hasData ? "Refresh research" : "Run impact research"}
      </Button>
      <ResearchProgressOverlay open={running} done={done} />
    </>
  );
};
