"""Standardized event schema for Opta-LMX observability.

Extends the base ServerEvent with structured categorization, severity levels,
and correlation metadata for request tracing. Part of P4: Observability Maturity.
"""

from __future__ import annotations

import time
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class EventCategory(StrEnum):
    """Top-level classification for server events."""

    INFERENCE = "inference"
    MODEL_LIFECYCLE = "model_lifecycle"
    ADMIN = "admin"
    AGENT = "agent"
    SKILL = "skill"
    SECURITY = "security"
    SYSTEM = "system"


class StandardizedEvent(BaseModel):
    """A classified, structured server event with tracing metadata.

    Extends the raw ServerEvent data with category, severity, and optional
    correlation IDs for cross-request tracing and triage filtering.
    """

    event_type: str
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)
    category: EventCategory
    severity: Literal["info", "warning", "error", "critical"]
    correlation_id: str | None = None
    model_id: str | None = None
    client_id: str | None = None


# ── Prefix-to-category mapping ──────────────────────────────────────────

_PREFIX_CATEGORY_MAP: list[tuple[str, EventCategory]] = [
    ("inference_", EventCategory.INFERENCE),
    ("completion_", EventCategory.INFERENCE),
    ("stream_", EventCategory.INFERENCE),
    ("token_", EventCategory.INFERENCE),
    ("model_", EventCategory.MODEL_LIFECYCLE),
    ("download_", EventCategory.MODEL_LIFECYCLE),
    ("canary_", EventCategory.MODEL_LIFECYCLE),
    ("agent_", EventCategory.AGENT),
    ("run_", EventCategory.AGENT),
    ("skill_", EventCategory.SKILL),
    ("mcp_", EventCategory.SKILL),
    ("auth_", EventCategory.SECURITY),
    ("rate_limit_", EventCategory.SECURITY),
    ("mtls_", EventCategory.SECURITY),
    ("jwt_", EventCategory.SECURITY),
    ("admin_", EventCategory.ADMIN),
    ("config_", EventCategory.ADMIN),
    ("server_", EventCategory.SYSTEM),
    ("memory_", EventCategory.SYSTEM),
    ("crash_", EventCategory.SYSTEM),
    ("metal_", EventCategory.SYSTEM),
    ("ttl_", EventCategory.SYSTEM),
    ("journaling_", EventCategory.SYSTEM),
    ("health_", EventCategory.SYSTEM),
    ("rag_", EventCategory.SYSTEM),
    ("embedding_", EventCategory.SYSTEM),
]

# Substrings that indicate elevated severity regardless of prefix.
_ERROR_SUBSTRINGS: frozenset[str] = frozenset({
    "error", "failed", "crashed", "timeout", "quarantined", "oom",
    "rejected", "denied", "invalid", "exceeded",
})

_WARNING_SUBSTRINGS: frozenset[str] = frozenset({
    "warning", "degraded", "skipped", "retry", "slow", "pressure",
    "evict", "unloaded", "dropped",
})

_CRITICAL_SUBSTRINGS: frozenset[str] = frozenset({
    "crash_loop", "fatal", "sigabrt", "critical",
})


def _classify_severity(event_type: str) -> Literal["info", "warning", "error", "critical"]:
    """Derive severity from the event_type string by substring matching."""
    lower = event_type.lower()
    if any(s in lower for s in _CRITICAL_SUBSTRINGS):
        return "critical"
    if any(s in lower for s in _ERROR_SUBSTRINGS):
        return "error"
    if any(s in lower for s in _WARNING_SUBSTRINGS):
        return "warning"
    return "info"


def _classify_category(event_type: str) -> EventCategory:
    """Derive category from event_type prefix matching."""
    lower = event_type.lower()
    for prefix, category in _PREFIX_CATEGORY_MAP:
        if lower.startswith(prefix):
            return category
    return EventCategory.SYSTEM


def classify_event(
    event_type: str,
    data: dict[str, Any] | None = None,
) -> tuple[EventCategory, Literal["info", "warning", "error", "critical"]]:
    """Classify a raw event_type string into (category, severity).

    Args:
        event_type: The event_type from a ServerEvent.
        data: Optional event data dict (currently unused but reserved for
              future data-aware classification).

    Returns:
        Tuple of (EventCategory, severity literal).
    """
    category = _classify_category(event_type)
    severity = _classify_severity(event_type)
    return category, severity
