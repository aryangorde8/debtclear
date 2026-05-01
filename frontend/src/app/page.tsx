"use client";
import { useRef, useState } from "react";
import { AnimatedShaderHero } from "@/components/ui/animated-shader-hero";
import { HowItWorks } from "@/components/HowItWorks";
import { DebtForm } from "@/components/DebtForm";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { AnalyzeResult } from "@/types";

export default function Home() {
  const formRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToHow = () => howRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleResult = (r: AnalyzeResult) => {
    setResult(r);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleReset = () => {
    setResult(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <main>
      <AnimatedShaderHero
        trustBadge={{ text: "AI-Powered Debt Strategy Engine" }}
        headline={{ line1: "Crush Your Debt.", line2: "Save Thousands." }}
        subtitle="Model Avalanche vs. Snowball strategies with real math, get a personalized AI stress score, and generate a word-for-word negotiation script to settle your debt for less."
        buttons={{
          primary: { text: "Analyze My Debt →", onClick: scrollToForm },
          secondary: { text: "How it works", onClick: scrollToHow },
        }}
      />
      <div ref={howRef}>
        <HowItWorks />
      </div>
      <div ref={formRef}>
        <DebtForm onResult={handleResult} />
      </div>
      {result && (
        <div ref={resultsRef}>
          <ResultsDashboard result={result} onReset={handleReset} />
        </div>
      )}
    </main>
  );
}
