"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Clock, Sparkles, RefreshCw, HandshakeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StressRing } from "@/components/StressRing";
import { PayoffChart } from "@/components/PayoffChart";
import { DebtDonut } from "@/components/DebtDonut";
import { NegotiateModal } from "@/components/NegotiateModal";
import { AnalyzeResult, Debt } from "@/types";

interface Props { result: AnalyzeResult; onReset: () => void }

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const card = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};


export function ResultsDashboard({ result, onReset }: Props) {
  const [negotiateDebt, setNegotiateDebt] = useState<Debt | null>(null);
  const isAvalanche = result.recommended_strategy === "avalanche";

  const financialContext = {
    monthly_income: result.monthly_income,
    total_debt: result.total_debt,
    stress_score: result.stress_score,
  };

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <h2 className="text-3xl font-bold">Your Debt Analysis</h2>
            <p className="text-muted-foreground mt-1">
              Total debt: <span className="text-foreground font-semibold">${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              {" "}· {result.debts.length} account{result.debts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCw className="h-3.5 w-3.5" /> New Analysis
          </Button>
        </motion.div>

        {/* Top stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Stress Ring */}
          <motion.div variants={card}>
            <Card className="bg-black/50 backdrop-blur-xl border-white/10 h-full">
              <CardContent className="pt-6 flex justify-center">
                <StressRing score={result.stress_score} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Strategy recommendation */}
          <motion.div variants={card} className="md:col-span-2">
            <Card className={`glass h-full border-2 ${isAvalanche ? "border-blue-500/30" : "border-violet-500/30"} glow-blue`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={isAvalanche ? "default" : "purple"} className="text-xs">Recommended</Badge>
                  <CardTitle className="gradient-text">{isAvalanche ? "Avalanche Method" : "Snowball Method"}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Debt Free In</p>
                    <p className="text-3xl font-bold text-foreground">
                      <AnimatedNumber value={isAvalanche ? result.avalanche.months : result.snowball.months} suffix=" mo" />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Interest Saved</p>
                    <p className="text-3xl font-bold gradient-text-green">
                      <AnimatedNumber value={result.interest_saved} prefix="$" />
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Avalanche</p>
                    <p className="font-semibold text-sm">{result.avalanche.months} mo · ${result.avalanche.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })} interest</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Snowball</p>
                    <p className="font-semibold text-sm">{result.snowball.months} mo · ${result.snowball.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })} interest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Charts */}
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div variants={card}>
            <Card className="bg-black/50 backdrop-blur-xl border-white/10">
              <CardHeader><CardTitle className="text-base">Payoff Timeline</CardTitle></CardHeader>
              <CardContent><PayoffChart result={result} /></CardContent>
            </Card>
          </motion.div>
          <motion.div variants={card}>
            <Card className="bg-black/50 backdrop-blur-xl border-white/10">
              <CardHeader><CardTitle className="text-base">Debt Breakdown</CardTitle></CardHeader>
              <CardContent><DebtDonut debts={result.debts} /></CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* AI Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card className="bg-black/50 backdrop-blur-xl border-white/10 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-base">AI Financial Advisor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.ai_analysis.split("\n\n").filter(Boolean).map((para, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {para}
                  </motion.p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Negotiate cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-5">
            <h3 className="text-xl font-bold">Negotiate Your Debts</h3>
            <p className="text-muted-foreground text-sm mt-1">Generate a word-for-word phone script to settle each debt for less.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.debts.map((debt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card className="bg-black/50 backdrop-blur-xl border-white/10 cursor-pointer border-border hover:border-primary/40 transition-all" onClick={() => setNegotiateDebt(debt)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm">{debt.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{debt.rate}% APR</p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <HandshakeIcon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      ${debt.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Min ${debt.min_payment}/mo</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-primary font-medium">Tap to negotiate →</span>
                    </div>
                  </CardContent>
                </Card>
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
