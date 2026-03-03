"""Rate limiting for inference endpoints via slowapi.

The limiter is a module-level singleton. Limits are configured per-endpoint
via decorators, with dynamic callables that read from app state config.

Rate limiting is opt-in: disabled by default, enabled via config.security.rate_limit.enabled.
"""

from __future__ import annotations

import contextvars
from collections.abc import Callable
from typing import Any, Protocol, TypeVar

from starlette.requests import Request

request_ctx: contextvars.ContextVar[Request] = contextvars.ContextVar("request_ctx")
_DecoratedFunc = TypeVar("_DecoratedFunc", bound=Callable[..., Any])


# Provide a no-op stub so rate_limit decorators are valid at import time.
class _NoOpLimiter:
    """Stub limiter that does nothing when slowapi is not installed."""

    enabled = False

    def __init__(self, *a: object, **kw: object) -> None:
        self.enabled = bool(kw.get("enabled", False))

    def limit(
        self,
        limit_value: str | Callable[..., str],
        key_func: Callable[..., str] | None = None,
        per_method: bool = False,
        methods: list[str] | None = None,
        error_message: str | None = None,
        exempt_when: Callable[..., bool] | None = None,
        cost: int | Callable[..., int] = 1,
        override_defaults: bool = True,
    ) -> Callable[..., Any]:
        del (
            limit_value,
            key_func,
            per_method,
            methods,
            error_message,
            exempt_when,
            cost,
            override_defaults,
        )

        def decorator(func: _DecoratedFunc) -> _DecoratedFunc:
            return func

        return decorator


class _LimiterLike(Protocol):
    """Protocol for limiter implementations used by endpoint decorators."""

    enabled: bool

    def limit(
        self,
        limit_value: str | Callable[..., str],
        key_func: Callable[..., str] | None = None,
        per_method: bool = False,
        methods: list[str] | None = None,
        error_message: str | None = None,
        exempt_when: Callable[..., bool] | None = None,
        cost: int | Callable[..., int] = 1,
        override_defaults: bool = True,
    ) -> Callable[..., Any]:
        """Return a decorator that wraps endpoint handlers."""


_slowapi_remote_address: Callable[[Request], str] | None
try:
    from slowapi.util import get_remote_address as _slowapi_remote_address_impl
except ImportError:  # pragma: no cover
    _slowapi_remote_address = None
    SLOWAPI_AVAILABLE = False
else:
    _slowapi_remote_address = _slowapi_remote_address_impl
    SLOWAPI_AVAILABLE = True


def _remote_address(request: Request) -> str:
    if _slowapi_remote_address is None:
        return "127.0.0.1"
    value = _slowapi_remote_address(request)
    return value if isinstance(value, str) else str(value)


def _key_func(request: Request) -> str:
    """Wrapper around get_remote_address that stores the request in context."""
    request_ctx.set(request)
    return _remote_address(request)


limiter: _LimiterLike
if SLOWAPI_AVAILABLE:
    from slowapi import Limiter as _SlowapiLimiter

    slowapi_limiter = _SlowapiLimiter(key_func=_key_func)
    slowapi_limiter.enabled = False
    limiter = slowapi_limiter
else:
    limiter = _NoOpLimiter(key_func=_key_func, enabled=False)


def _chat_completions_limit(key: str) -> str:
    """Dynamic rate limit for /v1/chat/completions."""
    try:
        request = request_ctx.get()
        config = getattr(request.app.state, "config", None)
        if config and config.security.rate_limit.chat_completions_limit:
            return str(config.security.rate_limit.chat_completions_limit)
        if config:
            return str(config.security.rate_limit.default_limit)
    except LookupError:
        pass
    return "60/minute"


def _embeddings_limit(key: str) -> str:
    """Dynamic rate limit for /v1/embeddings."""
    try:
        request = request_ctx.get()
        config = getattr(request.app.state, "config", None)
        if config and config.security.rate_limit.embeddings_limit:
            return str(config.security.rate_limit.embeddings_limit)
        if config:
            return str(config.security.rate_limit.default_limit)
    except LookupError:
        pass
    return "60/minute"
