"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const TrendChart = ({ data }: { data: Array<{ month: string; co2eKg: number; spendEur: number }> }) => {
  const hasSpend = data.some((d) => d.spendEur > 0);
  const hasCo2 = data.some((d) => d.co2eKg > 0);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: hasSpend ? 0 : 8, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30c06f" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#30c06f" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="spendgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b9bd2" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#6b9bd2" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 5" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--text-faint)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            yAxisId="co2"
            stroke="var(--text-faint)"
            fontSize={10}
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
              stroke="var(--text-faint)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => (v === 0 ? "€0" : v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${Math.round(v)}`)}
            />
          )}
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              fontSize: 12,
              background: "rgba(18,21,25,0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6), 0 0 40px -10px rgba(48,192,111,0.2)",
              color: "var(--text)",
            }}
            formatter={(v, name) => {
              const n = Number(v);
              if (name === "co2eKg") return [`${n.toFixed(1)} kg`, "CO₂e"];
              return [`€ ${n.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`, "Spend"];
            }}
            labelStyle={{ color: "var(--text-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}
          />
          <Area
            yAxisId="co2"
            type="monotone"
            dataKey="co2eKg"
            stroke="#30c06f"
            strokeWidth={2.5}
            fill="url(#co2grad)"
            dot={false}
            activeDot={{ r: 5, fill: "#eafff1", stroke: "#30c06f", strokeWidth: 2 }}
            name="co2eKg"
          />
          {hasSpend && (
            <Area
              yAxisId="spend"
              type="monotone"
              dataKey="spendEur"
              stroke="#6b9bd2"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#spendgrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#d0e4f7", stroke: "#6b9bd2", strokeWidth: 2 }}
              name="spendEur"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {hasSpend && (
        <div className="flex items-center justify-center gap-5 mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
          <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded-full" style={{ background: "#30c06f" }} />CO₂e (kg)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded-full" style={{ background: "#6b9bd2", borderTop: "1px dashed #6b9bd2" }} />Spend (€)</span>
        </div>
      )}
    </div>
  );
};
