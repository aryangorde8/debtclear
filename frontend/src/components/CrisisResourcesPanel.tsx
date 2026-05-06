"use client";
import { motion } from "framer-motion";
import { LifeBuoy, Phone, ExternalLink, Shield, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  stressScore: number;
  monthlyIncome: number;
  totalDebt: number;
}

interface Resource {
  name: string;
  description: string;
  href: string;
  cta: string;
  phone?: string;
}

const RESOURCES: Resource[] = [
  {
    name: "National Foundation for Credit Counseling",
    description:
      "Nonprofit network of certified credit counselors. Free or low-cost budget review and debt management plans that consolidate payments and often reduce interest rates.",
    href: "https://www.nfcc.org/",
    cta: "Find a counselor",
    phone: "1-800-388-2227",
  },
  {
    name: "CFPB — Help with Debt",
    description:
      "Federal Consumer Financial Protection Bureau guides on negotiating with creditors, dealing with collectors, and understanding your rights under the Fair Debt Collection Practices Act.",
    href: "https://www.consumerfinance.gov/consumer-tools/debt-collection/",
    cta: "Read official guide",
  },
  {
    name: "211.org — Local Assistance",
    description:
      "Dial 2-1-1 or search by ZIP for local nonprofit programs: rent assistance, utility help, food banks, and emergency cash aid that can free up income to attack debt.",
    href: "https://www.211.org/",
    cta: "Find local help",
    phone: "211",
  },
  {
    name: "Upsolve — Free Bankruptcy Help",
    description:
      "Nonprofit (Harvard-incubated) that helps qualifying low-income families file Chapter 7 bankruptcy for free when debt is genuinely unrecoverable. Bankruptcy is a last resort but a legal one.",
    href: "https://upsolve.org/",
    cta: "Check eligibility",
  },
];

export function CrisisResourcesPanel({ stressScore, monthlyIncome, totalDebt }: Props) {
  if (stressScore < 75) return null;

  const dti = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-red-950/40 via-black/50 to-amber-950/30 backdrop-blur-xl border-red-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/40 flex items-center justify-center">
              <LifeBuoy className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <CardTitle className="text-base">You don&apos;t have to do this alone</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stress score {stressScore}/100 · DTI {dti.toFixed(0)}% · these are vetted, free or low-cost resources
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-red-500/5 border border-red-400/20 p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-300 shrink-0 mt-0.5" />
            <div className="text-xs text-red-100/90 leading-relaxed">
              <span className="font-semibold text-red-200">Your numbers indicate genuine financial distress.</span> Before
              any creditor calls or settlement attempts, talk to a nonprofit credit counselor — most reviews are free,
              completely confidential, and they can negotiate rates and consolidate payments on your behalf.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RESOURCES.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl bg-black/40 border border-white/10 hover:border-red-400/50 p-4 transition-all hover:bg-black/60"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-red-300/80" />
                    <h4 className="font-semibold text-sm text-white">{r.name}</h4>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-white/40 group-hover:text-red-300 transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{r.description}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-red-300 group-hover:text-red-200">{r.cta} →</span>
                  {r.phone && (
                    <span className="text-xs text-white/60 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1">
            DebtClear is a planning tool, not a substitute for professional advice. The organizations above are
            independent nonprofits and government agencies — we don&apos;t receive any referral fees.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
