"use client";

import { QRCodeSVG } from "qrcode.react";

export function AuditQR({
  runId,
  digest,
}: {
  runId: string;
  digest: string;
}) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${runId}?digest=${digest}`
      : `/verify/${runId}?digest=${digest}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="p-4 rounded-[12px]"
        style={{
          background: "#ffffff",
          border: "1px solid var(--border-default)",
        }}
      >
        <QRCodeSVG
          value={url}
          size={160}
          level="M"
          bgColor="#ffffff"
          fgColor="#0f0f0f"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[12px] uppercase tracking-[1.2px]"
          style={{
            color: "var(--fg-muted)",
            fontFamily: "var(--font-source-code-pro, monospace)",
          }}
        >
          Scan to verify
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{
            color: "var(--fg-faint)",
            fontFamily: "var(--font-source-code-pro, monospace)",
          }}
        >
          {digest.slice(0, 16)}…
        </span>
      </div>
    </div>
  );
}
