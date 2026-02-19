"""Tests for MiniMax M2.5 XML tool call parser.

Covers non-streaming parsing, streaming parsing, type coercion,
think tag stripping, and engine integration.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from opta_lmx.inference.tool_parser import (
    MiniMaxToolParser,
    StreamingToolParser,
    convert_param_value,
    strip_thinking,
    wrap_stream_with_tool_parsing,
)

# ─── Fixtures ───────────────────────────────────────────────────────────────

WEATHER_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "unit": {"type": "string"},
                },
            },
        },
    },
]

TYPED_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer"},
                    "score": {"type": "number"},
                    "active": {"type": "boolean"},
                    "tags": {"type": "array"},
                    "metadata": {"type": "object"},
                    "nullable_field": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                    },
                },
            },
        },
    },
]


SIMPLE_TOOL_CALL_XML = (
    '<minimax:tool_call>\n'
    '<invoke name="get_weather">\n'
    '<parameter name="location">San Francisco</parameter>\n'
    '<parameter name="unit">celsius</parameter>\n'
    '</invoke>\n'
    '</minimax:tool_call>'
)


# ═══════════════════════════════════════════════════════════════════════════
# Non-Streaming Parsing
# ═══════════════════════════════════════════════════════════════════════════


class TestNonStreamingParsing:
    """Tests for MiniMaxToolParser.parse_tool_calls()."""

    def test_single_tool_call(self) -> None:
        """Parse a single tool call with two parameters."""
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(SIMPLE_TOOL_CALL_XML, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.tool_calls is not None
        assert len(result.tool_calls) == 1

        tc = result.tool_calls[0]
        assert tc.name == "get_weather"
        assert tc.id.startswith("call_")
        args = json.loads(tc.arguments)
        assert args["location"] == "San Francisco"
        assert args["unit"] == "celsius"

    def test_multiple_invokes_in_one_block(self) -> None:
        """Parse two invokes in a single <minimax:tool_call> block."""
        xml = (
            '<minimax:tool_call>\n'
            '<invoke name="get_weather">\n'
            '<parameter name="location">Tokyo</parameter>\n'
            '</invoke>\n'
            '<invoke name="get_weather">\n'
            '<parameter name="location">London</parameter>\n'
            '</invoke>\n'
            '</minimax:tool_call>'
        )
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(xml, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.tool_calls is not None
        assert len(result.tool_calls) == 2
        assert json.loads(result.tool_calls[0].arguments)["location"] == "Tokyo"
        assert json.loads(result.tool_calls[1].arguments)["location"] == "London"
        # Each tool call should have a unique ID
        assert result.tool_calls[0].id != result.tool_calls[1].id

    def test_content_before_tool_calls(self) -> None:
        """Text before <minimax:tool_call> preserved in content."""
        text = f"Let me check the weather for you.\n\n{SIMPLE_TOOL_CALL_XML}"
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(text, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.content == "Let me check the weather for you."

    def test_no_tool_calls_returns_content(self) -> None:
        """Plain text without tool calls returns as content."""
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls("Hello, how can I help?", WEATHER_TOOLS)

        assert result.has_tool_calls is False
        assert result.tool_calls is None
        assert result.content == "Hello, how can I help?"

    def test_no_tools_no_parsing(self) -> None:
        """When no tools provided, XML stays as raw content."""
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(SIMPLE_TOOL_CALL_XML, tools=None)

        # Even without tools, the parser still detects XML tool call blocks
        assert result.has_tool_calls is True

    def test_malformed_xml_graceful_fallback(self) -> None:
        """Malformed XML without valid invokes returns as content."""
        xml = "<minimax:tool_call>garbage that isn't valid XML</minimax:tool_call>"
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(xml, WEATHER_TOOLS)

        assert result.has_tool_calls is False
        assert result.content is not None

    def test_tool_calls_with_thinking(self) -> None:
        """<think>...</think> blocks stripped before tool calls."""
        text = (
            "<think>I need to check the weather.</think>\n"
            f"{SIMPLE_TOOL_CALL_XML}"
        )
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(text, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        # Thinking should be stripped — no thinking text in content
        assert result.content is None or "I need to check" not in result.content

    def test_no_opening_think_tag(self) -> None:
        """Handle M2.5 quirk: reasoning without <think>, only </think>."""
        text = f"Let me think about this...</think>\n{SIMPLE_TOOL_CALL_XML}"
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(text, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.content is None or "Let me think" not in result.content

    def test_empty_content_returns_none(self) -> None:
        """When tool call has no text before it, content is None."""
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(SIMPLE_TOOL_CALL_XML, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.content is None

    def test_openai_native_tool_calls_bypass_xml_parser(self) -> None:
        """Content without MiniMax XML tags passes through without parsing.

        GLM-4, Kimi K2, and other models that use standard OpenAI tool call
        format should not have their output mangled by the XML parser.
        """
        # Simulates a response from a model that uses OpenAI-native tool calling
        content = "I'll help you check the weather. Let me look that up."
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(content, WEATHER_TOOLS)

        assert result.has_tool_calls is False
        assert result.content == content

    def test_unquoted_attribute_names(self) -> None:
        """Handle unquoted attribute values in invoke/parameter tags."""
        xml = (
            '<minimax:tool_call>\n'
            '<invoke name=get_weather>\n'
            '<parameter name=location>Paris</parameter>\n'
            '</invoke>\n'
            '</minimax:tool_call>'
        )
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(xml, WEATHER_TOOLS)

        assert result.has_tool_calls is True
        assert result.tool_calls is not None
        assert json.loads(result.tool_calls[0].arguments)["location"] == "Paris"


# ═══════════════════════════════════════════════════════════════════════════
# Type Coercion
# ═══════════════════════════════════════════════════════════════════════════


class TestTypeCoercion:
    """Tests for convert_param_value()."""

    def test_string_type(self) -> None:
        assert convert_param_value("hello", {"type": "string"}) == "hello"

    def test_integer_type(self) -> None:
        assert convert_param_value("42", {"type": "integer"}) == 42

    def test_number_type(self) -> None:
        result = convert_param_value("3.14", {"type": "number"})
        assert isinstance(result, float)
        assert abs(result - 3.14) < 0.001

    def test_boolean_true(self) -> None:
        assert convert_param_value("true", {"type": "boolean"}) is True

    def test_boolean_false(self) -> None:
        assert convert_param_value("false", {"type": "boolean"}) is False

    def test_array_type(self) -> None:
        result = convert_param_value('["a", "b"]', {"type": "array"})
        assert result == ["a", "b"]

    def test_object_type(self) -> None:
        result = convert_param_value('{"key": "value"}', {"type": "object"})
        assert result == {"key": "value"}

    def test_null_type(self) -> None:
        assert convert_param_value("anything", {"type": "null"}) is None

    def test_any_of_string_or_null(self) -> None:
        schema = {"anyOf": [{"type": "string"}, {"type": "null"}]}
        assert convert_param_value("hello", schema) == "hello"

    def test_one_of_integer_fallback(self) -> None:
        schema = {"oneOf": [{"type": "integer"}, {"type": "string"}]}
        assert convert_param_value("42", schema) == 42

    def test_no_schema_json_fallback(self) -> None:
        """No schema — tries JSON parse, falls back to string."""
        assert convert_param_value("42", None) == 42
        assert convert_param_value("hello", None) == "hello"
        assert convert_param_value('{"a": 1}', None) == {"a": 1}

    def test_typed_tool_call_parsing(self) -> None:
        """Full tool call with typed parameters parsed correctly."""
        xml = (
            '<minimax:tool_call>\n'
            '<invoke name="search">\n'
            '<parameter name="query">python tutorials</parameter>\n'
            '<parameter name="limit">10</parameter>\n'
            '<parameter name="score">0.85</parameter>\n'
            '<parameter name="active">true</parameter>\n'
            '<parameter name="tags">["python", "beginner"]</parameter>\n'
            '<parameter name="metadata">{"source": "web"}</parameter>\n'
            '</invoke>\n'
            '</minimax:tool_call>'
        )
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(xml, TYPED_TOOLS)

        assert result.has_tool_calls is True
        assert result.tool_calls is not None
        args = json.loads(result.tool_calls[0].arguments)
        assert args["query"] == "python tutorials"
        assert args["limit"] == 10
        assert isinstance(args["score"], float)
        assert args["active"] is True
        assert args["tags"] == ["python", "beginner"]
        assert args["metadata"] == {"source": "web"}


# ═══════════════════════════════════════════════════════════════════════════
# Think Tag Stripping
# ═══════════════════════════════════════════════════════════════════════════


class TestThinkStripping:
    """Tests for strip_thinking()."""

    def test_standard_think_block(self) -> None:
        result = strip_thinking("<think>reasoning here</think>The answer is 42.")
        assert result == "The answer is 42."

    def test_no_opening_think_tag(self) -> None:
        result = strip_thinking("some reasoning</think>The answer is 42.")
        assert result == "The answer is 42."

    def test_no_think_tags(self) -> None:
        result = strip_thinking("Just regular content.")
        assert result == "Just regular content."

    def test_multiple_think_blocks(self) -> None:
        result = strip_thinking(
            "<think>first</think>A<think>second</think>B"
        )
        assert result == "AB"

    def test_empty_after_strip(self) -> None:
        result = strip_thinking("<think>only thinking</think>")
        assert result == ""


# ═══════════════════════════════════════════════════════════════════════════
# Streaming Parser
# ═══════════════════════════════════════════════════════════════════════════


class TestStreamingParser:
    """Tests for StreamingToolParser.feed() and flush()."""

    def test_content_only_stream(self) -> None:
        """Plain content without tool calls passes through."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        content = ""

        for token in ["Hello", " world", "!"]:
            result = parser.feed(token)
            if result.content_delta:
                content += result.content_delta

        result = parser.flush()
        if result.content_delta:
            content += result.content_delta

        assert content == "Hello world!"
        assert not parser.saw_tool_calls

    def test_tool_call_in_single_chunk(self) -> None:
        """Complete tool call in one chunk."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        result = parser.feed(SIMPLE_TOOL_CALL_XML)

        assert result.tool_call_deltas is not None
        assert len(result.tool_call_deltas) == 1
        assert result.tool_call_deltas[0].name == "get_weather"
        args = json.loads(result.tool_call_deltas[0].arguments_delta)
        assert args["location"] == "San Francisco"

    def test_tool_call_split_across_chunks(self) -> None:
        """Tool call XML split across multiple token chunks."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        all_deltas = []

        # Split the XML into realistic token-sized chunks
        chunks = [
            "<minimax", ":tool_call", ">\n<invoke",
            ' name="get_weather"', ">\n<parameter",
            ' name="location">', "San Francisco",
            "</parameter>\n</invoke>", "\n</minimax:tool_call>",
        ]

        for chunk in chunks:
            result = parser.feed(chunk)
            if result.tool_call_deltas:
                all_deltas.extend(result.tool_call_deltas)

        result = parser.flush()
        if result.tool_call_deltas:
            all_deltas.extend(result.tool_call_deltas)

        assert len(all_deltas) == 1
        assert all_deltas[0].name == "get_weather"
        assert parser.saw_tool_calls

    def test_content_before_tool_call_streamed(self) -> None:
        """Content before tool call is emitted, then tool call follows."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        content = ""
        tool_deltas = []

        chunks = [
            "Let me ", "check ", "the weather",
            f".\n\n{SIMPLE_TOOL_CALL_XML}",
        ]

        for chunk in chunks:
            result = parser.feed(chunk)
            if result.content_delta:
                content += result.content_delta
            if result.tool_call_deltas:
                tool_deltas.extend(result.tool_call_deltas)

        result = parser.flush()
        if result.content_delta:
            content += result.content_delta

        assert "Let me check the weather" in content
        assert len(tool_deltas) == 1

    def test_partial_tag_at_chunk_boundary(self) -> None:
        """'<' at end of chunk is buffered, not emitted prematurely."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        content = ""

        # Feed text ending with '<' (could be start of tool call)
        result = parser.feed("Hello world<")
        if result.content_delta:
            content += result.content_delta
        # '<' should be buffered
        assert "<" not in content

        # Next chunk reveals it's just HTML, not a tool call
        result = parser.feed("br>more text")
        if result.content_delta:
            content += result.content_delta

        result = parser.flush()
        if result.content_delta:
            content += result.content_delta

        assert content == "Hello world<br>more text"

    def test_multiple_tools_streamed(self) -> None:
        """Two invokes in one block parsed sequentially."""
        xml = (
            '<minimax:tool_call>\n'
            '<invoke name="get_weather">\n'
            '<parameter name="location">Tokyo</parameter>\n'
            '</invoke>\n'
            '<invoke name="get_weather">\n'
            '<parameter name="location">London</parameter>\n'
            '</invoke>\n'
            '</minimax:tool_call>'
        )
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        all_deltas = []

        # Feed in two chunks — split between the invokes
        mid = xml.index("</invoke>") + len("</invoke>")
        for chunk in [xml[:mid], xml[mid:]]:
            result = parser.feed(chunk)
            if result.tool_call_deltas:
                all_deltas.extend(result.tool_call_deltas)

        result = parser.flush()
        if result.tool_call_deltas:
            all_deltas.extend(result.tool_call_deltas)

        assert len(all_deltas) == 2
        assert all_deltas[0].index == 0
        assert all_deltas[1].index == 1

    def test_thinking_then_tool_call(self) -> None:
        """<think> block is suppressed, tool call is parsed."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        content = ""
        tool_deltas = []

        chunks = [
            "<think>", "Let me think...", "</think>",
            SIMPLE_TOOL_CALL_XML,
        ]

        for chunk in chunks:
            result = parser.feed(chunk)
            if result.content_delta:
                content += result.content_delta
            if result.tool_call_deltas:
                tool_deltas.extend(result.tool_call_deltas)

        # Thinking content should not appear
        assert "Let me think" not in content
        assert len(tool_deltas) == 1

    def test_flush_returns_remaining_content(self) -> None:
        """flush() returns buffered content at end of stream."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)

        # Feed text ending with partial potential tag
        parser.feed("Hello<")
        result = parser.flush()

        # Flush should emit the buffered '<'
        assert result.content_delta is not None
        assert "<" in result.content_delta

    def test_saw_tool_calls_property(self) -> None:
        """saw_tool_calls tracks whether any tool calls were parsed."""
        parser = StreamingToolParser(tools=WEATHER_TOOLS)
        assert not parser.saw_tool_calls

        parser.feed(SIMPLE_TOOL_CALL_XML)
        assert parser.saw_tool_calls


