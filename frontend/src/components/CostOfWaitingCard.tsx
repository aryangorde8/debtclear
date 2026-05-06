"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AnalyzeResult } from "@/types";

interface Props {
  result: AnalyzeResult;
}

const OPTIONS = [3, 6, 12];

function costOfDelay(totalDebt: number, weightedAvgRate: number, months: number): number {
  if (totalDebt <= 0 || weightedAvgRate <= 0 || months <= 0) return 0;
  return totalDebt * (weightedAvgRate / 100 / 12) * months;
}

export function CostOfWaitingCard({ result }: Props) {
  const [months, setMonths] = useState<number>(6);
  const cost = costOfDelay(result.total_debt, result.weighted_avg_rate, months);
  const dailyCost = cost / (months * 30);

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3 border-b border-foreground/30">
        <div className="eyebrow mb-1" style={{ color: "hsl(var(--red))" }}>A Warning · Section V</div>
        <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
          The cost of waiting.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every month you delay, your balances compound at{" "}
          <span className="font-mono font-medium text-foreground">{result.weighted_avg_rate.toFixed(1)}% weighted APR</span>.
          Here&apos;s what inaction actually costs.
        </p>

        {/* Month toggles — editorial button group */}
        <div className="flex border border-foreground">
          {OPTIONS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className="flex-1 py-2.5 font-mono text-xs tracking-[0.12em] uppercase transition-all"
              style={{
                borderRight: i < OPTIONS.length - 1 ? "1px solid hsl(var(--foreground))" : "none",
                background: months === m ? "hsl(var(--foreground))" : "transparent",
                color: months === m ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
              }}
            >
              {m} MO
            </button>
          ))}
        </div>

        <motion.div
          key={months}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-foreground/30 p-5 text-center bg-secondary/20"
        >
          <div className="eyebrow mb-2">Extra interest if you wait {months} mo</div>
          <div className="font-mono font-semibold" style={{ fontSize: "3rem", color: "hsl(var(--red))", lineHeight: 1, fontStyle: "italic" }}>
            <AnimatedNumber value={cost} prefix="$" duration={600} />
          </div>
          <p className="font-display text-sm mt-3 text-muted-foreground" style={{ fontStyle: "italic" }}>
            That&apos;s{" "}
            <span className="font-mono font-semibold not-italic" style={{ color: "hsl(var(--red))" }}>
              ${dailyCost.toFixed(2)}
            </span>{" "}
            disappearing each day.
          </p>
        </motion.div>

        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          ${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })} × {result.weighted_avg_rate.toFixed(2)}% APR ÷ 12 × {months} months.
          Conservative — assumes minimums continue; real cost is higher if payments slip.
        </p>
      </CardContent>
    </Card>
  );
}
