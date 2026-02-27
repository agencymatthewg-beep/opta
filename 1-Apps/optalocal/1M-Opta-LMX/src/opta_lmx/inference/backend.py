"""Inference backend protocol — defines the contract for MLX and GGUF engines."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Literal, Protocol

BackendName = Literal["vllm-mlx", "mlx-lm", "gguf"]


class InferenceBackend(Protocol):
    """Protocol for inference backends (MLX, GGUF).

    Each backend handles raw inference for a single loaded model.
    Lifecycle management (load, unload, LRU eviction, memory checks)
    remains in InferenceEngine — backends only generate tokens.
    """

    async def generate(
        self,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict[str, Any]] | None,
        response_format: dict[str, Any] | None = None,
    ) -> tuple[str, int, int]:
        """Non-streaming generation.

        Args:
            messages: Conversation messages as dicts.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (pass-through).
            response_format: Response format constraint (e.g. json_object).

        Returns:
            Tuple of (content, prompt_tokens, completion_tokens).
        """
        ...

    async def stream(
        self,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict[str, Any]] | None,
        response_format: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]:
        """Streaming generation — yields token strings.

        Args:
            messages: Conversation messages as dicts.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (pass-through).
            response_format: Response format constraint (e.g. json_object).

        Yields:
            Individual token strings.
        """
        ...

    def close(self) -> None:
        """Release model resources."""
        ...
