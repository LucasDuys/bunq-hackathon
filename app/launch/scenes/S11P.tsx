"use client";

/**
 * S11P — Policy → reserve transfer + EU credit purchase.
 *
 * The closing motion of the close machine. A permission prompt slides in
 * ("Approve €412 transfer …"), then auto-approves: the bunq transfer toast
 * settles green and the Puro.earth credit certificate prints line by line,
 * stamping "Retired" at the end.
 *
 * Layout: white shell, no MacWindow (the two artifacts ARE the chrome).
 * Toast on the left, certificate on the right.
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { ReserveTransferToast } from "../components/ReserveTransferToast";
import { CreditCertificate } from "../components/CreditCertificate";
import { PermissionPrompt } from "../components/PermissionPrompt";

const SHOW_PROMPT_AT = 400;
const APPROVE_AT = 2200;
const SETTLE_AT = 2600;
const PRINT_START = 2700;
const STAMP_AT = 5300;

export default function S11P({ elapsedMs, durationMs }: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#fafafa",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0,    scale: 0.96, x: 0, y: 16 },
          { at: 0.45, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0,  scale: 1.03, x: 0, y: -10 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 48,
          }}
        >
          {/* Left: bunq-styled transfer toast */}
          <ReserveTransferToast
            elapsedMs={elapsedMs}
            showAt={0}
            settleAt={SETTLE_AT}
          />

          {/* Right: Puro.earth credit certificate */}
          <CreditCertificate
            elapsedMs={elapsedMs}
            printStart={PRINT_START}
            stampAt={STAMP_AT}
          />
        </div>
      </CameraScript>

      {/* Permission prompt — sits on top of everything. */}
      <PermissionPrompt
        elapsedMs={elapsedMs}
        showAt={SHOW_PROMPT_AT}
        approveAt={APPROVE_AT}
        question="Approve €412 transfer to Carbon Reserve and retire 2.84 t of EU-registered credits?"
        description="DRY_RUN guard active · external transfer requires your approval"
        approveLabel="Approve & transfer"
      />
    </div>
  );
}
