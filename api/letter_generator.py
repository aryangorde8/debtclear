"""
Settlement-letter generator.

Produces a formal written settlement letter the borrower can mail certified
when the phone negotiation stalls. AI-generated with deterministic fallback.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict

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


def _build_prompt(debt: Dict[str, Any], leverage: Dict[str, Any], financial_context: Dict[str, Any]) -> str:
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    target_pct = leverage["settlement_target"]
    target_amount = balance * target_pct / 100
    income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", balance) or balance)
    factors = "; ".join(leverage.get("hardship_factors", [])) or "Significant financial hardship"
    today = datetime.now().strftime("%B %d, %Y")

    return (
        "You are a consumer-debt attorney with 20 years of experience drafting settlement "
        "letters for FDCPA-compliant negotiations. Write a formal settlement-offer letter "
        "the borrower will mail by certified mail to the creditor.\n\n"
        f"DATE: {today}\n"
        f"CREDITOR: {debt['name']}\n"
        f"OUTSTANDING BALANCE: ${balance:,.2f}\n"
        f"APR: {rate:.2f}%\n"
        f"DEBT TYPE: {leverage['debt_type_label']}\n"
        f"BORROWER MONTHLY INCOME: ${income:,.2f}\n"
        f"BORROWER TOTAL DEBT: ${total_debt:,.2f}\n"
        f"HARDSHIP FACTORS: {factors}\n"
        f"SETTLEMENT OFFER: ${target_amount:,.2f} ({target_pct}% of balance), payable as a one-time lump sum within 14 calendar days of written acceptance\n\n"
        "STRUCTURE THE LETTER WITH THESE EXACT SECTIONS, EACH WITH AN ALL-CAPS HEADER:\n"
        "RE: Settlement Offer for Account [placeholder for account number]\n\n"
        "INTRODUCTION\n"
        "One short paragraph stating the purpose of the letter and that this is a good-faith settlement offer.\n\n"
        "STATEMENT OF HARDSHIP\n"
        "Two short paragraphs detailing the specific hardship factors and why full repayment is not possible. Use the actual dollar figures.\n\n"
        "SETTLEMENT OFFER\n"
        f"State the exact offer (${target_amount:,.2f}, lump sum, 14 days). State that this is the borrower's maximum capacity.\n\n"
        "TERMS AND CONDITIONS\n"
        "List exactly four conditions of acceptance:\n"
        "1. Account marked 'settled in full' or 'paid as agreed' to all three credit bureaus.\n"
        "2. No portion of the forgiven balance sold or transferred to a collections agency.\n"
        "3. Written acceptance required before any funds are transmitted.\n"
        "4. No further collection activity once payment is received.\n\n"
        "RESPONSE DEADLINE\n"
        "Give the creditor 30 calendar days from receipt to respond in writing. State that absent a written response, the offer is withdrawn.\n\n"
        "CLOSING\n"
        "Polite, professional close. Sign-off line: 'Sincerely,' followed by '[Your Full Name]' and '[Your Address]' as placeholders.\n\n"
        "RULES:\n"
        "- Use formal business-letter English. No casual language.\n"
        "- Do NOT include the date line or recipient address block — those are added by the UI.\n"
        "- Use exact dollar figures from above. No placeholders for amounts.\n"
        "- Where a personal detail is needed (name, address, account number, phone), use bracketed placeholders like [Your Full Name].\n"
        "- The whole letter should be 350–500 words.\n"
        "- Do not add any markdown — return plain text only."
    )


def _fallback_letter(debt: Dict[str, Any], leverage: Dict[str, Any], financial_context: Dict[str, Any]) -> str:
    balance = float(debt["balance"])
    rate = float(debt["rate"])
    target_pct = leverage["settlement_target"]
    target_amount = balance * target_pct / 100
    income = float(financial_context.get("monthly_income", 0) or 0)
    total_debt = float(financial_context.get("total_debt", balance) or balance)
    debt_type = leverage["debt_type_label"].lower()
    factors = leverage.get("hardship_factors", [])[:3]
    factors_text = "; ".join(factors) if factors else "significant financial hardship"

    return f"""RE: Settlement Offer for Account [Account Number]

INTRODUCTION
This letter constitutes a formal, good-faith settlement offer regarding the above-referenced account with {debt['name']}. The undersigned is requesting resolution of the outstanding balance under the terms described below.

STATEMENT OF HARDSHIP
The current outstanding balance on this {debt_type} is ${balance:,.2f} at an annual percentage rate of {rate:.2f}%. The undersigned is presently experiencing serious financial hardship that makes continued repayment at the current minimum schedule impossible to sustain.

The borrower's monthly income is approximately ${income:,.2f} and total outstanding consumer debt across all accounts is ${total_debt:,.2f}. Specifically, the following hardship factors apply: {factors_text}. Continued attempts to service the account at the current contractual rate would result in further delinquency and likely default.

SETTLEMENT OFFER
In an effort to resolve this matter outside of formal hardship or legal proceedings, the undersigned offers ${target_amount:,.2f} — representing {target_pct}% of the outstanding balance — as a one-time lump-sum settlement, payable within fourteen (14) calendar days of written acceptance. This figure represents the maximum amount the borrower is able to allocate to this account given current obligations.

TERMS AND CONDITIONS
Acceptance of this offer is contingent upon the following four conditions:

1. The account shall be reported to all three credit bureaus (Equifax, Experian, TransUnion) as "settled in full" or "paid as agreed," not as a charge-off or collection.
2. No portion of the forgiven balance shall be sold, assigned, or transferred to any third-party collections agency.
3. Written acceptance of these terms must be received before any funds are transmitted.
4. All collection activity on the account shall cease immediately upon receipt of payment.

RESPONSE DEADLINE
Please respond in writing within thirty (30) calendar days of receipt of this letter. Absent a written response within that period, this offer shall be deemed withdrawn and the borrower will pursue alternative resolution options.

CLOSING
Thank you for your prompt and professional attention to this matter. The undersigned is committed to resolving this account in good faith and looks forward to your written response.

Sincerely,

[Your Full Name]
[Your Address]
[City, State ZIP]
[Phone]
"""


def generate_settlement_letter(
    debt: Dict[str, Any],
    leverage: Dict[str, Any],
    financial_context: Dict[str, Any],
) -> Dict[str, Any]:
    """Returns {body, source} where source is 'groq', 'claude', or 'fallback'."""
    prompt = _build_prompt(debt, leverage, financial_context)

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _call_groq(client):
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.3,
        )
        text = (resp.choices[0].message.content or "").strip()
        if len(text) < 200:
            raise ValueError("Letter too short")
        return text

    raw = call_with_failover(_call_groq)
    if raw:
        return {"body": raw, "source": "groq"}

    anth = _anthropic()
    if anth:
        try:
            msg = anth.messages.create(
                model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                max_tokens=1000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (msg.content[0].text if msg.content else "").strip()
            if len(text) >= 200:
                return {"body": text, "source": "claude"}
        except Exception as exc:
            logger.warning("Anthropic letter generation failed: %s", exc)

    return {"body": _fallback_letter(debt, leverage, financial_context), "source": "fallback"}
