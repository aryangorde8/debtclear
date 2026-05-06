"use client";
import { useRouter } from "next/navigation";
import { ShaderBackground } from "@/components/ShaderBackground";
import { DebtForm } from "@/components/DebtForm";
import { ArrowLeft } from "lucide-react";
import { AnalyzeResult } from "@/types";

export default function AnalyzePage() {
  const router = useRouter();

  const handleResult = (result: AnalyzeResult) => {
    localStorage.setItem("debtclear_result", JSON.stringify(result));
    router.push("/results");
  };

  return (
    <main className="relative min-h-screen">
      <ShaderBackground />

      {/* Nav */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-white/40 text-xs uppercase tracking-widest">DebtClear</span>
      </div>

      <div className="relative z-10">
        <DebtForm onResult={handleResult} />
      </div>
    </main>
  );
}
