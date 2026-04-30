"""
Negotiate Mode — leverage analysis and settlement-range calculation.

Real-world settlement ranges are sourced from CFPB consumer-finance guidance,
NACBA practitioner reports, and the FTC debt-relief disclosure rule. They
reflect what creditors *actually* accept on aged, hardship-flagged accounts —
not best-case numbers. The leverage score combines hardship signals already
present in the user's DebtClear analysis with intrinsic creditor flexibility.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

# Settlement ranges by debt type. Numbers are percentages of original balance
# the user might realistically settle for. Lower = better for the borrower.
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

# Order matters — most-specific first. We match on whole-word boundaries so
# "credit card" doesn't get caught by an auto-loan keyword like "car".
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
        # Multi-word keywords need substring match; single words use \b boundaries.
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


def analyze_debt_leverage(
    debt: Dict[str, Any],
    financial_context: Dict[str, Any],
    debt_count: int = 1,
) -> Dict[str, Any]:
    """Returns the full leverage analysis for a single debt."""
    debt_type = detect_debt_type(debt.get("name", ""))
    settlement = SETTLEMENT_RANGES[debt_type]

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
            "Debt type couldn't be auto-detected from the name. Settlement assumes "
            "an average unsecured account — adjust expectations based on the creditor."
        )

    return {
        "debt_type": debt_type,
        "debt_type_label": DEBT_TYPE_LABELS[debt_type],
        "leverage_score": leverage_score,
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
    """Best/expected/worst settlement outcomes for the UI."""
    return {
        "best_case": calculate_settlement_savings(debt, analysis["settlement_low"]),
        "target":    calculate_settlement_savings(debt, analysis["settlement_target"]),
        "worst_case": calculate_settlement_savings(debt, analysis["settlement_high"]),
    }
