"use client";
import { useRouter } from "next/navigation";
import { AnimatedShaderHero } from "@/components/ui/animated-shader-hero";

export default function Home() {
  const router = useRouter();

  return (
    <main>
      <AnimatedShaderHero
        trustBadge={{ text: "AI-Powered Debt Strategy Engine" }}
        headline={{ line1: "Crush Your Debt.", line2: "Save Thousands." }}
        subtitle="Model Avalanche vs. Snowball strategies with real math, get a personalized AI stress score, and generate a word-for-word negotiation script to settle your debt for less."
        buttons={{
          primary: { text: "Analyze My Debt →", onClick: () => router.push("/analyze") },
          secondary: { text: "How it works", onClick: () => router.push("/how-it-works") },
        }}
      />
    </main>
  );
}
