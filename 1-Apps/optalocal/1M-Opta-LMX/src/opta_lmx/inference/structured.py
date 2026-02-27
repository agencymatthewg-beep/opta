"""Structured output enforcement for response_format.

Handles JSON mode (json_object) and JSON Schema mode (json_schema)
by injecting system prompts and validating/extracting output. This
replicates the pattern used by vllm-mlx's server layer, since the
engine-level chat()/stream_chat() APIs don't enforce response_format.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def build_json_system_prompt(
    response_format: dict[str, Any] | None,
) -> str | None:
    """Build a system instruction that guides the model to emit valid JSON.

    Args:
        response_format: OpenAI-compatible response_format dict.

    Returns:
        Instruction string to inject, or None if not needed.
    """
    if response_format is None:
        return None

    fmt_type = response_format.get("type", "text")

    if fmt_type == "text":
        return None

    if fmt_type == "json_object":
        return (
            "You must respond with valid JSON only. "
            "Do not include any explanation or text outside the JSON object."
        )

    if fmt_type == "json_schema":
        spec = response_format.get("json_schema", {})
        schema = spec.get("schema", {})
        name = spec.get("name", "response")
        description = spec.get("description", "")

        prompt = f"You must respond with valid JSON matching the '{name}' schema."
        if description:
            prompt += f" {description}"
        prompt += (
            f"\n\nJSON Schema:\n```json\n{json.dumps(schema, indent=2)}\n```\n\n"
            "Respond with only the JSON object, no additional text or explanation."
        )
        return prompt

    return None


def inject_json_instruction(
    messages: list[dict[str, Any]],
    instruction: str,
) -> list[dict[str, Any]]:
    """Inject a JSON instruction into the conversation messages.

    If a system message exists, appends to it. Otherwise prepends a new one.

    Args:
        messages: Conversation messages (dict format, already resolved).
        instruction: The JSON instruction to inject.

    Returns:
        New message list with instruction injected (original not mutated).
    """
    messages = list(messages)

    system_idx: int | None = None
    for i, msg in enumerate(messages):
        if msg.get("role") == "system":
            system_idx = i
            break

    if system_idx is not None:
        msg = dict(messages[system_idx])
        existing = msg.get("content", "")
        msg["content"] = f"{existing}\n\n{instruction}"
        messages[system_idx] = msg
    else:
        messages.insert(0, {"role": "system", "content": instruction})

    return messages


def extract_json_from_text(text: str) -> dict[str, Any] | list[Any] | None:
    """Extract JSON from model output, trying multiple strategies.

    1. Parse entire text as JSON
    2. Extract from markdown code blocks
    3. Find first JSON object/array in text

    Args:
        text: Raw model output.

    Returns:
        Parsed JSON data, or None if no valid JSON found.
    """
    text = text.strip()

    # Strategy 1: whole text is JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: markdown code blocks
    for match in re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text):
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    # Strategy 3: first { ... } or [ ... ]
    for pattern in (r"(\{[\s\S]*\})", r"(\[[\s\S]*\])"):
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                continue

    return None


def validate_json_schema(
    data: Any,
    schema: dict[str, Any],
) -> tuple[bool, str | None]:
    """Validate data against a JSON Schema.

    Uses ``jsonschema`` if available, otherwise skips validation.

    Returns:
        (is_valid, error_message) — error_message is None when valid.
    """
    try:
        from jsonschema import ValidationError, validate  # type: ignore[import-untyped]

        validate(instance=data, schema=schema)
        return True, None
    except ImportError:
        logger.debug("jsonschema_not_installed_skipping_validation")
        return True, None
    except ValidationError as e:
        return False, str(e.message)


def parse_json_output(
    text: str,
    response_format: dict[str, Any] | None,
) -> tuple[str, dict[str, Any] | None, bool, str | None]:
    """Parse and validate JSON from model output.

    Args:
        text: Raw model output.
        response_format: OpenAI-compatible response_format dict.

    Returns:
        (cleaned_text, parsed_json, is_valid, error_message)
    """
    if response_format is None:
        return text, None, True, None

    fmt_type = response_format.get("type", "text")

    if fmt_type == "text":
        return text, None, True, None

    parsed = extract_json_from_text(text)

    if parsed is None:
        return text, None, False, "Failed to extract valid JSON from output"

    if fmt_type == "json_object":
        return text, parsed, True, None

    if fmt_type == "json_schema":
        spec = response_format.get("json_schema", {})
        schema = spec.get("schema", {})
        if schema:
            is_valid, error = validate_json_schema(parsed, schema)
            if not is_valid:
                return text, parsed, False, f"JSON Schema validation failed: {error}"
        return text, parsed, True, None

    return text, None, True, None
