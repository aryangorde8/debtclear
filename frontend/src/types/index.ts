export interface Debt {
  name: string;
  balance: number;
  rate: number;
  min_payment: number;
}

export interface AnalyzePayload {
  monthly_income: number;
  extra_payment: number;
  debts: Debt[];
}

export interface StrategyResult {
  months: number;
  total_interest: number;
  payoff_timeline: number[];
  payoff_order: string[];
  converged: boolean;
}

export interface AnalyzeResult {
  total_debt: number;
  monthly_income: number;
  weighted_avg_rate: number;
  stress_score: number;
  interest_saved: number;
  months_saved: number;
  recommended_strategy: "avalanche" | "snowball";
  avalanche: StrategyResult;
  snowball: StrategyResult;
  ai_analysis: string;
  ai_source: string;
  debts: Debt[];
  extra_payment: number;
}

export interface LeverageAnalysis {
  debt_type: string;
  debt_type_label: string;
  leverage_score: number;
  leverage_label: string;
  settlement_low: number;
  settlement_target: number;
  settlement_high: number;
  hardship_factors: string[];
  negotiation_tips: string[];
  risk_factors: string[];
}

export interface ScriptSection {
  key: string;
  title: string;
}

export interface SavingsBreakdown {
  original_balance: number;
  settlement_amount: number;
  dollars_saved: number;
  percentage_saved: number;
}

export interface NegotiateResult {
  leverage_analysis: LeverageAnalysis;
  savings: SavingsBreakdown;
  savings_range: {
    best_case: SavingsBreakdown;
    target: SavingsBreakdown;
    worst_case: SavingsBreakdown;
  };
  script: {
    sections: Record<string, string>;
    section_order: ScriptSection[];
    source: string;
  };
  debt: Debt;
}
