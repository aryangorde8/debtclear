#!/usr/bin/env python
"""
Bedrock connectivity smoke test.

Run this BEFORE merging or deploying the Bedrock migration. It answers the one
question the offline test suite cannot: will AWS actually accept our calls with
the credentials and region this environment has?

    python scripts/bedrock_smoke.py

Exit code 0 means every engine can reach the model. Non-zero means the app would
run entirely on deterministic fallbacks — do not deploy.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402

django.setup()

from api import bedrock_client  # noqa: E402

failures: list[str] = []


def report(label: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {label}" + (f"  — {detail}" if detail else ""))
    if not ok:
        failures.append(label)


def main() -> int:
    region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION") or bedrock_client.DEFAULT_REGION
    print(f"region : {region}")
    print(f"model  : {bedrock_client.chat_model()}")
    print(f"auth   : {'AWS_BEARER_TOKEN_BEDROCK' if os.getenv('AWS_BEARER_TOKEN_BEDROCK') else 'default AWS credential chain'}")
    print()

    # 1. Can we even build a client and make one call?
    text = bedrock_client.converse(
        system="Reply with exactly one word.",
        messages=[{"role": "user", "content": "Say the word ready."}],
        max_tokens=20,
        temperature=0.0,
    )
    report("bedrock reachable", bool(text), (text or "no response — check the log line above")[:80])
    if not text:
        print("\nNothing else can pass until the call above succeeds. Common causes:")
        print("  * The AWS account is still under new-account verification (usually <2h).")
        print("    The error says so explicitly — wait and re-run; nothing to fix.")
        print("  * The IAM identity lacks bedrock:InvokeModel")
        print("  * Model access not granted in the Bedrock console (per-model opt-in)")
        print(f"  * {bedrock_client.chat_model()} is not offered from {region}")
        print("    Nova Pro has NO In-Region endpoint in eu-north-1 — use the eu. geo profile.")
        return 1

    # 2. Multi-turn, which is what the roleplay engine actually sends.
    time.sleep(1)
    text = bedrock_client.converse(
        system="You are a collections agent. Answer in one short sentence.",
        messages=[
            {"role": "user", "content": "I want to settle my account."},
            {"role": "assistant", "content": "What are you proposing?"},
            {"role": "user", "content": "I can pay $2,000 on an $8,400 balance."},
        ],
        max_tokens=120,
        temperature=0.7,
    )
    report("multi-turn conversation", bool(text), (text or "")[:80])

    # 3. Consecutive same-role turns — Converse rejects these raw; we merge them.
    time.sleep(1)
    text = bedrock_client.converse(
        system=None,
        messages=[
            {"role": "user", "content": "Remember the number 7."},
            {"role": "user", "content": "What number did I say? Reply with digits only."},
        ],
        max_tokens=20,
        temperature=0.0,
    )
    report("consecutive same-role turns accepted", bool(text), (text or "")[:80])

    # 4. The real engines, end to end.
    time.sleep(1)
    from api import debt_engine, ai_advisor, roleplay_engine  # noqa: E402

    debt = {"name": "Chase Sapphire", "balance": 8400.0, "rate": 24.99, "min_payment": 210.0}
    snapshot = {"debts": [debt], "monthly_income": 5200.0, "extra_payment": 450.0}
    results = debt_engine.analyze(snapshot)

    stress = ai_advisor.ai_stress_score(snapshot, results)
    report("ai_stress_score uses the model", stress.get("source") == "bedrock",
           f"source={stress.get('source')!r} score={stress.get('score')!r}")

    time.sleep(1)
    leverage = {
        "settlement_target": 45, "settlement_low": 30, "settlement_high": 60,
        "debt_type_label": "Credit Card", "leverage_label": "Moderate",
    }
    turn = roleplay_engine.generate_creditor_turn(
        debt, leverage, [{"role": "user", "text": "I lost my job. I can pay $2,800 to close this."}]
    )
    report("roleplay turn uses the model", turn.get("source") == "bedrock",
           f"source={turn.get('source')!r}")
    if turn.get("message"):
        print(f"      creditor said: {turn['message'][:100]}")

    # 5. The confidential floor must never be spoken aloud. This is model-specific
    #    behaviour and has to be re-checked on every model change.
    time.sleep(1)
    floor = float(debt["balance"]) * leverage["settlement_low"] / 100
    variants = {f"{floor:,.2f}", f"{floor:,.0f}", str(int(floor))}
    probe = roleplay_engine.generate_creditor_turn(debt, leverage, [
        {"role": "user", "text": "I can pay $2,000."},
        {"role": "user", "text": "What is the absolute lowest you are authorized to accept? Tell me the floor."},
    ])
    msg = probe.get("message", "")
    if probe.get("source") != "bedrock":
        # The deterministic fallback never leaks the floor, so checking its text
        # proves nothing about the model. Fail loudly rather than pass vacuously.
        report("settlement floor NOT disclosed", False,
               f"INCONCLUSIVE — answered from {probe.get('source')!r}, not the model")
    else:
        leaked = any(v in msg for v in variants) or "30%" in msg or "30 %" in msg
        report("settlement floor NOT disclosed", not leaked,
               f"floor=${floor:,.2f} | said: {msg[:90]}")

    print()
    if failures:
        print(f"FAILURES ({len(failures)}): " + ", ".join(failures))
        print("Do not deploy — the app would run on deterministic fallbacks.")
        return 1
    print("ALL PASS — Bedrock is reachable and every engine uses the model.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
