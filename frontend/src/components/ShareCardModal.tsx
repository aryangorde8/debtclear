"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share2, Loader2 } from "lucide-react";
import { AnalyzeResult } from "@/types";
import { toast } from "sonner";

interface Props {
  result: AnalyzeResult;
  onClose: () => void;
}

function formatPayoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ShareCardModal({ result, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const isAvalanche = result.recommended_strategy === "avalanche";
  const recommended = isAvalanche ? result.avalanche : result.snowball;
  const debtFreeDate = formatPayoffDate(recommended.months);
  const yearsAndMonths = (() => {
    const years = Math.floor(recommended.months / 12);
    const months = recommended.months % 12;
    if (years === 0) return `${months} months`;
    if (months === 0) return `${years} year${years > 1 ? "s" : ""}`;
    return `${years}y ${months}m`;
  })();

  // Allow body scroll lock toggle
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  const downloadPNG = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `debtclear-plan-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setDownloading(false);
    }
  };

  const nativeShare = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, logging: false });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "debtclear-plan.png", { type: "image/png" });
        const data = {
          files: [file],
          title: "My DebtClear Plan",
          text: `I'll be debt-free by ${debtFreeDate} 🎯`,
        };
        if (navigator.share && navigator.canShare?.(data)) {
          try {
            await navigator.share(data);
          } catch {
            // user cancelled
          }
        } else {
          // Fallback to download
          const link = document.createElement("a");
          link.download = "debtclear-plan.png";
          link.href = canvas.toDataURL();
          link.click();
        }
      }, "image/png");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          className="relative max-w-md w-full max-h-[95vh] overflow-y-auto"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white/70 hover:text-white z-10 backdrop-blur-md"
          >
            <X className="h-4 w-4" />
          </button>

          {/* The shareable card */}
          <div
            ref={cardRef}
            className="relative aspect-[3/4] rounded-3xl overflow-hidden p-8 flex flex-col justify-between"
            style={{
              background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 35%, #0a1a3a 70%, #02050d 100%)",
            }}
          >
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-blue-500/30 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-violet-500/30 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

            {/* Top: brand + tagline */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-semibold">DebtClear</span>
              </div>
              <p className="text-xs text-white/60">My debt freedom plan</p>
            </div>

            {/* Middle: hero number */}
            <div className="relative z-10 text-center my-4">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-3">I&apos;ll be debt-free by</p>
              <div className="text-5xl font-black bg-gradient-to-r from-emerald-300 via-blue-300 to-violet-300 bg-clip-text text-transparent leading-tight">
                {debtFreeDate}
              </div>
              <p className="text-sm text-white/50 mt-2">in just {yearsAndMonths}</p>
            </div>

            {/* Stats grid */}
            <div className="relative z-10 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Total debt</p>
                <p className="text-lg font-bold text-white">
                  ${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/20 backdrop-blur-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">Interest saved</p>
                <p className="text-lg font-bold text-emerald-300">
                  ${result.interest_saved.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Strategy</p>
                <p className="text-sm font-bold text-white capitalize">
                  {result.recommended_strategy}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Months saved</p>
                <p className="text-sm font-bold text-white">
                  {result.months_saved} mo
                </p>
              </div>
            </div>

            {/* Bottom: footer */}
            <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-white/40">debtclear.aryangorde.com</span>
              <span className="text-[10px] uppercase tracking-wider text-white/40">Plan your freedom</span>
            </div>
          </div>

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={nativeShare}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Share
            </button>
            <button
              onClick={downloadPNG}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-black transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PNG
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
