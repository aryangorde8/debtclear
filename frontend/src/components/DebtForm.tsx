"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Loader2, ArrowRight, DollarSign, Percent, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Debt, AnalyzePayload, AnalyzeResult } from "@/types";
import { analyze } from "@/lib/api";
import { toast } from "sonner";

const EMPTY_DEBT: Debt = { name: "", balance: 0, rate: 0, min_payment: 0 };

interface Props { onResult: (r: AnalyzeResult) => void }

export function DebtForm({ onResult }: Props) {
  const [income, setIncome] = useState("");
  const [extra, setExtra] = useState("");
  const [debts, setDebts] = useState<Debt[]>([{ ...EMPTY_DEBT }]);
  const [loading, setLoading] = useState(false);

  const addDebt = () => setDebts((d) => [...d, { ...EMPTY_DEBT }]);
  const removeDebt = (i: number) => setDebts((d) => d.filter((_, idx) => idx !== i));
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

  return (
    <section id="form" className="relative py-32 px-4 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
            </span>
            <span className="text-xs text-white/70">Step 1 of 2</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold mb-4 leading-[1.05]">
            <span className="bg-gradient-to-r from-blue-200 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
              Enter Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
              Numbers.
            </span>
          </h2>
          <p className="text-white/60 text-lg max-w-md mx-auto">
            Exact figures give you exact results. Nothing leaves your browser.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Income card */}
          <div className="relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-cyan-500/20 rounded-2xl blur opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-blue-300" />
                </div>
                <h3 className="font-semibold text-white">Monthly Finances</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-white/50">Monthly Income</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="5,000"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-400/50 focus:bg-white/[0.07]"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-white/50">Extra Monthly Payment</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="200"
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-400/50 focus:bg-white/[0.07]"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Debts header */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-white/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-violet-300" />
              </div>
              <h3 className="font-semibold text-white">Your Debts</h3>
              <span className="text-xs text-white/50 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{debts.length}</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addDebt}
              disabled={debts.length >= 20}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white h-9"
            >
              <Plus className="h-3.5 w-3.5" /> Add Debt
            </Button>
          </div>

          {/* Debt cards */}
          <AnimatePresence mode="popLayout">
            {debts.map((debt, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative group"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs uppercase tracking-wider text-white/40">Debt #{i + 1}</span>
                    {debts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDebt(i)}
                        className="text-white/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs uppercase tracking-wider text-white/50">Name</label>
                      <Input
                        placeholder="Chase Sapphire Card"
                        value={debt.name}
                        onChange={(e) => updateDebt(i, "name", e.target.value)}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-400/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-white/50">Balance</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                        <Input
                          type="number"
                          step="any"
                          min="1"
                          placeholder="8,500"
                          value={debt.balance || ""}
                          onChange={(e) => updateDebt(i, "balance", e.target.value)}
                          className="pl-7 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-400/50"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1">
                        APR <Percent className="h-2.5 w-2.5" />
                      </label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        placeholder="22.99"
                        value={debt.rate || ""}
                        onChange={(e) => updateDebt(i, "rate", e.target.value)}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-400/50"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-4 space-y-2">
                      <label className="text-xs uppercase tracking-wider text-white/50">Min. Payment / month</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                        <Input
                          type="number"
                          step="any"
                          min="1"
                          placeholder="200"
                          value={debt.min_payment || ""}
                          onChange={(e) => updateDebt(i, "min_payment", e.target.value)}
                          className="pl-7 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-400/50"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Submit button — matches hero primary CTA */}
          <div className="relative group pt-4 flex justify-center">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-400/40 via-violet-400/40 to-fuchsia-400/40 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <button
              type="submit"
              disabled={loading}
              className="relative px-10 py-4 bg-white text-black rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/20 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Running AI Analysis…</>
              ) : (
                <>Run Analysis <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-white/40 pt-2">
            Your data never leaves your browser. No accounts, no tracking.
          </p>
        </motion.form>
      </div>

      {/* Bottom fade-out */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
    </section>
  );
}
