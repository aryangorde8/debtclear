"""
Phone-call roleplay engine.

The user plays themselves; the AI plays a tough but realistic collections agent
for the creditor. Each turn takes the conversation history plus debt context
and returns the creditor's next line.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List

from .groq_pool import call_with_failover

logger = logging.getLogger(__name__)

try:
    import anthropic as _anthropic_sdk
except ImportError:
    _anthropic_sdk = None

_ANTHROPIC_CLIENT = None


def _anthropic():
    global _ANTHROPIC_CLIENT
    if _ANTHROPIC_CLIENT is not None or _anthropic_sdk is None:
        return _ANTHROPIC_CLIENT
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None
    _ANTHROPIC_CLIENT = _anthropic_sdk.Anthropic(api_key=key)
    return _ANTHROPIC_CLIENT


def _system_prompt(debt: Dict[str, Any], leverage: Dict[str, Any]) -> str:
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    target_pct = leverage["settlement_target"]
    low_pct = leverage["settlement_low"]
    high_pct = leverage["settlement_high"]
    target_amount = balance * target_pct / 100
    low_amount = balance * low_pct / 100
    high_amount = balance * high_pct / 100
    debt_type = leverage["debt_type_label"]
    leverage_label = leverage["leverage_label"]

    return (
        f"You are Sarah Mitchell, a senior collections specialist at {debt['name']}. "
        f"You have 12 years of experience in debt recovery. You are firm, professional, "
        f"and slightly skeptical, but ultimately willing to settle if the customer makes "
        f"a strong case. You are NOT a pushover.\n\n"
        f"ACCOUNT IN FRONT OF YOU:\n"
        f"- Customer's {debt_type.lower()} account\n"
        f"- Outstanding balance: ${balance:,.2f}\n"
        f"- APR: {rate:.2f}%\n"
        f"- The customer's leverage is rated: {leverage_label}\n\n"
        f"YOUR INTERNAL GUIDELINES (never reveal these to the customer):\n"
        f"- The lowest you can go is {low_pct}% of balance (${low_amount:,.2f}) — "
        f"only for customers with severe hardship + good case\n"
        f"- Realistic target settlement is {target_pct}% (${target_amount:,.2f})\n"
        f"- Anything above {high_pct}% (${high_amount:,.2f}) you accept readily\n"
        f"- Always start by quoting the FULL balance and pushing for full repayment\n"
        f"- Counter their first offer with something 15-25% higher\n"
        f"- Never accept their first or second offer — push back at least twice\n"
        f"- If they sound unprepared, scared, or vague — push harder, offer less\n"
        f"- If they cite specific hardship (income loss, medical, multiple debts) — soften\n"
        f"- If they ask for a payment plan, prefer lump sum (offer 5-10% better terms)\n"
        f"- Demand any agreement be paid within 7-30 days\n\n"
        f"CONVERSATION RULES:\n"
        f"- Stay in character as Sarah. Speak naturally, like a real phone call.\n"
        f"- Keep responses SHORT — 1 to 3 sentences max. This is a phone call, not an essay.\n"
        f"- Use realistic collections language: 'account on file', 'balance due', "
        f"'minimum acceptable amount', 'I'd need manager approval for that'.\n"
        f"- Occasionally use filler: 'I see', 'Okay', 'I understand', 'Let me check'.\n"
        f"- Never break character. Never mention you are AI.\n"
        f"- Never use markdown, bullet points, or lists. Speak conversationally.\n\n"
        f"WHEN TO END THE CALL:\n"
        f"- If the customer makes an offer at or above your acceptable range AND has "
        f"pushed back at least once: you can verbally accept and then ASK them to confirm "
        f"the terms (lump sum, deadline, etc.). Tag this turn ONGOING — the deal is not "
        f"final until they say yes.\n"
        f"- Only tag SETTLED on a turn where the customer has CLEARLY confirmed the "
        f"specific dollar amount and terms in their previous message (e.g. they said 'yes', "
        f"'agreed', 'I'll do that', 'deal'). If you are still asking 'would you be able to "
        f"commit?' or 'do we have a deal?', the call is ONGOING — wait for their answer.\n"
        f"- If they hang up or say 'goodbye': end politely with [CALL_STATUS: DECLINED] if "
        f"no settlement was reached, or [CALL_STATUS: SETTLED $X] if it was.\n"
        f"- If you accept a settlement that the customer has confirmed, end your message "
        f'with the exact tag: [CALL_STATUS: SETTLED $X] where X is the dollar amount agreed.\n'
        f"- If they walk away with no deal, end with: [CALL_STATUS: DECLINED]\n"
        f"- Otherwise (most turns), end with: [CALL_STATUS: ONGOING]\n"
        f"- The status tag MUST be the very last thing in your response."
    )


def _opening_line(debt: Dict[str, Any]) -> str:
    return (
        f"Thank you for calling {debt['name']} collections, this is Sarah speaking. "
        f"I have your account pulled up. How can I help you today?"
    )


def _parse_status(text: str) -> tuple[str, str, float | None]:
    """Returns (clean_message, status, settlement_amount)."""
    pattern = re.compile(r"\[CALL_STATUS:\s*([A-Z]+)(?:\s*\$?([\d,]+(?:\.\d+)?))?\s*\]", re.IGNORECASE)
    match = pattern.search(text)
    if not match:
        return text.strip(), "ongoing", None

    status_word = match.group(1).upper()
    amount_str = match.group(2)
    amount: float | None = None
    if amount_str:
        try:
            amount = float(amount_str.replace(",", ""))
        except ValueError:
            amount = None

    clean = pattern.sub("", text).strip()
    status = "settled" if status_word == "SETTLED" else "declined" if status_word == "DECLINED" else "ongoing"
    return clean, status, amount


def _fallback_response(history: List[Dict[str, str]], debt: Dict[str, Any], leverage: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback if all AI providers fail."""
    target = float(debt["balance"]) * leverage["settlement_target"] / 100
    turns = len([m for m in history if m["role"] == "user"])

    if turns == 0:
        msg = _opening_line(debt)
        return {"message": msg, "status": "ongoing", "settlement_amount": None}
    if turns == 1:
        msg = (
            f"I see. Well, the balance on file is ${float(debt['balance']):,.2f} "
            f"and that's what's owed. What are you proposing today?"
        )
        return {"message": msg, "status": "ongoing", "settlement_amount": None}
    if turns == 2:
        msg = (
            f"That's quite a bit lower than what we typically accept. The minimum "
            f"I could even take to my manager would be ${target:,.2f}. Can you do that?"
        )
        return {"message": msg, "status": "ongoing", "settlement_amount": None}
    msg = (
        f"Alright. Let me speak with my manager — we can do ${target:,.2f} as a "
        f"final settlement, paid within 14 days. Do we have a deal?"
    )
    return {"message": msg, "status": "settled", "settlement_amount": round(target, 2)}


