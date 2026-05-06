"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Loader2, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Debt, AnalyzePayload, AnalyzeResult } from "@/types";
import { analyze } from "@/lib/api";
import { toast } from "sonner";

const LOADING_STEPS = [
  "Running Avalanche simulation…",
  "Running Snowball simulation…",
  "Calculating financial stress score…",
  "Generating AI analysis…",
];

function LoadingOverlay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 900);
    return () => clearInterval(interval);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "hsl(var(--background) / 0.92)", backdropFilter: "blur(4px)" }}
    >
      <div className="paper-card p-10 max-w-sm w-full mx-4 space-y-6">
        <div className="eyebrow">Analyzing your debts</div>
        <div className="border-t border-foreground mb-4" />
        <div className="space-y-4">
          {LOADING_STEPS.map((s, i) => (
            <motion.div
              key={s}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              {i < step ? (
                <CheckCircle2 className="h-4 w-4 text-ink-green flex-shrink-0" />
              ) : i === step ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-gold" style={{ color: "hsl(var(--gold))" }} />
              ) : (
                <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />
              )}
              <span className={`text-sm font-mono ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const EMPTY_DEBT: Debt = { name: "", balance: 0, rate: 0, min_payment: 0 };
const SAMPLE_INCOME = "5800";
const SAMPLE_EXTRA = "300";
const SAMPLE_DEBTS: Debt[] = [
  { name: "Chase Sapphire Card", balance: 8500, rate: 24.99, min_payment: 255 },
  { name: "Discover Card", balance: 4200, rate: 21.5, min_payment: 130 },
  { name: "Capital One Quicksilver", balance: 2800, rate: 19.99, min_payment: 90 },
  { name: "Personal Loan (Upstart)", balance: 6400, rate: 15.5, min_payment: 220 },
];

interface Props { onResult: (r: AnalyzeResult) => void }

export function DebtForm({ onResult }: Props) {
  const [income, setIncome] = useState("");
  const [extra, setExtra] = useState("");
  const [debts, setDebts] = useState<Debt[]>([{ ...EMPTY_DEBT }]);
  const [loading, setLoading] = useState(false);

  const addDebt = () => setDebts((d) => [...d, { ...EMPTY_DEBT }]);
  const removeDebt = (i: number) => setDebts((d) => d.filter((_, idx) => idx !== i));
  const loadSample = () => {
    setIncome(SAMPLE_INCOME);
    setExtra(SAMPLE_EXTRA);
    setDebts(SAMPLE_DEBTS.map((d) => ({ ...d })));
    toast.success("Sample data loaded — click Run Analysis");
    document.getElementById("form")?.scrollIntoView({ behavior: "smooth" });
  };
  const updateDebt = (i: number, field: keyof Debt, value: string) =>
    setDebts((d) => d.map((debt, idx) => idx === i ? { ...debt, [field]: field === "name" ? value : parseFloat(value) || 0 } : debt));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: AnalyzePayload = {
        monthly_income: parseFloat(income),
        extra_payment: parseFloat(extra) || 0,
        debts,
      };
      const result = await analyze(payload);
      onResult({ ...result, debts, extra_payment: parseFloat(extra) || 0 });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = debts.reduce((s, d) => s + (d.balance || 0), 0);
  const totalMin = debts.reduce((s, d) => s + (d.min_payment || 0), 0);

  return (
    <>
      {loading && <LoadingOverlay />}
      <section id="form" className="py-20 md:py-28 px-6 md:px-12 border-b border-foreground/20">
        <div className="max-w-4xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-end justify-between mb-8 flex-wrap gap-4"
          >
            <div>
              <div className="eyebrow mb-3">Section I · The Ledger</div>
              <h2 className="font-display text-foreground" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 400 }}>
                Your debts.
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase border border-muted-foreground/40 px-2 py-1 text-muted-foreground">◉ STAYS LOCAL</span>
              <button
                type="button"
                onClick={loadSample}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border-b border-transparent hover:border-muted-foreground transition-all pb-px"
              >
                <Sparkles className="h-3 w-3" />
                Try sample data
              </button>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onSubmit={handleSubmit}
            className="paper-card"
          >
            {/* Monthly finances header row */}
            <div className="p-6 md:p-8 border-b border-foreground">
              <div className="eyebrow mb-4">Monthly Finances</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="eyebrow block mb-2">Monthly income</label>
                  <div className="flex items-baseline border-b border-foreground pb-2">
                    <span className="font-mono text-lg text-muted-foreground mr-1">$</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="5,000"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      required
                      className="flex-1 font-mono text-xl bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="eyebrow block mb-2">Extra monthly payment</label>
                  <div className="flex items-baseline border-b border-foreground pb-2">
                    <span className="font-mono text-lg text-muted-foreground mr-1">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="200"
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      required
                      className="flex-1 font-mono text-xl bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Debt table header */}
            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_2rem] gap-x-4 px-6 md:px-8 py-3 border-b border-foreground bg-secondary/50">
              <span className="eyebrow">No.</span>
              <span className="eyebrow">Account</span>
              <span className="eyebrow text-right">Balance</span>
              <span className="eyebrow text-right">APR</span>
              <span className="eyebrow text-right">Min/mo</span>
              <span />
            </div>

            {/* Debt rows */}
            <AnimatePresence mode="popLayout">
              {debts.map((debt, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_2rem] gap-x-4 px-6 md:px-8 py-4 border-b border-border items-center"
                >
                  <span className="font-mono text-xs text-gold font-semibold" style={{ color: "hsl(var(--gold))" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    placeholder="Account name"
                    value={debt.name}
                    onChange={(e) => updateDebt(i, "name", e.target.value)}
                    className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40 font-display italic"
                    style={{ fontStyle: "italic" }}
                  />
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="0"
                      value={debt.balance || ""}
                      onChange={(e) => updateDebt(i, "balance", e.target.value)}
                      required
                      className="font-mono text-sm text-right bg-transparent outline-none w-20 text-foreground placeholder:text-muted-foreground/40"
                      style={{ color: "hsl(var(--gold))" }}
                    />
                  </div>
                  <div className="flex items-baseline justify-end gap-0.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={debt.rate || ""}
                      onChange={(e) => updateDebt(i, "rate", e.target.value)}
                      required
                      className="font-mono text-sm text-right bg-transparent outline-none w-14"
                      style={{ color: debt.rate > 20 ? "hsl(var(--red))" : "hsl(var(--foreground))" }}
                    />
                    <span className="font-mono text-xs text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="0"
                      value={debt.min_payment || ""}
                      onChange={(e) => updateDebt(i, "min_payment", e.target.value)}
                      required
                      className="font-mono text-sm text-right bg-transparent outline-none w-16 text-foreground placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {debts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeDebt(i)}
                      className="text-muted-foreground/40 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : <span />}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add debt row */}
            <button
              type="button"
              onClick={addDebt}
              disabled={debts.length >= 20}
              className="w-full flex items-center justify-center gap-2 py-4 border-b border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all border-dashed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add another debt
            </button>

            {/* Totals */}
            <div className="px-6 md:px-8 py-6 border-t border-foreground bg-secondary/30">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <div className="eyebrow mb-1">Total balance</div>
                  <div className="font-mono font-semibold" style={{ fontSize: "2.5rem", color: "hsl(var(--gold))", lineHeight: 1 }}>
                    ${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="eyebrow mb-1">Total minimums</div>
                  <div className="font-mono font-semibold" style={{ fontSize: "2.5rem", lineHeight: 1 }}>
                    ${totalMin.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    <span className="text-base text-muted-foreground">/mo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 md:px-8 py-6">
              <button
                type="submit"
                disabled={loading}
                className="btn-ink w-full flex items-center justify-center gap-2 text-base py-4"
              >
                Run Analysis <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Your data never leaves your browser. No accounts, no tracking.
          </p>
        </div>
      </section>
    </>
  );
}
