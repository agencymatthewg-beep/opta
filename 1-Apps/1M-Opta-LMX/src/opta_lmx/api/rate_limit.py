"""Rate limiting for inference endpoints via slowapi.

The limiter is a module-level singleton. Limits are configured per-endpoint
via decorators, with dynamic callables that read from app state config.

Rate limiting is opt-in: disabled by default, enabled via config.security.rate_limit.enabled.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address, enabled=False)


def _chat_completions_limit(request: Request) -> str:
    """Dynamic rate limit for /v1/chat/completions."""
    config = getattr(request.app.state, "config", None)
    if config and config.security.rate_limit.chat_completions_limit:
        return config.security.rate_limit.chat_completions_limit
    if config:
        return config.security.rate_limit.default_limit
    return "60/minute"


def _embeddings_limit(request: Request) -> str:
    """Dynamic rate limit for /v1/embeddings."""
    config = getattr(request.app.state, "config", None)
    if config and config.security.rate_limit.embeddings_limit:
        return config.security.rate_limit.embeddings_limit
    if config:
        return config.security.rate_limit.default_limit
    return "60/minute"
