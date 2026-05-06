"use client";
import { motion } from "framer-motion";
import { Zap, Skull } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyzeResult } from "@/types";

interface Props {
  result: AnalyzeResult;
}

function formatYearsMonths(months: number): string {
  if (months <= 0) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y}y ${m}m`;
}

export function MinimumOnlyCompare({ result }: Props) {
  const isAvalanche = result.recommended_strategy === "avalanche";
  const recommended = isAvalanche ? result.avalanche : result.snowball;
  const baseline = result.minimum_only;

  // Edge case: extra_payment was already 0 → both simulations identical.
  // Don't render the comparison; there's nothing to compare.
  if (Math.abs(baseline.months - recommended.months) < 1 && Math.abs(baseline.total_interest - recommended.total_interest) < 1) {
    return null;
  }

  const interestDelta = baseline.total_interest - recommended.total_interest;
  const monthsDelta = baseline.months - recommended.months;
  const interestRatio = recommended.total_interest > 0 ? baseline.total_interest / recommended.total_interest : 0;

  return (
    <Card className="bg-black/50 backdrop-blur-xl border-white/10 border-violet-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-violet-300" />
          </div>
          <CardTitle className="text-base">Why Your Plan Matters</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Compared to making only the minimum payments — the path most people are on by default.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Doing nothing column */}
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl bg-red-500/5 border border-red-400/20 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Skull className="h-3.5 w-3.5 text-red-300" />
              <span className="text-xs uppercase tracking-wider text-red-200/80 font-semibold">Minimum only</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-2xl font-bold text-red-200">
                  {formatYearsMonths(baseline.months)}
                </div>
                <div className="text-[10px] text-red-200/60 uppercase tracking-wider">to debt-free</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-300">
                  ${baseline.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-red-200/60 uppercase tracking-wider">in interest</div>
              </div>
            </div>
          </motion.div>

          {/* Your plan column */}
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl bg-emerald-500/5 border border-emerald-400/30 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-xs uppercase tracking-wider text-emerald-200/80 font-semibold">Your plan</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-2xl font-bold text-emerald-200">
                  {formatYearsMonths(recommended.months)}
                </div>
                <div className="text-[10px] text-emerald-200/60 uppercase tracking-wider">to debt-free</div>
              </div>
              <div>
                <div className="text-lg font-bold gradient-text-green">
                  ${recommended.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-emerald-200/60 uppercase tracking-wider">in interest</div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-400/30 p-4"
        >
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-bold text-emerald-300">
              ${interestDelta.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            {" "}saved
            {monthsDelta > 0 && (
              <>
                {" "}and{" "}
                <span className="font-bold text-emerald-300">
                  {formatYearsMonths(monthsDelta)}
                </span>
                {" "}of your life back
              </>
            )}
            {interestRatio > 1.5 && (
              <>
                {" "}— that&apos;s{" "}
                <span className="font-bold text-emerald-300">
                  {interestRatio.toFixed(1)}×
                </span>
                {" "}less interest paid
              </>
            )}
            . The plan isn&apos;t just better — it&apos;s a different financial future.
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
