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
  trustBadge,
  headline,
  subtitle,
  buttons,
  className = "",
}) => {
  return (
    <section className={`relative w-full min-h-screen flex flex-col items-center justify-center px-4 ${className}`}>
      <div className="relative z-10 flex flex-col items-center justify-center text-white max-w-5xl mx-auto">
        {trustBadge && (
          <div className="mb-8 animate-fade-in-down">
            <div className="flex items-center gap-2 px-5 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
              </span>
              <span className="text-white/80">{trustBadge.text}</span>
            </div>
          </div>
        )}

        <div className="text-center space-y-6">
          <div className="space-y-1">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-blue-200 via-cyan-300 to-violet-300 bg-clip-text text-transparent animate-fade-in-up animation-delay-200 leading-[1.05]">
              {headline.line1}
            </h1>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent animate-fade-in-up animation-delay-400 leading-[1.05]">
              {headline.line2}
            </h1>
          </div>

          <div className="max-w-3xl mx-auto animate-fade-in-up animation-delay-600">
            <p className="text-lg md:text-xl text-white/70 font-light leading-relaxed">
              {subtitle}
            </p>
          </div>

          {buttons && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 animate-fade-in-up animation-delay-800">
              {buttons.primary && (
                <button
                  onClick={buttons.primary.onClick}
                  className="px-8 py-4 bg-white text-black rounded-full font-semibold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/20"
                >
                  {buttons.primary.text}
                </button>
              )}
              {buttons.secondary && (
                <button
                  onClick={buttons.secondary.onClick}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white rounded-full font-semibold text-base transition-all duration-300 hover:scale-105 backdrop-blur-md"
                >
                  {buttons.secondary.text}
                </button>
              )}
            </div>
          )}

          {/* Scroll indicator — directly below the buttons, centered */}
          <div className="flex flex-col items-center gap-3 pt-16 animate-fade-in-up animation-delay-800">
            <span className="h-10 w-px bg-gradient-to-b from-white/10 to-white/50 animate-pulse" />
            <span className="text-white/50 text-[10px] uppercase tracking-[0.3em] font-medium">
              Scroll to begin
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnimatedShaderHero;
