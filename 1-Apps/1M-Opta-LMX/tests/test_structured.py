"""Tests for structured output enforcement (E11)."""

from __future__ import annotations

from opta_lmx.inference.structured import (
    build_json_system_prompt,
    extract_json_from_text,
    inject_json_instruction,
    parse_json_output,
)


def test_build_json_system_prompt_none():
    assert build_json_system_prompt(None) is None


def test_build_json_system_prompt_text():
    assert build_json_system_prompt({"type": "text"}) is None


def test_build_json_system_prompt_json_object():
    prompt = build_json_system_prompt({"type": "json_object"})
    assert prompt is not None
    assert "valid JSON" in prompt


def test_build_json_system_prompt_json_schema():
    prompt = build_json_system_prompt({
        "type": "json_schema",
        "json_schema": {
            "name": "test_schema",
            "schema": {"type": "object", "properties": {"name": {"type": "string"}}},
        },
    })
    assert prompt is not None
    assert "test_schema" in prompt
    assert "JSON Schema" in prompt


def test_inject_json_instruction_no_system():
    msgs = [{"role": "user", "content": "hello"}]
    result = inject_json_instruction(msgs, "Output JSON only.")
    assert len(result) == 2
    assert result[0]["role"] == "system"
    assert result[0]["content"] == "Output JSON only."
    # Original should not be mutated
    assert len(msgs) == 1


def test_inject_json_instruction_with_system():
    msgs = [
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "hi"},
    ]
    result = inject_json_instruction(msgs, "Output JSON only.")
    assert len(result) == 2
    assert "You are helpful." in result[0]["content"]
    assert "Output JSON only." in result[0]["content"]
    # Original should not be mutated
    assert msgs[0]["content"] == "You are helpful."


def test_extract_json_raw():
    assert extract_json_from_text('{"key": "value"}') == {"key": "value"}


def test_extract_json_from_code_block():
    text = 'Here is the result:\n```json\n{"a": 1}\n```\nDone.'
    assert extract_json_from_text(text) == {"a": 1}


def test_extract_json_embedded():
    text = "The result is {\"b\": 2} which is correct."
    assert extract_json_from_text(text) == {"b": 2}


def test_extract_json_none():
    assert extract_json_from_text("no json here") is None


def test_parse_json_output_none_format():
    text, parsed, valid, _err = parse_json_output("hello", None)
    assert text == "hello"
    assert parsed is None
    assert valid is True


def test_parse_json_output_json_object():
    _text, parsed, valid, err = parse_json_output('{"x": 1}', {"type": "json_object"})
    assert parsed == {"x": 1}
    assert valid is True
    assert err is None


def test_parse_json_output_invalid():
    _text, parsed, valid, err = parse_json_output("no json", {"type": "json_object"})
    assert parsed is None
    assert valid is False
    assert err is not None


def test_parse_json_output_json_schema_valid():
    schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "test",
            "schema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
    }
    _text, parsed, valid, _err = parse_json_output('{"name": "Alice"}', schema)
    assert parsed == {"name": "Alice"}
    assert valid is True


def test_num_ctx_field_on_request():
    """F5: Verify num_ctx field exists on ChatCompletionRequest."""
    from opta_lmx.inference.schema import ChatCompletionRequest

    # Default is None
    req = ChatCompletionRequest(model="test", messages=[])
    assert req.num_ctx is None

    # Can be set
    req2 = ChatCompletionRequest(model="test", messages=[], num_ctx=4096)
    assert req2.num_ctx == 4096


def test_preset_chat_template_field():
    """F4: Verify chat_template field exists on Preset."""
    from opta_lmx.presets.manager import Preset

    p = Preset(name="test")
    assert p.chat_template is None

    p2 = Preset(name="test", chat_template="{% for m in messages %}...")
    assert p2.chat_template is not None
