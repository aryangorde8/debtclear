"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface Props {
  totalDebt: number;
  weightedAvgRate: number;
}

/**
 * Pulsing live counter showing interest accrued since the user opened the page.
 * Ticks at 10Hz so cents move smoothly. Pure visceral demo moment.
 */
export function LiveInterestTicker({ totalDebt, weightedAvgRate }: Props) {
  const [accrued, setAccrued] = useState(0);
  const startRef = useRef<number | null>(null);

  // Per-second interest = balance * apr/100 / (days/yr * sec/day)
  const perSecond = (totalDebt * (weightedAvgRate / 100)) / (365 * 24 * 60 * 60);

  useEffect(() => {
    if (perSecond <= 0) return;
    let raf = 0;
    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsedSec = (ts - startRef.current) / 1000;
      setAccrued(elapsedSec * perSecond);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [perSecond]);

  if (perSecond <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-amber-500/10 border border-amber-400/30 backdrop-blur-md"
    >
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Flame className="h-3 w-3 text-amber-300" />
      </motion.div>
      <span className="text-[10px] uppercase tracking-wider text-amber-200/80">Interest accruing</span>
      <span className="text-sm font-mono font-bold text-amber-200 tabular-nums">
        ${accrued.toFixed(4)}
      </span>
      <span className="text-[10px] text-amber-200/60">since you opened this page</span>
    </motion.div>
  );
}
