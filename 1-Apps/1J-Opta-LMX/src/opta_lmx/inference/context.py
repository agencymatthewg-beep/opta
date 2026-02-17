"""Context window management for conversation message truncation.

Ensures conversation history fits within the model's context window
budget by estimating token counts and trimming older messages while
preserving the system prompt and most recent turns.
"""

from __future__ import annotations

import logging

from opta_lmx.inference.schema import ChatMessage, ContentPart

logger = logging.getLogger(__name__)

# Characters per token heuristic (consistent with chunker.py)
_CHARS_PER_TOKEN = 4


def estimate_tokens(text: str) -> int:
    """Estimate token count for a string (~4 chars/token)."""
    return max(1, len(text) // _CHARS_PER_TOKEN)


def estimate_message_tokens(message: ChatMessage) -> int:
    """Estimate token count for a single chat message.

    Accounts for role overhead (~4 tokens) plus content tokens.
    Handles both string content and multimodal content arrays.
    """
    overhead = 4  # role, formatting tokens

    if message.content is None:
        content_tokens = 0
    elif isinstance(message.content, str):
        content_tokens = estimate_tokens(message.content)
    elif isinstance(message.content, list):
        content_tokens = sum(_estimate_content_part(p) for p in message.content)
    else:
        content_tokens = 0

    # Tool calls add tokens
    tool_tokens = 0
    if message.tool_calls:
        for tc in message.tool_calls:
            tool_tokens += estimate_tokens(tc.function.name)
            tool_tokens += estimate_tokens(tc.function.arguments)
            tool_tokens += 4  # structural overhead

    return overhead + content_tokens + tool_tokens


def _estimate_content_part(part: ContentPart) -> int:
    """Estimate tokens for a content part."""
    if hasattr(part, "text"):
        return estimate_tokens(part.text)
    # Images: rough estimate based on detail level
    if hasattr(part, "image_url"):
        detail = getattr(part.image_url, "detail", "auto")
        if detail == "low":
            return 85
        return 765  # high/auto
    return 0


def estimate_conversation_tokens(messages: list[ChatMessage]) -> int:
    """Estimate total tokens for a conversation."""
    return sum(estimate_message_tokens(m) for m in messages) + 3  # conversation overhead


def fit_to_context(
    messages: list[ChatMessage],
    max_context_tokens: int,
    reserve_for_output: int = 0,
) -> list[ChatMessage]:
    """Trim conversation to fit within context window budget.

    Strategy:
    1. Always keep system messages (first messages with role="system")
    2. Always keep the most recent user message
    3. Remove oldest non-system messages from the middle until budget fits
    4. If still over budget, truncate the longest remaining message

    Args:
        messages: Full conversation history.
        max_context_tokens: Model's context window size in tokens.
        reserve_for_output: Tokens to reserve for the model's response.

    Returns:
        Trimmed message list that fits within the budget.
    """
    if not messages:
        return []

    budget = max_context_tokens - reserve_for_output
    if budget <= 0:
        return messages[-1:]  # At minimum, keep the last message

    # Check if it already fits
    total = estimate_conversation_tokens(messages)
    if total <= budget:
        return messages

    # Separate system messages, middle messages, and tail
    system_msgs: list[ChatMessage] = []
    middle_msgs: list[ChatMessage] = []
    tail_msgs: list[ChatMessage] = []

    # Collect leading system messages
    i = 0
    while i < len(messages) and messages[i].role == "system":
        system_msgs.append(messages[i])
        i += 1

    # The rest: keep the last message as tail, everything else is middle
    if i < len(messages):
        middle_msgs = list(messages[i:-1]) if len(messages) > i + 1 else []
        tail_msgs = [messages[-1]]
    else:
        # All messages are system messages
        return messages

    # Calculate budget used by system + tail (non-negotiable)
    system_tokens = sum(estimate_message_tokens(m) for m in system_msgs)
    tail_tokens = sum(estimate_message_tokens(m) for m in tail_msgs)
    fixed_tokens = system_tokens + tail_tokens + 3  # conversation overhead

    remaining_budget = budget - fixed_tokens
    if remaining_budget <= 0:
        # Can't even fit system + last message? Return them anyway.
        trimmed = system_msgs + tail_msgs
        logger.warning("context_severely_truncated", extra={
            "system_tokens": system_tokens,
            "tail_tokens": tail_tokens,
            "budget": budget,
        })
        return trimmed

    # Fill from newest middle messages backward (keep recent context)
    kept_middle: list[ChatMessage] = []
    used = 0
    for msg in reversed(middle_msgs):
        msg_tokens = estimate_message_tokens(msg)
        if used + msg_tokens > remaining_budget:
            break
        kept_middle.insert(0, msg)
        used += msg_tokens

    trimmed = system_msgs + kept_middle + tail_msgs
    trimmed_total = estimate_conversation_tokens(trimmed)

    dropped = len(messages) - len(trimmed)
    if dropped > 0:
        logger.info("context_window_trimmed", extra={
            "original_messages": len(messages),
            "kept_messages": len(trimmed),
            "dropped": dropped,
            "estimated_tokens": trimmed_total,
            "budget": budget,
        })

    return trimmed
