"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AnalyzeResult } from "@/types";

interface Props { result: AnalyzeResult }

export function PayoffChart({ result }: Props) {
  const avalanche = result.avalanche.payoff_timeline ?? [];
  const snowball = result.snowball.payoff_timeline ?? [];
  const maxLen = Math.max(avalanche.length, snowball.length);

  const data = Array.from({ length: maxLen }, (_, i) => ({
    month: i,
    avalanche: avalanche[i] ?? 0,
    snowball: snowball[i] ?? 0,
  }));

  const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAvalanche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSnowball" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 14%)" />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
            tickFormatter={(v) => `M${v}`}
          />
          <YAxis
            tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
            tickFormatter={fmt}
          />
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(222 47% 14%)", borderRadius: "8px" }}
            labelStyle={{ color: "hsl(213 31% 91%)", fontSize: 12 }}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              name === "avalanche" ? "Avalanche" : "Snowball",
            ]}
            labelFormatter={(v) => `Month ${v}`}
          />
          <Legend
            formatter={(value) => <span style={{ color: "hsl(215 20% 65%)", fontSize: 12 }}>{value === "avalanche" ? "Avalanche" : "Snowball"}</span>}
          />
          <Area type="monotone" dataKey="avalanche" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAvalanche)" dot={false} />
          <Area type="monotone" dataKey="snowball" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorSnowball)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
