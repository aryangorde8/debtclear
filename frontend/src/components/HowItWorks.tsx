"use client";
import { motion } from "framer-motion";
import { Calculator, BrainCircuit, Phone } from "lucide-react";

const STEPS = [
  {
    icon: Calculator,
    title: "01 / Enter Your Debts",
    body: "Add every debt you carry — balance, APR, minimum payment. Nothing leaves your browser. We need exact numbers because the math compounds — small errors in input become large errors in months.",
  },
  {
    icon: BrainCircuit,
    title: "02 / We Simulate",
    body: "We run a month-by-month simulation of both Avalanche and Snowball strategies, then layer Claude AI for personalised advice. You see exact dollar savings and the months you'd shave off.",
  },
  {
    icon: Phone,
    title: "03 / Negotiate the Rest",
    body: "For each debt, generate a phone-ready script: opening, hardship statement, initial offer, counter-offer responses, closing checklist. Read it aloud, settle for less.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-32 px-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <span className="text-xs uppercase tracking-widest text-white/60">How it works</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold leading-[1.05]">
            <span className="bg-gradient-to-r from-blue-200 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
              Three steps
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
              to a payoff plan.
            </span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative group"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-blue-500/20 via-violet-500/20 to-fuchsia-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-6 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm uppercase tracking-wider">{title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed mt-2">{body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
