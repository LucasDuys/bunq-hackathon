"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";

type QuestionRow = {
  id: number;
  closeRunId: string;
  clusterId: string;
  question: string;
  options: string;
  answer: string | null;
};

const QuestionCard = ({ runId, question }: { runId: string; question: QuestionRow }) => {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const options = JSON.parse(question.options) as Array<{ label: string; category: string; subCategory: string | null }>;
  const submit = async (label: string) => {
    setBusy(label);
    try {
      await fetch(`/api/close/${runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qaId: question.id, answer: label }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="text-sm font-medium">{question.question}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.label}
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => submit(o.label)}
            className="gap-1.5 capitalize"
          >
            {busy === o.label && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

const ApproveButton = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    try {
      await fetch(`/api/close/${runId}/approve`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={approve} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      Approve & execute
    </Button>
  );
};

export const CloseActions = { QuestionCard, ApproveButton };
