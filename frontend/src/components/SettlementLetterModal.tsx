"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Download, Copy, Check, FileText, Sparkles } from "lucide-react";
import { Debt, LeverageAnalysis } from "@/types";
import { generateLetter } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  debt: Debt;
  leverage: LeverageAnalysis;
  financialContext: { monthly_income: number; total_debt: number };
  onClose: () => void;
}

function formatLetterDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function SettlementLetterModal({ debt, leverage, financialContext, onClose }: Props) {
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await generateLetter(debt, leverage, financialContext);
        if (!cancelled) setBody(r.body);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to generate letter");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debt, leverage, financialContext]);

  const fullLetter = body
    ? `${formatLetterDate()}\n\n${debt.name}\nCollections Department\n[Creditor Address]\n\n${body}`
    : "";

  const copyAll = () => {
    navigator.clipboard.writeText(fullLetter);
    setCopied(true);
    toast.success("Letter copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!body) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 56;
    const lineHeight = 14;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;

    doc.setFont("times", "normal");
    doc.setFontSize(11);

    // Date
    doc.text(formatLetterDate(), margin, y);
    y += lineHeight * 2;

    // Recipient block
    doc.text(debt.name, margin, y);
    y += lineHeight;
    doc.text("Collections Department", margin, y);
    y += lineHeight;
    doc.text("[Creditor Address]", margin, y);
    y += lineHeight * 2;

    // Body — split on double-newline paragraphs and headers
    const paragraphs = body.split(/\n\n+/);
    for (const para of paragraphs) {
      const isHeader = /^[A-Z][A-Z\s,:&]+$/.test(para.trim()) && para.trim().length < 60;
      if (isHeader) {
        doc.setFont("times", "bold");
        doc.setFontSize(11);
      } else {
        doc.setFont("times", "normal");
        doc.setFontSize(11);
      }
      const lines = doc.splitTextToSize(para, maxWidth);
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      y += lineHeight * 0.6;
    }

    const safeName = debt.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    doc.save(`settlement-letter-${safeName}.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] paper-card overflow-hidden flex flex-col"
          style={{ borderRadius: 0 }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-foreground flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <div className="eyebrow mb-0.5">Settlement Letter</div>
                <h2 className="font-display font-medium text-base" style={{ fontStyle: "italic" }}>{debt.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">${debt.balance.toLocaleString()}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-5">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: "hsl(var(--gold))" }} />
                <div className="text-center">
                  <p className="font-display text-base font-medium" style={{ fontStyle: "italic" }}>Drafting your letter…</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">Formal certified-mail format</p>
                </div>
              </div>
            )}

            {body && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-2 border border-foreground/30 p-3 bg-secondary/30">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "hsl(var(--gold))" }} />
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    Draft ready. Review, fill in your personal details, and mail by certified mail with return receipt.
                  </p>
                </div>

                <div className="border border-foreground/20 bg-[#FDFAF4] text-zinc-900 p-8 font-serif text-sm leading-relaxed whitespace-pre-line">
                  <div className="text-zinc-600 mb-6">{formatLetterDate()}</div>
                  <div className="text-zinc-800 mb-6">
                    {debt.name}<br />
                    Collections Department<br />
                    [Creditor Address]
                  </div>
                  <div className="text-zinc-900">{body}</div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Action bar */}
          {body && !loading && (
            <div className="border-t border-foreground/20 p-4 flex items-center justify-between gap-3 bg-secondary/30">
              <p className="font-mono text-xs text-muted-foreground hidden sm:block">
                Mail certified · Keep a copy · Wait 30 days
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1.5 px-3 py-2 border border-foreground/40 hover:border-foreground text-muted-foreground hover:text-foreground font-mono text-[10px] tracking-[0.12em] uppercase transition-all"
                >
                  {copied ? <><Check className="h-3.5 w-3.5" style={{ color: "hsl(var(--gold))" }} /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-1.5 px-4 py-2 bg-foreground hover:bg-foreground/80 text-background font-mono text-[10px] tracking-[0.12em] uppercase transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
