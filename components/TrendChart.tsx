"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const TrendChart = ({ data }: { data: Array<{ month: string; co2eKg: number; spendEur: number }> }) => (
  <div className="h-52">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30c06f" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#30c06f" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 5" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="month"
          stroke="var(--text-faint)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--text-faint)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v)}`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 14,
            fontSize: 12,
            background: "rgba(18,21,25,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(48,192,111,0.3)",
            boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6), 0 0 40px -10px rgba(48,192,111,0.3)",
            color: "var(--text)",
          }}
          formatter={(v) => [`${Number(v).toFixed(1)} kg`, "CO₂e"]}
          labelStyle={{ color: "var(--text-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}
        />
        <Area
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
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