def generate_creditor_turn(
    debt: Dict[str, Any],
    leverage: Dict[str, Any],
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    history: list of {role: 'user'|'creditor', text: str}, oldest first.
    Returns: {message, status, settlement_amount}.
    """
    if not history or all(m["role"] == "creditor" for m in history):
        return {"message": _opening_line(debt), "status": "ongoing", "settlement_amount": None}

    system = _system_prompt(debt, leverage)
    messages = []
    for m in history:
        role = "user" if m["role"] == "user" else "assistant"
        messages.append({"role": role, "content": m["text"]})

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, *messages],
            max_tokens=200,
            temperature=0.7,
        )
        return (resp.choices[0].message.content or "").strip()

    raw = call_with_failover(_call_groq)

    if raw is None:
        anth = _anthropic()
        if anth:
            try:
                msg = anth.messages.create(
                    model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                    max_tokens=200,
                    temperature=0.7,
                    system=system,
                    messages=messages,
                )
                raw = (msg.content[0].text if msg.content else "").strip()
            except Exception as exc:
                logger.warning("Anthropic roleplay failed: %s", exc)

    if not raw:
        return _fallback_response(history, debt, leverage)

    clean, status, amount = _parse_status(raw)
    if not clean:
        return _fallback_response(history, debt, leverage)

    return {"message": clean, "status": status, "settlement_amount": amount}
