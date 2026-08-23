"""
Groq client pool with automatic failover.

Reads GROQ_API_KEYS (comma-separated) or GROQ_API_KEY (single key).
On rate-limit or transient errors, the caller advances to the next client.

Also owns the choice of chat model, so a model swap is one edit rather than
seven (see chat_model).
"""
from __future__ import annotations

import logging
import os
from typing import Callable, List, Optional, TypeVar

logger = logging.getLogger(__name__)

try:
    import groq as _groq_sdk
except ImportError:
    _groq_sdk = None

# Groq decommissioned llama-3.3-70b-versatile in August 2026; requests for it
# now 404 with model_not_found, which the pool swallows into a silent fallback.
DEFAULT_MODEL = "openai/gpt-oss-120b"

_CLIENTS: Optional[List] = None

T = TypeVar("T")


def _build_clients() -> List:
    if _groq_sdk is None:
        return []
    raw = os.getenv("GROQ_API_KEYS") or os.getenv("GROQ_API_KEY", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    return [_groq_sdk.Groq(api_key=k, max_retries=0, timeout=20.0) for k in keys]


def get_clients() -> List:
    """Returns the cached list of Groq clients, building them on first call."""
    global _CLIENTS
    if _CLIENTS is None:
        _CLIENTS = _build_clients()
    return _CLIENTS


def call_with_failover(fn: Callable[[object], T]) -> Optional[T]:
    """
    Call fn(client) for each client in the pool until one succeeds.
    Returns the result of the first successful call, or None if all failed.
    fn should raise an exception on failure (rate limit, timeout, etc.).
    """
    clients = get_clients()
    if not clients:
        return None

    last_exc: Optional[Exception] = None
    for i, client in enumerate(clients):
        try:
            return fn(client)
        except Exception as exc:
            last_exc = exc
            logger.warning("Groq client #%d failed: %s — trying next", i + 1, exc)
            continue

    if last_exc is not None:
        logger.warning("All Groq clients exhausted; last error: %s", last_exc)
    return None


def chat_model() -> tuple[str, dict]:
    """
    Returns (model_name, extra_create_kwargs) for a chat completion.

    GROQ_MODEL — a repo variable synced into .env at deploy time — overrides the
    default, so swapping models needs no code change.

    gpt-oss models burn completion tokens on an internal reasoning pass before
    they write any `content`. At the default effort that pass routinely eats the
    whole max_tokens budget and returns an empty message, and it also makes the
    model far likelier to recite its confidential system prompt verbatim — in
    testing it disclosed the settlement floor when asked point-blank. "low" keeps
    the reasoning short enough to leave room for an actual answer and holds the
    guidelines in character.
    """
    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    extra: dict = {}
    if "gpt-oss" in model:
        extra["reasoning_effort"] = os.getenv("GROQ_REASONING_EFFORT", "low")
    return model, extra
