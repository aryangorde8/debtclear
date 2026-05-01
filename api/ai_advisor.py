"""
AI financial-advice integration.

Priority: Groq (free, no CC) → Anthropic Claude → deterministic fallback.
The fallback is always responsive so the demo never breaks.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from typing import Any, Dict

_CACHE: dict = {}
_CACHE_TTL = 3600

logger = logging.getLogger(__name__)


def _cache_key(debt_data: Dict, results: Dict) -> str:
    payload = {
        "income": round(debt_data["monthly_income"]),
        "extra": round(debt_data["extra_payment"]),
        "debts": sorted(
            [{"n": d["name"], "b": round(d["balance"]), "r": d["rate"]} for d in debt_data["debts"]],
            key=lambda x: x["n"],
        ),
    }
    return hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _get_cached(key: str):
    entry = _CACHE.get(key)
    if entry and time.time() - entry[1] < _CACHE_TTL:
        return entry[0]
    return None


def _set_cached(key: str, value):
    _CACHE[key] = (value, time.time())


# ── Groq client pool (multi-key with failover) ───────────────────────────────

from .groq_pool import call_with_failover


# ── Anthropic client ──────────────────────────────────────────────────────────

try:
    import anthropic as _anthropic_sdk
except ImportError:
    _anthropic_sdk = None

_ANTHROPIC_CLIENT = None


def _get_anthropic_client():
    global _ANTHROPIC_CLIENT
    if _ANTHROPIC_CLIENT is not None or _anthropic_sdk is None:
        return _ANTHROPIC_CLIENT
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    _ANTHROPIC_CLIENT = _anthropic_sdk.Anthropic(api_key=api_key)
    return _ANTHROPIC_CLIENT


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_prompt(debt_data: Dict[str, Any], results: Dict[str, Any]) -> str:
    debt_lines = "\n".join(
        f"  - {d['name']}: balance ${d['balance']:,.2f}, rate {d['rate']}%, "
        f"minimum ${d['min_payment']:,.2f}/mo"
        for d in debt_data["debts"]
    )
    return (
        "You are a certified financial advisor specialising in consumer debt management. "
        "You are speaking directly to a client whose full numbers you know.\n\n"
        "CLIENT SITUATION\n"
        f"- Total debt: ${results['total_debt']:,.2f}\n"
        f"- Monthly income: ${debt_data['monthly_income']:,.2f}\n"
        f"- Extra monthly payment available beyond minimums: ${debt_data['extra_payment']:,.2f}\n"
        f"- Number of debts: {len(debt_data['debts'])}\n"
        f"- Weighted average interest rate: {results['weighted_avg_rate']}%\n"
        f"- Debts:\n{debt_lines}\n\n"
        "MATHEMATICAL SIMULATION\n"
        f"- Avalanche method: debt-free in {results['avalanche']['months']} months, "
        f"total interest paid ${results['avalanche']['total_interest']:,.2f}\n"
        f"- Snowball method: debt-free in {results['snowball']['months']} months, "
        f"total interest paid ${results['snowball']['total_interest']:,.2f}\n"
        f"- Interest saved by Avalanche over Snowball: ${results['interest_saved']:,.2f}\n"
        f"- Months saved by Avalanche: {results['months_saved']}\n"
        f"- Financial stress score: {results['stress_score']}/100\n\n"
        "RESPONSE FORMAT — return exactly three paragraphs, no headings, no bullet lists:\n"
        "1. Direct, specific assessment of their debt situation. Cite exact dollar figures.\n"
        "2. The strategy you recommend and why, referencing the precise mathematical "
        "difference between Avalanche and Snowball for THIS client.\n"
        "3. One concrete action they can take this month, with an exact dollar amount.\n\n"
        "Rules: be direct and specific, never generic. Use exact dollar figures. "
        "Reference real concepts (debt avalanche, compound interest, debt-to-income ratio). "
        "Do not give disclaimers. Do not suggest consulting another advisor. "
        "Speak as their trusted advisor who already knows the full picture."
    )


# ── Deterministic fallback ────────────────────────────────────────────────────

def _fallback_analysis(debt_data: Dict[str, Any], results: Dict[str, Any]) -> str:
    total = results["total_debt"]
    income = debt_data["monthly_income"]
    extra = debt_data["extra_payment"]
    saved = results["interest_saved"]
    months_saved = results["months_saved"]
    stress = results["stress_score"]
    avalanche_months = results["avalanche"]["months"]
    snowball_months = results["snowball"]["months"]
    avalanche_interest = results["avalanche"]["total_interest"]
    snowball_interest = results["snowball"]["total_interest"]
    debts = sorted(debt_data["debts"], key=lambda d: -d["rate"])
    top = debts[0]
    annual_income = income * 12
    dti = (total / annual_income * 100) if annual_income > 0 else 0

    severity = (
        "manageable but worth taking seriously"
        if stress < 40
        else "elevated and demands a structured plan"
        if stress < 70
        else "severe — every additional month of minimum-only payments is expensive"
    )

    para1 = (
        f"You're carrying ${total:,.2f} in total debt against ${income:,.2f} in monthly income, "
        f"a debt-to-annual-income ratio of {dti:.0f}%. Your stress score of {stress}/100 puts "
        f"this in the {severity} category. The biggest single driver is your {top['name']} "
        f"at {top['rate']}% APR — that one balance is compounding faster than anything else "
        f"in your portfolio, and it's where the math says your next dollar belongs."
    )

    if results["recommended_strategy"] == "avalanche":
        time_clause = (
            f" and {months_saved} {'month' if months_saved == 1 else 'months'} of your life back"
            if months_saved > 0
            else ""
        )
        para2 = (
            f"Run the Avalanche method. The simulation shows you debt-free in {avalanche_months} "
            f"months paying ${avalanche_interest:,.2f} in total interest, versus "
            f"{snowball_months} months and ${snowball_interest:,.2f} on Snowball. "
            f"That's ${saved:,.2f} kept in your pocket{time_clause}, simply by attacking "
            f"{top['name']} at {top['rate']}% before lower-rate balances. "
            f"Compound interest is the lever here — high-rate debt grows faster, so killing it "
            f"first starves the largest source of new interest."
        )
    else:
        para2 = (
            f"In your specific portfolio the two strategies converge — Snowball costs about the "
            f"same as Avalanche (${snowball_interest:,.2f} vs ${avalanche_interest:,.2f}), so "
            f"the psychological win of clearing your smallest balance first is worth taking. "
            f"Knock out the smallest debt, then redirect every freed-up dollar to the next one. "
            f"Momentum compounds the same way interest does."
        )

    target_extra = max(50.0, round(extra * 1.25))
    para3 = (
        f"This month, route every available dollar of your ${extra:,.2f} extra payment to "
        f"{top['name']} on top of its ${top['min_payment']:,.2f} minimum — that's "
        f"${top['min_payment'] + extra:,.2f} aimed at one balance. If you can find another "
        f"${target_extra - extra:,.0f}/month by trimming a recurring subscription or one weekly "
        f"discretionary line item, push your extra payment to ${target_extra:,.0f} and re-run "
        f"this analysis. Even a small bump shifts the curve materially because it stacks against "
        f"compounding interest, not against a fixed bill."
    )

    return f"{para1}\n\n{para2}\n\n{para3}"


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_with_claude(debt_data: Dict[str, Any], results: Dict[str, Any]) -> Dict[str, Any]:
    """Returns {text, source} where source is 'groq', 'claude', 'fallback', or *_cached."""
    key = _cache_key(debt_data, results)
    cached = _get_cached(key)
    if cached:
        return {**cached, "source": cached["source"] + "_cached"}

    prompt = _build_prompt(debt_data, results)

    # 1. Try Groq with key-pool failover
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.4,
        )
        text = (completion.choices[0].message.content or "").strip()
        if not text:
            raise ValueError("Empty completion")
        return text

    text = call_with_failover(_call_groq)
    if text:
        result = {"text": text, "source": "groq"}
        _set_cached(key, result)
        return result

    # 2. Try Anthropic Claude
    anthropic_client = _get_anthropic_client()
    if anthropic_client:
        try:
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            message = anthropic_client.messages.create(
                model=model,
                max_tokens=800,
                temperature=0.4,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (message.content[0].text if message.content else "").strip()
            if text:
                result = {"text": text, "source": "claude"}
                _set_cached(key, result)
                return result
        except Exception as exc:
            logger.warning("Anthropic API failed; using fallback: %s", exc)

    # 3. Deterministic fallback
    return {"text": _fallback_analysis(debt_data, results), "source": "fallback"}
