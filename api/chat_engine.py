"""
AI Q&A chat for follow-up questions about a user's debt plan.

The model receives the full financial snapshot every turn so it can answer
"what if I lose my job?", "should I refinance?", etc. with reference to the
user's actual numbers — not generic advice.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

from .groq_pool import call_with_failover

logger = logging.getLogger(__name__)

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


def _system_prompt(snapshot: Dict[str, Any]) -> str:
    debts = snapshot.get("debts", [])
    debt_lines = "\n".join(
        f"  - {d['name']}: ${d['balance']:,.2f} @ {d['rate']}% APR, min ${d['min_payment']:,.2f}/mo"
        for d in debts
    )
    income = float(snapshot.get("monthly_income", 0))
    annual = income * 12
    total_debt = float(snapshot.get("total_debt", 0))
    dti = (total_debt / annual * 100) if annual > 0 else 0
    rec = snapshot.get("recommended_strategy", "avalanche")
    avalanche = snapshot.get("avalanche", {})
    snowball = snapshot.get("snowball", {})
    minimum_only = snapshot.get("minimum_only", {})

    return (
        "You are this client's certified financial advisor. You already know their full picture "
        "(below). They are asking follow-up questions about their plan. Speak directly and "
        "specifically — always reference their actual numbers, not generic principles.\n\n"
        "CLIENT SNAPSHOT\n"
        f"- Total debt: ${total_debt:,.2f}\n"
        f"- Monthly income: ${income:,.2f} (annual ${annual:,.2f})\n"
        f"- Debt-to-annual-income ratio: {dti:.0f}%\n"
        f"- Extra monthly payment available: ${snapshot.get('extra_payment', 0):,.2f}\n"
        f"- Stress score: {snapshot.get('stress_score', 0)}/100\n"
        f"- Weighted average rate: {snapshot.get('weighted_avg_rate', 0)}%\n"
        f"- Debts:\n{debt_lines}\n\n"
        "PLAN\n"
        f"- Recommended strategy: {rec}\n"
        f"- Avalanche: {avalanche.get('months', '?')} months, ${avalanche.get('total_interest', 0):,.2f} interest\n"
        f"- Snowball: {snowball.get('months', '?')} months, ${snowball.get('total_interest', 0):,.2f} interest\n"
        f"- Minimum-only: {minimum_only.get('months', '?')} months, ${minimum_only.get('total_interest', 0):,.2f} interest\n\n"
        "RULES\n"
        "- Keep responses under 120 words. Conversational, direct, second person.\n"
        "- ALWAYS cite specific dollar figures from the snapshot when relevant.\n"
        "- If asked something hypothetical (job loss, windfall, refinance), do quick mental math "
        "and give a concrete answer with their numbers — don't punt.\n"
        "- Never give disclaimers. Never say 'consult a financial advisor' — you are their advisor.\n"
        "- If a question is outside debt/personal-finance scope, redirect briefly back to their plan.\n"
        "- Don't repeat the snapshot back to them; they already see it on the page.\n"
    )


def _fallback_reply(question: str, snapshot: Dict[str, Any]) -> str:
    income = float(snapshot.get("monthly_income", 0))
    total = float(snapshot.get("total_debt", 0))
    extra = float(snapshot.get("extra_payment", 0))
    rec = snapshot.get("recommended_strategy", "avalanche")
    months = snapshot.get(rec, {}).get("months", 0)
    return (
        f"I'm having trouble reaching the model right now, but here's the short version: "
        f"with ${total:,.0f} in debt and ${extra:,.0f}/month extra, your {rec} plan finishes in "
        f"{months} months. For \"{question[:80]}\" — the biggest variables are your income "
        f"(${income:,.0f}/mo) and how much extra you can throw at the highest-rate balance. "
        f"Try the what-if slider above to see how changes affect your timeline, then ask me again."
    )


def answer_question(snapshot: Dict[str, Any], history: List[Dict[str, str]], question: str) -> Dict[str, str]:
    """Returns {text, source}. history is a list of {role: 'user'|'assistant', content: str}."""
    system = _system_prompt(snapshot)

    # Trim history to last 6 turns to keep the context tight.
    trimmed = history[-12:] if len(history) > 12 else list(history)
    messages = [{"role": m["role"], "content": m["content"]} for m in trimmed if m.get("content")]
    messages.append({"role": "user", "content": question})

    # 1. Groq with failover
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, *messages],
            max_tokens=300,
            temperature=0.5,
        )
        text = (completion.choices[0].message.content or "").strip()
        if not text:
            raise ValueError("Empty completion")
        return text

    text = call_with_failover(_call_groq)
    if text:
        return {"text": text, "source": "groq"}

    # 2. Anthropic
    client = _get_anthropic_client()
    if client:
        try:
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            msg = client.messages.create(
                model=model,
                max_tokens=300,
                temperature=0.5,
                system=system,
                messages=messages,
            )
            text = (msg.content[0].text if msg.content else "").strip()
            if text:
                return {"text": text, "source": "claude"}
        except Exception as exc:
            logger.warning("chat_engine anthropic failed: %s", exc)

    # 3. Deterministic
    return {"text": _fallback_reply(question, snapshot), "source": "fallback"}
