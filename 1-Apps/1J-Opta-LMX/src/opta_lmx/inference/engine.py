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
from opta_lmx.inference.context import fit_to_context
from opta_lmx.inference.predictor import UsagePredictor
from opta_lmx.inference.tool_parser import TOOL_CALL_OPEN, MiniMaxToolParser
from opta_lmx.inference.types import LoadedModel, ModelInfo
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.monitoring.events import EventBus, ServerEvent

logger = logging.getLogger(__name__)

_SENTINEL = object()  # Sentinel for sync-to-async iterator conversion


def _resolve_context_length(model_id: str) -> int | None:
    """Try to read max context length from a model's config.json in the HF cache.

    Checks: max_position_embeddings, max_sequence_length, n_positions, seq_length.
    Returns None if the model config is not found or has no context field.
    """
    try:
        import json
        from pathlib import Path

        from huggingface_hub import try_to_load_from_cache

        config_path = try_to_load_from_cache(model_id, "config.json")
        if config_path is None or isinstance(config_path, str) and not Path(config_path).exists():
            return None

        with open(config_path) as f:
            config = json.load(f)

        for key in ("max_position_embeddings", "max_sequence_length", "n_positions", "seq_length"):
            if key in config and isinstance(config[key], int):
                return config[key]
    except Exception:
        pass
    return None


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


