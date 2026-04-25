"use client";

import { Sparkles } from "lucide-react";
import { type MouseEvent } from "react";
import { useExplain } from "./ExplainProvider";
import { METRIC_REGISTRY, type MetricKey, type ScopeArgs } from "@/lib/explain/metrics";
import { cn } from "@/lib/utils";

export const ExplainButton = ({
  metric,
  scope,
  className,
  size = "sm",
}: {
  metric: MetricKey;
  scope?: ScopeArgs;
  className?: string;
  size?: "xs" | "sm";
}) => {
  const { openExplain } = useExplain();
  const entry = METRIC_REGISTRY[metric];
  const ariaLabel = `Explain · ${entry.label}`;

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    openExplain({ metric, scope, triggerEl: e.currentTarget });
  };

  const dim = size === "xs" ? "h-6 w-6" : "h-7 w-7";
  const iconSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title="Explain this with AI"
      data-explain-button
      className={cn(
        "explain-btn inline-flex items-center justify-center shrink-0 rounded-[6px]",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        dim,
        className,
      )}
    >
      <Sparkles className={iconSize} aria-hidden />
    </button>
  );
};
