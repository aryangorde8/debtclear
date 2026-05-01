"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2, ChevronRight, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Debt, NegotiateResult } from "@/types";
import { negotiate } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  debt: Debt;
  financialContext: { monthly_income: number; total_debt: number; stress_score: number };
  debtCount: number;
  onClose: () => void;
}

const LEVERAGE_COLOR: Record<string, string> = {
  "Very High": "success",
  "High": "success",
  "Moderate": "warning",
  "Low": "destructive",
};

export function NegotiateModal({ debt, financialContext, debtCount, onClose }: Props) {
  const [result, setResult] = useState<NegotiateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await negotiate(debt, financialContext, debtCount);
      setResult(r);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load script");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.script.section_order
      .map(({ key, title }) => `${title}\n${result.script.sections[key]}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Script copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[85vh] bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="font-bold text-lg">{debt.name}</h2>
              <p className="text-sm text-muted-foreground">
                ${debt.balance.toLocaleString()} · {debt.rate}% APR
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {!result && !loading && (
              <div className="p-8 flex flex-col items-center gap-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Generate Negotiation Script</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    AI will analyze your leverage and write a complete, word-for-word phone script to settle this debt for less.
                  </p>
                </div>
                <button
                  onClick={load}
                  className="relative px-8 py-3 bg-white text-black rounded-full font-semibold text-base flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/20"
                >
                  <Sparkles className="h-4 w-4" /> Generate Script
                </button>
              </div>
            )}

            {loading && (
              <div className="p-12 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">AI is writing your script…</p>
              </div>
            )}

            {result && (
              <div className="p-5 space-y-5">
                {/* Savings banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Projected Savings</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold gradient-text-green">
                        <AnimatedNumber value={result.savings.dollars_saved} prefix="$" />
                      </div>
                      <div className="text-xs text-muted-foreground">Estimated Savings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        <AnimatedNumber value={result.savings_range.worst_case.percentage_saved} suffix="%" />
                        –<AnimatedNumber value={result.savings_range.best_case.percentage_saved} suffix="%" />
                      </div>
                      <div className="text-xs text-muted-foreground">Settlement Range</div>
                    </div>
                    <div>
                      <Badge variant={(LEVERAGE_COLOR[result.leverage_analysis.leverage_label] as "success" | "warning" | "destructive") ?? "outline"} className="text-sm px-3 py-1">
                        {result.leverage_analysis.leverage_label} Leverage
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">{result.leverage_analysis.debt_type_label}</div>
                    </div>
                  </div>
                </motion.div>

                {/* Script sections */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Phone Script</h3>
                    <Button size="sm" variant="outline" onClick={copyAll}>
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy All</>}
                    </Button>
                  </div>

                  {result.script.section_order.map(({ key, title }, idx) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => setActiveSection(activeSection === idx ? -1 : idx)}
                      >
                        <Card className={`bg-black/60 backdrop-blur-xl border-white/10 transition-all ${activeSection === idx ? "border-primary/50" : ""}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">{idx + 1}</span>
                                <span className="font-medium text-sm">{title}</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === idx ? "rotate-90" : ""}`} />
                            </div>
                            <AnimatePresence>
                              {activeSection === idx && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-9">
                                    {result.script.sections[key]}
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </button>
                    </motion.div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
