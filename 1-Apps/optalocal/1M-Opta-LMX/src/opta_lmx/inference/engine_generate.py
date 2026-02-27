"""Generation execution for the inference engine.

Contains the core inference path (streaming and non-streaming),
speculative telemetry tracking, tool call parsing, and structured
output post-processing.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any

from opta_lmx.inference.context import estimate_prompt_tokens, fit_to_context
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    FunctionCall,
    ResponseMessage,
    ToolCall,
    Usage,
)
from opta_lmx.inference.structured import (
    build_json_system_prompt,
    inject_json_instruction,
    parse_json_output,
)
from opta_lmx.inference.tool_parser import TOOL_CALL_OPEN, MiniMaxToolParser
from opta_lmx.inference.types import LoadedModel
from opta_lmx.model_safety import ErrorCodes

logger = logging.getLogger(__name__)


def _resolve_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    """Convert ChatMessage list to dicts, preserving multimodal content and tool fields.

    - String content -> {"role": ..., "content": "..."}
    - List content (multimodal) -> {"role": ..., "content": [{...}, ...]}
    - None content -> {"role": ..., "content": ""}
    - tool_calls / tool_call_id are preserved when present (required by chat templates).

    Note: MiniMax chat templates expect tool_call.function.arguments as a dict,
    not a JSON string (they call .items() on it). We parse it here.
    """
    result: list[dict[str, Any]] = []
    for m in messages:
        if isinstance(m.content, list):
            d: dict[str, Any] = {"role": m.role, "content": [p.model_dump() for p in m.content]}
        else:
            d = {"role": m.role, "content": m.content or ""}
        if m.tool_calls:
            resolved_tcs = []
            for tc in m.tool_calls:
                tc_dict = tc.model_dump()
                fn = tc_dict.get("function")
                if fn and isinstance(fn.get("arguments"), str):
                    with contextlib.suppress(json.JSONDecodeError, TypeError):
                        fn["arguments"] = json.loads(fn["arguments"])
                resolved_tcs.append(tc_dict)
            d["tool_calls"] = resolved_tcs
        if m.tool_call_id:
            d["tool_call_id"] = m.tool_call_id
        if m.name:
            d["name"] = m.name
        result.append(d)
    return result


class SpeculativeTelemetryHelper:
    """Helpers for tracking speculative decoding telemetry per request."""

    @staticmethod
    def base_speculative_telemetry(loaded: LoadedModel) -> dict[str, Any]:
        """Construct a per-request speculative telemetry record."""
        telemetry_mode = (
            "unavailable"
            if loaded.speculative_active
            else ("disabled" if loaded.speculative_requested else "not_requested")
        )
        return {
            "requested": loaded.speculative_requested,
            "active": loaded.speculative_active,
            "reason": loaded.speculative_reason,
            "draft_model": loaded.speculative_draft_model,
            "num_tokens": loaded.speculative_num_tokens,
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "ignored_tokens": 0,
            "acceptance_ratio": None,
            "telemetry": telemetry_mode,
        }

    @staticmethod
    def _coerce_payload_mapping(payload: Any) -> dict[str, Any]:
        if isinstance(payload, dict):
            return payload
        if hasattr(payload, "model_dump"):
            with contextlib.suppress(Exception):
                dumped = payload.model_dump()
                if isinstance(dumped, dict):
                    return dumped
        if hasattr(payload, "__dict__"):
            mapping = vars(payload)
            if isinstance(mapping, dict):
                return mapping
        return {}

    @staticmethod
    def _read_int_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> int | None:
        for key in keys:
            value = mapping.get(key)
            if value is None:
                continue
            with contextlib.suppress(TypeError, ValueError):
                return int(value)
        return None

    @staticmethod
    def _read_bool_field(mapping: dict[str, Any], keys: tuple[str, ...]) -> bool | None:
        for key in keys:
            value = mapping.get(key)
            if isinstance(value, bool):
                return value
        return None

    @classmethod
    def update_speculative_from_payload(
        cls,
        telemetry: dict[str, Any],
        payload: Any,
    ) -> None:
        """Update speculative telemetry counters from a backend payload object."""
        if not telemetry.get("active"):
            return

        mapping = cls._coerce_payload_mapping(payload)
        nested = mapping.get("speculative")
        combined = {**mapping, **nested} if isinstance(nested, dict) else mapping

        accepted = cls._read_int_field(
            combined,
            (
                "accepted_tokens",
                "draft_accepted_tokens",
                "accepted_draft_tokens",
                "num_accepted_draft_tokens",
                "speculative_accepted_tokens",
            ),
        )
        rejected = cls._read_int_field(
            combined,
            (
                "rejected_tokens",
                "draft_rejected_tokens",
                "rejected_draft_tokens",
                "num_rejected_draft_tokens",
                "speculative_rejected_tokens",
            ),
        )
        ignored = cls._read_int_field(
            combined,
            (
                "ignored_tokens",
                "draft_ignored_tokens",
                "speculative_ignored_tokens",
            ),
        )

        native_counts_seen = False
        if accepted is not None:
            telemetry["accepted_tokens"] += max(0, accepted)
            native_counts_seen = True
        if rejected is not None:
            telemetry["rejected_tokens"] += max(0, rejected)
            native_counts_seen = True
        if ignored is not None:
            telemetry["ignored_tokens"] += max(0, ignored)
            native_counts_seen = True

        if native_counts_seen:
            telemetry["telemetry"] = "native"
            return

        from_draft = cls._read_bool_field(
            combined,
            (
                "from_draft",
                "draft_accepted",
                "accepted_from_draft",
                "is_draft_token",
            ),
        )
        if from_draft is None:
            return

        if from_draft:
            telemetry["accepted_tokens"] += 1
        else:
            telemetry["rejected_tokens"] += 1
        telemetry["telemetry"] = "inferred_from_flag"

    @staticmethod
    def finalize_speculative_telemetry(
        telemetry: dict[str, Any],
        completion_units: int,
    ) -> None:
        if not telemetry.get("active"):
            telemetry["acceptance_ratio"] = None
            return

        accepted = max(0, int(telemetry.get("accepted_tokens", 0) or 0))
        rejected = max(0, int(telemetry.get("rejected_tokens", 0) or 0))
        ignored = max(0, int(telemetry.get("ignored_tokens", 0) or 0))

        if accepted == 0 and rejected == 0 and ignored == 0:
            ignored = max(0, int(completion_units))
            telemetry["ignored_tokens"] = ignored
            telemetry["telemetry"] = "unavailable"

        denominator = accepted + rejected
        telemetry["acceptance_ratio"] = (
            round(accepted / denominator, 6) if denominator > 0 else None
        )


class GenerationExecutor:
    """Executes inference requests (streaming and non-streaming).

    Delegates concurrency control and model lookup to the owning
    InferenceEngine instance via callback references.
    """

    def __init__(
        self,
        *,
        models: dict[str, LoadedModel],
        inference_timeout: int,
        get_model_fn: Any,
        acquire_request_slots_fn: Any,
        concurrency: Any,
        mark_readiness_failure_fn: Any,
        adapt_concurrency_fn: Any,
        speculative_telemetry_ctx: Any,
        queue_wait_sec_ctx: Any,
        predictor: Any,
        runtime_failure_quarantine_threshold: int,
    ) -> None:
        self._models = models
        self._inference_timeout = inference_timeout
        self._get_model = get_model_fn
        self._acquire_request_slots = acquire_request_slots_fn
        self._concurrency = concurrency
        self._mark_readiness_failure = mark_readiness_failure_fn
        self._adapt_concurrency = adapt_concurrency_fn
        self._speculative_telemetry_ctx = speculative_telemetry_ctx
        self._queue_wait_sec_ctx = queue_wait_sec_ctx
        self._predictor = predictor
        self._runtime_failure_quarantine_threshold = runtime_failure_quarantine_threshold

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
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        priority: str = "normal",
        num_ctx: int | None = None,
        client_id: str | None = None,
    ) -> ChatCompletionResponse:
        """Non-streaming chat completion."""
        loaded = self._get_model(model_id)
        self._speculative_telemetry_ctx.set(None)
        self._queue_wait_sec_ctx.set(None)
        loaded.request_count += 1
        loaded.last_used_at = time.time()
        self._predictor.record_access(model_id)

        effective_ctx = num_ctx or loaded.context_length
        if effective_ctx:
            messages = fit_to_context(
                messages,
                max_context_tokens=effective_ctx,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        async def _run_inference() -> tuple[str, int, int, dict[str, Any]]:
            self._concurrency.enter_inference(model_id)
            try:
                return await asyncio.wait_for(
                    self._do_generate(
                        loaded, msg_dicts, messages, temperature,
                        max_tokens, top_p, stop, tools, response_format,
                        frequency_penalty, presence_penalty,
                    ),
                    timeout=self._inference_timeout,
                )
            except TimeoutError:
                logger.error("inference_timeout", extra={
                    "model_id": model_id, "timeout_sec": self._inference_timeout,
                })
                raise RuntimeError(
                    f"Inference timed out after {self._inference_timeout}s"
                ) from None
            except Exception as e:
                state = await self._mark_readiness_failure(
                    model_id,
                    reason=str(e),
                    quarantine_threshold=self._runtime_failure_quarantine_threshold,
                )
                if state.get("state") == "quarantined":
                    loaded.readiness_state = "quarantined"
                    loaded.readiness_reason = f"{ErrorCodes.MODEL_UNSTABLE}:{state.get('reason')}"
                logger.error("inference_failed", extra={"model_id": model_id, "error": str(e)})
                raise RuntimeError(f"Inference failed: {e}") from e
            finally:
                self._concurrency.exit_inference(model_id)

        request_started = time.monotonic()
        try:
            async with self._acquire_request_slots(
                model_id=model_id,
                priority=priority,
                client_id=client_id,
            ):
                (
                    content,
                    prompt_tokens,
                    completion_tokens,
                    speculative_telemetry,
                ) = await _run_inference()
        finally:
            self._concurrency._record_latency_sample(time.monotonic() - request_started)
            self._adapt_concurrency()
        self._speculative_telemetry_ctx.set(speculative_telemetry)

        if response_format and not tools:
            _cleaned, parsed_json, is_valid, error = parse_json_output(content, response_format)
            if parsed_json is not None:
                import json as _json
                content = _json.dumps(parsed_json)
            if not is_valid:
                logger.warning("structured_output_validation_failed", extra={
                    "model_id": model_id, "error": error,
                })

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

        if (
            finish_reason != "tool_calls"
            and max_tokens is not None
            and completion_tokens >= max_tokens
        ):
            finish_reason = "length"

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
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
    ) -> tuple[str, int, int, dict[str, Any]]:
        """Execute inference and return content, token usage, and speculative telemetry."""
        speculative_telemetry = SpeculativeTelemetryHelper.base_speculative_telemetry(loaded)
        effective_msgs = msg_dicts
        if response_format:
            json_instruction = build_json_system_prompt(response_format)
            if json_instruction:
                effective_msgs = inject_json_instruction(msg_dicts, json_instruction)

        if loaded.backend is not None:
            from typing import cast
            backend_result = await loaded.backend.generate(
                messages=effective_msgs,
                temperature=temperature,
                max_tokens=max_tokens or 2048,
                top_p=top_p,
                stop=stop,
                tools=tools,
                response_format=response_format,
            )
            content, prompt_tokens, completion_tokens = cast(tuple[str, int, int], backend_result)
            SpeculativeTelemetryHelper.finalize_speculative_telemetry(
                speculative_telemetry, completion_tokens,
            )
            return content, prompt_tokens, completion_tokens, speculative_telemetry

        chat_kwargs: dict[str, Any] = {
            "messages": effective_msgs,
            "temperature": temperature,
            "max_tokens": max_tokens or 2048,
            "top_p": top_p,
        }
        if stop:
            chat_kwargs["stop"] = stop
        if tools:
            chat_kwargs["tools"] = tools
        if frequency_penalty != 0.0:
            chat_kwargs["frequency_penalty"] = frequency_penalty
        if presence_penalty != 0.0:
            chat_kwargs["presence_penalty"] = presence_penalty
        result = await loaded.engine.chat(**chat_kwargs)

        if hasattr(result, "text"):
            content = result.text
            prompt_tokens = (
                getattr(result, "prompt_tokens", 0)
                or estimate_prompt_tokens(messages)
            )
            completion_tokens = (
                getattr(result, "completion_tokens", 0)
                or max(1, len(content) // 4)
            )
        else:
            content = result if isinstance(result, str) else str(result)
            prompt_tokens = estimate_prompt_tokens(messages)
            completion_tokens = max(1, len(content) // 4)
        SpeculativeTelemetryHelper.update_speculative_from_payload(
            speculative_telemetry, result,
        )
        SpeculativeTelemetryHelper.finalize_speculative_telemetry(
            speculative_telemetry, completion_tokens,
        )
        return content, prompt_tokens, completion_tokens, speculative_telemetry

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
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        priority: str = "normal",
        num_ctx: int | None = None,
        client_id: str | None = None,
    ) -> AsyncIterator[str]:
        """Streaming chat completion -- yields token strings."""
        loaded = self._get_model(model_id)
        self._speculative_telemetry_ctx.set(None)
        self._queue_wait_sec_ctx.set(None)
        loaded.request_count += 1
        loaded.last_used_at = time.time()
        self._predictor.record_access(model_id)
        speculative_telemetry = SpeculativeTelemetryHelper.base_speculative_telemetry(loaded)
        completion_units = 0

        effective_ctx = num_ctx or loaded.context_length
        if effective_ctx:
            messages = fit_to_context(
                messages,
                max_context_tokens=effective_ctx,
                reserve_for_output=max_tokens or 1024,
            )

        msg_dicts = _resolve_messages(messages)

        if response_format:
            json_instruction = build_json_system_prompt(response_format)
            if json_instruction:
                msg_dicts = inject_json_instruction(msg_dicts, json_instruction)

        request_started = time.monotonic()
        try:
            async with self._acquire_request_slots(
                model_id=model_id,
                priority=priority,
                client_id=client_id,
            ):
                self._concurrency.enter_inference(model_id)
                try:
                    async with asyncio.timeout(self._inference_timeout):
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
                                completion_units += 1
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
                            if frequency_penalty != 0.0:
                                chat_kwargs["frequency_penalty"] = frequency_penalty
                            if presence_penalty != 0.0:
                                chat_kwargs["presence_penalty"] = presence_penalty
                            stream = loaded.engine.stream_chat(**chat_kwargs)
                            async for chunk in stream:
                                SpeculativeTelemetryHelper.update_speculative_from_payload(
                                    speculative_telemetry, chunk,
                                )
                                delta = chunk.new_text if hasattr(chunk, "new_text") else str(chunk)
                                if delta:
                                    completion_units += 1
                                    yield delta
                except asyncio.CancelledError:
                    logger.info("stream_cancelled", extra={"model_id": model_id})
                    raise
                except TimeoutError:
                    logger.error("stream_timeout", extra={
                        "model_id": model_id, "timeout_sec": self._inference_timeout,
                    })
                    raise RuntimeError(
                        f"Stream inference timed out after {self._inference_timeout}s"
                    ) from None
                except Exception as e:
                    state = await self._mark_readiness_failure(
                        model_id,
                        reason=str(e),
                        quarantine_threshold=self._runtime_failure_quarantine_threshold,
                    )
                    if state.get("state") == "quarantined":
                        loaded.readiness_state = "quarantined"
                        loaded.readiness_reason = (
                            f"{ErrorCodes.MODEL_UNSTABLE}:{state.get('reason')}"
                        )
                    logger.error("stream_failed", extra={"model_id": model_id, "error": str(e)})
                    raise RuntimeError(f"Stream inference failed: {e}") from e
                finally:
                    self._concurrency.exit_inference(model_id)
        finally:
            SpeculativeTelemetryHelper.finalize_speculative_telemetry(
                speculative_telemetry, completion_units,
            )
            self._speculative_telemetry_ctx.set(speculative_telemetry)
            self._concurrency._record_latency_sample(time.monotonic() - request_started)
            self._adapt_concurrency()