def _resolve_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    """Convert ChatMessage list to dicts, preserving multimodal content.

    - String content → {"role": ..., "content": "..."}
    - List content (multimodal) → {"role": ..., "content": [{...}, ...]}
    - None content → {"role": ..., "content": ""}
    """
    result: list[dict[str, Any]] = []
    for m in messages:
        if isinstance(m.content, list):
            # Multimodal: pass content array through for vision models
            result.append({"role": m.role, "content": [p.model_dump() for p in m.content]})
        else:
            result.append({"role": m.role, "content": m.content or ""})
    return result


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
        speculative_model: str | None = None,
        speculative_num_tokens: int = 5,
        kv_bits: int | None = None,
        kv_group_size: int = 64,
        prefix_cache_enabled: bool = True,
        max_concurrent_requests: int = 4,
        inference_timeout_sec: int = 300,
        warmup_on_load: bool = True,
    ) -> None:
        self._models: dict[str, LoadedModel] = {}
        self._memory = memory_monitor
        self._use_batching = use_batching
        self._auto_evict_lru = auto_evict_lru
        self._gguf_context_length = gguf_context_length
        self._gguf_gpu_layers = gguf_gpu_layers
        self._event_bus = event_bus
        self._speculative_model = speculative_model
        self._speculative_num_tokens = speculative_num_tokens
        self._kv_bits = kv_bits
        self._kv_group_size = kv_group_size
        self._prefix_cache_enabled = prefix_cache_enabled
        self._load_lock = asyncio.Lock()
        self._loading_models: set[str] = set()  # Models currently being loaded
        self._max_concurrent = max_concurrent_requests
        self._inference_semaphore = asyncio.Semaphore(max_concurrent_requests)
        self._inference_timeout = inference_timeout_sec
        self._warmup_on_load = warmup_on_load
        self._in_flight = 0  # Active inference requests (for graceful shutdown)
        self._predictor = UsagePredictor()

    async def load_model(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
    ) -> ModelInfo:
        """Load an MLX model into memory via vllm-mlx.

        Args:
            model_id: HuggingFace model ID (e.g., 'mlx-community/Mistral-7B-Instruct-4bit').
            use_batching: Override default batching setting.
            performance_overrides: Per-model performance settings from preset (kv_bits,
                prefix_cache, speculative, max_concurrent). Overrides global defaults.

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
            return await self._do_load(model_id, use_batching, performance_overrides)
        finally:
            self._loading_models.discard(model_id)

    async def _do_load(
        self,
        model_id: str,
        use_batching: bool | None = None,
        performance_overrides: dict[str, Any] | None = None,
    ) -> ModelInfo:
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
                engine = await self._create_engine(
                    model_id, batching, performance_overrides=performance_overrides,
                )
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

        # Resolve context length from model config or GGUF setting
        ctx_len: int | None = None
        if fmt == "gguf":
            ctx_len = self._gguf_context_length
        else:
            ctx_len = _resolve_context_length(model_id)

        loaded = LoadedModel(
            model_id=model_id,
            engine=engine,
            loaded_at=time.time(),
            use_batching=batching if fmt == "mlx" else False,
            estimated_memory_gb=round(model_memory_gb, 2),
            backend_type=fmt,
            backend=backend_instance,
            context_length=ctx_len,
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

        # Warmup: run a minimal inference to prime JIT/Metal shaders
        if self._warmup_on_load:
            await self._warmup_model(model_id)

        # Adjust concurrency based on new memory state
        self.adapt_concurrency()

        return ModelInfo(
            model_id=model_id,
            loaded=True,
            memory_used_gb=round(memory_after, 2),
            loaded_at=loaded.loaded_at,
            use_batching=batching if fmt == "mlx" else False,
        )

    async def _create_engine(
        self,
        model_id: str,
        use_batching: bool,
        performance_overrides: dict[str, Any] | None = None,
    ) -> Any:
        """Create a vllm-mlx engine instance.

        Uses BatchedEngine for concurrent request support,
        SimpleEngine for maximum single-request throughput.
        Merges per-model performance overrides (from preset) with global defaults.
        """
        perf = performance_overrides or {}

        spec_kwargs: dict[str, Any] = {}

        # Speculative decoding: preset overrides global
        spec_config = perf.get("speculative", {})
        draft_model = spec_config.get("draft_model") or self._speculative_model
        num_tokens = spec_config.get("num_tokens") or self._speculative_num_tokens
        if draft_model:
            spec_kwargs["speculative_model"] = draft_model
            spec_kwargs["num_speculative_tokens"] = num_tokens

        # KV cache: preset overrides global
        kv_bits = perf.get("kv_bits", self._kv_bits)
        kv_group_size = perf.get("kv_group_size", self._kv_group_size)
        if kv_bits is not None:
            spec_kwargs["kv_bits"] = kv_bits
            spec_kwargs["kv_group_size"] = kv_group_size

        # Prefix cache: preset overrides global
        prefix_cache = perf.get("prefix_cache", self._prefix_cache_enabled)
        if not prefix_cache:
            spec_kwargs["prefix_cache"] = False

        if perf:
            logger.info("performance_overrides_applied", extra={
                "model_id": model_id,
                "overrides": {k: v for k, v in perf.items() if k != "memory_estimate_gb"},
            })

        if use_batching:
            from vllm_mlx.engine.batched import BatchedEngine

            engine = BatchedEngine(model_name=model_id, **spec_kwargs)
            await engine.start()
            return engine
        else:
            from vllm_mlx.engine.simple import SimpleEngine

            return SimpleEngine(model_name=model_id, **spec_kwargs)

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

        # Adjust concurrency after freeing memory
        self.adapt_concurrency()

        return freed

    @property
    def in_flight_count(self) -> int:
        """Number of currently active inference requests."""
        return self._in_flight

    @property
    def max_concurrent_requests(self) -> int:
        """Current maximum concurrent inference requests."""
        return self._max_concurrent

    @property
    def predictor(self) -> UsagePredictor:
        """Access the usage predictor for stats and manual preloading."""
        return self._predictor

    def predict_next_model(self) -> str | None:
        """Predict which model to preload based on access patterns."""
        loaded = set(self._models.keys())
        return self._predictor.predict_next(loaded, exclude=self._loading_models)

    def adapt_concurrency(self) -> int:
        """Dynamically adjust inference concurrency based on memory pressure.

        When memory usage is high (>80% of threshold), reduce concurrency
        to prevent OOM. When memory is plentiful, allow up to the configured max.

        Returns:
            New concurrency level.
        """
        usage_pct = self._memory.usage_percent()
        threshold = self._memory.threshold_percent

        # Scale concurrency: full at <70% of threshold, minimum 1 at >95%
        ratio = usage_pct / threshold if threshold > 0 else 0
        if ratio < 0.7:
            target = self._max_concurrent
        elif ratio < 0.85:
            target = max(2, self._max_concurrent * 3 // 4)
        elif ratio < 0.95:
            target = max(1, self._max_concurrent // 2)
        else:
            target = 1

        if target != self._inference_semaphore._value + self._in_flight:
            self._inference_semaphore = asyncio.Semaphore(target)
            logger.info("concurrency_adapted", extra={
                "new_limit": target,
                "memory_usage_pct": round(usage_pct, 1),
                "in_flight": self._in_flight,
            })

        return target

    async def _warmup_model(self, model_id: str) -> None:
        """Run a minimal inference to prime JIT compilation and KV cache.

        This eliminates the cold-start penalty on the first real request
        (typically 2-3x slower without warmup on Apple Silicon due to MLX
        Metal shader compilation).
        """
        loaded = self._models.get(model_id)
        if loaded is None:
            return

        warmup_messages = [{"role": "user", "content": "Hi"}]
        start = time.monotonic()

        try:
            if loaded.backend is not None:
                await loaded.backend.generate(
                    messages=warmup_messages, temperature=0.0, max_tokens=1,
                    top_p=1.0, stop=None, tools=None, response_format=None,
                )
            elif loaded.engine is not None:
                await loaded.engine.chat(
                    messages=warmup_messages, temperature=0.0, max_tokens=1,
                )
            elapsed = time.monotonic() - start
            logger.info("model_warmup_complete", extra={
                "model_id": model_id, "warmup_ms": round(elapsed * 1000, 1),
            })
        except Exception as e:
            logger.warning("model_warmup_failed", extra={
                "model_id": model_id, "error": str(e),
            })

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
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
        self._predictor.record_access(model_id)

        # Trim context to fit model's window (if known)
        if loaded.context_length:
            messages = fit_to_context(
                messages,
                max_context_tokens=loaded.context_length,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        async with self._inference_semaphore:
            self._in_flight += 1
            try:
                content, prompt_tokens, completion_tokens = await asyncio.wait_for(
                    self._do_generate(loaded, msg_dicts, messages, temperature, max_tokens, top_p, stop, tools, response_format),
                    timeout=self._inference_timeout,
                )
            except asyncio.TimeoutError:
                logger.error("inference_timeout", extra={
                    "model_id": model_id, "timeout_sec": self._inference_timeout,
                })
                raise RuntimeError(
                    f"Inference timed out after {self._inference_timeout}s"
                ) from None
            except Exception as e:
                logger.error("inference_failed", extra={"model_id": model_id, "error": str(e)})
                raise RuntimeError(f"Inference failed: {e}") from e
            finally:
                self._in_flight -= 1

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

    async def _do_generate(
        self,
        loaded: LoadedModel,
        msg_dicts: list[dict[str, Any]],
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int | None,
        top_p: float,
        stop: list[str] | None,
        tools: list[dict[str, Any]] | None,
        response_format: dict[str, Any] | None,
    ) -> tuple[str, int, int]:
        """Execute inference and return (content, prompt_tokens, completion_tokens)."""
        if loaded.backend is not None:
            return await loaded.backend.generate(
                messages=msg_dicts,
                temperature=temperature,
                max_tokens=max_tokens or 2048,
                top_p=top_p,
                stop=stop,
                tools=tools,
                response_format=response_format,
            )

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
        if response_format:
            chat_kwargs["response_format"] = response_format
        result = await loaded.engine.chat(**chat_kwargs)

        if hasattr(result, "text"):
            content = result.text
            prompt_tokens = getattr(result, "prompt_tokens", 0) or self._estimate_prompt_tokens(messages)
            completion_tokens = getattr(result, "completion_tokens", 0) or max(1, len(content) // 4)
        else:
            content = result if isinstance(result, str) else str(result)
            prompt_tokens = self._estimate_prompt_tokens(messages)
            completion_tokens = max(1, len(content) // 4)
        return content, prompt_tokens, completion_tokens

    async def stream_generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 1.0,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
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
        self._predictor.record_access(model_id)

        # Trim context to fit model's window (if known)
        if loaded.context_length:
            messages = fit_to_context(
                messages,
                max_context_tokens=loaded.context_length,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        async with self._inference_semaphore:
            self._in_flight += 1
            try:
                if loaded.backend is not None:
                    async for token in loaded.backend.stream(
                        messages=msg_dicts,
                        temperature=temperature,
                        max_tokens=max_tokens or 2048,
                        top_p=top_p,
                        stop=stop,
                        tools=tools,
                        response_format=response_format,
                    ):
                        yield token
                else:
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
                    if response_format:
                        chat_kwargs["response_format"] = response_format
                    stream = loaded.engine.stream_chat(**chat_kwargs)
                    async for chunk in stream:
                        delta = chunk.new_text if hasattr(chunk, "new_text") else str(chunk)
                        if delta:
                            yield delta
            except Exception as e:
                logger.error("stream_failed", extra={"model_id": model_id, "error": str(e)})
                raise RuntimeError(f"Stream inference failed: {e}") from e
            finally:
                self._in_flight -= 1

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

    async def evict_idle_models(self, ttl_seconds: float) -> list[str]:
        """Unload models idle longer than ttl_seconds.

        Args:
            ttl_seconds: Maximum idle time before eviction.

        Returns:
            List of evicted model IDs.
        """
        now = time.time()
        evicted: list[str] = []

        # Snapshot model IDs to avoid mutating dict during iteration
        for model_id, loaded in list(self._models.items()):
            idle_time = now - loaded.last_used_at
            if idle_time > ttl_seconds:
                logger.info("ttl_eviction", extra={
                    "model_id": model_id,
                    "idle_seconds": round(idle_time, 1),
                    "ttl_seconds": ttl_seconds,
                })
                try:
                    await self.unload_model(model_id)
                    evicted.append(model_id)
                    if self._event_bus:
                        await self._event_bus.publish(ServerEvent(
                            event_type="model_ttl_evicted",
                            data={"model_id": model_id, "idle_seconds": round(idle_time, 1)},
                        ))
                except Exception as e:
                    logger.error("ttl_eviction_failed", extra={
                        "model_id": model_id, "error": str(e),
                    })

        return evicted

    async def drain(self, timeout_sec: float = 30.0) -> bool:
        """Wait for all in-flight inference requests to complete.

        Args:
            timeout_sec: Maximum seconds to wait for drain.

        Returns:
            True if all requests completed, False if timed out.
        """
        if self._in_flight == 0:
            return True

        logger.info("drain_started", extra={"in_flight": self._in_flight})
        deadline = time.monotonic() + timeout_sec
        while self._in_flight > 0 and time.monotonic() < deadline:
            await asyncio.sleep(0.1)

        if self._in_flight > 0:
            logger.warning("drain_timeout", extra={
                "remaining": self._in_flight, "timeout_sec": timeout_sec,
            })
            return False

        logger.info("drain_complete")
        return True

    @staticmethod
    def _estimate_prompt_tokens(messages: list[ChatMessage]) -> int:
        """Estimate prompt token count from message content (~4 chars/token)."""
        prompt_text = " ".join(
            m.content if isinstance(m.content, str) else ""
            for m in messages
        )
        return max(1, len(prompt_text) // 4)

    def get_model(self, model_id: str) -> LoadedModel:
        """Get a loaded model or raise KeyError."""
        if model_id not in self._models:
            raise KeyError(f"Model '{model_id}' is not loaded")
        return self._models[model_id]
