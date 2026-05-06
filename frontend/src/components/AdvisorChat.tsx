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
    <Card className="paper-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-foreground">
        <div className="flex items-center gap-2">
          <div className="eyebrow">Section X · Ask the Advisor</div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <MessageCircle className="h-3.5 w-3.5" style={{ color: "hsl(var(--gold))" }} />
          <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>Ask Your Advisor</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {history.length === 0 && !loading && (
          <div className="border border-border p-4 bg-secondary/30">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "hsl(var(--gold))" }} />
              <p className="text-xs text-muted-foreground leading-relaxed">
                I have your full financial picture — every debt, your income, your stress score, your plan.
                Ask anything and I&apos;ll answer with <span className="text-foreground font-medium">your actual numbers</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 border border-border hover:border-foreground hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all font-mono"
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
                    className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed border ${
                      turn.role === "user"
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {turn.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "hsl(var(--gold))" }}>
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
                <div className="border border-border bg-card px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(var(--gold))" }} />
                  <span className="font-mono text-xs text-muted-foreground">Thinking…</span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border pt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your plan…"
            disabled={loading}
            maxLength={500}
            className="flex-1 px-4 py-2.5 border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-foreground hover:bg-foreground/80 text-background flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
