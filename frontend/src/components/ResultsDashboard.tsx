"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Clock, Sparkles, RefreshCw, HandshakeIcon, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StressRing } from "@/components/StressRing";
import { PayoffChart } from "@/components/PayoffChart";
import { DebtDonut } from "@/components/DebtDonut";
import { NegotiateModal } from "@/components/NegotiateModal";
import { WhatIfSlider } from "@/components/WhatIfSlider";
import { CostOfWaitingCard } from "@/components/CostOfWaitingCard";
import { CrisisResourcesPanel } from "@/components/CrisisResourcesPanel";
import { MinimumOnlyCompare } from "@/components/MinimumOnlyCompare";
import { MilestoneTimeline } from "@/components/MilestoneTimeline";
import { AdvisorChat } from "@/components/AdvisorChat";
import { downloadPlanPDF } from "@/lib/planPdf";
import { toast } from "sonner";
import { AnalyzeResult, Debt } from "@/types";

interface Props { result: AnalyzeResult; onReset: () => void }

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function ResultsDashboard({ result, onReset }: Props) {
  const [negotiateDebt, setNegotiateDebt] = useState<Debt | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isAvalanche = result.recommended_strategy === "avalanche";

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await downloadPlanPDF(result);
      toast.success("Plan PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const financialContext = {
    monthly_income: result.monthly_income,
    total_debt: result.total_debt,
    stress_score: result.stress_score,
  };

  return (
    <section className="py-16 px-6 md:px-12 border-t border-foreground/20">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header — editorial masthead style */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-foreground pb-6"
        >
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="eyebrow mb-2">Your Analysis · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
              <h2 className="font-display text-foreground" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 400 }}>
                Your Debt{" "}
                <span className="font-display" style={{ fontStyle: "italic", color: "hsl(var(--gold))" }}>
                  Analysis.
                </span>
              </h2>
              <p className="text-muted-foreground mt-1 text-sm font-mono">
                ${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })} across {result.debts.length} account{result.debts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePdf}
                disabled={pdfLoading}
                className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase border border-foreground px-3 py-2 hover:bg-foreground hover:text-background transition-all disabled:opacity-50"
              >
                {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                Download plan
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase border border-muted-foreground/40 px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" /> New Analysis
              </button>
            </div>
          </div>
        </motion.div>

        {/* Top stats — Stress + Strategy side by side */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Stress Ring */}
          <motion.div variants={fadeUp}>
            <Card className="paper-card h-full">
              <CardContent className="pt-5 px-5">
                <StressRing score={result.stress_score} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Strategy recommendation */}
          <motion.div variants={fadeUp} className="md:col-span-2">
            <Card className="paper-card h-full">
              <CardHeader className="pb-3 border-b border-foreground">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] tracking-[0.2em] uppercase border border-foreground px-2 py-0.5 bg-foreground text-background">
                    Recommended
                  </span>
                  <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
                    {isAvalanche ? "Avalanche Method" : "Snowball Method"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="eyebrow flex items-center gap-1"><Clock className="h-3 w-3" /> Debt Free In</p>
                    <p className="font-mono font-bold text-3xl text-foreground">
                      <AnimatedNumber value={isAvalanche ? result.avalanche.months : result.snowball.months} suffix=" mo" />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="eyebrow flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Interest Saved</p>
                    <p className="font-mono font-bold text-3xl" style={{ color: "hsl(var(--gold))" }}>
                      <AnimatedNumber value={result.interest_saved} prefix="$" />
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="border border-foreground/30 p-3 bg-secondary/30">
                    <p className="eyebrow mb-1">Avalanche</p>
                    <p className="font-mono font-semibold text-sm">{result.avalanche.months} mo · ${result.avalanche.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })} interest</p>
                  </div>
                  <div className="border border-foreground/30 p-3 bg-secondary/30">
                    <p className="eyebrow mb-1">Snowball</p>
                    <p className="font-mono font-semibold text-sm">{result.snowball.months} mo · ${result.snowball.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })} interest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Minimum-only baseline comparison */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <MinimumOnlyCompare result={result} />
        </motion.div>

        {/* What-if + Cost of waiting */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <motion.div variants={fadeUp}><WhatIfSlider result={result} /></motion.div>
          <motion.div variants={fadeUp}><CostOfWaitingCard result={result} /></motion.div>
        </motion.div>

        {/* Milestone timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <MilestoneTimeline result={result} />
        </motion.div>

        {/* Charts */}
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div variants={fadeUp}>
            <Card className="paper-card">
              <CardHeader className="border-b border-foreground/30 pb-3">
                <div className="eyebrow mb-0.5">Section VII · Figures</div>
                <CardTitle className="font-display font-medium text-lg" style={{ fontStyle: "italic" }}>Payoff Timeline</CardTitle>
              </CardHeader>
              <CardContent className="pt-4"><PayoffChart result={result} /></CardContent>
            </Card>
          </motion.div>
          <motion.div variants={fadeUp}>
            <Card className="paper-card">
              <CardHeader className="border-b border-foreground/30 pb-3">
                <div className="eyebrow mb-0.5">Section VIII · Breakdown</div>
                <CardTitle className="font-display font-medium text-lg" style={{ fontStyle: "italic" }}>Debt Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-4"><DebtDonut debts={result.debts} /></CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* AI Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="paper-card">
            <CardHeader className="border-b border-foreground pb-4">
              <div className="eyebrow mb-1">Section IX · The Advisor</div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--gold))" }} />
                <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>AI Financial Advisor</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                {result.ai_analysis.split("\n\n").filter(Boolean).map((para, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {para}
                  </motion.p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Advisor chat */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <AdvisorChat result={result} />
        </motion.div>

        {/* Crisis resources */}
        <CrisisResourcesPanel
          stressScore={result.stress_score}
          monthlyIncome={result.monthly_income}
          totalDebt={result.total_debt}
        />

        {/* Negotiate cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 border-b border-foreground pb-4">
            <div className="eyebrow mb-2">Section X · Negotiation</div>
            <h3 className="font-display text-2xl font-medium" style={{ fontStyle: "italic" }}>Negotiate Your Debts</h3>
            <p className="text-muted-foreground text-sm mt-1">Generate a word-for-word phone script to settle each debt for less.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.debts.map((debt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                whileHover={{ y: -2 }}
                onClick={() => setNegotiateDebt(debt)}
                className="paper-card cursor-pointer hover:bg-secondary/30 transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="font-display text-base font-medium mt-0.5" style={{ fontStyle: "italic" }}>{debt.name}</p>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{debt.rate}% APR</p>
                    </div>
                    <HandshakeIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <p className="font-mono font-bold text-2xl" style={{ color: "hsl(var(--gold))" }}>
                    ${debt.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">Min ${debt.min_payment}/mo</p>
                  <div className="mt-4 border-t border-foreground/20 pt-3">
                    <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground">Tap to negotiate →</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {negotiateDebt && (
        <NegotiateModal
          debt={negotiateDebt}
          financialContext={financialContext}
          debtCount={result.debts.length}
          onClose={() => setNegotiateDebt(null)}
        />
      )}
    </section>
  );
}
