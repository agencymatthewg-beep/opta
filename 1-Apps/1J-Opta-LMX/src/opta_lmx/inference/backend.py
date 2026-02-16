"""Inference backend protocol — defines the contract for MLX and GGUF engines."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol


class InferenceBackend(Protocol):
    """Protocol for inference backends (MLX, GGUF).

    Each backend handles raw inference for a single loaded model.
    Lifecycle management (load, unload, LRU eviction, memory checks)
    remains in InferenceEngine — backends only generate tokens.
    """

    async def generate(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict] | None,
    ) -> tuple[str, int, int]:
        """Non-streaming generation.

        Args:
            messages: Conversation messages as dicts.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (pass-through).

        Returns:
            Tuple of (content, prompt_tokens, completion_tokens).
        """
        ...

    async def stream(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict] | None,
    ) -> AsyncIterator[str]:
        """Streaming generation — yields token strings.

        Args:
            messages: Conversation messages as dicts.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (pass-through).

        Yields:
            Individual token strings.
        """
        ...

    def close(self) -> None:
        """Release model resources."""
        ...
