"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Hourglass, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AnalyzeResult } from "@/types";

interface Props {
  result: AnalyzeResult;
}

const OPTIONS = [3, 6, 12];

/**
 * Cost of waiting = additional interest accrued on the current balance over the
 * delay window at the weighted average rate, while still making minimums.
 *
 * It's a conservative lower-bound: if the user is currently paying extra, the
 * delay also wipes out that progress, but we keep the math transparent and
 * just show the new interest accrual.
 */
function costOfDelay(totalDebt: number, weightedAvgRate: number, months: number): number {
  if (totalDebt <= 0 || weightedAvgRate <= 0 || months <= 0) return 0;
  const monthlyRate = weightedAvgRate / 100 / 12;
  return totalDebt * monthlyRate * months;
}

export function CostOfWaitingCard({ result }: Props) {
  const [months, setMonths] = useState<number>(6);
  const cost = costOfDelay(result.total_debt, result.weighted_avg_rate, months);
  const dailyCost = cost / (months * 30);

  return (
    <Card className="bg-black/50 backdrop-blur-xl border-amber-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Hourglass className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <CardTitle className="text-base">The Cost of Waiting</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every month you delay starting your plan, your balances keep compounding at{" "}
          <span className="text-amber-300 font-medium">{result.weighted_avg_rate.toFixed(1)}% weighted APR</span>.
          Here&apos;s what inaction actually costs.
        </p>

        <div className="flex gap-2">
          {OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                months === m
                  ? "bg-amber-500/20 border border-amber-400/40 text-amber-200"
                  : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              Wait {m} mo
            </button>
          ))}
        </div>

        <motion.div
          key={months}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-amber-500/10 to-red-500/5 border border-amber-400/20 p-5 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-amber-300" />
            <span className="text-xs uppercase tracking-wider text-amber-200/80">Extra interest paid</span>
          </div>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-red-300">
            <AnimatedNumber value={cost} prefix="$" duration={600} />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            That&apos;s roughly{" "}
            <span className="text-amber-200 font-medium">
              ${dailyCost.toFixed(2)} a day
            </span>{" "}
            disappearing into interest while you wait.
          </div>
        </motion.div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Calculation: ${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })} × {result.weighted_avg_rate.toFixed(2)}% APR ÷ 12 × {months} months. Conservative — assumes you keep making minimums; actual cost is higher if minimums slip.
        </p>
      </CardContent>
    </Card>
  );
}
