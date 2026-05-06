"use client";
import { motion } from "framer-motion";
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

  if (Math.abs(baseline.months - recommended.months) < 1 && Math.abs(baseline.total_interest - recommended.total_interest) < 1) {
    return null;
  }

  const interestDelta = baseline.total_interest - recommended.total_interest;
  const monthsDelta = baseline.months - recommended.months;
  const interestRatio = recommended.total_interest > 0 ? baseline.total_interest / recommended.total_interest : 0;

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3 border-b border-foreground/30">
        <div className="eyebrow mb-1">Section II · The Verdict</div>
        <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
          Why your plan matters.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Compared to making only minimum payments — the path most people follow by default.
        </p>

        <div className="grid grid-cols-2 divide-x divide-foreground border border-foreground">
          {/* Minimum only */}
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-5 bg-secondary/20"
          >
            <div className="eyebrow mb-3" style={{ color: "hsl(var(--red))" }}>Method — Minimum only</div>
            <div className="space-y-3">
              <div>
                <div className="font-mono font-bold text-2xl" style={{ color: "hsl(var(--red))" }}>
                  {formatYearsMonths(baseline.months)}
                </div>
                <div className="eyebrow mt-0.5">to debt-free</div>
              </div>
              <div>
                <div className="font-mono font-semibold text-lg" style={{ color: "hsl(var(--red))" }}>
                  ${baseline.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="eyebrow mt-0.5">in interest</div>
              </div>
            </div>
          </motion.div>

          {/* Your plan */}
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-5"
          >
            <div className="eyebrow mb-3" style={{ color: "hsl(var(--green))" }}>Your plan</div>
            <div className="space-y-3">
              <div>
                <div className="font-mono font-bold text-2xl" style={{ color: "hsl(var(--green))" }}>
                  {formatYearsMonths(recommended.months)}
                </div>
                <div className="eyebrow mt-0.5">to debt-free</div>
              </div>
              <div>
                <div className="font-mono font-semibold text-lg" style={{ color: "hsl(var(--gold))" }}>
                  ${recommended.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="eyebrow mt-0.5">in interest</div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border-l-4 pl-4 py-1"
          style={{ borderColor: "hsl(var(--gold))" }}
        >
          <p className="font-display text-base leading-relaxed" style={{ fontStyle: "italic" }}>
            &ldquo;Choosing your plan saves{" "}
            <span className="font-mono font-semibold not-italic" style={{ color: "hsl(var(--gold))" }}>
              ${interestDelta.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            {monthsDelta > 0 && (
              <> and{" "}
                <span className="font-mono font-semibold not-italic" style={{ color: "hsl(var(--gold))" }}>
                  {formatYearsMonths(monthsDelta)}
                </span>
                {" "}of your life
              </>
            )}
            {interestRatio > 1.5 && (
              <> — {interestRatio.toFixed(1)}× less interest paid</>
            )}
            . The plan isn&apos;t just better — it&apos;s a different financial future.&rdquo;
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
