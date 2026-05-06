"use client";
import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyzeResult } from "@/types";

interface Props {
  result: AnalyzeResult;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function MilestoneTimeline({ result }: Props) {
  const isAvalanche = result.recommended_strategy === "avalanche";
  const recommended = isAvalanche ? result.avalanche : result.snowball;
  const order = recommended.payoff_order;
  const months = recommended.payoff_months;

  if (!order || !months || order.length === 0 || order.length !== months.length) {
    return null;
  }

  const today = new Date();
  const totalMonths = recommended.months;

  const milestones = order.map((name, i) => {
    const m = months[i];
    const debt = result.debts.find((d) => d.name === name);
    return {
      name,
      month: m,
      date: addMonths(today, m),
      balance: debt?.balance ?? 0,
      isFinal: i === order.length - 1,
      progress: (m / totalMonths) * 100,
    };
  });

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3 border-b border-foreground/30">
        <div className="eyebrow mb-1">Section VI · The Calendar</div>
        <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
          Your road to{" "}
          <span style={{ color: "hsl(var(--green))" }}>debt-free.</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each marker is one debt eliminated — a permanent raise. {isAvalanche ? "Avalanche" : "Snowball"} order.
        </p>

        {/* Timeline track */}
        <div className="relative pt-2 pb-4">
          {/* Base track — thin ink line */}
          <div className="absolute left-0 right-0 top-10 h-px bg-foreground/20" />

          {/* Animated fill line */}
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute left-0 top-10 h-px"
            style={{ background: `linear-gradient(to right, hsl(var(--red)), hsl(var(--gold)), hsl(var(--green)))` }}
          />

          {/* TODAY marker */}
          <div className="absolute left-0 top-[34px] z-10">
            <div className="w-3 h-3 border-2 border-foreground" style={{ background: "hsl(var(--background))" }} />
            <div className="absolute top-5 left-0 -translate-x-1/4 whitespace-nowrap">
              <div className="font-mono text-[8px] tracking-[0.2em] uppercase" style={{ color: "hsl(var(--red))" }}>Now</div>
              <div className="font-mono text-[9px] text-muted-foreground">{formatMonthYear(today)}</div>
            </div>
          </div>

          {/* Milestone markers */}
          <div className="relative h-36">
            {milestones.map((ms, i) => {
              const left = `${Math.min(98, Math.max(2, ms.progress))}%`;
              const isAbove = i % 2 === 0;
              return (
                <motion.div
                  key={`${ms.name}-${ms.month}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 260 }}
                  className="absolute top-[34px] -translate-y-1/2 z-10"
                  style={{ left }}
                >
                  {/* Dot */}
                  <div
                    className="w-4 h-4 border-2 border-foreground flex items-center justify-center"
                    style={{
                      background: ms.isFinal ? "hsl(var(--green))" : "hsl(var(--gold))",
                    }}
                  />

                  {/* Label card */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${isAbove ? "-top-16" : "top-6"}`}
                  >
                    <div
                      className="border px-2 py-1"
                      style={{
                        background: ms.isFinal ? "hsl(var(--green) / 0.1)" : "hsl(var(--card))",
                        borderColor: ms.isFinal ? "hsl(var(--green))" : "hsl(var(--border))",
                      }}
                    >
                      <div className="font-display text-[10px] font-semibold text-foreground" style={{ fontStyle: "italic" }}>
                        {ms.isFinal ? "Debt-free!" : ms.name}
                      </div>
                      <div className="font-mono text-[8px] text-muted-foreground mt-0.5">
                        {formatMonthYear(ms.date)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Summary footer */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-foreground/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="h-3 w-3" style={{ color: "hsl(var(--gold))" }} />
            <span>
              First win in{" "}
              <span className="font-mono font-semibold" style={{ color: "hsl(var(--gold))" }}>
                {milestones[0].month} mo
              </span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            All clear by{" "}
            <span className="font-semibold" style={{ color: "hsl(var(--green))" }}>
              {formatMonthYear(milestones[milestones.length - 1].date)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
