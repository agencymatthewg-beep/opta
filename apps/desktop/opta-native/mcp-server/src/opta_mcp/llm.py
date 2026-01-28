"""Ollama LLM integration for Opta.

Provides local LLM inference using Ollama with Llama 3 8B for zero-cost
AI queries for routine optimization questions.

Functions handle Ollama not running gracefully - returning clear errors
without crashing.
"""

from typing import Any, Optional

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False


def check_ollama_status() -> dict[str, Any]:
    """Check if Ollama is running and return available models.

    Returns:
        dict with keys:
            - running (bool): Whether Ollama service is available
            - models (list[str]): List of installed model names (if running)
            - error (str | None): Error message if not running
    """
    if not OLLAMA_AVAILABLE:
        return {
            "running": False,
            "models": [],
            "error": "ollama package not installed. Run: pip install ollama"
        }

    try:
        response = ollama.list()
        models = [m.get("name", m.get("model", "unknown")) for m in response.get("models", [])]
        return {
            "running": True,
            "models": models,
            "error": None
        }
    except Exception as e:
        return {
            "running": False,
            "models": [],
            "error": str(e)
        }


def get_available_models() -> dict[str, Any]:
    """List all installed Ollama models.

    Returns:
        dict with keys:
            - models (list[str]): List of model names
            - error (str | None): Error message if failed
    """
    status = check_ollama_status()
    if not status["running"]:
        return {
            "models": [],
            "error": status["error"]
        }

    return {
        "models": status["models"],
        "error": None
    }


def pull_model(model_name: str) -> dict[str, Any]:
    """Download a model if not already present.

    Args:
        model_name: Name of the model to pull (e.g., "llama3:8b")

    Returns:
        dict with keys:
            - success (bool): Whether pull succeeded
            - model (str): Model name
            - error (str | None): Error message if failed
    """
    if not OLLAMA_AVAILABLE:
        return {
            "success": False,
            "model": model_name,
            "error": "ollama package not installed. Run: pip install ollama"
        }

    try:
        # Pull model (this may take a while for large models)
        ollama.pull(model_name)
        return {
            "success": True,
            "model": model_name,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "model": model_name,
            "error": str(e)
        }


def chat_completion(
    messages: list[dict[str, str]],
    model: str = "llama3:8b"
) -> dict[str, Any]:
    """Send a chat completion request to Ollama.

    Args:
        messages: List of message dicts with "role" and "content" keys.
                  Roles: "system", "user", "assistant"
        model: Model to use (default: llama3:8b)

    Returns:
        dict with keys:
            - content (str | None): Response content if successful
            - model (str): Model used
            - done (bool): Whether generation completed
            - error (str | None): Error message if failed

    Example:
        >>> response = chat_completion([
        ...     {"role": "system", "content": "You are a helpful PC optimization assistant."},
        ...     {"role": "user", "content": "How can I free up RAM?"}
        ... ])
        >>> print(response["content"])
    """
    if not OLLAMA_AVAILABLE:
        return {
            "content": None,
            "model": model,
            "done": False,
            "error": "ollama package not installed. Run: pip install ollama"
        }

    try:
        response = ollama.chat(model=model, messages=messages)
        return {
            "content": response["message"]["content"],
            "model": model,
            "done": True,
            "error": None
        }
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error messages for common issues
        if "connection refused" in error_msg.lower():
            error_msg = "Ollama is not running. Start it with: ollama serve"
        elif "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            error_msg = f"Model '{model}' not found. Pull it with: ollama pull {model}"

        return {
            "content": None,
            "model": model,
            "done": False,
            "error": error_msg
        }


def chat_with_context(
    user_message: str,
    include_system_info: bool = True,
    model: str = "llama3:8b"
) -> dict[str, Any]:
    """Send a chat message with automatic system prompt and telemetry context.

    This is a higher-level API that automatically includes the optimization
    system prompt and optionally the user's current system state.

    Args:
        user_message: The user's question or message.
        include_system_info: Whether to include current telemetry data (default: True).
        model: Model to use (default: llama3:8b).

    Returns:
        dict with same keys as chat_completion:
            - content (str | None): Response content if successful
            - model (str): Model used
            - done (bool): Whether generation completed
            - error (str | None): Error message if failed
    """
    from opta_mcp.prompts import SYSTEM_PROMPT, get_system_context
    from opta_mcp.telemetry import get_system_snapshot

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    if include_system_info:
        snapshot = get_system_snapshot()
        context = get_system_context(snapshot)
        if context:
            messages.append({
                "role": "system",
                "content": f"Current system state:\n{context}"
            })

    messages.append({"role": "user", "content": user_message})

    return chat_completion(messages, model)


def chat_optimized(
    user_message: str,
    model: str = "llama3:8b"
) -> dict[str, Any]:
    """Simplified chat interface for MCP tool.

    Wraps chat_with_context for use as an MCP tool. Always includes
    system prompt and telemetry context.

    Args:
        user_message: The user's question or message.
        model: Model to use (default: llama3:8b).

    Returns:
        dict with chat response and quick prompts metadata:
            - content (str | None): Response content if successful
            - model (str): Model used
            - done (bool): Whether generation completed
            - error (str | None): Error message if failed
    """
    return chat_with_context(user_message, include_system_info=True, model=model)
