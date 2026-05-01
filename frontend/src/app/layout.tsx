import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ShaderBackground } from "@/components/ShaderBackground";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DebtClear — Crush Your Debt Intelligently",
  description: "Model Avalanche vs Snowball strategies with real math, get a personalized AI stress score, and generate a word-for-word negotiation script to settle your debt for less.",
  keywords: ["debt payoff", "avalanche method", "snowball method", "debt negotiation", "financial planning", "AI finance"],
  openGraph: {
    title: "DebtClear — Crush Your Debt Intelligently",
    description: "AI-powered debt payoff simulator with real math, stress scoring, and phone-ready negotiation scripts.",
    type: "website",
    url: "https://debtclear.aryangorde.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtClear — Crush Your Debt Intelligently",
    description: "AI-powered debt payoff simulator with real math, stress scoring, and phone-ready negotiation scripts.",
  },
  metadataBase: new URL("https://debtclear.aryangorde.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased min-h-screen bg-black text-white`}>
        <ShaderBackground />
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
