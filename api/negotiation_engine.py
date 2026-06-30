"""
Negotiate Mode — leverage analysis and settlement-range calculation.

Settlement ranges start from industry baselines (CFPB/NACBA/FTC data) then are
refined by AI based on the borrower's specific hardship profile and leverage score.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Baseline settlement ranges by debt type (% of balance borrower settles for).
# These are the fallback when AI is unavailable.
SETTLEMENT_RANGES: Dict[str, Dict[str, int]] = {
    "credit_card":      {"low": 40, "high": 60, "target": 50},
    "personal_loan":    {"low": 50, "high": 70, "target": 60},
    "medical":          {"low": 25, "high": 50, "target": 35},
    "auto":             {"low": 70, "high": 85, "target": 78},
    "student_private":  {"low": 60, "high": 80, "target": 70},
    "student_federal":  {"low": 90, "high": 100, "target": 95},
    "other":            {"low": 50, "high": 70, "target": 60},
}

DEBT_TYPE_LABELS = {
    "credit_card":     "Credit card",
    "personal_loan":   "Personal loan",
    "medical":         "Medical debt",
    "auto":            "Auto loan",
    "student_private": "Private student loan",
    "student_federal": "Federal student loan",
    "other":           "Consumer debt",
}

_TYPE_KEYWORDS = [
    ("medical",         ("medical", "hospital", "doctor", "clinic", "health", "dental", "physician", "er bill", "emergency room")),
    ("student_federal", ("fafsa", "stafford", "perkins", "grad plus", "parent plus", "direct loan", "federal student", "nslds")),
    ("credit_card",     ("credit card", "card", "visa", "mastercard", "amex", "american express", "discover", "chase", "capital one", "citi", "citibank", "barclays", "synchrony", "comenity", "credit")),
    ("student_private", ("student", "tuition", "sallie", "navient", "earnest", "college ave", "education")),
    ("auto",            ("auto", "car", "vehicle", "truck", "motorcycle", "lease", "carmax")),
    ("personal_loan",   ("personal", "lendingclub", "prosper", "upstart", "marcus", "loan", "lending")),
]


def _matches_any(name: str, keywords) -> bool:
    for kw in keywords:
        if " " in kw:
            if kw in name:
                return True
        else:
            if re.search(rf"\b{re.escape(kw)}\b", name):
                return True
    return False


def detect_debt_type(debt_name: str) -> str:
    name = (debt_name or "").lower().strip()
    if not name:
        return "other"
    for debt_type, keywords in _TYPE_KEYWORDS:
        if _matches_any(name, keywords):
            return debt_type
    return "other"


def _compute_hardship_factors(
    debt: Dict[str, Any],
    financial_context: Dict[str, Any],
    debt_count: int,
) -> List[str]:
    factors: List[str] = []
    monthly_income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", 0) or 0)
    stress_score = float(financial_context.get("stress_score", 0) or 0)

    if monthly_income > 0 and total_debt > monthly_income * 24:
        factors.append("Total debt exceeds 2x annual income")
    elif monthly_income > 0 and total_debt > monthly_income * 12:
        factors.append("Total debt exceeds 1x annual income")
    if debt_count >= 3:
        factors.append("Carrying multiple concurrent debts")
    if stress_score >= 70:
        factors.append("Limited monthly cash flow after minimums")
    elif stress_score >= 50:
        factors.append("Tight monthly cash flow")
    if float(debt.get("rate", 0) or 0) > 20:
        factors.append("High interest rate burden on this account")
    if monthly_income > 0:
        min_to_income = float(debt.get("min_payment", 0) or 0) / monthly_income
        if min_to_income > 0.10:
            factors.append("Minimum payment is over 10% of monthly income")

    return factors or ["Standard hardship inquiry"]


# ── AI leverage assessment ────────────────────────────────────────────────────

from .groq_pool import call_with_failover


def _ai_leverage_assessment(
    debt: Dict[str, Any],
    debt_type_baseline: str,
    leverage_baseline: int,
    hardship_baseline: List[str],
    financial_context: Dict[str, Any],
    debt_count: int,
) -> Optional[Dict[str, Any]]:
    """
    One AI call that judges debt type, leverage score, hardship factors and the settlement
    range together. Returns the parsed JSON dict, or None when Groq is unavailable or the
    output can't be parsed (callers then fall back to the deterministic values).
    """
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", 0) or 0)
    stress = float(financial_context.get("stress_score", 0) or 0)
    type_keys = ", ".join(SETTLEMENT_RANGES.keys())
    base = SETTLEMENT_RANGES[debt_type_baseline]

    prompt = (
        "You are a debt-settlement expert with 20 years of experience. Assess ONE debt "
        "account and the borrower behind it, then return a structured judgement.\n\n"
        "DEBT\n"
        f'- Name (as the borrower typed it): "{debt.get("name", "")}"\n'
        f"- Balance: ${balance:,.2f}\n"
        f"- APR: {rate:.2f}%\n"
        f"- Minimum payment: ${float(debt.get('min_payment', 0)):,.2f}/mo\n\n"
        "BORROWER\n"
        f"- Monthly income: ${income:,.2f}\n"
        f"- Total debt across all accounts: ${total_debt:,.2f}\n"
        f"- Financial stress score: {stress:.0f}/100\n"
        f"- Number of concurrent debts: {debt_count}\n\n"
        "RULE-BASED REFERENCE (adjust with judgement, don't just echo)\n"
        f"- Detected debt type: {debt_type_baseline}\n"
        f"- Leverage score: {leverage_baseline}/100\n"
        f"- Hardship factors: {'; '.join(hardship_baseline)}\n"
        f"- Settlement range: {base['low']}%/{base['target']}%/{base['high']}%\n\n"
        "TASKS\n"
        f"1. debt_type — classify as EXACTLY one of: {type_keys}.\n"
        "2. leverage_score — 0-100, the borrower's power to settle below the balance. Unsecured "
        "revolving debt (credit cards, medical) settles easily; secured debt (auto) and federal "
        "student loans barely settle.\n"
        "3. hardship_factors — 1 to 4 concise noun phrases (<=8 words each), grounded in the numbers.\n"
        "4. settlement — realistic % of balance to settle for: integers with low < target < high, "
        "each between 10 and 100. Federal student loans never below 85.\n\n"
        "Return ONLY valid JSON, no markdown, no prose:\n"
        '{"debt_type":"<type>","leverage_score":<int>,'
        '"hardship_factors":["..."],"settlement":{"low":<int>,"target":<int>,"high":<int>}}'
    )

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
            temperature=0.3,
        )
        return (resp.choices[0].message.content or "").strip()

    raw = call_with_failover(_call_groq)
    if not raw:
        return None

    raw = re.sub(r"```[a-z]*", "", raw).strip().strip("`")
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        logger.warning("Could not parse AI leverage assessment '%s': %s", raw, exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def _heuristic_leverage_score(
    debt_type: str,
    financial_context: Dict[str, Any],
    debt_count: int,
) -> int:
    """Rule-based leverage score (0-100) — reference for, and fallback from, the AI."""
    monthly_income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", 0) or 0)
    stress_score = float(financial_context.get("stress_score", 0) or 0)

    score = 50
    if debt_type in ("credit_card", "medical"):
        score += 20
    if debt_type in ("student_federal", "auto"):
        score -= 20
    if stress_score > 70:
        score += 15
    if monthly_income > 0 and total_debt > monthly_income * 3:
        score += 10
    if debt_count >= 3:
        score += 5
    return max(0, min(100, score))


def analyze_debt_leverage(
    debt: Dict[str, Any],
    financial_context: Dict[str, Any],
    debt_count: int = 1,
) -> Dict[str, Any]:
    # Deterministic baselines — handed to the AI as a reference and used as the fallback if
    # Groq is unavailable or returns junk. The settlement *dollars* (computed later in
    # calculate_settlement_savings) always stay exact arithmetic.
    det_type = detect_debt_type(debt.get("name", ""))
    det_leverage = _heuristic_leverage_score(det_type, financial_context, debt_count)
    det_hardship = _compute_hardship_factors(debt, financial_context, debt_count)

    debt_type = det_type
    leverage_score = det_leverage
    hardship_factors = det_hardship
    settlement = dict(SETTLEMENT_RANGES[det_type])
    source = "fallback"

    ai = _ai_leverage_assessment(
        debt, det_type, det_leverage, det_hardship, financial_context, debt_count
    )
    if ai:
        source = "groq"

        # debt type (must be one we recognise)
        t = str(ai.get("debt_type", "")).strip()
        if t in SETTLEMENT_RANGES:
            debt_type = t
            settlement = dict(SETTLEMENT_RANGES[t])

        # leverage score
        try:
            ls = int(round(float(ai["leverage_score"])))
            if 0 <= ls <= 100:
                leverage_score = ls
        except (KeyError, TypeError, ValueError):
            pass

        # hardship factors
        hf = ai.get("hardship_factors")
        if isinstance(hf, list):
            cleaned = [str(x).strip() for x in hf if str(x).strip()][:4]
            if cleaned:
                hardship_factors = cleaned

        # settlement percentages (low < target < high); federal student loans floored at 85
        s = ai.get("settlement") or {}
        try:
            low, target, high = int(s["low"]), int(s["target"]), int(s["high"])
            if debt_type == "student_federal":
                low = max(low, 85)
            if 10 <= low < target < high <= 100:
                settlement = {"low": low, "target": target, "high": high}
        except (KeyError, TypeError, ValueError):
            pass

    notes: List[str] = []
    if debt_type == "student_federal":
        notes.append(
            "Federal student loans almost never settle. Pursue an income-driven "
            "repayment plan (IDR) or Public Service Loan Forgiveness instead."
        )
    if debt_type == "auto":
        notes.append(
            "Auto loans are secured by the vehicle. Negotiation power is limited "
            "unless the loan is delinquent or the car is worth less than the balance."
        )
    if debt_type == "other":
        notes.append(
            "Debt type couldn't be auto-detected. Settlement assumes an average "
            "unsecured account — adjust based on the creditor."
        )

    leverage_label = (
        "Very High" if leverage_score >= 75
        else "High" if leverage_score >= 55
        else "Moderate" if leverage_score >= 35
        else "Low"
    )

    return {
        "debt_type": debt_type,
        "debt_type_label": DEBT_TYPE_LABELS[debt_type],
        "leverage_score": leverage_score,
        "leverage_label": leverage_label,
        "settlement_low": settlement["low"],
        "settlement_high": settlement["high"],
        "settlement_target": settlement["target"],
        "hardship_factors": hardship_factors,
        "notes": notes,
        "source": source,
    }


def calculate_settlement_savings(
    debt: Dict[str, Any],
    settlement_percentage: float,
) -> Dict[str, Any]:
    balance = float(debt.get("balance", 0) or 0)
    pct = max(0.0, min(100.0, float(settlement_percentage)))
    settlement_amount = round(balance * pct / 100.0, 2)
    dollars_saved = round(balance - settlement_amount, 2)
    return {
        "original_balance": round(balance, 2),
        "settlement_amount": settlement_amount,
        "dollars_saved": dollars_saved,
        "percentage_saved": round(100.0 - pct, 2),
    }


def projected_savings_range(debt: Dict[str, Any], analysis: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "best_case":  calculate_settlement_savings(debt, analysis["settlement_low"]),
        "target":     calculate_settlement_savings(debt, analysis["settlement_target"]),
        "worst_case": calculate_settlement_savings(debt, analysis["settlement_high"]),
    }
