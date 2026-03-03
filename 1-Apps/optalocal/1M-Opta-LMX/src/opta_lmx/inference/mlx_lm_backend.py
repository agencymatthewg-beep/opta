"""Direct mlx-lm backend adapter implementing the shared InferenceBackend protocol."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any, cast

logger = logging.getLogger(__name__)


def _messages_to_prompt(messages: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for msg in messages:
        role = str(msg.get("role", "user")).strip() or "user"
        content = msg.get("content", "")
        if isinstance(content, list):
            text_parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        text_parts.append(value)
            content_text = " ".join(text_parts)
        else:
            content_text = str(content)
        lines.append(f"{role}: {content_text}")
    lines.append("assistant:")
    return "\n".join(lines).strip()


class MLXLMBackend:
    """Minimal mlx-lm adapter with graceful degradation for unsupported features."""

    def __init__(
        self,
        model_id: str,
        draft_model_id: str | None = None,
        num_draft_tokens: int | None = None,
    ) -> None:
        self._model_id = model_id
        self._draft_model_id = draft_model_id.strip() if isinstance(draft_model_id, str) else None
        self._num_draft_tokens = (
            int(num_draft_tokens)
            if isinstance(num_draft_tokens, int) and num_draft_tokens > 0
            else None
        )
        self._model: Any = None
        self._tokenizer: Any = None
        self._draft_model: Any = None
        self._draft_tokenizer: Any = None
        self._generate_fn: Any = None
        self._stream_generate_fn: Any = None
        self._load_fn: Any = None
        self._load_lock = asyncio.Lock()
        self._draft_load_lock = asyncio.Lock()

    async def _ensure_loaded(self) -> None:
        if (
            self._model is not None
            and self._tokenizer is not None
            and self._generate_fn is not None
        ):
            return
        async with self._load_lock:
            if (
                self._model is not None
                and self._tokenizer is not None
                and self._generate_fn is not None
            ):
                return
            try:
                from mlx_lm import generate as mlx_generate
                from mlx_lm import load as mlx_load
                from mlx_lm import stream_generate as mlx_stream_generate
            except Exception as exc:  # pragma: no cover - import failure path depends on env
                raise RuntimeError(f"mlx-lm backend unavailable: {exc}") from exc

            loaded = cast(tuple[Any, Any], await asyncio.to_thread(mlx_load, self._model_id))
            model, tokenizer = loaded
            self._model = model
            self._tokenizer = tokenizer
            self._generate_fn = mlx_generate
            self._stream_generate_fn = mlx_stream_generate
            self._load_fn = mlx_load

    async def _ensure_draft_loaded(self) -> Any | None:
        if not self._draft_model_id:
            return None
        if self._draft_model is not None:
            return self._draft_model

        await self._ensure_loaded()
        if self._load_fn is None:
            from mlx_lm import load as mlx_load

            self._load_fn = mlx_load

        async with self._draft_load_lock:
            if self._draft_model is not None:
                return self._draft_model
            draft_loaded = cast(
                tuple[Any, Any],
                await asyncio.to_thread(
                    self._load_fn,
                    self._draft_model_id,
                ),
            )
            draft_model, draft_tokenizer = draft_loaded
            self._draft_model = draft_model
            self._draft_tokenizer = draft_tokenizer
            return self._draft_model

    async def probe(self) -> None:
        """Best-effort backend probe used by admin diagnostics."""
        await self._ensure_loaded()
        if self._draft_model_id:
            await self._ensure_draft_loaded()

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
        del stop, tools, response_format
        await self._ensure_loaded()
        draft_model = await self._ensure_draft_loaded()
        assert self._generate_fn is not None
        assert self._model is not None
        assert self._tokenizer is not None

        prompt = _messages_to_prompt(messages)
        from mlx_lm.sample_utils import make_sampler

        sampler = make_sampler(temp=temperature, top_p=top_p)
        generate_kwargs: dict[str, Any] = {
            "prompt": prompt,
            "max_tokens": max_tokens,
            "sampler": sampler,
        }
        if draft_model is not None:
            generate_kwargs["draft_model"] = draft_model
            if self._num_draft_tokens is not None:
                generate_kwargs["num_draft_tokens"] = self._num_draft_tokens
        result = await asyncio.to_thread(
            self._generate_fn,
            self._model,
            self._tokenizer,
            **generate_kwargs,
        )
        content = result if isinstance(result, str) else str(getattr(result, "text", result))
        prompt_tokens = max(1, len(prompt.split()))
        completion_tokens = max(1, len(content.split())) if content else 1
        return content, prompt_tokens, completion_tokens

    async def stream(
        self,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict[str, Any]] | None,
        response_format: dict[str, Any] | None = None,
    ) -> AsyncIterator[str | dict[str, Any]]:
        del stop, tools, response_format
        await self._ensure_loaded()
        draft_model = await self._ensure_draft_loaded()
        assert self._model is not None
        assert self._tokenizer is not None

        if self._stream_generate_fn is None:
            content, _, _ = await self.generate(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stop=None,
                tools=None,
                response_format=None,
            )
            for token in content.split():
                yield token + " "
            return

        prompt = _messages_to_prompt(messages)
        from mlx_lm.sample_utils import make_sampler

        sampler = make_sampler(temp=temperature, top_p=top_p)
        queue: asyncio.Queue[dict[str, Any] | Exception | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _run_stream() -> None:
            generated_seen = 0
            speculative_enabled = draft_model is not None
            stream_kwargs: dict[str, Any] = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "sampler": sampler,
            }
            if speculative_enabled:
                stream_kwargs["draft_model"] = draft_model
            if speculative_enabled and self._num_draft_tokens is not None:
                stream_kwargs["num_draft_tokens"] = self._num_draft_tokens

            try:
                responses = self._stream_generate_fn(
                    self._model,
                    self._tokenizer,
                    **stream_kwargs,
                )
                for response in responses:
                    text = getattr(response, "text", "")
                    payload: dict[str, Any] = {
                        "text": text if isinstance(text, str) else str(text),
                    }

                    generation_tokens = getattr(response, "generation_tokens", None)
                    new_tokens = 0
                    if isinstance(generation_tokens, int) and generation_tokens > generated_seen:
                        new_tokens = generation_tokens - generated_seen
                        generated_seen = generation_tokens

                    if speculative_enabled and new_tokens > 0:
                        from_draft = bool(getattr(response, "from_draft", False))
                        if from_draft:
                            payload["accepted_tokens"] = new_tokens
                        else:
                            payload["rejected_tokens"] = new_tokens

                    if (
                        payload.get("text")
                        or payload.get("accepted_tokens")
                        or payload.get("rejected_tokens")
                    ):
                        loop.call_soon_threadsafe(queue.put_nowait, payload)
            except Exception as exc:
                logger.error(
                    "mlx_lm_stream_failed",
                    extra={"model_id": self._model_id, "error": str(exc)},
                )
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        stream_task = loop.run_in_executor(None, _run_stream)
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                raise RuntimeError(f"mlx-lm stream error: {item}") from item
            yield item
        await stream_task

    def close(self) -> None:
        self._model = None
        self._tokenizer = None
        self._draft_model = None
        self._draft_tokenizer = None
        self._generate_fn = None
        self._stream_generate_fn = None
        self._load_fn = None
