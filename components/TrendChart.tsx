"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const TrendChart = ({ data }: { data: Array<{ month: string; co2eKg: number; spendEur: number }> }) => (
  <div className="h-48">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} />
        <YAxis stroke="#71717a" fontSize={11} tickLine={false} tickFormatter={(v) => `${Math.round(v)}`} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`${v.toFixed(1)} kg`, "CO₂e"]}
        />
        <Area type="monotone" dataKey="co2eKg" stroke="#10b981" strokeWidth={2} fill="url(#co2grad)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
