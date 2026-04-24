import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ── Card ── */

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("ca-card", className)} {...p} />
);

export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-7 py-5", className)}
    style={{ borderBottom: "1px solid var(--border-faint)" }}
    {...p}
  />
);

export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn("text-sm font-semibold tracking-[-0.01em]", className)}
    style={{ color: "var(--text)" }}
    {...p}
  />
);

export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-7 py-5", className)} {...p} />
);

/* ── Stat ── */

export const Stat = ({
  label,
  value,
  sub,
  tone,
  serif,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "warning";
  serif?: boolean;
}) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="text-[10.5px] uppercase tracking-[0.6px] font-semibold"
      style={{ color: "var(--text-mute)" }}
    >
      {label}
    </div>
    <div
      className={cn(
        "text-2xl font-semibold tabular-nums tracking-[-0.02em]",
        serif && "font-serif font-normal",
      )}
      style={{
        color:
          tone === "positive"
            ? "var(--green-bright)"
            : tone === "warning"
              ? "var(--amber)"
              : "#fff",
      }}
    >
      {value}
    </div>
    {sub && (
      <div className="text-xs" style={{ color: "var(--text-mute)" }}>
        {sub}
      </div>
    )}
  </div>
);

/* ── Button ── */

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md";
  }
>(({ className, variant = "primary", size = "md", ...p }, ref) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background,box-shadow] duration-[120ms] ease-out whitespace-nowrap active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright";

  const sizeClass = size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-5 text-sm";

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      color: "#08140c",
      background: "linear-gradient(180deg, #7ae29f 0%, #30c06f 60%, #259556 100%)",
      boxShadow:
        "0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 20px rgba(48,192,111,0.28)",
    },
    secondary: {
      color: "var(--text)",
      background: "var(--bg-card-2)",
      boxShadow: "0 0 0 1px var(--border-strong) inset",
    },
    ghost: {
      color: "var(--text-dim)",
      background: "transparent",
      boxShadow: "0 0 0 1px var(--border) inset",
    },
  };

  return (
    <button
      ref={ref}
      className={cn(base, sizeClass, className)}
      style={variantStyles[variant]}
      {...p}
    />
  );
});
Button.displayName = "Button";

/* ── Badge / Chip ── */

export const Badge = ({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "positive" | "warning" | "info";
  children: React.ReactNode;
}) => {
  const tones: Record<string, React.CSSProperties> = {
    default: {
      background: "rgba(255,255,255,0.04)",
      color: "var(--text-dim)",
      border: "1px solid var(--border)",
    },
    positive: {
      background: "rgba(48,192,111,0.10)",
      color: "#86efac",
      border: "1px solid rgba(48,192,111,0.22)",
    },
    warning: {
      background: "rgba(217,164,65,0.10)",
      color: "#e6b968",
      border: "1px solid rgba(217,164,65,0.22)",
    },
    info: {
      background: "rgba(107,155,210,0.10)",
      color: "#9bbfe0",
      border: "1px solid rgba(107,155,210,0.22)",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      style={tones[tone]}
    >
      {children}
    </span>
  );
};

/* ── Confidence Bar ── */

export const ConfidenceBar = ({ value, animate }: { value: number; animate?: boolean }) => {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
        ? "var(--confidence-medium)"
        : "var(--confidence-low)";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "var(--text-mute)" }}>Confidence</span>
        <span className="tabular-nums font-semibold" style={{ color: "var(--text-dim)" }}>
          {pct}%
        </span>
      </div>
      <div
        className="h-[6px] w-full rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: `linear-gradient(90deg, ${tone}88, ${tone})`,
            boxShadow: `0 0 8px ${tone}40`,
            transition: animate ? "width 800ms cubic-bezier(.22,.8,.2,1)" : "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
};

/* ── KPI Chip (compact stat card) ── */

export const KpiChip = ({
  icon,
  label,
  value,
  unit,
  trend,
  trendTone = "green",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendTone?: "green" | "red" | "neutral";
}) => (
  <div className="ca-card flex items-center gap-3.5" style={{ padding: "14px 16px", minHeight: 62 }}>
    {icon && (
      <div
        className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border-faint)",
          color: "var(--green-bright)",
        }}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div
        className="text-[10.5px] uppercase tracking-[0.6px] font-semibold mb-[3px]"
        style={{ color: "var(--text-mute)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className="font-serif text-[22px] font-normal tracking-[-0.02em] leading-none tabular-nums"
          style={{ color: "#fff" }}
        >
          {value}
        </div>
        {unit && (
          <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>
            {unit}
          </div>
        )}
      </div>
    </div>
    {trend && (
      <div
        className="text-[11px] font-semibold flex items-center gap-0.5"
        style={{
          color:
            trendTone === "green"
              ? "var(--green-bright)"
              : trendTone === "red"
                ? "var(--red)"
                : "var(--text-mute)",
        }}
      >
        {trend}
      </div>
    )}
  </div>
);

/* ── Section Divider ── */

export const SectionDivider = ({ label }: { label?: string }) => (
  <div className={cn("section-divider my-1", !label && "section-divider--plain")}>
    {label && <span>{label}</span>}
  </div>
);

/* ── Donut Chart (SVG ring) ── */

export const DonutChart = ({
  segments,
  size = 180,
  thickness = 22,
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
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={thickness}
        />
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
            strokeLinecap="round"
            transform={`rotate(${arc.rotation} ${c} ${c})`}
            style={{
              filter: `drop-shadow(0 0 4px ${arc.color}44)`,
              transition: "stroke-dasharray 600ms ease-out",
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="font-serif text-[28px] font-normal tabular-nums leading-none"
          style={{ color: "#fff" }}
        >
          {segments.length}
        </div>
        <div className="text-[10px] uppercase tracking-[0.5px] mt-1" style={{ color: "var(--text-mute)" }}>
          categories
        </div>
      </div>
    </div>
  );
};

/* ── Pulse Dot ── */

export const PulseDot = ({ color = "var(--green)" }: { color?: string }) => (
  <span
    className="inline-block w-2 h-2 rounded-full"
    style={{
      background: color,
      animation: "pulse-dot 2.4s ease-in-out infinite",
    }}
  />
);
