import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ShaderBackground } from "@/components/ShaderBackground";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DebtClear — Crush Your Debt Intelligently",
  description: "AI-powered debt payoff simulator. Avalanche vs Snowball, stress scoring, and negotiation scripts.",
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
