"""
Amazon Bedrock client, via the Converse API.

Replaces the old Groq key pool. Auth is a single Bedrock API key
(AWS_BEARER_TOKEN_BEDROCK) or, failing that, whatever the standard AWS
credential chain resolves — env vars, ~/.aws, or an instance role.

Every engine calls `converse()`; nobody constructs a boto3 client directly.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:  # boto3 absent -> every engine falls back deterministically
    boto3 = None
    BotoConfig = None
    BotoCoreError = ClientError = Exception

# Nova Pro is not available In-Region from eu-north-1 (Stockholm) — only through
# the EU geo inference profile. Calling the bare "amazon.nova-pro-v1:0" from
# there fails with ValidationException, so the geo profile is the default.
# Override with BEDROCK_MODEL (use "us.amazon.nova-pro-v1:0" from a US region).
DEFAULT_MODEL = "eu.amazon.nova-pro-v1:0"
DEFAULT_REGION = "eu-north-1"

# Nova Pro caps output at 5K tokens regardless of what a caller asks for.
MAX_OUTPUT_TOKENS = 5000

# Errors worth a second attempt: transient capacity and throttling. A
# ValidationException or AccessDeniedException will fail identically on retry.
_RETRYABLE = {
    "ThrottlingException",
    "ModelNotReadyException",
    "ModelTimeoutException",
    "ServiceUnavailableException",
    "InternalServerException",
}

_CLIENT = None
_CLIENT_LOCK = threading.Lock()


def _build_client():
    if boto3 is None:
        logger.warning("boto3 is not installed — Bedrock is unavailable")
        return None
    region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION") or DEFAULT_REGION
    # boto3 reads AWS_BEARER_TOKEN_BEDROCK itself when present; otherwise it
    # walks the normal credential chain. Retries are handled here, not by boto,
    # so a dead call fails fast into the deterministic fallback.
    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        config=BotoConfig(
            retries={"max_attempts": 1, "mode": "standard"},
            connect_timeout=5,
            read_timeout=30,
        ),
    )


def get_client():
    """Cached bedrock-runtime client, built on first use."""
    global _CLIENT
    if _CLIENT is None:
        with _CLIENT_LOCK:
            if _CLIENT is None:
                _CLIENT = _build_client()
    return _CLIENT


def reset_client() -> None:
    """Drop the cached client. Tests use this after changing the environment."""
    global _CLIENT
    with _CLIENT_LOCK:
        _CLIENT = None


def chat_model() -> str:
    """The model (or geo inference profile) id to invoke."""
    return os.getenv("BEDROCK_MODEL", DEFAULT_MODEL)


def _normalise(messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Convert {role, content} pairs into Converse blocks.

    Converse is stricter than the old Groq endpoint: it rejects consecutive
    messages from the same role, and rejects a leading assistant turn. The
    roleplay history can legitimately contain two user turns in a row, so
    merge runs of the same role rather than letting the API 400.
    """
    merged: List[Dict[str, Any]] = []
    for m in messages:
        role = "assistant" if m.get("role") == "assistant" else "user"
        text = (m.get("content") or "").strip()
        if not text:
            continue
        if merged and merged[-1]["role"] == role:
            merged[-1]["content"][0]["text"] += "\n\n" + text
        else:
            merged.append({"role": role, "content": [{"text": text}]})

    while merged and merged[0]["role"] == "assistant":
        merged.pop(0)
    return merged


def converse(
    system: Optional[str],
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """
    Send one Converse request and return the assistant's text.

    Returns None on any failure — no key, no permission, throttled, empty
    completion — so callers drop to their deterministic fallback exactly as
    they did with Groq.
    """
    client = get_client()
    if client is None:
        return None

    body: Dict[str, Any] = {
        "modelId": chat_model(),
        "messages": _normalise(messages),
        "inferenceConfig": {
            "maxTokens": min(int(max_tokens), MAX_OUTPUT_TOKENS),
            "temperature": float(temperature),
        },
    }
    if not body["messages"]:
        logger.warning("Bedrock call skipped: no usable messages after normalisation")
        return None
    if system:
        body["system"] = [{"text": system}]

    last_error: Optional[Exception] = None
    for attempt in (1, 2):
        try:
            resp = client.converse(**body)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            last_error = exc
            if code in _RETRYABLE and attempt == 1:
                logger.warning("Bedrock %s on attempt %d — retrying", code, attempt)
                continue
            logger.warning("Bedrock call failed (%s): %s", code or "ClientError", exc)
            return None
        except BotoCoreError as exc:  # credentials missing, endpoint unreachable
            logger.warning("Bedrock transport error: %s", exc)
            return None

        stop = resp.get("stopReason")
        if stop in ("guardrail_intervened", "content_filtered"):
            logger.warning("Bedrock response suppressed (stopReason=%s)", stop)
            return None

        blocks = resp.get("output", {}).get("message", {}).get("content", [])
        text = "".join(b.get("text", "") for b in blocks).strip()
        if not text:
            logger.warning("Bedrock returned an empty completion (stopReason=%s)", stop)
            return None
        return text

    if last_error is not None:
        logger.warning("Bedrock exhausted retries; last error: %s", last_error)
    return None
