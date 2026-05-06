"use client";
import { motion } from "framer-motion";

interface Props { score: number }

const COLOR_MAP = [
  { max: 30, color: "#3F6B4A", label: "Healthy", textColor: "hsl(134 26% 33%)" },
  { max: 55, color: "#9C7A2E", label: "Moderate", textColor: "hsl(40 55% 39%)" },
  { max: 75, color: "#B8862A", label: "Elevated", textColor: "hsl(35 62% 44%)" },
  { max: 100, color: "#9B3A2C", label: "Critical", textColor: "hsl(8 55% 39%)" },
];

export function StressRing({ score }: Props) {
  const zone = COLOR_MAP.find((c) => score <= c.max) ?? COLOR_MAP[3];
  const angle = -90 + (score / 100) * 180;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Semicircular gauge — editorial style */}
      <svg viewBox="0 0 200 115" className="w-full max-w-[200px]" overflow="visible">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#3F6B4A" />
            <stop offset="50%" stopColor="#C9A455" />
            <stop offset="100%" stopColor="#9B3A2C" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="hsl(38 23% 72%)" strokeWidth="8" strokeLinecap="butt" />
        {/* Fill */}
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="url(#gauge-grad)" strokeWidth="8" strokeLinecap="butt" />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((t) => {
          const a = (-180 + (t / 100) * 180) * Math.PI / 180;
          const x1 = 100 + Math.cos(a) * 78, y1 = 100 + Math.sin(a) * 78;
          const x2 = 100 + Math.cos(a) * 68, y2 = 100 + Math.sin(a) * 68;
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(28 13% 9%)" strokeWidth="0.8" />;
        })}
        {/* Needle */}
        <motion.g
          initial={{ rotate: -90, originX: "100px", originY: "100px" }}
          animate={{ rotate: angle }}
          style={{ transformOrigin: "100px 100px" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <polygon points="100,32 97,100 103,100" fill="hsl(28 13% 9%)" />
          <circle cx="100" cy="100" r="5" fill="hsl(38 33% 91%)" stroke="hsl(28 13% 9%)" strokeWidth="1.5" />
        </motion.g>
      </svg>

      {/* Zone labels */}
      <div className="flex justify-between w-full max-w-[200px] px-1">
        {["HEALTHY", "MODERATE", "CRITICAL"].map((l) => (
          <span key={l} className="font-mono text-[8px] tracking-[0.12em] uppercase text-muted-foreground">{l}</span>
        ))}
      </div>

      {/* Score display */}
      <div className="flex items-baseline gap-3 border-t border-foreground/20 pt-4 w-full justify-center">
        <span className="font-mono font-light" style={{ fontSize: "4rem", color: zone.color, lineHeight: 1, fontStyle: "italic" }}>
          {score}
        </span>
        <div>
          <p className="font-display font-semibold text-base" style={{ color: zone.color }}>
            {zone.label}
          </p>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted-foreground mt-0.5">Financial Stress</p>
        </div>
      </div>
    </div>
  );
}
