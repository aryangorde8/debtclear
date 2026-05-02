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

  const pct = ((extra - 0) / cap) * 100;

  return (
    <Card className="bg-black/50 backdrop-blur-xl border-white/10 border-emerald-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Sliders className="h-3.5 w-3.5 text-emerald-300" />
          </div>
          <CardTitle className="text-base">What If You Paid More?</CardTitle>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300/70 ml-auto" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-muted-foreground">Extra monthly payment</span>
            <span className="text-2xl font-bold gradient-text-green">
              ${Math.round(extra).toLocaleString("en-US")}
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={Math.round(cap)}
              step={25}
              value={extra}
              onChange={(e) => setExtra(Number(e.target.value))}
              className="w-full appearance-none cursor-pointer h-2 rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(16,185,129,0.6)] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, rgb(16,185,129) 0%, rgb(59,130,246) ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/70 mt-2">
            <span>$0</span>
            <span className="text-emerald-300/80">Current: ${Math.round(baselineExtra).toLocaleString("en-US")}</span>
            <span>${Math.round(cap).toLocaleString("en-US")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div
            key={`m-${months}`}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="rounded-xl bg-secondary/50 p-4"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Calendar className="h-3 w-3" /> Debt-free in
            </div>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={months} suffix=" mo" duration={500} />
            </div>
            <div className="text-xs text-muted-foreground/80 mt-0.5">
              by {formatPayoffDate(months)}
            </div>
            {monthsDelta !== 0 && (
              <div className={`text-xs mt-1 font-medium ${monthsDelta < 0 ? "text-emerald-300" : "text-amber-300"}`}>
                {monthsDelta < 0 ? "−" : "+"}{Math.abs(monthsDelta)} mo vs current
              </div>
            )}
          </motion.div>

          <motion.div
            key={`i-${Math.round(interest)}`}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="rounded-xl bg-secondary/50 p-4"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <TrendingDown className="h-3 w-3" /> Total interest
            </div>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={interest} prefix="$" duration={500} />
            </div>
            <div className="text-xs text-muted-foreground/80 mt-0.5">
              over the lifetime
            </div>
            {Math.abs(interestDelta) > 1 && (
              <div className={`text-xs mt-1 font-medium ${interestDelta < 0 ? "text-emerald-300" : "text-amber-300"}`}>
                {interestDelta < 0 ? "−" : "+"}${Math.abs(Math.round(interestDelta)).toLocaleString("en-US")} vs current
              </div>
            )}
          </motion.div>
        </div>

        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          Drag the slider to see how a different extra payment changes your payoff date and total interest in real time. Numbers come straight from the same simulator that produced your plan.
        </p>
      </CardContent>
    </Card>
  );
}
