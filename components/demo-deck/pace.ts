// Single source of truth for the morphing-canvas deck.
//
// v2 morph values: cubic-bezier (0.32, 0.72, 0.34, 1) gives elements a
// "physical arrival" — fast initial movement, soft landing — instead of the
// flat easeOut from v1's slide-show pattern.

export const MORPH_EASE = [0.32, 0.72, 0.34, 1] as const;

export const MORPH_TRANSITION = {
  duration: 0.7,
  ease: MORPH_EASE,
} as const;

export const CAPTION_FADE = {
  duration: 0.25,
  ease: "easeOut",
} as const;

// Pacing for in-stage internal beats (e.g. the 3 reveals inside the hook,
// the receipt-attach choreography in stage 2).
export const PACE = {
  slideEnter: { duration: 0.5, ease: "easeOut" },
  slideExit: { duration: 0.3, ease: "easeIn" },
  textStagger: 0.1,
  numberHold: 0.4,
  counterTick: 1.2,
  counterFinal: 1.6,
  pipelineAnim: 2.5,
} as const;

export const COUNTER_SPRING = {
  type: "spring" as const,
  stiffness: 90,
  damping: 18,
};

export type SlideProps = { isActive: boolean };
