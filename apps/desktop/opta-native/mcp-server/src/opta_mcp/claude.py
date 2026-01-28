"""Claude API client for Opta cloud AI integration.

This module provides functions to interact with Anthropic's Claude API
for complex reasoning queries that benefit from Claude's capabilities.

IMPORTANT: API keys are handled via environment variables and should
never be logged or exposed.
"""

import os
from typing import Optional

from anthropic import Anthropic


def get_client() -> Optional[Anthropic]:
    """Get an Anthropic client instance.

    Returns the client if API key is configured, None otherwise.
    Never logs or exposes the API key.

    Returns:
        Anthropic client instance if API key is set, None otherwise.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return Anthropic(api_key=api_key)


def check_claude_status() -> dict:
    """Check if Claude API is configured and available.

    Returns:
        Dict with 'available' bool, optional 'model' string, and optional 'error' string.
    """
    client = get_client()
    if not client:
        return {"available": False, "error": "API key not configured"}
    try:
        # Simple validation - the client exists and was created successfully
        # We don't make an API call to avoid costs for status checks
        return {"available": True, "model": "claude-sonnet-4-20250514"}
    except Exception as e:
        return {"available": False, "error": str(e)}


def chat_completion(
    messages: list[dict],
    system_prompt: Optional[str] = None
) -> dict:
    """Send a chat message to Claude and get a response.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
                  Roles should be 'user' or 'assistant'.
        system_prompt: Optional system prompt to guide Claude's behavior.

    Returns:
        Dict with 'content' (response text), 'model', and 'usage' (token counts),
        or 'error' string if the request failed.
    """
    client = get_client()
    if not client:
        return {"error": "API key not configured"}

    try:
        kwargs = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": messages
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = client.messages.create(**kwargs)
        return {
            "content": response.content[0].text,
            "model": response.model,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }
    except Exception as e:
        return {"error": str(e)}
