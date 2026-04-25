"use client";

import { QRCodeSVG } from "qrcode.react";
import { Leaf } from "lucide-react";

export function ProofBadge({
  orgId,
  orgName,
  size = 140,
}: {
  orgId: string;
  orgName: string;
  size?: number;
}) {
  const path = `/proof/${orgId}`;
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR */}
      <div
        className="p-5 rounded-[16px]"
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
          imageSettings={{
            src: "",
            height: 0,
            width: 0,
            excavate: false,
          }}
        />
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <Leaf
            className="h-3.5 w-3.5"
            style={{ color: "var(--brand-green)" }}
            aria-hidden="true"
          />
          <span
            className="text-[12px] uppercase tracking-[1.2px]"
            style={{
              color: "var(--brand-green)",
              fontFamily: "var(--font-source-code-pro, monospace)",
            }}
          >
            Proof of green
          </span>
        </div>
        <span
          className="text-[13px]"
          style={{ color: "var(--fg-secondary)" }}
        >
          {orgName}
        </span>
        <a
          href={path}
          className="text-[11px] no-underline hover:underline"
          style={{
            color: "var(--brand-green-link)",
            fontFamily: "var(--font-source-code-pro, monospace)",
          }}
        >
          Scan or tap to verify
        </a>
      </div>
    </div>
  );
}