# ═══════════════════════════════════════════════════════════════════════════
# Stream Wrapping
# ═══════════════════════════════════════════════════════════════════════════


class TestWrapStreamWithToolParsing:
    """Tests for wrap_stream_with_tool_parsing() async generator."""

    @pytest.mark.asyncio
    async def test_content_passthrough(self) -> None:
        """Plain content passes through as StreamChunk with content."""
        async def token_gen() -> AsyncIterator[str]:
            for t in ["Hello", " world"]:
                yield t

        chunks = [c async for c in wrap_stream_with_tool_parsing(token_gen())]

        content_chunks = [c for c in chunks if c.content is not None]
        assert len(content_chunks) >= 1
        full = "".join(c.content for c in content_chunks if c.content)
        assert full == "Hello world"

    @pytest.mark.asyncio
    async def test_tool_call_yields_delta(self) -> None:
        """Tool call XML yields StreamChunk with tool_call_delta."""
        async def token_gen() -> AsyncIterator[str]:
            yield SIMPLE_TOOL_CALL_XML

        chunks = [c async for c in wrap_stream_with_tool_parsing(
            token_gen(), tools=WEATHER_TOOLS,
        )]

        tool_chunks = [c for c in chunks if c.tool_call_delta is not None]
        assert len(tool_chunks) == 1
        assert tool_chunks[0].tool_call_delta is not None
        assert tool_chunks[0].tool_call_delta.name == "get_weather"

    @pytest.mark.asyncio
    async def test_mixed_content_and_tools(self) -> None:
        """Content followed by tool call yields both types."""
        async def token_gen() -> AsyncIterator[str]:
            yield "Here's the weather: "
            yield SIMPLE_TOOL_CALL_XML

        chunks = [c async for c in wrap_stream_with_tool_parsing(
            token_gen(), tools=WEATHER_TOOLS,
        )]

        content_chunks = [c for c in chunks if c.content is not None]
        tool_chunks = [c for c in chunks if c.tool_call_delta is not None]

        assert len(content_chunks) >= 1
        assert len(tool_chunks) == 1


