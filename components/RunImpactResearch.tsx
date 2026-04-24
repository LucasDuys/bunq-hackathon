"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

export const RunImpactResearch = ({ hasData }: { hasData: boolean }) => {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () => {
    start(async () => {
      await fetch("/api/impacts/research", { method: "POST" });
      router.refresh();
    });
  };

  return (
    <Button
      onClick={run}
      disabled={pending}
      variant="primary"
      aria-label={hasData ? "Refresh impact research" : "Run impact research"}
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      {pending ? "Researching…" : hasData ? "Refresh research" : "Run impact research"}
    </Button>
  );
};
