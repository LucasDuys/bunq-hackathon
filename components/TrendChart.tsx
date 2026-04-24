"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const TrendChart = ({ data }: { data: Array<{ month: string; co2eKg: number; spendEur: number }> }) => (
  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30c06f" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#30c06f" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="spendgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b9bd2" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6b9bd2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 5" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="month"
          stroke="var(--text-faint)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="co2"
          stroke="var(--text-faint)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v)}`}
        />
        <YAxis
          yAxisId="spend"
          orientation="right"
          stroke="var(--text-faint)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
        />
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
            return [`€ ${n.toFixed(0)}`, "Spend"];
          }}
          labelStyle={{ color: "var(--text-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 11, color: "var(--text-mute)", paddingTop: 8 }}
          formatter={(value: string) => (value === "co2eKg" ? "CO₂e (kg)" : "Spend (€)")}
        />
        <Area
          yAxisId="co2"
          type="monotone"
          dataKey="co2eKg"
          stroke="#30c06f"
          strokeWidth={2.5}
          fill="url(#co2grad)"
          dot={false}
          activeDot={{
            r: 5,
            fill: "#eafff1",
            stroke: "#30c06f",
            strokeWidth: 2,
          }}
        />
        <Area
          yAxisId="spend"
          type="monotone"
          dataKey="spendEur"
          stroke="#6b9bd2"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="url(#spendgrad)"
          dot={false}
          activeDot={{
            r: 4,
            fill: "#d0e4f7",
            stroke: "#6b9bd2",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
