"use client";

import { useState } from "react";
import { RotateCcw, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui";

export function InvoiceActions({
  invoiceId,
  status,
  fileMime,
}: {
  invoiceId: string;
  status: string;
  fileMime: string;
}) {
  const [reprocessing, setReprocessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleReprocess() {
    setReprocessing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/reprocess`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setResult(
          `Extracted: ${data.merchant} — ${data.lineItems} line items, confidence ${(data.confidence * 100).toFixed(0)}%`,
        );
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult(`Failed: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setReprocessing(false);
    }
  }

  const canPreview =
    fileMime === "application/pdf" ||
    fileMime === "image/jpeg" ||
    fileMime === "image/png";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {canPreview && (
          <a
            href={`/api/invoices/${invoiceId}/file`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="sm">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View file
            </Button>
          </a>
        )}
        <a href={`/api/invoices/${invoiceId}/file`} download>
          <Button variant="secondary" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
        </a>
        <Button
          variant={status === "failed" ? "primary" : "secondary"}
          size="sm"
          onClick={handleReprocess}
          disabled={reprocessing}
        >
          <RotateCcw
            className={`h-3.5 w-3.5 mr-1.5 ${reprocessing ? "animate-spin" : ""}`}
          />
          {reprocessing ? "Reprocessing…" : "Reprocess"}
        </Button>
      </div>
      {result && (
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: result.startsWith("Failed") || result.startsWith("Error")
              ? "var(--status-danger, #f04438)"
              : "var(--status-success, #17b26a)",
          }}
        >
          {result}
        </p>
      )}
    </div>
  );
}
