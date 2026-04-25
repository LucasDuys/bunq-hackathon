"use client";

import { ArrowUp, Square } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export type ExplainComposerHandle = {
  focus: () => void;
  setValue: (v: string) => void;
};

const MAX_ROWS = 4;
const MIN_HEIGHT = 40;
const ROW_HEIGHT = 20;

export const ExplainComposer = forwardRef<
  ExplainComposerHandle,
  {
    streaming: boolean;
    onSubmit: (text: string) => void;
    onStop: () => void;
    placeholder?: string;
  }
>(function ExplainComposer({ streaming, onSubmit, onStop, placeholder }, ref) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    setValue: (v) => setValue(v),
  }));

  // Autosize: clamp to MAX_ROWS rows.
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = MIN_HEIGHT + ROW_HEIGHT * (MAX_ROWS - 1);
    const next = Math.min(cap, Math.max(MIN_HEIGHT, el.scrollHeight));
    el.style.height = `${next}px`;
  }, [value]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    onSubmit(trimmed);
    setValue("");
  }, [value, streaming, onSubmit]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const trimmed = value.trim();
  const sendDisabled = streaming || trimmed.length === 0;

  return (
    <form
      className="explain-composer flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        placeholder={placeholder ?? "Ask a follow-up…"}
        aria-label="Ask a follow-up question"
        className={cn(
          "explain-input flex-1 resize-none rounded-[8px] px-3.5 py-[10px]",
          "text-[14px] leading-[1.4] outline-none",
          "placeholder:text-[var(--fg-faint)]",
        )}
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border-default)",
          color: "var(--fg-primary)",
          minHeight: MIN_HEIGHT,
        }}
      />
      {streaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          title="Stop"
          className={cn(
            "explain-send inline-flex items-center justify-center shrink-0",
            "h-10 w-10 rounded-full",
            "transition-[border-color,background] duration-150 ease-out",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          )}
          style={{
            color: "var(--fg-primary)",
            background: "var(--bg-button)",
            border: "1px solid var(--border-strong)",
            outlineColor: "var(--brand-green)",
          }}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          title="Send (Enter)"
          disabled={sendDisabled}
          className={cn(
            "explain-send inline-flex items-center justify-center shrink-0",
            "h-10 w-10 rounded-full",
            "transition-[border-color,background,opacity] duration-150 ease-out",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          )}
          style={{
            color: sendDisabled ? "var(--fg-muted)" : "var(--fg-primary)",
            background: "var(--bg-button)",
            border: `1px solid ${sendDisabled ? "var(--border-default)" : "var(--fg-primary)"}`,
            outlineColor: "var(--brand-green)",
          }}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </form>
  );
});
