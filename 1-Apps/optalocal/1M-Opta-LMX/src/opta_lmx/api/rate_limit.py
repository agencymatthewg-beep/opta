"""Rate limiting for inference endpoints via slowapi.

The limiter is a module-level singleton. Limits are configured per-endpoint
via decorators, with dynamic callables that read from app state config.

Rate limiting is opt-in: disabled by default, enabled via config.security.rate_limit.enabled.
"""

from __future__ import annotations

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    SLOWAPI_AVAILABLE = True
except ImportError:  # pragma: no cover
    # Provide a no-op stub so rate_limit decorators are valid at import time.
    class _NoOpLimiter:  # type: ignore[no-redef]
        """Stub limiter that does nothing when slowapi is not installed."""
        enabled = False
        def __init__(self, *a: object, **kw: object) -> None:
            pass
        def limit(self, *a: object, **kw: object):  # type: ignore[override]
            def decorator(func):  # type: ignore[no-untyped-def]
                return func
            return decorator

    Limiter = _NoOpLimiter  # type: ignore[misc,assignment]
    get_remote_address = lambda request: "127.0.0.1"  # type: ignore[assignment]  # noqa: E731
    SLOWAPI_AVAILABLE = False

from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address, enabled=False)  # type: ignore[arg-type]


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
