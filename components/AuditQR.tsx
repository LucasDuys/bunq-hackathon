"use client";

import { QRCodeSVG } from "qrcode.react";

export function AuditQR({
  runId,
  digest,
  size = 160,
}: {
  runId: string;
  digest: string;
  size?: number;
}) {
  const path = `/verify/${runId}?digest=${digest}`;
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path;

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
          size={size}
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
        <a
          href={path}
          className="text-[11px] tabular-nums no-underline hover:underline"
          style={{
            color: "var(--brand-green-link)",
            fontFamily: "var(--font-source-code-pro, monospace)",
          }}
        >
          {digest.slice(0, 16)}…
        </a>
      </div>
    </div>
  );
}
