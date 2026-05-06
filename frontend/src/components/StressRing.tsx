"use client";
import { useEffect, useState } from "react";

interface Props { score: number }

const ZONES = [
  { max: 30,  color: "#3F6B4A", label: "Healthy"  },
  { max: 55,  color: "#9C7A2E", label: "Moderate" },
  { max: 75,  color: "#B87A2A", label: "Elevated" },
  { max: 100, color: "#9B3A2C", label: "Critical" },
];

export function StressRing({ score }: Props) {
  const zone = ZONES.find((z) => score <= z.max) ?? ZONES[3];

  // Animate the needle from far-left to actual position on mount.
  const targetAngle = -90 + (score / 100) * 180;
  const [angle, setAngle] = useState(-90);
  useEffect(() => {
    const t = setTimeout(() => setAngle(targetAngle), 80);
    return () => clearTimeout(t);
  }, [targetAngle]);

  return (
    <div className="w-full space-y-1">
      {/* Section header */}
      <div className="eyebrow mb-1">Section II · The Index</div>
      <h3 className="font-display text-base font-medium mb-4" style={{ fontStyle: "italic" }}>
        Financial stress
      </h3>

      {/* SVG Gauge */}
      <svg
        viewBox="0 0 200 115"
        className="w-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="gauge-grad-sr" x1="0%" x2="100%">
            <stop offset="0%"   stopColor="#3F6B4A" />
            <stop offset="45%"  stopColor="#C9A455" />
            <stop offset="100%" stopColor="#9B3A2C" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke="hsl(38 23% 72%)"
          strokeWidth="8"
          strokeLinecap="butt"
        />
        {/* Colored track */}
        <path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke="url(#gauge-grad-sr)"
          strokeWidth="8"
          strokeLinecap="butt"
        />

        {/* Tick marks at 0, 25, 50, 75, 100 */}
        {[0, 25, 50, 75, 100].map((t) => {
          const a = (-180 + (t / 100) * 180) * (Math.PI / 180);
          const x1 = 100 + Math.cos(a) * 76;
          const y1 = 100 + Math.sin(a) * 76;
          const x2 = 100 + Math.cos(a) * 65;
          const y2 = 100 + Math.sin(a) * 65;
          return (
            <line
              key={t}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(28 13% 9%)"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Needle — SVG native transform for reliable placement */}
        <g
          transform={`rotate(${angle} 100 100)`}
          style={{ transition: "transform 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          {/* Thin needle line */}
          <line
            x1="100" y1="100"
            x2="100" y2="26"
            stroke="hsl(28 13% 9%)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Small counterweight at base */}
          <line
            x1="100" y1="100"
            x2="100" y2="110"
            stroke="hsl(28 13% 9%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Center pivot circle */}
        <circle
          cx="100" cy="100" r="5"
          fill="hsl(38 33% 91%)"
          stroke="hsl(28 13% 9%)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Zone labels */}
      <div className="flex justify-between px-1 -mt-1">
        {["HEALTHY", "MODERATE", "CRITICAL"].map((l) => (
          <span key={l} className="font-mono text-[8px] tracking-[0.12em] uppercase text-muted-foreground">
            {l}
          </span>
        ))}
      </div>

      {/* Score display */}
      <div
        className="flex items-baseline gap-3 border-t border-foreground/20 pt-4 mt-2"
      >
        <span
          className="font-display font-light leading-none"
          style={{ fontSize: "5rem", color: zone.color, fontStyle: "italic" }}
        >
          {score}
        </span>
        <div>
          <p className="font-display font-semibold text-lg leading-none" style={{ color: zone.color }}>
            {zone.label}
          </p>
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground mt-1">
            Financial Stress
          </p>
        </div>
      </div>
    </div>
  );
}
