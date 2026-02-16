"""GGUF inference backend via llama-cpp-python with Metal acceleration."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

logger = logging.getLogger(__name__)


class GGUFBackend:
    """GGUF inference via llama-cpp-python with Metal acceleration.

    Wraps llama-cpp-python's Llama class, running blocking calls
    in threads via asyncio.to_thread().

    llama-cpp-python is an optional dependency — import errors are
    raised at instantiation time, not at module import.
    """

    def __init__(
        self,
        model_path: str,
        n_ctx: int = 4096,
        n_gpu_layers: int = -1,
    ) -> None:
        """Load a GGUF model.

        Args:
            model_path: Path to the .gguf file.
            n_ctx: Context window size.
            n_gpu_layers: GPU layers (-1 = full Metal offload).
        """
        try:
            from llama_cpp import Llama
        except ImportError as e:
            raise ImportError(
                "llama-cpp-python is required for GGUF models. "
                "Install with: pip install opta-lmx[gguf]"
            ) from e

        self._llm = Llama(
            model_path=model_path,
            n_gpu_layers=n_gpu_layers,
            n_ctx=n_ctx,
            verbose=False,
        )
        logger.info(
            "gguf_backend_loaded",
            extra={"model_path": model_path, "n_ctx": n_ctx, "n_gpu_layers": n_gpu_layers},
        )

    async def generate(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict] | None,
    ) -> tuple[str, int, int]:
        """Non-streaming GGUF generation."""
        kwargs: dict[str, Any] = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
        }
        if stop:
            kwargs["stop"] = stop

        result = await asyncio.to_thread(
            self._llm.create_chat_completion, **kwargs
        )

        content = result["choices"][0]["message"]["content"] or ""
        usage = result.get("usage", {})
        return (
            content,
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0),
        )

    async def stream(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict] | None,
    ) -> AsyncIterator[str]:
        """Streaming GGUF generation — yields token strings.

        Uses a queue-based approach: a background thread runs the blocking
        llama-cpp-python iterator and pushes tokens into an asyncio.Queue,
        while the async generator awaits on the queue without blocking the
        event loop.
        """
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _run_stream() -> None:
            """Run blocking llama-cpp stream in thread, push tokens to queue."""
            chat_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
            kwargs: dict[str, Any] = {
                "messages": chat_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "stream": True,
            }
            if stop:
                kwargs["stop"] = stop

            for chunk in self._llm.create_chat_completion(**kwargs):
                delta = chunk["choices"][0].get("delta", {})
                if content := delta.get("content"):
                    loop.call_soon_threadsafe(queue.put_nowait, content)
            loop.call_soon_threadsafe(queue.put_nowait, None)  # Sentinel

        # Run the entire blocking iteration in a background thread
        thread_task = loop.run_in_executor(None, _run_stream)

        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

        await thread_task  # Ensure thread completes cleanly

    def close(self) -> None:
        """Release the GGUF model from memory."""
        if hasattr(self, "_llm"):
            del self._llm
            logger.info("gguf_backend_closed")
