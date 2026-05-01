"use client";
import { motion } from "framer-motion";

interface Props { score: number }

const COLOR_MAP = [
  { max: 30, color: "#22c55e", label: "Healthy" },
  { max: 55, color: "#eab308", label: "Moderate" },
  { max: 75, color: "#f97316", label: "Elevated" },
  { max: 100, color: "#ef4444", label: "Critical" },
];

export function StressRing({ score }: Props) {
  const { color, label } = COLOR_MAP.find((c) => score <= c.max) ?? COLOR_MAP[3];
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(222 47% 11%)" strokeWidth="10" />
          <motion.circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold" style={{ color }}>{label}</p>
        <p className="text-xs text-muted-foreground">Financial Stress Score</p>
      </div>
    </div>
  );
}
