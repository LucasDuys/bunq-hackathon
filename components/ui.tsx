import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ── Card ── */

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("ca-card ca-card--hover", className)} {...p} />
);

export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-6 py-4 flex items-center justify-between gap-4", className)}
    style={{ borderBottom: "1px solid var(--border-faint)" }}
    {...p}
  />
);

export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn("text-[17px] font-normal leading-[1.33] m-0", className)}
    style={{ color: "var(--fg-primary)", letterSpacing: "-0.16px" }}
    {...p}
  />
);

export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-6 py-5", className)} {...p} />
);

/* ── Eyebrow / CodeLabel — Source Code Pro 12px uppercase 1.2px ── */

export const CodeLabel = ({ className, children, ...p }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("code-label", className)} {...p}>
    {children}
  </span>
);

export const Eyebrow = CodeLabel;

/* ── Stat ── */

export const Stat = ({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "warning" | "danger";
  /** kept for backward compat; ignored — no serif in Supabase look */
  serif?: boolean;
}) => (
  <div className="flex flex-col gap-2">
    <CodeLabel>{label}</CodeLabel>
    <div
      className="text-[28px] font-normal leading-none tabular-nums tracking-[-0.01em]"
      style={{
        color:
          tone === "positive"
            ? "var(--brand-green)"
            : tone === "warning"
              ? "var(--status-warning)"
              : tone === "danger"
                ? "var(--status-danger)"
                : "var(--fg-primary)",
      }}
    >
      {value}
    </div>
    {sub && (
      <div className="text-[13px] leading-[1.4]" style={{ color: "var(--fg-secondary)" }}>
        {sub}
      </div>
    )}
  </div>
);

/* ── Button ── */

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
  }
>(({ className, variant = "primary", size = "md", ...p }, ref) => {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none transition-[border-color,background,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const sizeClass =
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-7 text-sm";

  // ghost is the only variant with a non-pill radius
  const shape = variant === "ghost" ? "rounded-[6px]" : "rounded-full";

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      color: "var(--fg-primary)",
      background: "var(--bg-button)",
      border: "1px solid var(--fg-primary)",
      outlineColor: "var(--brand-green)",
    },
    secondary: {
      color: "var(--fg-primary)",
      background: "var(--bg-button)",
      border: "1px solid var(--border-default)",
      outlineColor: "var(--brand-green)",
    },
    ghost: {
      color: "var(--fg-primary)",
      background: "transparent",
      border: "1px solid transparent",
      outlineColor: "var(--brand-green)",
    },
    danger: {
      color: "#fafafa",
      background: "var(--status-danger)",
      border: "1px solid var(--status-danger)",
      outlineColor: "var(--brand-green)",
    },
  };

  return (
    <button
      ref={ref}
      className={cn(base, sizeClass, shape, className)}
      style={variantStyles[variant]}
      {...p}
    />
  );
});
Button.displayName = "Button";

/* ── Badge — border-only chip ── */

export const Badge = ({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "positive" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) => {
  const map: Record<string, { color: string; border: string }> = {
    default:  { color: "var(--fg-secondary)", border: "var(--border-default)" },
    positive: { color: "var(--brand-green)",   border: "var(--brand-green-border)" },
    warning:  { color: "var(--status-warning)", border: "rgba(247,185,85,0.30)" },
    danger:   { color: "var(--status-danger)",  border: "rgba(229,72,77,0.30)" },
    info:     { color: "var(--status-info)",    border: "rgba(95,185,255,0.30)" },
  };
  const t = map[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-[12px] font-medium whitespace-nowrap",
        className,
      )}
      style={{ color: t.color, border: `1px solid ${t.border}`, background: "transparent" }}
    >
      {children}
    </span>
  );
};

/* ── Confidence Bar ── */

export const ConfidenceBar = ({
  value,
  animate,
}: {
  value: number;
  animate?: boolean;
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
        ? "var(--confidence-medium)"
        : "var(--confidence-low)";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <CodeLabel>Confidence</CodeLabel>
        <span
          className="tabular-nums text-[12px] font-medium"
          style={{ color: "var(--fg-secondary)" }}
        >
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-[6px] w-full rounded-full overflow-hidden"
        style={{ background: "var(--bg-inset)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: tone,
            transition: animate ? "width 500ms ease-out" : "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
};

/* ── KPI Chip — compact stat card ── */

export const KpiChip = ({
  icon,
  label,
  value,
  unit,
  trend,
  trendTone = "neutral",
  action,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendTone?: "green" | "red" | "neutral";
  /** Optional top-right slot, e.g. an Explain button. */
  action?: React.ReactNode;
}) => (
  <div
    className="ca-card ca-card--hover flex items-center gap-3 relative"
    style={{ padding: "16px 18px", minHeight: 76 }}
  >
    {icon && (
      <div
        className="w-8 h-8 rounded-[6px] grid place-items-center shrink-0"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border-faint)",
          color: "var(--brand-green)",
        }}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <CodeLabel className="block mb-1.5">{label}</CodeLabel>
      <div className="flex items-baseline gap-1.5">
        <div
          className="text-[24px] font-normal leading-none tabular-nums tracking-[-0.01em]"
          style={{ color: "var(--fg-primary)" }}
        >
          {value}
        </div>
        {unit && (
          <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
            {unit}
          </div>
        )}
      </div>
    </div>
    {trend && (
      <div
        className="text-[12px] font-medium tabular-nums"
        style={{
          color:
            trendTone === "green"
              ? "var(--brand-green)"
              : trendTone === "red"
                ? "var(--status-danger)"
                : "var(--fg-muted)",
        }}
      >
        {trend}
      </div>
    )}
    {action && (
      <div className="absolute top-2 right-2">
        {action}
      </div>
    )}
  </div>
);

/* ── Section Divider — single faint line ── */

export const SectionDivider = ({ label }: { label?: string }) => {
  if (label) {
    return (
      <div className="flex items-center gap-3 my-2">
        <CodeLabel>{label}</CodeLabel>
        <div className="flex-1 h-px" style={{ background: "var(--border-faint)" }} />
      </div>
    );
  }
  return <hr className="section-divider my-2" />;
};

/* ── Donut Chart (kept; restyled) ── */

export const DonutChart = ({
  segments,
  size = 180,
  thickness = 18,
  className,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  className?: string;
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = offset * 360 - 90;
    offset += pct;
    return { ...seg, dash, gap, rotation, pct };
  });

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-inset)" strokeWidth={thickness} />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeLinecap="butt"
            transform={`rotate(${arc.rotation} ${c} ${c})`}
            style={{ transition: "stroke-dasharray 600ms ease-out" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-[26px] font-normal tabular-nums leading-none"
          style={{ color: "var(--fg-primary)" }}
        >
          {segments.length}
        </div>
        <div className="mt-1.5">
          <CodeLabel>categories</CodeLabel>
        </div>
      </div>
    </div>
  );
};

/* ── Pulse Dot ── */

export const PulseDot = ({ color = "var(--brand-green)" }: { color?: string }) => (
  <span
    className="inline-block w-2 h-2 rounded-full"
    style={{
      background: color,
      animation: "pulse-dot 1.5s ease-in-out infinite",
    }}
  />
);
