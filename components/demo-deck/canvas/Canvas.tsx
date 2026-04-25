"use client";

import { LayoutGroup } from "motion/react";
import {
  AllAgents,
  AllClusters,
  AllReceipts,
  AllRecommendations,
  AllTransactions,
} from "./elements";
import {
  AskFrame,
  BunqSubAccountsFrame,
  CO2Comparison,
  CsrdReportFrame,
  DagFlowFrame,
  HeroFrame,
  HookBackdrop,
  MatrixGrid,
  ReceiptOCRFrame,
  ScaleStatCards,
} from "./frames";
import type { StageConfig } from "./stages";

// The persistent world. Mounted once. Every Element + Frame reads its
// current stage and morphs/fades in place.
//
// Order of stacking (back → front):
//   1. Frames (matrix grid, scale chart, co2 reports) — passive backdrops
//   2. Cluster halos — large soft shapes
//   3. Receipts — paperclip pills (under the tx cards in stage 2)
//   4. Transactions — front-of-list rows (or cluster dots later)
//   5. Agents + Recommendations — the synthesis layer
//   6. Ask frame — closing CTA on top of everything

export function Canvas({ stage }: { stage: StageConfig }) {
  return (
    <div className="absolute inset-0">
      {/* canvas is a relative container so absolutely positioned elements
          measure against it. We pad to leave room for the caption strip
          (top) — generous so a 2-line headline + 2-line sub never overlaps
          the canvas content — and the indicator strip (bottom). */}
      <div className="relative mx-auto h-full w-full max-w-[1400px] px-8 pb-20 pt-80">
        <div className="relative h-full w-full">
          {/* Frames: behind */}
          <HookBackdrop visible={stage.frames.hook === true} />
          <HeroFrame visible={stage.frames.hook === true} />
          <ReceiptOCRFrame
            visible={stage.frames.receiptOcr === true}
            caption={stage.caption}
          />
          <DagFlowFrame
            visible={stage.frames.dag === true}
            caption={stage.caption}
          />
          <BunqSubAccountsFrame visible={stage.frames.bunqSub === true} />
          <MatrixGrid visible={stage.frames.matrix === true} />
          <CsrdReportFrame
            visible={stage.frames.csrdReport === true}
            caption={stage.caption}
          />
          <ScaleStatCards visible={stage.frames.scale === true} />
          <CO2Comparison visible={stage.frames.co2 === true} />

          {/* Elements (LayoutGroup so layoutIds across families coordinate) */}
          <LayoutGroup>
            <AllClusters stage={stage} />
            <AllReceipts stage={stage} />
            <AllTransactions stage={stage} />
            <AllAgents stage={stage} />
            <AllRecommendations stage={stage} />
          </LayoutGroup>

          {/* Ask is in front of everything */}
          <AskFrame visible={stage.frames.ask === true} />
        </div>
      </div>
    </div>
  );
}
