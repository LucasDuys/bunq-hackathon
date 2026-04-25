"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  METRIC_REGISTRY,
  isMetricKey,
  type MetricKey,
  type ScopeArgs,
} from "@/lib/explain/metrics";
import type { ExplainMessage } from "@/lib/explain/schema";

type Status = "idle" | "streaming" | "error";

type OpenArgs = {
  metric: MetricKey;
  scope?: ScopeArgs;
  triggerEl?: HTMLElement | null;
};

type ExplainContextValue = {
  open: boolean;
  metric: MetricKey | null;
  scope: ScopeArgs;
  messages: ExplainMessage[];
  headline: string | null;
  status: Status;
  error: string | null;
  /** Open the modal scoped to a metric. */
  openExplain: (args: OpenArgs) => void;
  /** Close the modal and abort any in-flight stream. */
  close: () => void;
  /** Send a follow-up question. */
  ask: (text: string) => void;
  /** Stop the current stream without closing the modal. */
  stop: () => void;
};

const ExplainContext = createContext<ExplainContextValue | null>(null);

export const useExplain = (): ExplainContextValue => {
  const ctx = useContext(ExplainContext);
  if (!ctx) throw new Error("useExplain must be used inside <ExplainProvider>");
  return ctx;
};

const sendStream = async (opts: {
  metric: MetricKey;
  scope: ScopeArgs;
  history: ExplainMessage[];
  signal: AbortSignal;
  onHeadline: (h: string) => void;
  onDelta: (d: string) => void;
  onError: (msg: string) => void;
  onDone: () => void;
}) => {
  const { metric, scope, history, signal, onHeadline, onDelta, onError, onDone } = opts;
  let res: Response;
  try {
    res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric, scope, messages: history }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError((err as Error).message ?? "Network error");
    return;
  }
  if (!res.ok || !res.body) {
    onError(`Request failed (${res.status})`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are split by `\n\n`. A frame is one or more `data:` lines.
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let event: { type: string; value?: string; message?: string };
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }
          if (event.type === "headline" && event.value) onHeadline(event.value);
          else if (event.type === "delta" && event.value) onDelta(event.value);
          else if (event.type === "error") onError(event.message ?? "Stream error");
          else if (event.type === "done") {
            onDone();
            return;
          }
        }
      }
    }
    onDone();
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError((err as Error).message ?? "Stream error");
  }
};

export const ExplainProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [scope, setScope] = useState<ScopeArgs>({});
  const [messages, setMessages] = useState<ExplainMessage[]>([]);
  const [headline, setHeadline] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === "streaming" ? "idle" : s));
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    // Restore focus to trigger element after the modal collapses.
    requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true });
      triggerRef.current = null;
    });
    // Reset on next tick so the closing animation has nothing to flicker.
    setTimeout(() => {
      setMetric(null);
      setScope({});
      setMessages([]);
      setHeadline(null);
      setError(null);
    }, 220);
  }, [stop]);

  const sendTurn = useCallback(
    (turnMetric: MetricKey, turnScope: ScopeArgs, history: ExplainMessage[]) => {
      stop();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus("streaming");
      setError(null);

      // Append a placeholder assistant message we mutate as deltas arrive.
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      void sendStream({
        metric: turnMetric,
        scope: turnScope,
        history,
        signal: ac.signal,
        onHeadline: (h) => setHeadline(h),
        onDelta: (d) =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + d };
            }
            return next;
          }),
        onError: (msg) => {
          setError(msg);
          setStatus("error");
        },
        onDone: () => {
          if (abortRef.current === ac) abortRef.current = null;
          setStatus((s) => (s === "error" ? s : "idle"));
        },
      });
    },
    [stop],
  );

  const openExplain = useCallback(
    (args: OpenArgs) => {
      if (!isMetricKey(args.metric)) return;
      stop();
      triggerRef.current = args.triggerEl ?? (document.activeElement as HTMLElement | null) ?? null;
      const nextScope = args.scope ?? {};
      // Reset thread when scope or metric changes.
      const sameTarget = open && metric === args.metric && JSON.stringify(scope) === JSON.stringify(nextScope);
      setOpen(true);
      setMetric(args.metric);
      setScope(nextScope);
      if (!sameTarget) {
        setMessages([]);
        setHeadline(null);
        setError(null);
        // First-turn: server resolves the headline + initial narration.
        sendTurn(args.metric, nextScope, []);
      }
    },
    [open, metric, scope, sendTurn, stop],
  );

  const ask = useCallback(
    (text: string) => {
      if (!metric || !text.trim()) return;
      const userMsg: ExplainMessage = { role: "user", content: text.trim() };
      const next = [...messages, userMsg];
      setMessages(next);
      sendTurn(metric, scope, next);
    },
    [metric, scope, messages, sendTurn],
  );

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Abort any in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const value = useMemo<ExplainContextValue>(
    () => ({
      open,
      metric,
      scope,
      messages,
      headline,
      status,
      error,
      openExplain,
      close,
      ask,
      stop,
    }),
    [open, metric, scope, messages, headline, status, error, openExplain, close, ask, stop],
  );

  return <ExplainContext.Provider value={value}>{children}</ExplainContext.Provider>;
};

/** Headline + suggested follow-ups for the current metric, or `null`. */
export const useCurrentMetricEntry = () => {
  const { metric } = useExplain();
  return metric ? METRIC_REGISTRY[metric] : null;
};
