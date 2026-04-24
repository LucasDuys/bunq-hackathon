import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm", className)} {...p} />
);
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-4 border-b border-zinc-100 dark:border-zinc-900", className)} {...p} />
);
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-sm font-medium text-zinc-900 dark:text-zinc-50", className)} {...p} />
);
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-4", className)} {...p} />
);
export const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "default" | "positive" | "warning" }) => (
  <div className="flex flex-col gap-1">
    <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
    <div className={cn("text-2xl font-semibold tabular-nums", tone === "positive" && "text-emerald-600", tone === "warning" && "text-amber-600")}>{value}</div>
    {sub && <div className="text-xs text-zinc-500">{sub}</div>}
  </div>
);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }>(
  ({ className, variant = "primary", size = "md", ...p }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "secondary" && "border border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900",
        variant === "ghost" && "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900",
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = "Button";

export const Badge = ({ className, tone = "default", children }: { className?: string; tone?: "default" | "positive" | "warning" | "info"; children: React.ReactNode }) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    tone === "default" && "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    tone === "positive" && "bg-emerald-100 text-emerald-800",
    tone === "warning" && "bg-amber-100 text-amber-800",
    tone === "info" && "bg-sky-100 text-sky-800",
    className,
  )}>{children}</span>
);

export const ConfidenceBar = ({ value }: { value: number }) => (
  <div className="w-full">
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-zinc-500">Confidence</span>
      <span className="tabular-nums font-medium">{(value * 100).toFixed(0)}%</span>
    </div>
    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      <div className={cn("h-full", value > 0.85 ? "bg-emerald-500" : value > 0.6 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  </div>
);
