"use client";
import { useRouter } from "next/navigation";
import { ShaderBackground } from "@/components/ShaderBackground";
import { HowItWorks } from "@/components/HowItWorks";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function HowItWorksPage() {
  const router = useRouter();

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
        <HowItWorks />
      </div>

      {/* CTA */}
      <div className="relative z-10 flex justify-center pb-24">
        <button
          onClick={() => router.push("/analyze")}
          className="flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all hover:scale-105"
        >
          Analyze My Debt <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}
