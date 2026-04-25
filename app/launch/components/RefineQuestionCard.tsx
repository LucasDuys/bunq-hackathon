"use client";

/**
 * RefineQuestionCard — Sonnet writes 3 refine questions to disambiguate the
 * Albert Heijn cluster (Catering · fresh produce). User answers via inline
 * chips. Each question types in, then a chip slides up beneath as if
 * "answered". By the end, the cluster is marked Refined.
 *
 * Designed to live inside a MacWindow body. Title row up top, three Q/A
 * blocks, footer status.
 */

import { Check, MessageCircle } from "lucide-react";

type Q = {
  q: string;
  a: string;
};

const QUESTIONS: Q[] = [
  {
    q: "Was the Albert Heijn purchase for an internal team event, or for client hospitality?",
    a: "Internal team — weekly lunch",
  },
  {
    q: "Roughly what share of items was animal-based (meat, dairy)?",
    a: "About one third",
  },
  {
    q: "Should we treat this catering as recurring monthly or one-off?",
    a: "Recurring monthly",
  },
];

export type RefineQuestionCardProps = {
  /** ms elapsed in the parent scene */
  elapsedMs: number;
  /** total scene duration */
  durationMs: number;
};

const ENTER_MS = 320;
const PER_CHAR_MS = 18;
const ANSWER_AFTER_MS = 280;
const ANSWER_FADE_MS = 220;

export function RefineQuestionCard({ elapsedMs, durationMs }: RefineQuestionCardProps) {
  const stagger = ENTER_MS;
  const perBlockMs = (durationMs - ENTER_MS - 600) / QUESTIONS.length;

  // Closed-form: footer transitions to refined once the last answer has settled.
  const lastAnswerSettleMs =
    ENTER_MS +
    (QUESTIONS.length - 1) * stagger +
    QUESTIONS.length * perBlockMs +
    ANSWER_FADE_MS;
  const refined = elapsedMs >= lastAnswerSettleMs;

  return (
    <div
      style={{
        height: "100%",
        background: "#171717",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        padding: "32px 48px",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <MessageCircle size={16} color="var(--brand-green, #3ecf8e)" strokeWidth={2} />
        <span
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "#b4b4b4",
          }}
        >
          Refine · Sonnet 4.6 · cluster_food
        </span>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.16px",
          color: "#fafafa",
          marginBottom: 28,
        }}
      >
        Three questions for you.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        {QUESTIONS.map((q, i) => {
          const blockStart = ENTER_MS + i * stagger;
          const t = elapsedMs - blockStart;

          // Type the question
          const typingStart = 0;
          const typingChars = Math.max(
            0,
            Math.min(q.q.length, Math.floor((t - typingStart) / PER_CHAR_MS))
          );
          const questionShown = q.q.slice(0, typingChars);

          // Show the answer after the question fully types in
          const typingDoneAt = typingStart + q.q.length * PER_CHAR_MS;
          const answerStart = typingDoneAt + ANSWER_AFTER_MS;
          const answerT = Math.max(
            0,
            Math.min(1, (t - answerStart) / ANSWER_FADE_MS)
          );

          return (
            <div
              key={q.q}
              style={{
                opacity: t >= 0 ? 1 : 0,
                transition: "opacity 200ms ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                    fontSize: 11,
                    color: "#898989",
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    paddingTop: 2,
                  }}
                >
                  Q{i + 1}
                </span>
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.45,
                    color: "#fafafa",
                    maxWidth: 720,
                  }}
                >
                  {questionShown}
                  {typingChars < q.q.length && t >= 0 ? (
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        width: 1,
                        height: 14,
                        background: "var(--brand-green, #3ecf8e)",
                        marginLeft: 1,
                        verticalAlign: "middle",
                        opacity: Math.floor(elapsedMs / 380) % 2 === 0 ? 1 : 0,
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  marginLeft: 38,
                  opacity: answerT,
                  transform: `translateY(${(1 - answerT) * 6}px)`,
                  transition: "opacity 220ms ease-out, transform 220ms ease-out",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 9999,
                  border: "1px solid var(--brand-green, #3ecf8e)",
                  background: "rgba(62, 207, 142, 0.10)",
                  color: "var(--brand-green-link, #00c573)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {answerT > 0 ? <Check size={12} strokeWidth={2.5} /> : null}
                {q.a}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer status */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid #242424",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: refined ? "var(--brand-green, #3ecf8e)" : "#898989",
          transition: "color 280ms ease-out",
        }}
      >
        {refined ? "✓ cluster_food refined · confidence 0.91" : "awaiting confirmation…"}
      </div>
    </div>
  );
}
