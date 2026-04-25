"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, CheckCircle2, Layers } from "lucide-react";
import { Button, CodeLabel } from "@/components/ui";
import { fmtEur } from "@/lib/utils";

type QuestionRow = {
  id: number;
  closeRunId: string;
  clusterId: string;
  question: string;
  options: string;
  answer: string | null;
  affectedTxIds?: string;
};

export const QuestionCard = ({ runId, question }: { runId: string; question: QuestionRow }) => {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const options = JSON.parse(question.options) as Array<{
    label: string;
    category: string;
    subCategory: string | null;
  }>;
  const affected = (() => {
    if (!question.affectedTxIds) return null;
    try {
      const arr = JSON.parse(question.affectedTxIds) as string[];
      return Array.isArray(arr) ? arr.length : null;
    } catch {
      return null;
    }
  })();

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
      <div className="flex items-center gap-3 flex-wrap">
        <CodeLabel>Cluster · {question.clusterId.slice(0, 8)}</CodeLabel>
        {affected != null && affected > 0 && (
          <span
            className="inline-flex items-center gap-1.5 text-[12px] tabular-nums"
            style={{ color: "var(--fg-muted)" }}
          >
            <Layers className="h-3 w-3" aria-hidden="true" />
            {affected} transaction{affected === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div
        className="text-[15px] leading-[1.5]"
        style={{ color: "var(--fg-primary)" }}
      >
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
            aria-label={
              o.subCategory
                ? `${o.label} — ${o.category} · ${o.subCategory}`
                : `${o.label} — ${o.category}`
            }
          >
            {busy === o.label ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export const ApproveButton = ({
  runId,
  amountEur,
}: {
  runId: string;
  amountEur?: number | null;
}) => {
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
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      )}
      Approve &amp; transfer
      {amountEur != null && amountEur > 0 ? ` ${fmtEur(amountEur, 0)}` : ""}
    </Button>
  );
};
