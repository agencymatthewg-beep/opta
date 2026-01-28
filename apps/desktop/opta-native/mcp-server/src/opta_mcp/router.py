"""Hybrid routing logic for Opta AI backends.

Routes queries between local Ollama and cloud Claude based on query complexity,
user preference, and backend availability. Optimizes cost while maintaining
quality for complex queries.

Privacy: Context is anonymized before being sent to cloud services.
See anonymizer.py for details on what data is protected.
"""

from typing import Any, Optional

from opta_mcp import llm
from opta_mcp import claude
from opta_mcp.anonymizer import anonymize_context, get_anonymization_summary


# Track routing statistics for cost monitoring
_routing_stats = {
    "local": 0,
    "cloud": 0,
    "fallback_to_local": 0,
    "fallback_to_cloud": 0,
}


# Indicators suggesting queries that benefit from Claude's reasoning
CLOUD_INDICATORS = [
    # Complex reasoning
    "why",
    "explain",
    "analyze",
    "compare",
    "recommend",
    # Multi-step
    "step by step",
    "walkthrough",
    "guide me",
    # Technical depth
    "architecture",
    "design",
    "optimize for",
    # Troubleshooting
    "debug",
    "diagnose",
    "not working",
    "error",
]

# Indicators for simple queries that local LLM handles well
LOCAL_INDICATORS = [
    # Simple facts
    "what is",
    "how to",
    "list",
    "show",
    # Quick answers
    "quick",
    "simple",
    "basic",
    # Status checks
    "status",
    "check",
    "current",
]


def classify_query(query: str) -> str:
    """Classify a query for routing to local or cloud backend.

    Uses heuristics based on query length and complexity indicators
    to determine which backend would handle the query better.

    Args:
        query: The user's query text.

    Returns:
        "local" or "cloud" indicating the recommended backend.
    """
    query_lower = query.lower()
    word_count = len(query.split())

    # Long queries -> cloud (likely need better reasoning)
    if word_count > 50:
        return "cloud"

    cloud_score = sum(1 for ind in CLOUD_INDICATORS if ind in query_lower)
    local_score = sum(1 for ind in LOCAL_INDICATORS if ind in query_lower)

    # Prefer local unless strong cloud signal
    if cloud_score > local_score + 1:
        return "cloud"
    return "local"


