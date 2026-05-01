"""
Negotiation script generation.

Priority: Groq (free, no CC) → Anthropic Claude → deterministic fallback.
All expected sections are always returned — missing ones from the LLM are
filled deterministically so the UI never renders an empty card.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Tuple

_CACHE: dict = {}
_CACHE_TTL = 3600

logger = logging.getLogger(__name__)


def _cache_key(debt: Dict, financial_context: Dict) -> str:
    payload = {
        "name": debt.get("name", ""),
        "balance": round(float(debt.get("balance", 0))),
        "rate": debt.get("rate"),
        "income": round(float(financial_context.get("monthly_income", 0))),
        "stress": financial_context.get("stress_score"),
    }
    return hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _get_cached(key: str):
    entry = _CACHE.get(key)
    if entry and time.time() - entry[1] < _CACHE_TTL:
        return entry[0]
    return None


def _set_cached(key: str, value):
    _CACHE[key] = (value, time.time())


SECTION_ORDER: List[Tuple[str, str]] = [
    ("opening",          "OPENING"),
    ("hardship",         "HARDSHIP STATEMENT"),
    ("initial_offer",    "INITIAL OFFER"),
    ("if_they_say_no",   "IF THEY SAY NO"),
    ("if_they_counter",  "IF THEY COUNTER-OFFER HIGHER"),
    ("closing",          "CLOSING THE DEAL"),
    ("avoid",            "WHAT TO AVOID"),
]
SECTION_TITLES = {key: title for key, title in SECTION_ORDER}


# ── Groq client pool ──────────────────────────────────────────────────────────

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


# ── Prompt & parsing ──────────────────────────────────────────────────────────

def _build_prompt(
    debt: Dict[str, Any],
    leverage: Dict[str, Any],
    financial_context: Dict[str, Any],
) -> str:
    target_pct = leverage["settlement_target"]
    low_pct = leverage["settlement_low"]
    target_amount = float(debt["balance"]) * target_pct / 100.0
    low_amount = float(debt["balance"]) * low_pct / 100.0
    factors = "; ".join(leverage["hardship_factors"]) or "Standard hardship"

    return (
        "You are a debt-negotiation coach with 20 years of experience helping consumers "
        "settle debts directly with creditors. Generate a complete phone-call script the "
        "user can read aloud, in first person.\n\n"
        "DEBT\n"
        f"- Creditor / debt name: {debt['name']}\n"
        f"- Debt type: {leverage['debt_type_label']}\n"
        f"- Current balance: ${float(debt['balance']):,.2f}\n"
        f"- APR: {float(debt['rate']):.2f}%\n"
        f"- Minimum payment: ${float(debt['min_payment']):,.2f}/mo\n\n"
        "FINANCIAL CONTEXT\n"
        f"- Monthly income: ${float(financial_context['monthly_income']):,.2f}\n"
        f"- Total debt across all accounts: ${float(financial_context['total_debt']):,.2f}\n"
        f"- Financial stress score: {financial_context['stress_score']}/100\n"
        f"- Hardship factors: {factors}\n\n"
        "NEGOTIATION TARGETS\n"
        f"- Realistic settlement range: {low_pct}% – {leverage['settlement_high']}% of balance\n"
        f"- Recommended target: {target_pct}% (${target_amount:,.2f})\n"
        f"- Open with the low end first: {low_pct}% (${low_amount:,.2f})\n\n"
        "Output exactly these section headers, each on its own line, all caps, "
        "followed by the section body on the next line(s):\n\n"
        "OPENING:\n"
        "HARDSHIP STATEMENT:\n"
        "INITIAL OFFER:\n"
        "IF THEY SAY NO:\n"
        "IF THEY COUNTER-OFFER HIGHER:\n"
        "CLOSING THE DEAL:\n"
        "WHAT TO AVOID:\n\n"
        "Rules:\n"
        "- Use the exact dollar figures above. No placeholders, no [brackets].\n"
        "- Write OPENING through CLOSING in first person, as the caller would speak.\n"
        "- WHAT TO AVOID is a list of three concrete things the user must NOT say "
        "(format as three lines starting with '- ').\n"
        "- Be confident, calm, and concrete. No filler. No advice to consult anyone else.\n"
        "- Whole call should read in 5–7 minutes."
    )


def _parse_sections(raw: str) -> Dict[str, str]:
    if not raw:
        return {}
    pattern = re.compile(
        r"^\s*(OPENING|HARDSHIP STATEMENT|INITIAL OFFER|IF THEY SAY NO|"
        r"IF THEY COUNTER-OFFER HIGHER|CLOSING THE DEAL|WHAT TO AVOID)\s*:?\s*$",
        re.IGNORECASE | re.MULTILINE,
    )
    matches = list(pattern.finditer(raw))
    if not matches:
        return {}

    title_to_key = {title: key for key, title in SECTION_ORDER}
    sections: Dict[str, str] = {}
    for i, match in enumerate(matches):
        title = match.group(1).upper()
        key = title_to_key.get(title)
        if not key:
            continue
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[start:end].strip()
        if body:
            sections[key] = body
    return sections


# ── Deterministic fallback ────────────────────────────────────────────────────

def _fallback_sections(
    debt: Dict[str, Any],
    leverage: Dict[str, Any],
    financial_context: Dict[str, Any],
) -> Dict[str, str]:
    name = debt["name"]
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    debt_type_label = leverage["debt_type_label"]
    target_pct = leverage["settlement_target"]
    low_pct = leverage["settlement_low"]
    high_pct = leverage["settlement_high"]
    target_amount = balance * target_pct / 100
    low_amount = balance * low_pct / 100
    high_amount = balance * high_pct / 100

    income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", 0) or 0)
    factors = leverage["hardship_factors"]

    if leverage["debt_type"] == "student_federal":
        return {
            "opening": (
                f"Hi, I'm calling about my federal student loan with {name}. I'm not "
                f"asking for a settlement — I understand that isn't on the table for "
                f"federal loans. I want to apply for an income-driven repayment plan "
                f"based on a hardship situation."
            ),
            "hardship": (
                f"My monthly income is ${income:,.0f} and my total debt across all "
                f"accounts is ${total_debt:,.0f}. My current minimum on this loan is "
                f"${float(debt['min_payment']):,.0f}, which I can't sustain alongside "
                f"my other obligations. I qualify for income-driven repayment and want "
                f"to enroll today."
            ),
            "initial_offer": (
                "I'd like to enroll in the SAVE plan (or PAYE / IBR if SAVE isn't "
                "available) with payments calculated on my discretionary income."
            ),
            "if_they_say_no": (
                "Federal regulations require my servicer to offer at least one "
                "income-driven repayment option. Please walk me through which IDR "
                "plans I'm eligible for based on my AGI."
            ),
            "if_they_counter": (
                "If they offer forbearance instead of IDR, decline. Forbearance lets "
                "interest keep accruing and doesn't progress me toward forgiveness. "
                "Insist on IDR enrollment."
            ),
            "closing": (
                "Confirm: which IDR plan I'm enrolled in, my new monthly payment "
                "amount, the next payment date, and the recertification date. Ask "
                "them to email written confirmation before we hang up."
            ),
            "avoid": (
                "- Don't agree to forbearance or deferment as a substitute for IDR.\n"
                "- Don't admit you can afford the current payment if you can't.\n"
                "- Don't agree to anything verbally without written confirmation."
            ),
        }

    return {
        "opening": (
            f"Hi, I'm calling about my account with {name}. I want to talk about "
            f"resolving the balance. I've been working through a serious financial "
            f"hardship and I'd like to discuss a settlement today."
        ),
        "hardship": (
            f"My monthly income is ${income:,.0f}. My total debt across all accounts "
            f"is ${total_debt:,.0f} — this {debt_type_label.lower()} alone is "
            f"${balance:,.2f} at {rate:.2f}% APR. Specifically: "
            f"{', '.join(factors[:3]).lower()}. I can't keep up with the minimums "
            f"and I'm trying to resolve this before the account goes further into "
            f"delinquency."
        ),
        "initial_offer": (
            f"I can offer ${low_amount:,.2f} as a one-time lump-sum settlement to "
            f"close the account. That's {low_pct}% of the balance, paid within "
            f"7 business days, in exchange for the account being marked "
            f"\"settled in full\" on my credit report."
        ),
        "if_they_say_no": (
            f"I understand. The reality is I don't have ${balance:,.2f} and I won't "
            f"in any reasonable timeframe. I can stretch to ${target_amount:,.2f} — "
            f"that's {target_pct}% — but only as a single lump-sum payment, and only "
            f"if we agree today and get it in writing."
        ),
        "if_they_counter": (
            f"That's still beyond what I can do. My absolute ceiling is "
            f"${high_amount:,.2f} ({high_pct}%), and only as a lump sum. Anything "
            f"higher and I have to weigh other options including formal hardship "
            f"programs. I'd rather settle this with you today."
        ),
        "closing": (
            "Before we end the call: I need three things in writing before I send "
            "any money. One — the exact settlement amount and that it satisfies the "
            "debt in full. Two — that the account will be reported as \"settled in "
            "full\" or \"paid as agreed\" to all three credit bureaus, not as a "
            "charge-off. Three — confirmation that no portion of the forgiven debt "
            "will be sold to a collections agency. Please email or fax the agreement "
            "before I authorize the payment."
        ),
        "avoid": (
            "- Don't disclose the full amount you have available — only the offer "
            "you're making.\n"
            "- Don't agree to a payment plan when a lump sum is on the table; "
            "settlements are stronger as one-time payments.\n"
            "- Don't authorize any payment until you have the agreement in writing "
            "and have read every line."
        ),
    }


def _normalise_sections(parsed: Dict[str, str], fallback: Dict[str, str]) -> Dict[str, str]:
    return {key: parsed.get(key) or fallback.get(key, "") for key, _ in SECTION_ORDER}


# ── Public API ────────────────────────────────────────────────────────────────

def generate_negotiation_script(
    debt: Dict[str, Any],
    leverage: Dict[str, Any],
    financial_context: Dict[str, Any],
) -> Dict[str, Any]:
    """Returns {sections, source, raw} where source is 'groq', 'claude', or 'fallback'."""
    key = _cache_key(debt, financial_context)
    cached = _get_cached(key)
    if cached:
        return {**cached, "source": cached["source"] + "_cached"}

    fallback = _fallback_sections(debt, leverage, financial_context)
    prompt = _build_prompt(debt, leverage, financial_context)

    # 1. Try Groq with key-pool failover
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.3,
        )
        raw = (completion.choices[0].message.content or "").strip()
        parsed = _parse_sections(raw)
        if not parsed:
            raise ValueError("Could not parse script sections")
        return raw, parsed

    groq_result = call_with_failover(_call_groq)
    if groq_result:
        raw, parsed = groq_result
        result = {
            "sections": _normalise_sections(parsed, fallback),
            "source": "groq",
            "raw": raw,
        }
        _set_cached(key, result)
        return result

    # 2. Try Anthropic Claude
    anthropic_client = _get_anthropic_client()
    if anthropic_client:
        try:
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            message = anthropic_client.messages.create(
                model=model,
                max_tokens=1500,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = (message.content[0].text if message.content else "").strip()
            parsed = _parse_sections(raw)
            if parsed:
                result = {
                    "sections": _normalise_sections(parsed, fallback),
                    "source": "claude",
                    "raw": raw,
                }
                _set_cached(key, result)
                return result
        except Exception as exc:
            logger.warning("Anthropic script generation failed; using fallback: %s", exc)

    # 3. Deterministic fallback
    return {
        "sections": _normalise_sections({}, fallback),
        "source": "fallback",
        "raw": None,
    }
