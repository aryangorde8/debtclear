from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from . import ai_advisor, chat_engine, debt_engine, letter_generator, negotiation_engine, roleplay_engine, script_generator

logger = logging.getLogger(__name__)


def _validate(payload: dict) -> tuple[dict | None, dict | None]:
    """Returns (clean_payload, error_dict). Exactly one is None."""
    if not isinstance(payload, dict):
        return None, {"error": "Request body must be a JSON object."}

    try:
        monthly_income = float(payload.get("monthly_income", 0))
        extra_payment = float(payload.get("extra_payment", 0))
    except (TypeError, ValueError):
        return None, {"error": "monthly_income and extra_payment must be numbers."}

    if monthly_income <= 0:
        return None, {"error": "monthly_income must be greater than zero."}
    if extra_payment < 0:
        return None, {"error": "extra_payment cannot be negative."}

    raw_debts = payload.get("debts")
    if not isinstance(raw_debts, list) or not raw_debts:
        return None, {"error": "debts must be a non-empty list."}
    if len(raw_debts) > 20:
        return None, {"error": "Maximum 20 debts supported per analysis."}

    clean_debts = []
    for i, d in enumerate(raw_debts):
        if not isinstance(d, dict):
            return None, {"error": f"Debt #{i + 1} must be an object."}
        try:
            balance = float(d.get("balance", 0))
            rate = float(d.get("rate", 0))
            min_payment = float(d.get("min_payment", 0))
        except (TypeError, ValueError):
            return None, {"error": f"Debt #{i + 1} has non-numeric fields."}

        name = str(d.get("name", "")).strip() or f"Debt {i + 1}"
        if balance <= 0:
            return None, {"error": f"{name}: balance must be greater than zero."}
        if rate < 0 or rate > 100:
            return None, {"error": f"{name}: rate must be between 0 and 100."}
        if min_payment <= 0:
            return None, {"error": f"{name}: minimum payment must be greater than zero."}

        # Reject minimums that can't outpace monthly interest — would loop forever.
        monthly_interest = balance * (rate / 100.0 / 12.0)
        if min_payment <= monthly_interest:
            return None, {
                "error": (
                    f"{name}: minimum payment of ${min_payment:.2f} doesn't cover "
                    f"monthly interest of ${monthly_interest:.2f}. Increase the minimum "
                    f"or this debt grows forever."
                )
            }

        clean_debts.append(
            {"name": name, "balance": balance, "rate": rate, "min_payment": min_payment}
        )

    return {
        "monthly_income": monthly_income,
        "extra_payment": extra_payment,
        "debts": clean_debts,
    }, None


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def analyze(request):
    clean, error = _validate(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    try:
        results = debt_engine.analyze(clean)
    except Exception:
        logger.exception("debt_engine.analyze failed")
        return Response(
            {"error": "Internal calculation error."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    advice = ai_advisor.analyze_with_claude(clean, results)
    results["ai_analysis"] = advice["text"]
    results["ai_source"] = advice["source"]

    return Response(results, status=status.HTTP_200_OK)


def _validate_negotiate(payload: dict) -> tuple[dict | None, dict | None]:
    if not isinstance(payload, dict):
        return None, {"error": "Request body must be a JSON object."}

    debt = payload.get("debt")
    if not isinstance(debt, dict):
        return None, {"error": "debt must be an object."}

    try:
        balance = float(debt.get("balance", 0))
        rate = float(debt.get("rate", 0))
        min_payment = float(debt.get("min_payment", 0))
    except (TypeError, ValueError):
        return None, {"error": "debt.balance, debt.rate, and debt.min_payment must be numbers."}

    name = str(debt.get("name", "")).strip() or "Account"
    if balance <= 0:
        return None, {"error": "debt.balance must be greater than zero."}
    if rate < 0 or rate > 100:
        return None, {"error": "debt.rate must be between 0 and 100."}
    if min_payment <= 0:
        return None, {"error": "debt.min_payment must be greater than zero."}

    ctx = payload.get("financial_context") or {}
    try:
        monthly_income = float(ctx.get("monthly_income", 0))
        total_debt = float(ctx.get("total_debt", balance))
        stress_score = float(ctx.get("stress_score", 0))
    except (TypeError, ValueError):
        return None, {"error": "financial_context fields must be numbers."}

    if monthly_income < 0 or total_debt < 0 or stress_score < 0:
        return None, {"error": "financial_context values cannot be negative."}

    debt_count = int(payload.get("debt_count", 1) or 1)

    return (
        {
            "debt": {"name": name, "balance": balance, "rate": rate, "min_payment": min_payment},
            "financial_context": {
                "monthly_income": monthly_income,
                "total_debt": total_debt,
                "stress_score": stress_score,
            },
            "debt_count": max(1, debt_count),
        },
        None,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def negotiate(request):
    clean, error = _validate_negotiate(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    debt = clean["debt"]
    ctx = clean["financial_context"]

    try:
        leverage = negotiation_engine.analyze_debt_leverage(debt, ctx, clean["debt_count"])
        savings = negotiation_engine.calculate_settlement_savings(debt, leverage["settlement_target"])
        savings_range = negotiation_engine.projected_savings_range(debt, leverage)
    except Exception:
        logger.exception("negotiation_engine failed")
        return Response(
            {"error": "Could not analyze leverage for this debt."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    script = script_generator.generate_negotiation_script(debt, leverage, ctx)

    return Response(
        {
            "leverage_analysis": leverage,
            "savings": savings,
            "savings_range": savings_range,
            "script": {
                "sections": script["sections"],
                "section_order": [
                    {"key": k, "title": t} for k, t in script_generator.SECTION_ORDER
                ],
                "source": script["source"],
            },
            "debt": debt,
        },
        status=status.HTTP_200_OK,
    )


def _validate_roleplay(payload: dict) -> tuple[dict | None, dict | None]:
    if not isinstance(payload, dict):
        return None, {"error": "Request body must be a JSON object."}

    debt = payload.get("debt")
    if not isinstance(debt, dict):
        return None, {"error": "debt must be an object."}
    try:
        balance = float(debt.get("balance", 0))
        rate = float(debt.get("rate", 0))
    except (TypeError, ValueError):
        return None, {"error": "debt fields must be numeric."}
    name = str(debt.get("name", "")).strip() or "the creditor"
    if balance <= 0 or rate < 0:
        return None, {"error": "Invalid debt values."}

    leverage = payload.get("leverage")
    if not isinstance(leverage, dict):
        return None, {"error": "leverage must be an object."}
    required = ("settlement_low", "settlement_target", "settlement_high", "leverage_label", "debt_type_label")
    for k in required:
        if k not in leverage:
            return None, {"error": f"leverage.{k} is required."}

    history = payload.get("history", [])
    if not isinstance(history, list):
        return None, {"error": "history must be a list."}
    if len(history) > 30:
        return None, {"error": "Conversation too long."}

    clean_history = []
    for i, m in enumerate(history):
        if not isinstance(m, dict):
            return None, {"error": f"history[{i}] must be an object."}
        role = str(m.get("role", "")).lower()
        if role not in ("user", "creditor"):
            return None, {"error": f"history[{i}].role must be 'user' or 'creditor'."}
        text = str(m.get("text", "")).strip()
        if not text:
            continue
        clean_history.append({"role": role, "text": text[:500]})

    return (
        {
            "debt": {"name": name, "balance": balance, "rate": rate, "min_payment": float(debt.get("min_payment", 0) or 0)},
            "leverage": leverage,
            "history": clean_history,
        },
        None,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def roleplay(request):
    clean, error = _validate_roleplay(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = roleplay_engine.generate_creditor_turn(
            clean["debt"], clean["leverage"], clean["history"]
        )
    except Exception:
        logger.exception("roleplay_engine failed")
        return Response(
            {"error": "Could not generate creditor response."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(result, status=status.HTTP_200_OK)


def _validate_letter(payload: dict) -> tuple[dict | None, dict | None]:
    if not isinstance(payload, dict):
        return None, {"error": "Request body must be a JSON object."}
    debt = payload.get("debt")
    if not isinstance(debt, dict):
        return None, {"error": "debt must be an object."}
    try:
        balance = float(debt.get("balance", 0))
        rate = float(debt.get("rate", 0))
    except (TypeError, ValueError):
        return None, {"error": "debt fields must be numeric."}
    name = str(debt.get("name", "")).strip() or "the creditor"
    if balance <= 0 or rate < 0:
        return None, {"error": "Invalid debt values."}

    leverage = payload.get("leverage")
    if not isinstance(leverage, dict):
        return None, {"error": "leverage must be an object."}
    for k in ("settlement_target", "settlement_low", "settlement_high", "debt_type_label"):
        if k not in leverage:
            return None, {"error": f"leverage.{k} is required."}

    ctx = payload.get("financial_context") or {}
    try:
        monthly_income = float(ctx.get("monthly_income", 0))
        total_debt = float(ctx.get("total_debt", balance))
    except (TypeError, ValueError):
        return None, {"error": "financial_context fields must be numbers."}

    return (
        {
            "debt": {"name": name, "balance": balance, "rate": rate, "min_payment": float(debt.get("min_payment", 0) or 0)},
            "leverage": leverage,
            "financial_context": {"monthly_income": monthly_income, "total_debt": total_debt},
        },
        None,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def settlement_letter(request):
    clean, error = _validate_letter(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = letter_generator.generate_settlement_letter(
            clean["debt"], clean["leverage"], clean["financial_context"]
        )
    except Exception:
        logger.exception("letter_generator failed")
        return Response(
            {"error": "Could not generate letter."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def simulate(request):
    """Lightweight what-if simulation — no AI, just the numbers."""
    clean, error = _validate(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    try:
        results = debt_engine.analyze(clean)
    except Exception:
        logger.exception("debt_engine.analyze (simulate) failed")
        return Response(
            {"error": "Internal calculation error."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            "stress_score": results["stress_score"],
            "total_debt": results["total_debt"],
            "weighted_avg_rate": results["weighted_avg_rate"],
            "extra_payment": results["extra_payment"],
            "avalanche": results["avalanche"],
            "snowball": results["snowball"],
            "interest_saved": results["interest_saved"],
            "months_saved": results["months_saved"],
            "recommended_strategy": results["recommended_strategy"],
        },
        status=status.HTTP_200_OK,
    )


def _validate_chat(payload: dict) -> tuple[dict | None, dict | None]:
    if not isinstance(payload, dict):
        return None, {"error": "Request body must be a JSON object."}

    snapshot = payload.get("snapshot")
    if not isinstance(snapshot, dict):
        return None, {"error": "snapshot must be an object."}

    question = str(payload.get("question", "")).strip()
    if not question:
        return None, {"error": "question is required."}
    if len(question) > 500:
        return None, {"error": "question is too long (max 500 chars)."}

    history = payload.get("history", [])
    if not isinstance(history, list):
        return None, {"error": "history must be a list."}
    if len(history) > 30:
        return None, {"error": "Conversation too long."}

    clean_history = []
    for i, m in enumerate(history):
        if not isinstance(m, dict):
            return None, {"error": f"history[{i}] must be an object."}
        role = str(m.get("role", "")).lower()
        if role not in ("user", "assistant"):
            continue
        content = str(m.get("content", "")).strip()
        if not content:
            continue
        clean_history.append({"role": role, "content": content[:1000]})

    return ({"snapshot": snapshot, "history": clean_history, "question": question}, None)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def chat(request):
    clean, error = _validate_chat(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = chat_engine.answer_question(
            clean["snapshot"], clean["history"], clean["question"]
        )
    except Exception:
        logger.exception("chat_engine failed")
        return Response(
            {"error": "Could not generate response."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
def health(_request):
    return Response({"status": "ok"})
