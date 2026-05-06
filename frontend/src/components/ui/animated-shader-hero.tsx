"use client";
import React from "react";

interface HeroProps {
  trustBadge?: { text: string; icons?: string[] };
  headline: { line1: string; line2: string };
  subtitle: string;
  buttons?: {
    primary?: { text: string; onClick?: () => void };
    secondary?: { text: string; onClick?: () => void };
  };
  className?: string;
}

export const AnimatedShaderHero: React.FC<HeroProps> = ({
  headline,
  subtitle,
  buttons,
  className = "",
}) => {
  return (
    <section className={`relative w-full min-h-screen flex flex-col justify-center px-6 md:px-12 border-b border-foreground/20 ${className}`}>

      {/* Masthead bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-5 border-b border-foreground/20">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">Vol. I · Issue 04</span>
        <span className="font-display text-base font-semibold tracking-tight text-foreground">DebtClear</span>
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">May · MMXXVI</span>
      </div>

      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-0 pt-20">

        {/* Left 2/3 — Main editorial */}
        <div className="md:col-span-2 pr-0 md:pr-12 md:border-r border-foreground/20 flex flex-col justify-center py-12 md:py-20">
          <div className="eyebrow mb-6">The Personal Debt Quarterly · Cover Feature</div>
          <h1
            className="font-display leading-[0.92] tracking-tight text-foreground animate-fade-in-up animation-delay-200"
            style={{ fontSize: "clamp(3rem, 9vw, 7rem)", fontWeight: 400 }}
          >
            {headline.line1}<br />
            <span
              className="font-display"
              style={{ fontStyle: "italic", color: "hsl(var(--gold))", fontWeight: 300 }}
            >
              {headline.line2}
            </span>
          </h1>

          <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl animate-fade-in-up animation-delay-400" style={{ fontWeight: 300 }}>
            {subtitle}
          </p>

          {buttons && (
            <div className="flex flex-wrap items-center gap-5 mt-10 animate-fade-in-up animation-delay-600">
              {buttons.primary && (
                <button
                  onClick={buttons.primary.onClick}
                  className="btn-ink"
                >
                  {buttons.primary.text}
                </button>
              )}
              {buttons.secondary && (
                <button
                  onClick={buttons.secondary.onClick}
                  className="font-mono text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground border-b border-transparent hover:border-muted-foreground transition-colors pb-0.5"
                >
                  {buttons.secondary.text}
                </button>
              )}
            </div>
          )}

          {/* Micro-stats */}
          <div className="mt-12 pt-8 border-t border-foreground/20 grid grid-cols-3 gap-4 animate-fade-in-up animation-delay-800">
            {[
              ["77%", "of US adults carry multiple debts"],
              ["$1,658", "average interest saved"],
              ["12 mo", "sooner to debt-free"],
            ].map(([n, l]) => (
              <div key={n}>
                <div className="font-mono text-xl font-semibold text-gold">{n}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1/3 — In this issue panel */}
        <div className="hidden md:flex flex-col gap-6 pl-10 justify-center">
          <div className="eyebrow">In this issue</div>
          <div className="border-t border-foreground pt-4 space-y-3">
            {[
              ["I.", "Your stress index"],
              ["II.", "Avalanche v. Snowball"],
              ["III.", "The cost of waiting"],
              ["IV.", "A negotiation script"],
            ].map(([n, t]) => (
              <div key={n} className="flex gap-3 text-sm">
                <span className="font-mono text-[hsl(var(--gold))] w-6 shrink-0">{n}</span>
                <span className="font-display" style={{ fontStyle: "italic" }}>{t}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-foreground/20 pt-4 space-y-3">
            <div className="eyebrow">By the numbers</div>
            {[
              ["$42K+", "average user debt load"],
              ["38 mo", "typical payoff with plan"],
              ["90 sec", "to your full analysis"],
            ].map(([n, l]) => (
              <div key={n} className="flex items-baseline gap-3">
                <span className="font-mono text-base font-semibold text-gold">{n}</span>
                <span className="text-xs text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="h-8 w-px bg-foreground" />
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase">Scroll</span>
      </div>
    </section>
  );
};

export default AnimatedShaderHero;
