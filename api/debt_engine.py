"""
DebtClear financial engine.

Pure-Python simulation of debt-payoff strategies. Every number returned by the
API ultimately comes from this module — there are no hidden heuristics. The
algorithms model how lenders actually compound interest and apply payments:

    1. Apply 1/12 of the annual rate as monthly interest to each outstanding
       balance.
    2. Pay each debt's contractual minimum (or the remaining balance, whichever
       is smaller). Any unused minimum from a paid-off debt cascades forward
       and joins the extra-payment pool — this is the "debt snowball" effect
       that gives both strategies their name.
    3. Apply remaining cash to debts in priority order. Avalanche prioritises
       the highest annual rate; Snowball prioritises the smallest balance.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Iterable, List, Sequence

# Cap simulations at 50 years so a misconfigured payment that can't keep up
# with interest doesn't loop forever.
MAX_MONTHS = 600


@dataclass
class StrategyResult:
    months: int
    total_interest: float
    payoff_timeline: List[float]
    payoff_order: List[str]
    payoff_months: List[int]  # month index each debt in payoff_order was eliminated
    converged: bool

    def as_dict(self) -> dict:
        return {
            "months": self.months,
            "total_interest": round(self.total_interest, 2),
            "payoff_timeline": [round(b, 2) for b in self.payoff_timeline],
            "payoff_order": self.payoff_order,
            "payoff_months": self.payoff_months,
            "converged": self.converged,
        }


def _priority_key(strategy: str):
    if strategy == "avalanche":
        # Highest annual rate first; tie-break by smaller balance.
        return lambda d: (-d["rate"], d["balance"])
    if strategy == "snowball":
        # Smallest balance first; tie-break by higher rate.
        return lambda d: (d["balance"], -d["rate"])
    raise ValueError(f"Unknown strategy: {strategy}")


def simulate(
    debts: Sequence[dict],
    extra_payment: float,
    strategy: str = "avalanche",
) -> StrategyResult:
    """Simulate month-by-month payoff for a single strategy."""
    working = [
        {
            "name": d["name"],
            "balance": float(d["balance"]),
            "rate": float(d["rate"]),
            "min_payment": float(d["min_payment"]),
        }
        for d in deepcopy(list(debts))
    ]
    working.sort(key=_priority_key(strategy))

    extra_payment = max(0.0, float(extra_payment))
    months = 0
    total_interest = 0.0
    timeline: List[float] = [sum(d["balance"] for d in working)]
    payoff_order: List[str] = []
    payoff_months: List[int] = []
    paid_off: set[str] = set()

    while any(d["balance"] > 0.005 for d in working):
        if months >= MAX_MONTHS:
            return StrategyResult(
                months=months,
                total_interest=total_interest,
                payoff_timeline=timeline,
                payoff_order=payoff_order,
                payoff_months=payoff_months,
                converged=False,
            )

        months += 1

        # 1. Accrue monthly interest on outstanding balances.
        for d in working:
            if d["balance"] > 0:
                interest = d["balance"] * (d["rate"] / 100.0 / 12.0)
                d["balance"] += interest
                total_interest += interest

        # 2. Pay contractual minimums; cascade unused minimums into the pool.
        pool = extra_payment
        for d in working:
            if d["balance"] <= 0:
                pool += d["min_payment"]  # debt is gone — its old minimum frees up.
                continue
            pay = min(d["min_payment"], d["balance"])
            d["balance"] -= pay
            leftover = d["min_payment"] - pay
            if leftover > 0:
                pool += leftover

        # 3. Apply pool in priority order, cascading as debts close.
        for d in working:
            if pool <= 0:
                break
            if d["balance"] <= 0:
                continue
            pay = min(pool, d["balance"])
            d["balance"] -= pay
            pool -= pay

        # Track payoff order in the month each debt was eliminated.
        for d in working:
            if d["balance"] <= 0.005 and d["name"] not in paid_off:
                paid_off.add(d["name"])
                payoff_order.append(d["name"])
                payoff_months.append(months)

        timeline.append(sum(max(0.0, d["balance"]) for d in working))

    return StrategyResult(
        months=months,
        total_interest=total_interest,
        payoff_timeline=timeline,
        payoff_order=payoff_order,
        payoff_months=payoff_months,
        converged=True,
    )


def calculate_stress_score(
    debts: Iterable[dict],
    monthly_income: float,
) -> int:
    """
    Composite 0-100 score combining three classic debt-health signals:

      * Debt-to-annual-income ratio (max 50 pts)
      * Minimum-payment-to-income burden (max 30 pts)
      * Weighted average interest rate (max 20 pts, scales above 5%)

    Higher = more financial stress. The weights and breakpoints follow CFPB
    guidance on consumer debt thresholds.
    """
    debts = list(debts)
    monthly_income = float(monthly_income)
    if monthly_income <= 0:
        return 100

    total_debt = sum(float(d["balance"]) for d in debts)
    total_min = sum(float(d["min_payment"]) for d in debts)

    if total_debt <= 0:
        return 0

    weighted_rate = sum(float(d["rate"]) * float(d["balance"]) for d in debts) / total_debt

    annual_income = monthly_income * 12
    dti = total_debt / annual_income
    burden = total_min / monthly_income

    dti_score = min(50.0, dti * 50.0)         # 1.0x annual income → 50 pts
    burden_score = min(30.0, burden * 75.0)   # 40% of income → 30 pts
    rate_score = min(20.0, max(0.0, weighted_rate - 5.0) * 1.0)

    return int(round(min(100.0, dti_score + burden_score + rate_score)))


def analyze(payload: dict) -> dict:
    """High-level entrypoint used by the API view."""
    debts = payload["debts"]
    monthly_income = float(payload["monthly_income"])
    extra_payment = float(payload["extra_payment"])

    avalanche = simulate(debts, extra_payment, "avalanche")
    snowball = simulate(debts, extra_payment, "snowball")
    # Minimum-only baseline = what happens if you do nothing extra.
    # Use avalanche ordering for the baseline (rate-based) since with $0 extra
    # the priority lever doesn't matter — only minimums get applied — but the
    # ordering still affects which minimum cascades first.
    minimum_only = simulate(debts, 0.0, "avalanche")

    interest_saved = round(snowball.total_interest - avalanche.total_interest, 2)
    months_saved = snowball.months - avalanche.months
    recommended = "avalanche" if avalanche.total_interest <= snowball.total_interest else "snowball"

    recommended_result = avalanche if recommended == "avalanche" else snowball
    interest_vs_minimum = round(minimum_only.total_interest - recommended_result.total_interest, 2)
    months_vs_minimum = minimum_only.months - recommended_result.months

    total_debt = sum(float(d["balance"]) for d in debts)
    weighted_rate = (
        sum(float(d["rate"]) * float(d["balance"]) for d in debts) / total_debt
        if total_debt > 0
        else 0.0
    )

    return {
        "stress_score": calculate_stress_score(debts, monthly_income),
        "total_debt": round(total_debt, 2),
        "weighted_avg_rate": round(weighted_rate, 2),
        "monthly_income": round(monthly_income, 2),
        "extra_payment": round(extra_payment, 2),
        "avalanche": avalanche.as_dict(),
        "snowball": snowball.as_dict(),
        "minimum_only": minimum_only.as_dict(),
        "interest_saved": interest_saved,
        "months_saved": months_saved,
        "interest_vs_minimum": interest_vs_minimum,
        "months_vs_minimum": months_vs_minimum,
        "recommended_strategy": recommended,
        "debts": [
            {
                "name": d["name"],
                "balance": round(float(d["balance"]), 2),
                "rate": round(float(d["rate"]), 2),
                "min_payment": round(float(d["min_payment"]), 2),
            }
            for d in debts
        ],
    }
