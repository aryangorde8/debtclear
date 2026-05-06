"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShaderBackground } from "@/components/ShaderBackground";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { AnalyzeResult } from "@/types";
import { Loader2 } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("debtclear_result");
    if (!raw) {
      router.replace("/analyze");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/analyze");
      return;
    }
    setReady(true);
  }, [router]);

  const handleReset = () => {
    localStorage.removeItem("debtclear_result");
    router.push("/analyze");
  };

  if (!ready || !result) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <ShaderBackground />
        <Loader2 className="h-8 w-8 animate-spin text-white/40 relative z-10" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <ShaderBackground />
      <div className="relative z-10">
        <ResultsDashboard result={result} onReset={handleReset} />
      </div>
    </main>
  );
}
