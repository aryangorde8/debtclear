import {
  AnalyzePayload,
  AnalyzeResult,
  ChatResponse,
  ChatTurn,
  Debt,
  LeverageAnalysis,
  NegotiateResult,
  RoleplayResponse,
  RoleplayTurn,
  SettlementLetterResponse,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const analyze = (payload: AnalyzePayload) =>
  apiFetch<AnalyzeResult>("/api/analyze/", payload);

export interface SimulateResult {
  stress_score: number;
  total_debt: number;
  weighted_avg_rate: number;
  extra_payment: number;
  avalanche: { months: number; total_interest: number; payoff_timeline: number[]; payoff_order: string[]; converged: boolean };
  snowball: { months: number; total_interest: number; payoff_timeline: number[]; payoff_order: string[]; converged: boolean };
  interest_saved: number;
  months_saved: number;
  recommended_strategy: "avalanche" | "snowball";
}

export const simulate = (payload: AnalyzePayload) =>
  apiFetch<SimulateResult>("/api/simulate/", payload);

export const negotiate = (
  debt: Debt,
  financial_context: { monthly_income: number; total_debt: number; stress_score: number },
  debt_count: number
) =>
  apiFetch<NegotiateResult>("/api/negotiate/", { debt, financial_context, debt_count });

export const roleplay = (
  debt: Debt,
  leverage: LeverageAnalysis,
  history: RoleplayTurn[]
) => apiFetch<RoleplayResponse>("/api/roleplay/", { debt, leverage, history });

export const generateLetter = (
  debt: Debt,
  leverage: LeverageAnalysis,
  financial_context: { monthly_income: number; total_debt: number }
) =>
  apiFetch<SettlementLetterResponse>("/api/letter/", {
    debt,
    leverage,
    financial_context,
  });

export const askAdvisor = (
  snapshot: Record<string, unknown>,
  history: ChatTurn[],
  question: string
) => apiFetch<ChatResponse>("/api/chat/", { snapshot, history, question });
