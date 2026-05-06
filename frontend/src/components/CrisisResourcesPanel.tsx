"use client";
import { motion } from "framer-motion";
import { Phone, ExternalLink, Shield } from "lucide-react";
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
    description: "Nonprofit network of certified credit counselors. Free or low-cost budget review and debt management plans that consolidate payments and often reduce interest rates.",
    href: "https://www.nfcc.org/",
    cta: "Find a counselor",
    phone: "1-800-388-2227",
  },
  {
    name: "CFPB — Help with Debt",
    description: "Federal Consumer Financial Protection Bureau guides on negotiating with creditors, dealing with collectors, and understanding your rights under the FDCPA.",
    href: "https://www.consumerfinance.gov/consumer-tools/debt-collection/",
    cta: "Read official guide",
  },
  {
    name: "211.org — Local Assistance",
    description: "Dial 2-1-1 or search by ZIP for local nonprofit programs: rent, utilities, food, emergency cash — freeing income to attack debt.",
    href: "https://www.211.org/",
    cta: "Find local help",
    phone: "211",
  },
  {
    name: "Upsolve — Free Bankruptcy Help",
    description: "Harvard-incubated nonprofit helping qualifying low-income families file Chapter 7 bankruptcy for free when debt is genuinely unrecoverable.",
    href: "https://upsolve.org/",
    cta: "Check eligibility",
  },
];

export function CrisisResourcesPanel({ stressScore, monthlyIncome, totalDebt }: Props) {
  if (stressScore < 75) return null;

  const dti = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="paper-card" style={{ borderColor: "hsl(var(--red))" }}>
        <CardHeader className="pb-3 border-b" style={{ borderColor: "hsl(var(--red))" }}>
          <div className="eyebrow mb-1" style={{ color: "hsl(var(--red))" }}>Emergency Resources</div>
          <CardTitle className="font-display text-lg font-medium" style={{ fontStyle: "italic" }}>
            You don&apos;t have to do this alone.
          </CardTitle>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Stress score {stressScore}/100 · DTI {dti.toFixed(0)}% — vetted, free or low-cost resources
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div
            className="border-l-4 pl-4 py-1"
            style={{ borderColor: "hsl(var(--red))" }}
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Your numbers indicate genuine financial distress.</span>{" "}
              Before any creditor calls or settlement attempts, talk to a nonprofit credit counselor — most reviews are
              free, completely confidential, and they can negotiate rates and consolidate payments on your behalf.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RESOURCES.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-border hover:border-foreground p-4 transition-all hover:bg-secondary/30 block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <h4 className="font-display font-medium text-sm text-foreground" style={{ fontStyle: "italic" }}>{r.name}</h4>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{r.description}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border/50 pt-2">
                  <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-foreground group-hover:text-foreground">{r.cta} →</span>
                  {r.phone && (
                    <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>

          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed pt-1">
            DebtClear is a planning tool, not a substitute for professional advice. The organizations above are
            independent nonprofits and government agencies — no referral fees.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
