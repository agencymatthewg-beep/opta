"""
subscription_providers.py — Registry of OAuth-backed subscription providers.

These providers use OAuth tokens (from macOS Keychain via vault pull) instead
of API keys. Each has a base_url, auth_scheme, and required headers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

AuthScheme = Literal["bearer", "github_copilot"]


@dataclass(frozen=True)
class SubscriptionRoute:
    """Configuration for a single OAuth-backed subscription provider."""

    provider_id: str          # keychain key name (e.g. "github-copilot")
    base_url: str
    auth_scheme: AuthScheme
    default_model: str
    extra_headers: dict[str, str] = field(default_factory=dict)
    token_expires_seconds: int | None = None  # None = doesn't expire
    refresh_url: str | None = None


SUBSCRIPTION_ROUTES: list[SubscriptionRoute] = [
    SubscriptionRoute(
        provider_id="github-copilot",
        base_url="https://api.githubcopilot.com",
        auth_scheme="github_copilot",
        default_model="gpt-4o",
        extra_headers={
            "Copilot-Integration-Id": "vscode-chat",
            "Editor-Version": "Neovim/0.10.0",
            "Editor-Plugin-Version": "copilot.vim/1.16.0",
            "OpenAI-Intent": "conversation-panel",
            "X-Github-Api-Version": "2023-07-07",
        },
        token_expires_seconds=None,
    ),
    SubscriptionRoute(
        provider_id="gemini-cli",
        base_url="https://generativelanguage.googleapis.com",
        auth_scheme="bearer",
        default_model="gemini-2.0-flash",
        token_expires_seconds=3600,
        refresh_url="https://accounts.optalocal.com/api/oauth/gemini-cli/refresh",
    ),
]

SUBSCRIPTION_ROUTE_MAP: dict[str, SubscriptionRoute] = {
    r.provider_id: r for r in SUBSCRIPTION_ROUTES
}

# All provider_id values (used for prefix matching)
_PROVIDER_IDS: frozenset[str] = frozenset(SUBSCRIPTION_ROUTE_MAP.keys())

# Aliases that map to provider_ids (short aliases users may type)
_PREFIX_ALIASES: dict[str, str] = {
    "copilot": "github-copilot",
    "github-copilot": "github-copilot",
    "gemini-cli": "gemini-cli",
}


def resolve_subscription_route(model: str) -> tuple[SubscriptionRoute, str] | None:
    """Return (route, cleaned_model_name) if model targets a subscription provider.

    Matches:
    - ``copilot/gpt-4o``           → github-copilot route, model="gpt-4o"
    - ``github-copilot/gpt-4o``    → github-copilot route, model="gpt-4o"
    - ``gemini-cli/gemini-2.0-flash`` → gemini-cli route, model="gemini-2.0-flash"
    - ``github-copilot``           → github-copilot route, model=route.default_model
    - ``gemini-cli``               → gemini-cli route, model=route.default_model
    - ``copilot``                  → github-copilot route, model=route.default_model

    Returns None for any other model string (use local inference).
    """
    if not model:
        return None

    # Check for slash-prefixed form: "<alias>/<model>"
    if "/" in model:
        prefix, _, rest = model.partition("/")
        provider_id = _PREFIX_ALIASES.get(prefix.lower())
        if provider_id is not None:
            route = SUBSCRIPTION_ROUTE_MAP[provider_id]
            # Use the rest as the model name, or fall back to default if empty
            cleaned = rest.strip() or route.default_model
            return route, cleaned

    # Bare provider name (no slash): route with default model
    provider_id = _PREFIX_ALIASES.get(model.lower())
    if provider_id is not None:
        route = SUBSCRIPTION_ROUTE_MAP[provider_id]
        return route, route.default_model

    return None
