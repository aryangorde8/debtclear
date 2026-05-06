"use client";
import { motion } from "framer-motion";

const STEPS = [
  {
    roman: "I",
    title: "Enter your debts",
    body: "Balance, APR, minimum payment. Nothing leaves your browser — the math runs locally. We need exact numbers because compounding amplifies small errors into large ones over months.",
  },
  {
    roman: "II",
    title: "We simulate",
    body: "Real month-by-month compounding across both Avalanche and Snowball strategies. Claude AI layers on personalised advice. You see exact dollar savings and the months you'd shave off.",
  },
  {
    roman: "III",
    title: "Negotiate the rest",
    body: "For each debt, a phone-ready script: opening, hardship statement, initial offer, counter-offer responses, closing checklist. Read it aloud. Settle for 40–60 cents on the dollar.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-32 px-6 md:px-12 border-b border-foreground/20">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className="eyebrow mb-4">The Method · Three Movements</div>
          <h2
            className="font-display leading-[1.05] text-foreground"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400 }}
          >
            From <span className="font-display" style={{ fontStyle: "italic" }}>anxious</span> to actionable,{" "}
            <span className="font-display" style={{ fontStyle: "italic", color: "hsl(var(--gold))" }}>
              in three movements.
            </span>
          </h2>
        </motion.div>

        <div className="border-t border-foreground mb-0" />

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-foreground/30">
          {STEPS.map(({ roman, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="py-10 md:py-12 px-0 md:px-10 first:pl-0 last:pr-0"
            >
              <div
                className="font-display mb-5 leading-none"
                style={{ fontSize: "4rem", color: "hsl(var(--gold))", fontWeight: 300, fontStyle: "italic" }}
              >
                {roman}
              </div>
              <div className="border-t border-foreground mb-5" />
              <h3
                className="font-display text-xl font-medium mb-4 text-foreground"
              >
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>

        <div className="border-t border-foreground/20 mt-0" />

        {/* Privacy note */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-muted-foreground border border-muted-foreground/30 px-2 py-1">
            ◉ STAYS LOCAL
          </span>
          <span className="text-xs text-muted-foreground">Your data never leaves your browser.</span>
        </div>
      </div>
    </section>
  );
}
