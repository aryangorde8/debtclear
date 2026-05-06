"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyzeResult, ChatTurn } from "@/types";
import { askAdvisor } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  result: AnalyzeResult;
}

const SUGGESTED: string[] = [
  "What if I lose my job?",
  "Should I refinance my highest-rate card?",
  "What if I get a $5,000 windfall?",
  "Is bankruptcy worth considering?",
  "Should I stop investing to pay debt faster?",
  "How do I free up more cash each month?",
];

export function AdvisorChat({ result }: Props) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Snapshot we send with every turn — same structure regardless of state.
  const snapshot = {
    monthly_income: result.monthly_income,
    extra_payment: result.extra_payment,
    total_debt: result.total_debt,
    weighted_avg_rate: result.weighted_avg_rate,
    stress_score: result.stress_score,
    debts: result.debts,
    recommended_strategy: result.recommended_strategy,
    avalanche: { months: result.avalanche.months, total_interest: result.avalanche.total_interest },
    snowball: { months: result.snowball.months, total_interest: result.snowball.total_interest },
    minimum_only: {
      months: result.minimum_only.months,
      total_interest: result.minimum_only.total_interest,
    },
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");
    const next: ChatTurn[] = [...history, { role: "user", content: question }];
    setHistory(next);
    setLoading(true);
    try {
      const r = await askAdvisor(snapshot, history, question);
      setHistory((cur) => [...cur, { role: "assistant", content: r.text }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach advisor");
      // Roll back the user turn so the user can retry without duplicating.
      setHistory((cur) => cur.slice(0, -1));
      setInput(question);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <Card className="bg-black/50 backdrop-blur-xl border-white/10 border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MessageCircle className="h-3.5 w-3.5 text-primary" />
          </div>
          <CardTitle className="text-base">Ask Your Advisor</CardTitle>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-300/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 && !loading && (
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                I have your full financial picture in front of me — every debt, your income, your stress score, your plan.
                Ask me anything follow-up and I&apos;ll answer with <span className="text-foreground font-medium">your actual numbers</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {(history.length > 0 || loading) && (
          <div
            ref={scrollRef}
            className="max-h-[420px] overflow-y-auto space-y-3 pr-1 -mr-1 scroll-smooth"
          >
            <AnimatePresence initial={false}>
              {history.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      turn.role === "user"
                        ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
                        : "bg-white/5 border border-white/10 text-muted-foreground rounded-bl-sm"
                    }`}
                  >
                    {turn.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
                        <Sparkles className="h-2.5 w-2.5" />
                        Advisor
                      </div>
                    )}
                    <p className="whitespace-pre-line">{turn.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your plan…"
            disabled={loading}
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
