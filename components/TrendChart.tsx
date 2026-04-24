"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#3ecf8e";
const INFO = "#5fb9ff";

export const TrendChart = ({ data }: { data: Array<{ month: string; co2eKg: number; spendEur: number }> }) => {
  const hasSpend = data.some((d) => d.spendEur > 0);
  const hasCo2 = data.some((d) => d.co2eKg > 0);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: hasSpend ? 0 : 8, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.16} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-faint)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--fg-muted)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.slice(5).toUpperCase()}
          />
          <YAxis
            yAxisId="co2"
            stroke="var(--fg-muted)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => (v === 0 ? "0" : `${Math.round(v)}`)}
            domain={hasCo2 ? ["auto", "auto"] : [0, 100]}
          />
          {hasSpend && (
            <YAxis
              yAxisId="spend"
              orientation="right"
              stroke="var(--fg-muted)"
              fontSize={11}
              fontFamily="var(--font-mono)"
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => (v === 0 ? "€0" : v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${Math.round(v)}`)}
            />
          )}
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              background: "var(--bg-canvas)",
              border: "1px solid var(--border-strong)",
              boxShadow: "none",
              color: "var(--fg-primary)",
              padding: "8px 12px",
            }}
            formatter={(v, name) => {
              const n = Number(v);
              if (name === "co2eKg") return [`${n.toFixed(1)} kg`, "CO₂e"];
              return [`€ ${n.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`, "Spend"];
            }}
            labelStyle={{
              color: "var(--fg-muted)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontFamily: "var(--font-mono)",
              marginBottom: 4,
            }}
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
          />
          <Area
            yAxisId="co2"
            type="monotone"
            dataKey="co2eKg"
            stroke={GREEN}
            strokeWidth={1.5}
            fill="url(#co2grad)"
            dot={false}
            activeDot={{ r: 4, fill: GREEN, stroke: "var(--bg-canvas)", strokeWidth: 2 }}
            name="co2eKg"
          />
          {hasSpend && (
            <Area
              yAxisId="spend"
              type="monotone"
              dataKey="spendEur"
              stroke={INFO}
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="transparent"
              dot={false}
              activeDot={{ r: 3, fill: INFO, stroke: "var(--bg-canvas)", strokeWidth: 2 }}
              name="spendEur"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {hasSpend && (
        <div
          className="flex items-center justify-center gap-6 mt-2 code-label"
          style={{ fontSize: 11 }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded-full" style={{ background: GREEN }} />
            CO₂e (kg)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[1px]" style={{ background: INFO, borderTop: `1px dashed ${INFO}` }} />
            Spend (€)
          </span>
        </div>
      )}
    </div>
  );
};
