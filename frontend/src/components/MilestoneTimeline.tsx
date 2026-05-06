"use client";
import { motion } from "framer-motion";
import { PartyPopper, Trophy, Flag } from "lucide-react";
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

  // Build milestone entries (one per debt) + a final "debt-free" milestone.
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
    <Card className="bg-black/50 backdrop-blur-xl border-white/10 border-emerald-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Trophy className="h-3.5 w-3.5 text-emerald-300" />
          </div>
          <CardTitle className="text-base">Your Victory Timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each debt eliminated is a permanent raise. Here&apos;s when each one disappears using the {isAvalanche ? "Avalanche" : "Snowball"} method.
        </p>

        <div className="relative pt-2 pb-4">
          {/* Track line */}
          <div className="absolute left-0 right-0 top-10 h-1 bg-white/5 rounded-full" />
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="absolute left-0 top-10 h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400 rounded-full"
          />

          {/* Start marker */}
          <div className="absolute left-0 top-8 -translate-y-1/2 z-10">
            <div className="w-4 h-4 rounded-full bg-white/30 border-2 border-white/60" />
            <div className="absolute top-7 left-0 -translate-x-1/4 whitespace-nowrap">
              <div className="text-[9px] uppercase tracking-wider text-white/40">Today</div>
              <div className="text-[10px] text-white/60 font-medium">{formatMonthYear(today)}</div>
            </div>
          </div>

          {/* Milestone markers */}
          <div className="relative h-32">
            {milestones.map((ms, i) => {
              const left = `${Math.min(98, Math.max(2, ms.progress))}%`;
              const isAbove = i % 2 === 0;
              return (
                <motion.div
                  key={`${ms.name}-${ms.month}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 300 }}
                  className="absolute top-8 -translate-y-1/2 z-10"
                  style={{ left }}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      ms.isFinal
                        ? "bg-emerald-400 border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.7)]"
                        : "bg-emerald-500/80 border-emerald-300"
                    }`}
                  >
                    {ms.isFinal ? (
                      <Trophy className="h-2.5 w-2.5 text-emerald-950" />
                    ) : (
                      <PartyPopper className="h-2 w-2 text-emerald-950" />
                    )}
                  </div>
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 ${
                      isAbove ? "-top-16" : "top-7"
                    } whitespace-nowrap`}
                  >
                    <div className={`rounded-md px-2 py-1 ${ms.isFinal ? "bg-emerald-500/20 border border-emerald-400/40" : "bg-white/5 border border-white/10"} backdrop-blur-md`}>
                      <div className="text-[10px] font-semibold text-white">
                        {ms.isFinal ? "Debt-free!" : `${ms.name} 🎉`}
                      </div>
                      <div className={`text-[9px] ${ms.isFinal ? "text-emerald-200" : "text-white/60"}`}>
                        {formatMonthYear(ms.date)} · m{ms.month}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Summary line */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="h-3 w-3 text-emerald-300" />
            <span>
              First win in <span className="text-emerald-300 font-semibold">{milestones[0].month} mo</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            All clear by{" "}
            <span className="gradient-text-green font-bold">
              {formatMonthYear(milestones[milestones.length - 1].date)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
