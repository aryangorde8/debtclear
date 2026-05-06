"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sliders, Loader2, Calendar, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AnalyzeResult, Debt } from "@/types";
import { simulate, SimulateResult } from "@/lib/api";

interface Props {
  result: AnalyzeResult;
}

function formatPayoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function WhatIfSlider({ result }: Props) {
  const baselineExtra = result.extra_payment;
  const sumMin = result.debts.reduce((s, d) => s + d.min_payment, 0);
  const cap = Math.max(baselineExtra * 4, sumMin * 2, baselineExtra + 1000);

  const [extra, setExtra] = useState(baselineExtra);
  const [sim, setSim] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const isAvalanche = (sim?.recommended_strategy ?? result.recommended_strategy) === "avalanche";
  const months = sim ? (isAvalanche ? sim.avalanche.months : sim.snowball.months) : (isAvalanche ? result.avalanche.months : result.snowball.months);
  const interest = sim ? (isAvalanche ? sim.avalanche.total_interest : sim.snowball.total_interest) : (isAvalanche ? result.avalanche.total_interest : result.snowball.total_interest);

  const baselineMonths = isAvalanche ? result.avalanche.months : result.snowball.months;
  const baselineInterest = isAvalanche ? result.avalanche.total_interest : result.snowball.total_interest;
  const monthsDelta = months - baselineMonths;
  const interestDelta = interest - baselineInterest;

  useEffect(() => {
    if (Math.abs(extra - baselineExtra) < 0.5) {
      setSim(null);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current;
      try {
        const cleanDebts: Debt[] = result.debts.map((d) => ({
          name: d.name,
          balance: d.balance,
          rate: d.rate,
          min_payment: d.min_payment,
        }));
        const r = await simulate({
          monthly_income: result.monthly_income,
          extra_payment: Math.round(extra),
          debts: cleanDebts,
        });
        if (myId === reqIdRef.current) {
          setSim(r);
          setLoading(false);
        }
      } catch {
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [extra, baselineExtra, result.debts, result.monthly_income]);

  const pct = (extra / cap) * 100;

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3 border-b border-foreground/30">
        <div className="eyebrow mb-1">Section IV · The Lever</div>
        <div className="flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5" style={{ color: "hsl(var(--gold))" }} />
          <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
            What if you paid{" "}
            <span style={{ color: "hsl(var(--gold))" }}>more?</span>
          </CardTitle>
          {loading && <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* Slider */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <span className="eyebrow">Extra monthly payment</span>
            <span className="font-mono font-semibold text-2xl" style={{ color: "hsl(var(--gold))" }}>
              +${Math.round(extra).toLocaleString("en-US")}
            </span>
          </div>

          {/* Track + thumb */}
          <div className="relative h-14 mb-1">
            {/* Tooltip above thumb */}
            <div
              className="absolute top-0 font-mono text-[10px] tracking-wider font-semibold border border-foreground bg-foreground text-background px-2 py-1 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct}%` }}
            >
              +${Math.round(extra).toLocaleString()}
            </div>

            {/* Track at 28px from top */}
            <div className="absolute top-7 left-0 right-0 h-0.5 bg-border">
              <div
                className="h-full"
                style={{ width: `${pct}%`, background: "hsl(var(--gold))" }}
              />
            </div>

            {/* Thumb square */}
            <div
              className="absolute top-[22px] w-4 h-4 border-2 border-foreground -translate-x-1/2 pointer-events-none"
              style={{ left: `${pct}%`, background: "hsl(var(--gold))" }}
            />

            {/* Invisible range input */}
            <input
              type="range"
              min={0}
              max={Math.round(cap)}
              step={25}
              value={extra}
              onChange={(e) => setExtra(Number(e.target.value))}
              className="absolute inset-x-0 top-6 h-6 opacity-0 cursor-pointer w-full"
            />
          </div>

          <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
            <span>$0</span>
            <span style={{ color: "hsl(var(--green))" }}>
              Current: ${Math.round(baselineExtra).toLocaleString()}
            </span>
            <span>${Math.round(cap).toLocaleString()}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            key={`m-${months}`}
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            className="border border-foreground/30 p-4 bg-secondary/30"
          >
            <div className="eyebrow flex items-center gap-1 mb-2">
              <Calendar className="h-3 w-3" /> Debt-free in
            </div>
            <div className="font-mono font-bold text-2xl text-foreground">
              <AnimatedNumber value={months} suffix=" mo" duration={500} />
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">
              by {formatPayoffDate(months)}
            </div>
            {monthsDelta !== 0 && (
              <div
                className="font-mono text-xs mt-1 font-medium"
                style={{ color: monthsDelta < 0 ? "hsl(var(--green))" : "hsl(var(--red))" }}
              >
                {monthsDelta < 0 ? "↓ " : "↑ "}{Math.abs(monthsDelta)} mo vs current
              </div>
            )}
          </motion.div>

          <motion.div
            key={`i-${Math.round(interest)}`}
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            className="border border-foreground/30 p-4 bg-secondary/30"
          >
            <div className="eyebrow flex items-center gap-1 mb-2">
              <TrendingDown className="h-3 w-3" /> Total interest
            </div>
            <div className="font-mono font-bold text-2xl" style={{ color: "hsl(var(--gold))" }}>
              <AnimatedNumber value={interest} prefix="$" duration={500} />
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">
              over the lifetime
            </div>
            {Math.abs(interestDelta) > 1 && (
              <div
                className="font-mono text-xs mt-1 font-medium"
                style={{ color: interestDelta < 0 ? "hsl(var(--green))" : "hsl(var(--red))" }}
              >
                {interestDelta < 0 ? "↓ $" : "↑ $"}{Math.abs(Math.round(interestDelta)).toLocaleString()} vs current
              </div>
            )}
          </motion.div>
        </div>

        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          Drag to see how extra monthly payment changes your payoff date and total interest. Recalculated live from the same engine that produced your plan.
        </p>
      </CardContent>
    </Card>
  );
}
