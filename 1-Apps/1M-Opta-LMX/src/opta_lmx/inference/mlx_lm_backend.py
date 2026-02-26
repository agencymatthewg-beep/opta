"""Direct mlx-lm backend adapter implementing the shared InferenceBackend protocol."""

from __future__ import annotations

import asyncio
from typing import Any


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

    def __init__(self, model_id: str) -> None:
        self._model_id = model_id
        self._model: Any = None
        self._tokenizer: Any = None
        self._generate_fn: Any = None
        self._load_lock = asyncio.Lock()

    async def _ensure_loaded(self) -> None:
        if self._model is not None and self._tokenizer is not None and self._generate_fn is not None:
            return
        async with self._load_lock:
            if self._model is not None and self._tokenizer is not None and self._generate_fn is not None:
                return
            try:
                from mlx_lm import generate as mlx_generate
                from mlx_lm import load as mlx_load
            except Exception as exc:  # pragma: no cover - import failure path depends on env
                raise RuntimeError(f"mlx-lm backend unavailable: {exc}") from exc

            model, tokenizer = await asyncio.to_thread(mlx_load, self._model_id)
            self._model = model
            self._tokenizer = tokenizer
            self._generate_fn = mlx_generate

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
        assert self._generate_fn is not None
        assert self._model is not None
        assert self._tokenizer is not None

        prompt = _messages_to_prompt(messages)
        from mlx_lm.sample_utils import make_sampler
        sampler = make_sampler(temp=temperature, top_p=top_p)
        result = await asyncio.to_thread(
            self._generate_fn,
            self._model,
            self._tokenizer,
            prompt=prompt,
            max_tokens=max_tokens,
            sampler=sampler,
        )
        if isinstance(result, str):
            content = result
        else:
            content = str(getattr(result, "text", result))
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
    ):
        content, _, _ = await self.generate(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stop=stop,
            tools=tools,
            response_format=response_format,
        )
        for token in content.split():
            yield token + " "

    def close(self) -> None:
        self._model = None
        self._tokenizer = None
        self._generate_fn = None
