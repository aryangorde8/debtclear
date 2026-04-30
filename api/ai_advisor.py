"""
Claude Sonnet 4.6 financial-advice integration via AWS Bedrock.

If Bedrock credentials are missing or the call fails, we fall back to a
data-driven advisor written in pure Python so the demo is always responsive.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Lazy boto3 import so dev environments without AWS still boot cleanly.
try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:  # pragma: no cover - boto3 is in requirements.txt
    boto3 = None
    BotoConfig = None
    BotoCoreError = ClientError = Exception  # type: ignore


_BEDROCK_CLIENT = None


def _get_client():
    global _BEDROCK_CLIENT
    if _BEDROCK_CLIENT is not None or boto3 is None:
        return _BEDROCK_CLIENT

    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    if not access_key or not secret_key:
        return None

    region = os.getenv("AWS_REGION", "us-east-1")
    _BEDROCK_CLIENT = boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=BotoConfig(read_timeout=30, connect_timeout=10, retries={"max_attempts": 2}),
    )
    return _BEDROCK_CLIENT


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


def _fallback_analysis(debt_data: Dict[str, Any], results: Dict[str, Any]) -> str:
    """Deterministic, data-driven advice when Bedrock is unavailable."""
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


def analyze_with_claude(debt_data: Dict[str, Any], results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns a dict with `text` (the advice) and `source` ("bedrock" or "fallback")
    so the UI can label the response transparently.
    """
    client = _get_client()
    if client is None:
        return {"text": _fallback_analysis(debt_data, results), "source": "fallback"}

    model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-6")
    prompt = _build_prompt(debt_data, results)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 800,
        "temperature": 0.4,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        payload = json.loads(response["body"].read())
        blocks = payload.get("content", [])
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        if not text:
            raise ValueError("Empty completion from Bedrock")
        return {"text": text, "source": "bedrock"}
    except (ClientError, BotoCoreError, ValueError, KeyError, json.JSONDecodeError) as exc:
        logger.warning("Bedrock invocation failed; using fallback analyzer: %s", exc)
        return {
            "text": _fallback_analysis(debt_data, results),
            "source": "fallback",
            "error": str(exc),
        }
