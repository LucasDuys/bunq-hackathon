"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button, CodeLabel } from "@/components/ui";

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
  const options = JSON.parse(question.options) as Array<{
    label: string;
    category: string;
    subCategory: string | null;
  }>;
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
    <div
      className="flex flex-col gap-4 p-5 rounded-[12px]"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center gap-2">
        <CodeLabel>Cluster · {question.clusterId.slice(0, 8)}</CodeLabel>
      </div>
      <div className="text-[15px] leading-[1.5]" style={{ color: "var(--fg-primary)" }}>
        {question.question}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.label}
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => submit(o.label)}
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
    <Button onClick={approve} disabled={busy} size="md">
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      Approve &amp; transfer
    </Button>
  );
};

export const CloseActions = { QuestionCard, ApproveButton };