def route_chat(
    messages: list[dict[str, str]],
    prefer: str = "auto",
    model: Optional[str] = None,
    context: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """Route a chat request to the appropriate backend.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        prefer: Routing preference - "auto", "local", or "cloud".
        model: Optional model override for local backend.
        context: Optional system context (anonymized for cloud queries).

    Returns:
        Dict with response data:
            - content: Response text
            - backend: "local" or "cloud"
            - model: Model that generated the response
            - done: Whether generation completed
            - error: Error message if failed
            - anonymized_fields: List of what was anonymized (cloud only)
    """
    global _routing_stats

    # Determine which backend to use
    if prefer == "local":
        target_backend = "local"
    elif prefer == "cloud":
        target_backend = "cloud"
    else:  # auto
        # Use the last user message for classification
        user_messages = [m for m in messages if m.get("role") == "user"]
        last_query = user_messages[-1]["content"] if user_messages else ""
        target_backend = classify_query(last_query)

    # Track anonymization for cloud queries
    anonymized_fields: list[str] = []

    # Check backend availability and route
    if target_backend == "cloud":
        # Try cloud first
        claude_status = claude.check_claude_status()
        if claude_status.get("available"):
            # Convert messages for Claude (filter out system role)
            claude_messages = [
                {"role": m["role"], "content": m["content"]}
                for m in messages
                if m.get("role") in ("user", "assistant")
            ]

            # Extract system prompt if present
            system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
            system_prompt = "\n\n".join(system_prompts) if system_prompts else None

            # Anonymize context before sending to cloud
            if context:
                anon_context = anonymize_context(context)
                anonymized_fields = get_anonymization_summary(context, anon_context)
                # Append anonymized context to system prompt
                context_str = "\n".join(f"- {k}: {v}" for k, v in anon_context.items())
                context_section = f"\n\nCurrent system context (anonymized):\n{context_str}"
                system_prompt = (system_prompt + context_section) if system_prompt else context_section

            result = claude.chat_completion(claude_messages, system_prompt)

            if not result.get("error"):
                _routing_stats["cloud"] += 1
                return {
                    "content": result.get("content"),
                    "backend": "cloud",
                    "model": result.get("model", "claude-sonnet-4-20250514"),
                    "done": True,
                    "error": None,
                    "usage": result.get("usage"),
                    "anonymized_fields": anonymized_fields,
                }
            # Fall back to local on error
            _routing_stats["fallback_to_local"] += 1
        else:
            # Cloud not available, fall back to local
            _routing_stats["fallback_to_local"] += 1
            target_backend = "local"

    # Local backend
    if target_backend == "local":
        ollama_status = llm.check_ollama_status()
        if ollama_status.get("running"):
            result = llm.chat_completion(messages, model or "llama3:8b")

            if not result.get("error"):
                _routing_stats["local"] += 1
                return {
                    "content": result.get("content"),
                    "backend": "local",
                    "model": result.get("model", model or "llama3:8b"),
                    "done": result.get("done", True),
                    "error": None,
                    "anonymized_fields": [],  # Local keeps full context
                }
            # Local failed, try cloud as fallback if not already tried
            if prefer != "cloud":
                claude_status = claude.check_claude_status()
                if claude_status.get("available"):
                    _routing_stats["fallback_to_cloud"] += 1
                    claude_messages = [
                        {"role": m["role"], "content": m["content"]}
                        for m in messages
                        if m.get("role") in ("user", "assistant")
                    ]
                    system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
                    system_prompt = "\n\n".join(system_prompts) if system_prompts else None

                    # Anonymize context for cloud fallback
                    cloud_anon_fields: list[str] = []
                    if context:
                        anon_ctx = anonymize_context(context)
                        cloud_anon_fields = get_anonymization_summary(context, anon_ctx)
                        ctx_str = "\n".join(f"- {k}: {v}" for k, v in anon_ctx.items())
                        ctx_section = f"\n\nCurrent system context (anonymized):\n{ctx_str}"
                        system_prompt = (system_prompt + ctx_section) if system_prompt else ctx_section

                    cloud_result = claude.chat_completion(claude_messages, system_prompt)
                    if not cloud_result.get("error"):
                        return {
                            "content": cloud_result.get("content"),
                            "backend": "cloud",
                            "model": cloud_result.get("model", "claude-sonnet-4-20250514"),
                            "done": True,
                            "error": None,
                            "usage": cloud_result.get("usage"),
                            "anonymized_fields": cloud_anon_fields,
                        }

            # Return original local error
            return {
                "content": None,
                "backend": "local",
                "model": model or "llama3:8b",
                "done": False,
                "error": result.get("error", "Local LLM error"),
                "anonymized_fields": [],
            }
        else:
            # Ollama not running, try cloud
            claude_status = claude.check_claude_status()
            if claude_status.get("available") and prefer != "local":
                _routing_stats["fallback_to_cloud"] += 1
                claude_messages = [
                    {"role": m["role"], "content": m["content"]}
                    for m in messages
                    if m.get("role") in ("user", "assistant")
                ]
                system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
                system_prompt = "\n\n".join(system_prompts) if system_prompts else None

                # Anonymize context for cloud fallback
                cloud_anon_fields2: list[str] = []
                if context:
                    anon_ctx2 = anonymize_context(context)
                    cloud_anon_fields2 = get_anonymization_summary(context, anon_ctx2)
                    ctx_str2 = "\n".join(f"- {k}: {v}" for k, v in anon_ctx2.items())
                    ctx_section2 = f"\n\nCurrent system context (anonymized):\n{ctx_str2}"
                    system_prompt = (system_prompt + ctx_section2) if system_prompt else ctx_section2

                cloud_result = claude.chat_completion(claude_messages, system_prompt)
                if not cloud_result.get("error"):
                    return {
                        "content": cloud_result.get("content"),
                        "backend": "cloud",
                        "model": cloud_result.get("model", "claude-sonnet-4-20250514"),
                        "done": True,
                        "error": None,
                        "usage": cloud_result.get("usage"),
                        "anonymized_fields": cloud_anon_fields2,
                    }

            return {
                "content": None,
                "backend": "local",
                "model": model or "llama3:8b",
                "done": False,
                "error": ollama_status.get("error", "Ollama not running"),
                "anonymized_fields": [],
            }

    # Should not reach here, but return error if we do
    return {
        "content": None,
        "backend": target_backend,
        "model": "unknown",
        "done": False,
        "error": "No backend available",
        "anonymized_fields": [],
    }


def get_routing_stats() -> dict[str, Any]:
    """Get routing statistics for cost monitoring.

    Returns:
        Dict with routing counts:
            - local: Queries routed to local Ollama
            - cloud: Queries routed to Claude
            - fallback_to_local: Cloud failed, used local
            - fallback_to_cloud: Local failed, used cloud
            - total: Total queries routed
    """
    return {
        **_routing_stats,
        "total": sum(_routing_stats.values()),
    }


def reset_routing_stats() -> None:
    """Reset routing statistics to zero."""
    global _routing_stats
    _routing_stats = {
        "local": 0,
        "cloud": 0,
        "fallback_to_local": 0,
        "fallback_to_cloud": 0,
    }


def smart_chat(
    message: str,
    prefer: str = "auto",
    model: Optional[str] = None
) -> dict[str, Any]:
    """Smart chat interface for MCP tool with automatic routing.

    Higher-level API that automatically includes system prompt and
    telemetry context, then routes to the best available backend.

    Context is passed separately and anonymized for cloud queries.

    Args:
        message: User's question or message.
        prefer: Routing preference - "auto", "local", or "cloud".
        model: Optional model override for local backend.

    Returns:
        Dict with response and routing info:
            - content: Response text
            - backend: Which backend was used
            - model: Model that generated response
            - done: Whether generation completed
            - error: Error message if failed
            - anonymized_fields: What was anonymized (cloud only)
    """
    from opta_mcp.prompts import SYSTEM_PROMPT
    from opta_mcp.telemetry import get_system_snapshot

    # Build messages with system prompt
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    messages.append({"role": "user", "content": message})

    # Get telemetry context as dict (will be anonymized for cloud)
    snapshot = get_system_snapshot()

    return route_chat(messages, prefer, model, context=snapshot)


def get_privacy_preview(context: dict[str, Any]) -> dict[str, Any]:
    """Preview what would be sent to cloud after anonymization.

    This function provides transparency by showing users exactly what
    data would be transmitted to cloud services vs what stays private.

    Args:
        context: The context that would be sent.

    Returns:
        Dict with:
        - original: The original context (not sent)
        - anonymized: What would actually be sent to cloud
        - changes: List of what was anonymized
    """
    anonymized = anonymize_context(context)
    changes = get_anonymization_summary(context, anonymized)

    return {
        "original": context,
        "anonymized": anonymized,
        "changes": changes,
    }
