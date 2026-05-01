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
from typing import Any, Dict, List

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


# ── AI-powered settlement range ───────────────────────────────────────────────

try:
    import groq as _groq_sdk
except ImportError:
    _groq_sdk = None

try:
    import anthropic as _anthropic_sdk
except ImportError:
    _anthropic_sdk = None

_GROQ_CLIENT = None
_ANTHROPIC_CLIENT = None


def _groq():
    global _GROQ_CLIENT
    if _GROQ_CLIENT is not None or _groq_sdk is None:
        return _GROQ_CLIENT
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    _GROQ_CLIENT = _groq_sdk.Groq(api_key=key, max_retries=0, timeout=10.0)
    return _GROQ_CLIENT


def _anthropic():
    global _ANTHROPIC_CLIENT
    if _ANTHROPIC_CLIENT is not None or _anthropic_sdk is None:
        return _ANTHROPIC_CLIENT
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None
    _ANTHROPIC_CLIENT = _anthropic_sdk.Anthropic(api_key=key)
    return _ANTHROPIC_CLIENT


def _ai_settlement_prompt(
    debt: Dict[str, Any],
    debt_type: str,
    baseline: Dict[str, int],
    leverage_score: int,
    hardship_factors: List[str],
    financial_context: Dict[str, Any],
) -> str:
    label = DEBT_TYPE_LABELS[debt_type]
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", 0) or 0)
    stress = float(financial_context.get("stress_score", 0) or 0)
    factors = "; ".join(hardship_factors)

    return (
        "You are a debt settlement expert with 20 years of experience. "
        "Estimate a realistic settlement range for this specific debt account.\n\n"
        "DEBT PROFILE\n"
        f"- Type: {label}\n"
        f"- Balance: ${balance:,.2f}\n"
        f"- APR: {rate:.2f}%\n"
        f"- Minimum payment: ${float(debt.get('min_payment', 0)):,.2f}/mo\n\n"
        "BORROWER FINANCIAL SITUATION\n"
        f"- Monthly income: ${income:,.2f}\n"
        f"- Total debt across all accounts: ${total_debt:,.2f}\n"
        f"- Financial stress score: {stress:.0f}/100\n"
        f"- Leverage score: {leverage_score}/100 (higher = more negotiating power)\n"
        f"- Hardship factors: {factors}\n\n"
        "INDUSTRY BASELINE FOR THIS DEBT TYPE\n"
        f"- Typical low (best case for borrower): {baseline['low']}% of balance\n"
        f"- Typical target: {baseline['target']}% of balance\n"
        f"- Typical high (worst case): {baseline['high']}% of balance\n\n"
        "Based on this borrower's specific leverage, hardship severity, and debt characteristics, "
        "provide a personalized settlement range. Adjust from the baseline — don't just echo it.\n\n"
        "Rules:\n"
        "- Federal student loans: never below 85%\n"
        "- High leverage score + multiple hardship factors → push low% down\n"
        "- Low stress, good income → push all %s up toward baseline or higher\n"
        "- low < target < high, all integers, all between 10 and 100\n\n"
        "Return ONLY valid JSON, no explanation, no markdown:\n"
        '{"low": <int>, "target": <int>, "high": <int>}'
    )


def _ai_calculate_settlement_range(
    debt: Dict[str, Any],
    debt_type: str,
    baseline: Dict[str, int],
    leverage_score: int,
    hardship_factors: List[str],
    financial_context: Dict[str, Any],
) -> Dict[str, int]:
    """Call AI to get personalized settlement percentages. Returns baseline on failure."""
    prompt = _ai_settlement_prompt(debt, debt_type, baseline, leverage_score, hardship_factors, financial_context)

    raw = None

    # Try Groq first
    groq = _groq()
    if groq:
        try:
            resp = groq.chat.completions.create(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=60,
                temperature=0.2,
            )
            raw = (resp.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning("Groq settlement range failed: %s", exc)

    # Try Anthropic if Groq failed
    if raw is None:
        anth = _anthropic()
        if anth:
            try:
                msg = anth.messages.create(
                    model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                    max_tokens=60,
                    temperature=0.2,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = (msg.content[0].text if msg.content else "").strip()
            except Exception as exc:
                logger.warning("Anthropic settlement range failed: %s", exc)

    if not raw:
        return baseline

    # Strip markdown fences if present
    raw = re.sub(r"```[a-z]*", "", raw).strip().strip("`")

    try:
        parsed = json.loads(raw)
        low = int(parsed["low"])
        target = int(parsed["target"])
        high = int(parsed["high"])
        # Sanity checks
        if not (10 <= low < target < high <= 100):
            raise ValueError("invalid range ordering")
        return {"low": low, "target": target, "high": high}
    except Exception as exc:
        logger.warning("Could not parse AI settlement range '%s': %s", raw, exc)
        return baseline


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_debt_leverage(
    debt: Dict[str, Any],
    financial_context: Dict[str, Any],
    debt_count: int = 1,
) -> Dict[str, Any]:
    debt_type = detect_debt_type(debt.get("name", ""))
    baseline = SETTLEMENT_RANGES[debt_type]

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
    leverage_score = max(0, min(100, score))

    hardship_factors = _compute_hardship_factors(debt, financial_context, debt_count)

    # Ask AI to personalize the settlement range
    settlement = _ai_calculate_settlement_range(
        debt, debt_type, baseline, leverage_score, hardship_factors, financial_context
    )

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
