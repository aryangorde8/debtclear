"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Debt } from "@/types";

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa"];

interface Props { debts: Debt[] }

export function DebtDonut({ debts }: Props) {
  const data = debts.map((d) => ({ name: d.name, value: d.balance }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(222 47% 14%)", borderRadius: "8px" }}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })} (${((Number(value) / total) * 100).toFixed(0)}%)`,
              name,
            ]}
          />
          <Legend
            formatter={(value) => <span style={{ color: "hsl(215 20% 65%)", fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
