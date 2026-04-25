"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

type UploadResult = {
  ok: boolean;
  id?: string;
  merchant?: string | null;
  totalCents?: number;
  lineItems?: number;
  confidence?: number;
  linked?: boolean;
  linkedTxId?: string | null;
  error?: string;
};

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export function InvoiceUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setState("uploading");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setState("processing");
      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        body: formData,
      });
      const data: UploadResult = await res.json();

      if (!res.ok) {
        setState("error");
        setResult({ ok: false, error: data.error ?? "Upload failed" });
        return;
      }

      setState("done");
      setResult(data);
      onSuccess?.();
    } catch (e) {
      setState("error");
      setResult({ ok: false, error: (e as Error).message });
    }
  }, [onSuccess]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = () => {
    setState("idle");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative rounded-2xl p-8 text-center cursor-pointer transition-all duration-150"
        style={{
          border: `2px dashed ${dragOver ? "var(--green)" : "var(--border)"}`,
          background: dragOver ? "rgba(48,192,111,0.05)" : "var(--bg-inset)",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleInputChange}
        />

        {state === "idle" && (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center"
              style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}
            >
              <Upload className="h-5 w-5" style={{ color: "var(--text-dim)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Drop an invoice here, or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-mute)" }}>
                JPEG, PNG, or PDF — max 10MB
              </p>
            </div>
          </div>
        )}

        {(state === "uploading" || state === "processing") && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--green)" }} />
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              {state === "uploading" ? "Uploading…" : "Extracting invoice data…"}
            </p>
          </div>
        )}

        {state === "done" && result?.ok && (
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-12 h-12 rounded-xl grid place-items-center"
              style={{ background: "rgba(48,192,111,0.15)" }}
            >
              <Check className="h-5 w-5" style={{ color: "var(--green)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {result.merchant ?? "Invoice processed"}
              </p>
              <p className="text-xs mt-1 tabular-nums" style={{ color: "var(--text-dim)" }}>
                {result.totalCents ? `€${(result.totalCents / 100).toFixed(2)}` : ""} · {result.lineItems ?? 0} line items · {result.confidence ? `${(result.confidence * 100).toFixed(0)}% confidence` : ""}
              </p>
              {result.linked && (
                <p className="text-xs mt-1" style={{ color: "var(--green)" }}>
                  Linked to transaction {result.linkedTxId?.slice(0, 12)}
                </p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={reset}>
              Upload another
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <AlertCircle className="h-6 w-6" style={{ color: "var(--red, #f04438)" }} />
            <p className="text-sm" style={{ color: "var(--red, #f04438)" }}>
              {result?.error ?? "Something went wrong"}
            </p>
            <Button variant="secondary" size="sm" onClick={reset}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
