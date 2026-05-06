"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2, ChevronRight, Sparkles, TrendingDown, Mic, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PhoneRoleplayModal } from "@/components/PhoneRoleplayModal";
import { SettlementLetterModal } from "@/components/SettlementLetterModal";
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
  const [roleplayOpen, setRoleplayOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);

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
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[85vh] paper-card overflow-hidden flex flex-col"
          style={{ borderRadius: 0, borderWidth: "1px" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-foreground">
            <div>
              <div className="eyebrow mb-1">Negotiation Script</div>
              <h2 className="font-display font-medium text-xl" style={{ fontStyle: "italic" }}>{debt.name}</h2>
              <p className="font-mono text-sm text-muted-foreground mt-0.5">
                ${debt.balance.toLocaleString()} · {debt.rate}% APR
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {!result && !loading && (
              <div className="p-10 flex flex-col items-center gap-6 text-center">
                <Sparkles className="h-10 w-10" style={{ color: "hsl(var(--gold))" }} />
                <div>
                  <h3 className="font-display text-2xl font-medium mb-2" style={{ fontStyle: "italic" }}>Generate Negotiation Script</h3>
                  <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                    AI will analyze your leverage and write a complete, word-for-word phone script to settle this debt for less.
                  </p>
                </div>
                <button onClick={load} className="btn-ink flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Generate Script
                </button>
              </div>
            )}

            {loading && (
              <div className="p-12 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: "hsl(var(--gold))" }} />
                <p className="font-mono text-sm text-muted-foreground">Writing your script…</p>
              </div>
            )}

            {result && (
              <div className="p-5 space-y-5">
                {/* Savings banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border border-foreground/40 p-5 bg-secondary/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4" style={{ color: "hsl(var(--green))" }} />
                    <span className="eyebrow">Projected Savings</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="font-mono font-bold text-2xl" style={{ color: "hsl(var(--gold))" }}>
                        <AnimatedNumber value={result.savings.dollars_saved} prefix="$" />
                      </div>
                      <div className="eyebrow mt-1">Estimated Savings</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-2xl text-foreground">
                        <AnimatedNumber value={result.savings_range.worst_case.percentage_saved} suffix="%" />
                        –<AnimatedNumber value={result.savings_range.best_case.percentage_saved} suffix="%" />
                      </div>
                      <div className="eyebrow mt-1">Settlement Range</div>
                    </div>
                    <div>
                      <Badge variant={(LEVERAGE_COLOR[result.leverage_analysis.leverage_label] as "success" | "warning" | "destructive") ?? "outline"} className="text-sm px-3 py-1">
                        {result.leverage_analysis.leverage_label} Leverage
                      </Badge>
                      <div className="eyebrow mt-1">{result.leverage_analysis.debt_type_label}</div>
                    </div>
                  </div>
                </motion.div>

                {/* Script sections */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-foreground/20">
                    <div className="eyebrow">Phone Script</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setRoleplayOpen(true)}
                        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-background transition-all"
                      >
                        <Mic className="h-3 w-3" /> Practice Call
                      </button>
                      <button
                        onClick={() => setLetterOpen(true)}
                        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase border border-foreground/40 px-3 py-1.5 text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
                      >
                        <FileText className="h-3 w-3" /> Letter
                      </button>
                      <Button size="sm" variant="outline" onClick={copyAll} className="font-mono text-[10px] tracking-[0.12em] uppercase h-auto py-1.5">
                        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy All</>}
                      </Button>
                    </div>
                  </div>

                  {result.script.section_order.map(({ key, title }, idx) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => setActiveSection(activeSection === idx ? -1 : idx)}
                      >
                        <div className={`border transition-all ${activeSection === idx ? "border-foreground" : "border-border"} p-4`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold" style={{ color: "hsl(var(--gold))" }}>
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="font-display font-medium text-sm" style={{ fontStyle: "italic" }}>{title}</span>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === idx ? "rotate-90" : ""}`} />
                          </div>
                          <AnimatePresence>
                            {activeSection === idx && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22 }}
                                className="overflow-hidden"
                              >
                                <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-7 border-t border-border/50 pt-3">
                                  {result.script.sections[key]}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      {roleplayOpen && result && (
        <PhoneRoleplayModal
          debt={debt}
          leverage={result.leverage_analysis}
          onClose={() => setRoleplayOpen(false)}
        />
      )}
      {letterOpen && result && (
        <SettlementLetterModal
          debt={debt}
          leverage={result.leverage_analysis}
          financialContext={{
            monthly_income: financialContext.monthly_income,
            total_debt: financialContext.total_debt,
          }}
          onClose={() => setLetterOpen(false)}
        />
      )}
    </AnimatePresence>
  );
}
