"use client";

/**
 * S11P — "We move the money. You approve it."
 *
 * The closing motion of the close machine. The viewer sees the actual bunq
 * Sub-accounts panel; €412 visibly arcs out of Operating and lands in
 * Carbon Reserve, with both balances ticking in real time. A permission
 * prompt gates the move so the human stays in the loop.
 *
 *   ──── beats ─────────────────────────────────────────────────────────
 *   0    →  600   bunq Sub-accounts panel fades in (Carbo's proposal lined up)
 *   600  →  2200  PermissionPrompt slides up: "You approve it."
 *   2200 →  2700  Approve pulse → prompt dismiss
 *   2900 →  4400  €412 puck arcs Operating ↘ Carbon Reserve, balances tick
 *   4400 →  4800  Carbon Reserve row settles green
 *   4800 →  6000  Puro.earth credit chip drops in below
 *
 * Layout: a centered MacWindow titled "bunq Business — Sub-accounts" hosts
 * the stage. The prompt overlays the entire scene so the gating step reads
 * unambiguously.
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { MacWindow } from "../components/MacWindow";
import { BunqSubAccountsStage } from "../components/BunqSubAccountsStage";
import { PermissionPrompt } from "../components/PermissionPrompt";

const PROPOSE_AT = 0;
const PROMPT_SHOW_AT = 600;
const APPROVE_AT = 2200;
const TRANSFER_START = 2900;
const TRANSFER_ARRIVE = 4400;
const CREDIT_AT = 4800;

export default function S11P({ elapsedMs, durationMs }: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#f4f3ee",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0, scale: 0.96, x: 0, y: 18 },
          { at: 0.18, scale: 1.0, x: 0, y: 0 },
          { at: 0.55, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.02, x: 0, y: -8 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="bunq Business — Sub-accounts"
          width={1180}
          height={720}
          glass
        >
          <BunqSubAccountsStage
            elapsedMs={elapsedMs}
            proposeAt={PROPOSE_AT}
            transferStart={TRANSFER_START}
            transferArrive={TRANSFER_ARRIVE}
            creditAt={CREDIT_AT}
          />
        </MacWindow>
      </CameraScript>

      {/* Permission prompt — overlays everything so the user step is unmissable. */}
      <PermissionPrompt
        elapsedMs={elapsedMs}
        showAt={PROMPT_SHOW_AT}
        approveAt={APPROVE_AT}
        question="Move €412 from Operating to your Carbon Reserve sub-account?"
        description="Carbo will then retire 2.84 tCO₂e. External transfer requires your approval."
        approveLabel="Approve & transfer"
      />
    </div>
  );
}