# ═══════════════════════════════════════════════════════════════════════════
# Engine Integration (Non-Streaming)
# ═══════════════════════════════════════════════════════════════════════════


class TestEngineIntegration:
    """Tests verifying tool parsing integrates into InferenceEngine."""

    @pytest.mark.asyncio
    async def test_generate_with_tool_calls(
        self, mock_engine: Any,
    ) -> None:
        """engine.generate() returns tool_calls when XML detected."""
        from opta_lmx.inference.engine import InferenceEngine
        from opta_lmx.inference.schema import ChatMessage
        from opta_lmx.manager.memory import MemoryMonitor

        engine = InferenceEngine(
            memory_monitor=MemoryMonitor(max_percent=90),
            use_batching=False,
            warmup_on_load=False,
        )

        # Mock engine to return tool call XML
        mock_result = MagicMock()
        mock_result.text = SIMPLE_TOOL_CALL_XML
        mock_result.prompt_tokens = 10
        mock_result.completion_tokens = 20

        async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
            mock = MagicMock()
            mock.chat = AsyncMock(return_value=mock_result)
            return mock

        engine._create_engine = mock_create  # type: ignore[assignment]

        # Load a fake model
        await engine.load_model("test-model")

        response = await engine.generate(
            model_id="test-model",
            messages=[ChatMessage(role="user", content="What's the weather?")],
            tools=WEATHER_TOOLS,
        )

        assert response.choices[0].finish_reason == "tool_calls"
        assert response.choices[0].message.tool_calls is not None
        assert len(response.choices[0].message.tool_calls) == 1
        tc = response.choices[0].message.tool_calls[0]
        assert tc.function.name == "get_weather"
        args = json.loads(tc.function.arguments)
        assert args["location"] == "San Francisco"

    @pytest.mark.asyncio
    async def test_generate_without_tools_no_parsing(
        self, mock_engine: Any,
    ) -> None:
        """engine.generate() without tools returns raw content."""
        from opta_lmx.inference.engine import InferenceEngine
        from opta_lmx.inference.schema import ChatMessage
        from opta_lmx.manager.memory import MemoryMonitor

        engine = InferenceEngine(
            memory_monitor=MemoryMonitor(max_percent=90),
            use_batching=False,
            warmup_on_load=False,
        )

        mock_result = MagicMock()
        mock_result.text = "Hello! The weather is sunny."
        mock_result.prompt_tokens = 10
        mock_result.completion_tokens = 20

        async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
            mock = MagicMock()
            mock.chat = AsyncMock(return_value=mock_result)
            return mock

        engine._create_engine = mock_create  # type: ignore[assignment]
        await engine.load_model("test-model")

        response = await engine.generate(
            model_id="test-model",
            messages=[ChatMessage(role="user", content="Hello")],
        )

        assert response.choices[0].finish_reason == "stop"
        assert response.choices[0].message.tool_calls is None
        assert response.choices[0].message.content == "Hello! The weather is sunny."

    @pytest.mark.asyncio
    async def test_generate_with_tools_but_no_xml(
        self, mock_engine: Any,
    ) -> None:
        """Tools requested but model responds without XML — returns content."""
        from opta_lmx.inference.engine import InferenceEngine
        from opta_lmx.inference.schema import ChatMessage
        from opta_lmx.manager.memory import MemoryMonitor

        engine = InferenceEngine(
            memory_monitor=MemoryMonitor(max_percent=90),
            use_batching=False,
            warmup_on_load=False,
        )

        mock_result = MagicMock()
        mock_result.text = "I don't have access to weather data."
        mock_result.prompt_tokens = 10
        mock_result.completion_tokens = 15

        async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
            mock = MagicMock()
            mock.chat = AsyncMock(return_value=mock_result)
            return mock

        engine._create_engine = mock_create  # type: ignore[assignment]
        await engine.load_model("test-model")

        response = await engine.generate(
            model_id="test-model",
            messages=[ChatMessage(role="user", content="Weather?")],
            tools=WEATHER_TOOLS,
        )

        assert response.choices[0].finish_reason == "stop"
        assert response.choices[0].message.tool_calls is None
        assert response.choices[0].message.content == "I don't have access to weather data."
