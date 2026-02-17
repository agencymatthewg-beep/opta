"""MLX inference engine wrapping vllm-mlx, with GGUF fallback support."""

from __future__ import annotations

import asyncio
import gc
import logging
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any

from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    FunctionCall,
    ResponseMessage,
    ToolCall,
    Usage,
)
from opta_lmx.inference.tool_parser import TOOL_CALL_OPEN, MiniMaxToolParser
from opta_lmx.inference.types import LoadedModel, ModelInfo
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.monitoring.events import EventBus, ServerEvent

logger = logging.getLogger(__name__)

_SENTINEL = object()  # Sentinel for sync-to-async iterator conversion


def _detect_format(model_id: str) -> str:
    """Detect whether model_id is MLX or GGUF.

    Rules:
    1. If model_id ends with .gguf → GGUF (local file path)
    2. If model_id contains 'GGUF' or 'gguf' → GGUF (HF repo)
    3. Otherwise → MLX (default, handled by vllm-mlx)
    """
    if model_id.endswith(".gguf"):
        return "gguf"
    if "gguf" in model_id.lower():
        return "gguf"
    return "mlx"


class InferenceEngine:
    """Manages MLX model lifecycle and inference via vllm-mlx.

    Wraps vllm-mlx's SimpleEngine/BatchedEngine and adds:
    - Multi-model management (load, unload, track)
    - Memory checking before load
    - Standardized response formatting
    - Error handling that never crashes
    """

    def __init__(
        self,
        memory_monitor: MemoryMonitor,
        use_batching: bool = True,
        auto_evict_lru: bool = True,
        gguf_context_length: int = 4096,
        gguf_gpu_layers: int = -1,
        event_bus: EventBus | None = None,
    ) -> None:
        self._models: dict[str, LoadedModel] = {}
        self._memory = memory_monitor
        self._use_batching = use_batching
        self._auto_evict_lru = auto_evict_lru
        self._gguf_context_length = gguf_context_length
        self._gguf_gpu_layers = gguf_gpu_layers
        self._event_bus = event_bus
        self._load_lock = asyncio.Lock()
        self._loading_models: set[str] = set()  # Models currently being loaded

    async def load_model(self, model_id: str, use_batching: bool | None = None) -> ModelInfo:
        """Load an MLX model into memory via vllm-mlx.

        Args:
            model_id: HuggingFace model ID (e.g., 'mlx-community/Mistral-7B-Instruct-4bit').
            use_batching: Override default batching setting.

        Returns:
            ModelInfo with load details.

        Raises:
            MemoryError: If loading would exceed 90% memory threshold.
            RuntimeError: If model loading fails.
        """
        # Lock the check-and-mutate section to prevent two concurrent
        # load_model() calls for the same model from both passing the
        # "already loaded?" check.
        async with self._load_lock:
            # Already loaded?
            if model_id in self._models:
                logger.info("model_already_loaded", extra={"model_id": model_id})
                existing = self._models[model_id]
                return ModelInfo(
                    model_id=model_id,
                    loaded=True,
                    memory_used_gb=existing.estimated_memory_gb,
                    loaded_at=existing.loaded_at,
                )

            # Already being loaded by another concurrent call?
            if model_id in self._loading_models:
                raise RuntimeError(
                    f"Model '{model_id}' is already being loaded by another request"
                )
            self._loading_models.add(model_id)

            # NOTE: Memory check is best-effort due to TOCTOU — other processes may
            # consume memory between this check and the actual model load. The post-load
            # verification (below) catches this case and triggers eviction if needed.

            # GUARDRAIL G-LMX-01: Check memory threshold before loading
            current_usage = self._memory.usage_percent()
            if current_usage >= self._memory.threshold_percent:
                # Try LRU eviction before refusing (G-LMX-01 fallback)
                if self._auto_evict_lru and self._models:
                    evicted_id = await self._evict_least_recently_used()
                    if evicted_id:
                        logger.info("lru_evicted_for_load", extra={
                            "evicted": evicted_id, "loading": model_id,
                        })
                        # Re-check after eviction
                        current_usage = self._memory.usage_percent()

                if current_usage >= self._memory.threshold_percent:
                    self._loading_models.discard(model_id)
                    raise MemoryError(
                        f"Memory usage at {current_usage:.1f}% — "
                        f"already at or above {self._memory.threshold_percent}% threshold. "
                        f"Unload a model first."
                    )

        try:
            return await self._do_load(model_id, use_batching)
        finally:
            self._loading_models.discard(model_id)

    async def _do_load(self, model_id: str, use_batching: bool | None = None) -> ModelInfo:
        """Execute the actual model load (called after lock/guard checks)."""
        fmt = _detect_format(model_id)
        batching = use_batching if use_batching is not None else self._use_batching
        memory_before = self._memory.used_memory_gb()
        start = time.monotonic()

        backend_instance: Any = None
        engine: Any = None

        try:
            if fmt == "gguf":
                from opta_lmx.inference.gguf_backend import GGUFBackend

                backend_instance = GGUFBackend(
                    model_path=model_id,
                    n_ctx=self._gguf_context_length,
                    n_gpu_layers=self._gguf_gpu_layers,
                )
                engine = None  # GGUF models use backend, not vllm-mlx engine
            else:
                engine = await self._create_engine(model_id, batching)
        except Exception as e:
            logger.error("model_load_failed", extra={
                "model_id": model_id, "format": fmt, "error": str(e),
            })
            raise RuntimeError(f"Failed to load model {model_id}: {e}") from e

        elapsed = time.monotonic() - start
        memory_after = self._memory.used_memory_gb()
        model_memory_gb = max(0, memory_after - memory_before)

        # Post-load check: if loading pushed us over threshold, unload immediately
        if self._memory.usage_percent() >= self._memory.threshold_percent:
            logger.warning(
                "model_load_exceeded_threshold",
                extra={"model_id": model_id, "memory_after_percent": self._memory.usage_percent()},
            )
            if backend_instance:
                backend_instance.close()
            if engine:
                del engine
            gc.collect()
            raise MemoryError(
                f"Loading {model_id} pushed memory to {self._memory.usage_percent():.1f}% — "
                f"exceeds {self._memory.threshold_percent}% threshold. Model unloaded."
            )

        loaded = LoadedModel(
            model_id=model_id,
            engine=engine,
            loaded_at=time.time(),
            use_batching=batching if fmt == "mlx" else False,
            estimated_memory_gb=round(model_memory_gb, 2),
            backend_type=fmt,
            backend=backend_instance,
        )
        async with self._load_lock:
            self._models[model_id] = loaded

        logger.info(
            "model_loaded",
            extra={
                "model_id": model_id,
                "format": fmt,
                "duration_sec": round(elapsed, 2),
                "memory_used_gb": round(memory_after, 2),
                "batching": batching if fmt == "mlx" else False,
            },
        )

        if self._event_bus:
            await self._event_bus.publish(ServerEvent(
                event_type="model_loaded",
                data={
                    "model_id": model_id,
                    "format": fmt,
                    "memory_gb": round(model_memory_gb, 2),
                    "duration_sec": round(elapsed, 2),
                },
            ))

        return ModelInfo(
            model_id=model_id,
            loaded=True,
            memory_used_gb=round(memory_after, 2),
            loaded_at=loaded.loaded_at,
            use_batching=batching if fmt == "mlx" else False,
        )

    async def _create_engine(self, model_id: str, use_batching: bool) -> Any:
        """Create a vllm-mlx engine instance.

        Uses BatchedEngine for concurrent request support,
        SimpleEngine for maximum single-request throughput.
        """
        if use_batching:
            from vllm_mlx.engine.batched import BatchedEngine

            engine = BatchedEngine(model_name=model_id)
            await engine.start()
            return engine
        else:
            from vllm_mlx.engine.simple import SimpleEngine

            return SimpleEngine(model_name=model_id)

    async def unload_model(self, model_id: str) -> float:
        """Unload a model and free memory.

        Args:
            model_id: Model to unload.

        Returns:
            Estimated GB freed.

        Raises:
            KeyError: If model is not loaded.
        """
        async with self._load_lock:
            if model_id not in self._models:
                raise KeyError(f"Model {model_id} is not loaded")
            loaded = self._models.pop(model_id)

        memory_before = self._memory.used_memory_gb()

        # Close backend if present (GGUF)
        if loaded.backend is not None:
            loaded.backend.close()

        if loaded.engine is not None:
            del loaded.engine
        gc.collect()

        # Try to clear MLX metal cache (only relevant for MLX models)
        if loaded.backend_type == "mlx":
            try:
                import mlx.core as mx

                mx.metal.clear_cache()
            except Exception:
                pass

        memory_after = self._memory.used_memory_gb()
        freed = max(0, memory_before - memory_after)

        logger.info(
            "model_unloaded",
            extra={"model_id": model_id, "memory_freed_gb": round(freed, 2)},
        )

        if self._event_bus:
            await self._event_bus.publish(ServerEvent(
                event_type="model_unloaded",
                data={"model_id": model_id, "memory_freed_gb": round(freed, 2)},
            ))

        return freed

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatCompletionResponse:
        """Non-streaming chat completion.

        Args:
            model_id: Which loaded model to use.
            messages: Conversation messages.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (passed through).

        Returns:
            Complete ChatCompletionResponse.
        """
        loaded = self.get_model(model_id)
        loaded.request_count += 1
        loaded.last_used_at = time.time()

        msg_dicts = [{"role": m.role, "content": m.content or ""} for m in messages]

        try:
            if loaded.backend is not None:
                # GGUF backend — returns (content, prompt_tokens, completion_tokens)
                content, prompt_tokens, completion_tokens = await loaded.backend.generate(
                    messages=msg_dicts,
                    temperature=temperature,
                    max_tokens=max_tokens or 2048,
                    top_p=top_p,
                    stop=stop,
                    tools=tools,
                )
            else:
                # MLX backend (vllm-mlx) — run in thread to avoid blocking event loop
                chat_kwargs: dict[str, Any] = {
                    "messages": msg_dicts,
                    "temperature": temperature,
                    "max_tokens": max_tokens or 2048,
                    "top_p": top_p,
                }
                if stop:
                    chat_kwargs["stop"] = stop
                if tools:
                    chat_kwargs["tools"] = tools
                result = await loaded.engine.chat(**chat_kwargs)
                # vllm-mlx returns GenerationOutput with .new_text, .prompt_tokens, .completion_tokens
                if hasattr(result, "text"):
                    content = result.text
                    prompt_tokens = getattr(result, "prompt_tokens", 0) or max(1, len(" ".join(m.content or "" for m in messages)) // 4)
                    completion_tokens = getattr(result, "completion_tokens", 0) or max(1, len(content) // 4)
                else:
                    content = result if isinstance(result, str) else str(result)
                    prompt_text = " ".join(m.content or "" for m in messages)
                    prompt_tokens = max(1, len(prompt_text) // 4)
                    completion_tokens = max(1, len(content) // 4)
        except Exception as e:
            logger.error("inference_failed", extra={"model_id": model_id, "error": str(e)})
            raise RuntimeError(f"Inference failed: {e}") from e

        # Parse MiniMax XML tool calls if tools were requested
        response_message: ResponseMessage
        finish_reason: str = "stop"

        if tools and TOOL_CALL_OPEN in content:
            parser = MiniMaxToolParser()
            parsed = parser.parse_tool_calls(content, tools)
            if parsed.has_tool_calls and parsed.tool_calls:
                response_message = ResponseMessage(
                    role="assistant",
                    content=parsed.content,
                    tool_calls=[
                        ToolCall(
                            id=tc.id,
                            type="function",
                            function=FunctionCall(
                                name=tc.name, arguments=tc.arguments,
                            ),
                        )
                        for tc in parsed.tool_calls
                    ],
                )
                finish_reason = "tool_calls"
            else:
                response_message = ResponseMessage(
                    role="assistant", content=content,
                )
        else:
            response_message = ResponseMessage(
                role="assistant", content=content,
            )

        return ChatCompletionResponse(
            id=f"chatcmpl-{secrets.token_urlsafe(16)}",
            created=int(time.time()),
            model=model_id,
            choices=[
                Choice(
                    index=0,
                    message=response_message,
                    finish_reason=finish_reason,
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

    async def stream_generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[str]:
        """Streaming chat completion — yields token strings.

        Args:
            model_id: Which loaded model to use.
            messages: Conversation messages.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            top_p: Nucleus sampling parameter.
            stop: Stop sequences.
            tools: Tool definitions (passed through).

        Yields:
            Individual token strings.
        """
        loaded = self.get_model(model_id)
        loaded.request_count += 1
        loaded.last_used_at = time.time()

        msg_dicts = [{"role": m.role, "content": m.content or ""} for m in messages]

        try:
            if loaded.backend is not None:
                # GGUF backend streaming
                async for token in loaded.backend.stream(
                    messages=msg_dicts,
                    temperature=temperature,
                    max_tokens=max_tokens or 2048,
                    top_p=top_p,
                    stop=stop,
                    tools=tools,
                ):
                    yield token
            else:
                # MLX backend (vllm-mlx) streaming
                chat_kwargs: dict[str, Any] = {
                    "messages": msg_dicts,
                    "temperature": temperature,
                    "max_tokens": max_tokens or 2048,
                    "top_p": top_p,
                }
                if stop:
                    chat_kwargs["stop"] = stop
                if tools:
                    chat_kwargs["tools"] = tools
                # vllm-mlx uses stream_chat (async generator) for streaming
                stream = loaded.engine.stream_chat(**chat_kwargs)
                async for chunk in stream:
                    # chunk is GenerationOutput; new_text has the delta
                    delta = chunk.new_text if hasattr(chunk, "new_text") else str(chunk)
                    if delta:
                        yield delta
        except Exception as e:
            logger.error("stream_failed", extra={"model_id": model_id, "error": str(e)})
            raise RuntimeError(f"Stream inference failed: {e}") from e

    def get_loaded_models(self) -> list[ModelInfo]:
        """Return info about all currently loaded models."""
        return [
            ModelInfo(
                model_id=m.model_id,
                loaded=True,
                memory_used_gb=m.estimated_memory_gb,
                loaded_at=m.loaded_at,
                use_batching=m.use_batching,
            )
            for m in self._models.values()
        ]

    def is_model_loaded(self, model_id: str) -> bool:
        """Check if a model is currently loaded."""
        return model_id in self._models

    def get_loaded_models_detailed(self) -> list[LoadedModel]:
        """Return internal LoadedModel objects for admin endpoints."""
        return list(self._models.values())

    async def _evict_least_recently_used(self) -> str | None:
        """Unload the least-recently-used model to free memory.

        Returns:
            The model_id that was evicted, or None if no models loaded.
        """
        if not self._models:
            return None

        # Find the model with the oldest last_used_at (LRU)
        lru_model = min(self._models.values(), key=lambda m: m.last_used_at)
        model_id = lru_model.model_id

        logger.info("lru_eviction", extra={
            "model_id": model_id,
            "last_used_at": lru_model.last_used_at,
            "request_count": lru_model.request_count,
        })

        await self.unload_model(model_id)
        return model_id

    def get_model(self, model_id: str) -> LoadedModel:
        """Get a loaded model or raise KeyError."""
        if model_id not in self._models:
            raise KeyError(f"Model '{model_id}' is not loaded")
        return self._models[model_id]
