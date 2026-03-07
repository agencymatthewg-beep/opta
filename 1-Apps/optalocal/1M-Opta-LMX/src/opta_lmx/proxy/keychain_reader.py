"""
keychain_reader.py — Read subscription OAuth tokens from macOS Keychain.

Tokens are stored by opta vault pull using the provider id as the service name.
Falls back to env vars (OPTA_TOKEN_<PROVIDER_UPPER>) for non-macOS environments.
"""

from __future__ import annotations

import logging
import os
import subprocess
import time

logger = logging.getLogger(__name__)

# In-memory cache: provider_id → (token, fetched_at)
_cache: dict[str, tuple[str, float]] = {}
CACHE_TTL_SECONDS = 300  # Re-read keychain every 5 minutes max


def get_subscription_token(provider_id: str) -> str | None:
    """Return the OAuth token for a subscription provider, or None if not found."""
    now = time.monotonic()
    if provider_id in _cache:
        token, fetched_at = _cache[provider_id]
        if now - fetched_at < CACHE_TTL_SECONDS:
            return token or None

    token = _read_token(provider_id)
    _cache[provider_id] = (token or "", now)
    return token


def invalidate_token(provider_id: str) -> None:
    """Remove cached token to force re-read on next call."""
    _cache.pop(provider_id, None)


def _read_token(provider_id: str) -> str | None:
    """Try env var first, then macOS Keychain."""
    # 1. Try env var first (CI, non-macOS, override)
    env_key = f"OPTA_TOKEN_{provider_id.upper().replace('-', '_')}"
    env_val = os.environ.get(env_key, "").strip()
    if env_val:
        logger.debug(
            "subscription_token_source",
            extra={"provider_id": provider_id, "source": "env"},
        )
        return env_val

    # 2. Try macOS Keychain via security CLI
    # opta vault pull stores using service=opta-{provider_id}
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", f"opta-{provider_id}", "-w"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0:
            token = result.stdout.strip()
            if token:
                logger.debug(
                    "subscription_token_source",
                    extra={"provider_id": provider_id, "source": "keychain"},
                )
                return token
    except FileNotFoundError:
        # security binary not available (non-macOS)
        pass
    except subprocess.TimeoutExpired:
        logger.warning(
            "keychain_timeout",
            extra={"provider_id": provider_id},
        )

    logger.debug(
        "subscription_token_missing",
        extra={"provider_id": provider_id},
    )
    return None
