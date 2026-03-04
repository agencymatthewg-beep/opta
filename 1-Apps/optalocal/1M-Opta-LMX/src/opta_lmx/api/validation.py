"""Validation and payload parsing helpers."""

from __future__ import annotations

from opta_lmx.inference.schema import (
    ChatCompletionRequest,
    ChatMessage,
    ImageContentPart,
    ImageUrlDetail,
    TextContentPart,
)


def _chat_stream_include_logprobs_placeholder(body: ChatCompletionRequest) -> bool:
    """Whether streaming chunks should expose `choices[].logprobs: null`."""
    return bool(body.logprobs or body.top_logprobs is not None)


def _parse_responses_max_tokens(body: dict[str, object]) -> tuple[int | None, str | None]:
    """Resolve `max_output_tokens`/`max_tokens` with OpenAI-style compatibility."""
    param: str | None
    if "max_output_tokens" in body:
        raw = body.get("max_output_tokens")
        param = "max_output_tokens"
    else:
        raw = body.get("max_tokens")
        param = "max_tokens" if "max_tokens" in body else None

    if raw is None or param is None:
        return None, None
    if isinstance(raw, bool):
        return None, param
    if isinstance(raw, int):
        value = raw
    elif isinstance(raw, float):
        if not raw.is_integer():
            return None, param
        value = int(raw)
    elif isinstance(raw, str):
        try:
            value = int(raw)
        except ValueError:
            return None, param
    else:
        return None, param
    if value <= 0:
        return None, param
    return value, None


def _normalize_responses_content_parts(
    parts: list[object],
) -> list[TextContentPart | ImageContentPart]:
    """Normalize Responses API content parts into ChatMessage multimodal parts."""
    normalized: list[TextContentPart | ImageContentPart] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        part_type = part.get("type")
        if part_type in {"input_text", "text"}:
            text = part.get("text")
            if isinstance(text, str):
                normalized.append(TextContentPart(type="text", text=text))
        elif part_type in {"input_image", "image_url"}:
            image_data = part.get("image_url")
            if image_data is None:
                image_data = part.get("image")
            if isinstance(image_data, str):
                normalized.append(
                    ImageContentPart(
                        type="image_url",
                        image_url=ImageUrlDetail(url=image_data, detail="auto"),
                    )
                )
            elif isinstance(image_data, dict):
                url = image_data.get("url")
                if isinstance(url, str):
                    detail = image_data.get("detail")
                    normalized.append(
                        ImageContentPart(
                            type="image_url",
                            image_url=ImageUrlDetail(
                                url=url,
                                detail=detail if isinstance(detail, str) else "auto",
                            ),
                        )
                    )
    return normalized


def _parse_responses_input_messages(input_payload: object) -> list[ChatMessage]:
    """Parse Responses API `input` into ChatMessage list.

    Supported forms:
    - string
    - list[string]
    - list[{role, content}] where content is string or content-parts list
    """
    if isinstance(input_payload, str):
        return [ChatMessage(role="user", content=input_payload)]

    if isinstance(input_payload, dict):
        items: list[object] = [input_payload]
    elif isinstance(input_payload, list):
        items = list(input_payload)
    else:
        raise ValueError("Field 'input' must be a string, object, or array.")

    messages: list[ChatMessage] = []
    for item in items:
        if isinstance(item, str):
            messages.append(ChatMessage(role="user", content=item))
            continue
        if not isinstance(item, dict):
            raise ValueError("Field 'input' contains an invalid item type.")

        role = item.get("role", "user")
        if not isinstance(role, str):
            raise ValueError("Field 'input.role' must be a string.")

        content = item.get("content", "")
        if isinstance(content, str) or content is None:
            messages.append(ChatMessage(role=role, content=content or ""))
            continue
        if isinstance(content, list):
            normalized = _normalize_responses_content_parts(content)
            messages.append(ChatMessage(role=role, content=normalized or ""))
            continue

        raise ValueError("Field 'input.content' must be a string or content-parts array.")

    if not messages:
        raise ValueError("Field 'input' must not be empty.")
    return messages

_SERVING_LANE_TO_PRIORITY: dict[str, str] = {
    "interactive": "high",
    "throughput": "normal",
}
_PRIORITY_TO_SERVING_LANE: dict[str, str] = {
    "high": "interactive",
    "normal": "throughput",
}


def _resolve_serving_lane_and_priority(
    *,
    route: str,
    x_serving_lane: str | None,
    x_priority: str | None,
) -> tuple[str, str]:
    """Resolve serving lane and request priority with deterministic precedence."""
    lane_raw = (x_serving_lane or "").strip().lower()
    if lane_raw:
        if lane_raw not in _SERVING_LANE_TO_PRIORITY:
            allowed = ", ".join(_SERVING_LANE_TO_PRIORITY.keys())
            raise ValueError(f"Invalid value for 'x-serving-lane'. Expected one of: {allowed}.")
        serving_lane = lane_raw
        priority = _SERVING_LANE_TO_PRIORITY[serving_lane]
        source = "x-serving-lane"
    else:
        priority_raw = (x_priority or "").strip().lower()
        priority = priority_raw or "normal"
        serving_lane = _PRIORITY_TO_SERVING_LANE.get(priority, "custom")
        source = "x-priority" if priority_raw else "default"

    logger.info(
        "serving_lane_resolved",
        extra={
            "route": route,
            "serving_lane": serving_lane,
            "priority": priority,
            "source": source,
        },
    )
    return serving_lane, priority

