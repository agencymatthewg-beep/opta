"""MiniMax M2.5 XML tool call parser for OpenAI-compatible output.

Converts MiniMax's proprietary XML tool call format:
    <minimax:tool_call>
    <invoke name="get_weather">
    <parameter name="location">San Francisco</parameter>
    </invoke>
    </minimax:tool_call>

Into OpenAI-compatible tool_calls format for seamless client compatibility.

Supports both non-streaming (full text) and streaming (token-by-token) parsing.
Zero external dependencies — uses only stdlib (re, json, uuid, dataclasses).
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import Enum, auto
from typing import Any

logger = logging.getLogger(__name__)

# ─── Compiled Regex Patterns ────────────────────────────────────────────────

TOOL_CALL_BLOCK_RE = re.compile(
    r"<minimax:tool_call>(.*?)</minimax:tool_call>", re.DOTALL,
)
INVOKE_RE = re.compile(
    r'<invoke\s+name="?([^">]+)"?\s*>(.*?)</invoke>', re.DOTALL,
)
PARAM_RE = re.compile(
    r'<parameter\s+name="?([^">]+)"?\s*>(.*?)</parameter>', re.DOTALL,
)
THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

# Sentinel strings for streaming detection
TOOL_CALL_OPEN = "<minimax:tool_call>"
TOOL_CALL_CLOSE = "</minimax:tool_call>"
THINK_OPEN = "<think>"
THINK_CLOSE = "</think>"


# ─── Data Classes ───────────────────────────────────────────────────────────


@dataclass
class ParsedToolCall:
    """A single parsed tool call in OpenAI format."""

    id: str
    name: str
    arguments: str  # JSON string


@dataclass
class ParsedOutput:
    """Result of parsing model output for tool calls."""

    content: str | None
    tool_calls: list[ParsedToolCall] | None
    has_tool_calls: bool


@dataclass
class ToolCallDelta:
    """Incremental tool call data for streaming responses."""

    index: int
    id: str | None = None       # Only on first chunk for this tool
    name: str | None = None     # Only on first chunk for this tool
    arguments_delta: str = ""   # Incremental JSON string


@dataclass
class StreamingParseResult:
    """Result of feeding a chunk to the streaming parser."""

    content_delta: str | None = None
    tool_call_deltas: list[ToolCallDelta] | None = None
    buffered: bool = False


@dataclass
class StreamChunk:
    """A typed chunk in a streaming response.

    Used to distinguish content from tool call data in the token stream,
    allowing format_sse_stream to emit the correct delta shape.
    """

    content: str | None = None
    tool_call_delta: ToolCallDelta | None = None


# ─── Helper Functions ───────────────────────────────────────────────────────


def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks from text.

    Handles two patterns:
    1. Standard: <think>reasoning</think>content
    2. No opening tag: reasoning</think>content (M2.5 streaming quirk)
    """
    # Pattern 1: <think>...</think>
    text = THINK_RE.sub("", text)
    # Pattern 2: no opening <think>, just </think>
    if THINK_CLOSE in text:
        idx = text.index(THINK_CLOSE)
        text = text[idx + len(THINK_CLOSE) :]
    return text.strip()


def _get_param_schema(
    tools: list[dict[str, Any]] | None,
    func_name: str,
    param_name: str,
) -> dict[str, Any] | None:
    """Look up a parameter's schema from the tools definition."""
    if not tools:
        return None
    for tool in tools:
        func = tool.get("function", {}) if tool.get("type") == "function" else tool
        if func.get("name") == func_name:
            props = func.get("parameters", {}).get("properties", {})
            return props.get(param_name)
    return None


def convert_param_value(value: str, schema: dict[str, Any] | None) -> Any:
    """Convert a string parameter value to the correct type based on schema.

    Supports: string, integer, number, boolean, object, array, null.
    Also handles anyOf/oneOf schemas by trying each variant in order.
    """
    value = value.strip()

    if schema is None:
        return _try_json_parse(value)

    # Handle anyOf / oneOf
    type_key = schema.get("type")
    if type_key is None:
        for key in ("anyOf", "oneOf"):
            variants = schema.get(key, [])
            if variants:
                for variant in variants:
                    vtype = variant.get("type")
                    if vtype:
                        try:
                            return _convert_by_type(value, vtype)
                        except (ValueError, json.JSONDecodeError):
                            continue
                return value
        return _try_json_parse(value)

    return _convert_by_type(value, type_key)


def _convert_by_type(value: str, type_name: str) -> Any:
    """Convert value string to the specified JSON schema type."""
    if type_name == "string":
        return value
    if type_name == "integer":
        return int(value)
    if type_name == "number":
        return float(value)
    if type_name == "boolean":
        lower = value.lower()
        if lower in ("true", "1", "yes"):
            return True
        if lower in ("false", "0", "no"):
            return False
        raise ValueError(f"Cannot convert '{value}' to boolean")
    if type_name == "null":
        return None
    if type_name in ("object", "array"):
        return json.loads(value)
    return _try_json_parse(value)


def _try_json_parse(value: str) -> Any:
    """Try to parse as JSON, return original string on failure."""
    try:
        return json.loads(value)
    except (json.JSONDecodeError, ValueError):
        return value


def _generate_call_id() -> str:
    """Generate a unique tool call ID in OpenAI format."""
    return f"call_{uuid.uuid4().hex[:24]}"


# ─── Non-Streaming Parser ──────────────────────────────────────────────────


class MiniMaxToolParser:
    """Parse MiniMax M2.5 XML tool calls into OpenAI format.

    Usage:
        parser = MiniMaxToolParser()
        result = parser.parse_tool_calls(model_output, tools)
        if result.has_tool_calls:
            # result.tool_calls has OpenAI-format tool calls
            # result.content has any text before the tool calls
    """

    def parse_tool_calls(
        self,
        text: str,
        tools: list[dict[str, Any]] | None = None,
    ) -> ParsedOutput:
        """Parse tool calls from model output text.

        Args:
            text: Raw model output that may contain XML tool calls.
            tools: Tool definitions for type coercion of parameters.

        Returns:
            ParsedOutput with extracted tool calls and remaining content.
        """
        # Strip thinking blocks first
        text = strip_thinking(text)

        # Check for tool call blocks
        match = TOOL_CALL_BLOCK_RE.search(text)
        if not match:
            return ParsedOutput(
                content=text or None, tool_calls=None, has_tool_calls=False,
            )

        # Extract content before tool calls
        content_before = text[: match.start()].strip() or None

        # Parse all tool call blocks (may have multiple)
        tool_calls: list[ParsedToolCall] = []
        for block_match in TOOL_CALL_BLOCK_RE.finditer(text):
            block_content = block_match.group(1)
            for invoke_match in INVOKE_RE.finditer(block_content):
                func_name = invoke_match.group(1).strip().strip('"')
                invoke_body = invoke_match.group(2)

                params: dict[str, Any] = {}
                for param_match in PARAM_RE.finditer(invoke_body):
                    param_name = param_match.group(1).strip().strip('"')
                    param_value_str = param_match.group(2)
                    param_schema = _get_param_schema(tools, func_name, param_name)
                    params[param_name] = convert_param_value(
                        param_value_str, param_schema,
                    )

                tool_calls.append(ParsedToolCall(
                    id=_generate_call_id(),
                    name=func_name,
                    arguments=json.dumps(params),
                ))

        if not tool_calls:
            return ParsedOutput(
                content=text, tool_calls=None, has_tool_calls=False,
            )

        return ParsedOutput(
            content=content_before,
            tool_calls=tool_calls,
            has_tool_calls=True,
        )

    def create_streaming_parser(
        self,
        tools: list[dict[str, Any]] | None = None,
    ) -> StreamingToolParser:
        """Create a streaming parser instance."""
        return StreamingToolParser(tools=tools)


# ─── Streaming Parser ──────────────────────────────────────────────────────


class _ParserState(Enum):
    """Internal state of the streaming parser."""

    CONTENT = auto()
    THINKING = auto()
    IN_TOOL_CALL = auto()
    DONE = auto()


class StreamingToolParser:
    """Stateful streaming parser for MiniMax XML tool calls.

    Feed token chunks incrementally. The parser buffers partial XML tags
    and emits content deltas and tool call deltas as they become complete.

    Usage:
        parser = StreamingToolParser(tools=tools)
        for chunk in token_stream:
            result = parser.feed(chunk)
            if result.content_delta:
                # Emit as content SSE chunk
            if result.tool_call_deltas:
                # Emit as tool_calls SSE chunk
        result = parser.flush()
    """

    def __init__(self, tools: list[dict[str, Any]] | None = None) -> None:
        self._tools = tools
        self._full_text = ""
        self._content_emitted_to = 0
        self._tool_calls_emitted = 0
        self._tool_index = 0
        self._state = _ParserState.CONTENT
        self._thinking_checked = False

    @property
    def saw_tool_calls(self) -> bool:
        """Whether any tool calls have been parsed so far."""
        return self._tool_calls_emitted > 0

    def feed(self, chunk: str) -> StreamingParseResult:
        """Feed a token chunk and get any parseable results.

        Args:
            chunk: New token(s) from the model.

        Returns:
            StreamingParseResult with content and/or tool call deltas.
        """
        self._full_text += chunk

        if self._state == _ParserState.THINKING:
            return self._handle_thinking()

        # Check for thinking at start of stream (once)
        if not self._thinking_checked and self._state == _ParserState.CONTENT:
            think_result = self._check_thinking_start()
            if think_result is not None:
                return think_result

        if self._state == _ParserState.CONTENT:
            return self._handle_content()
        if self._state == _ParserState.IN_TOOL_CALL:
            return self._handle_tool_call()

        return StreamingParseResult()

    def flush(self) -> StreamingParseResult:
        """Flush remaining buffered content after stream ends."""
        if self._state == _ParserState.CONTENT:
            remaining = self._full_text[self._content_emitted_to :]
            self._content_emitted_to = len(self._full_text)
            if remaining:
                return StreamingParseResult(content_delta=remaining)
        elif self._state == _ParserState.IN_TOOL_CALL:
            return self._handle_tool_call()
        return StreamingParseResult()

    # ── Thinking Handling ───────────────────────────────────────────────

    def _check_thinking_start(self) -> StreamingParseResult | None:
        """Check for <think> tag at start of stream."""
        stripped = self._full_text.lstrip()

        # Definite <think> opening
        if stripped.startswith(THINK_OPEN):
            self._state = _ParserState.THINKING
            self._thinking_checked = True
            return StreamingParseResult(buffered=True)

        # Could be partial <think> (e.g., just "<thi" so far)
        if stripped and THINK_OPEN.startswith(stripped):
            return StreamingParseResult(buffered=True)

        # Not thinking — proceed normally
        self._thinking_checked = True
        return None

    def _handle_thinking(self) -> StreamingParseResult:
        """Buffer until </think> is found, then switch to content."""
        if THINK_CLOSE in self._full_text:
            idx = self._full_text.index(THINK_CLOSE) + len(THINK_CLOSE)
            self._full_text = self._full_text[idx:]
            self._content_emitted_to = 0
            self._state = _ParserState.CONTENT
            return self._handle_content()
        return StreamingParseResult(buffered=True)

    # ── Content Handling ────────────────────────────────────────────────

    def _handle_content(self) -> StreamingParseResult:
        """Emit content tokens, watching for tool call start."""
        text = self._full_text

        # Check for complete tool call opening tag
        tc_pos = text.find(TOOL_CALL_OPEN)
        if tc_pos >= 0:
            # Emit any remaining content before the tool call
            new_content = text[self._content_emitted_to : tc_pos]
            self._content_emitted_to = tc_pos
            self._state = _ParserState.IN_TOOL_CALL

            result = StreamingParseResult(
                content_delta=new_content.rstrip() if new_content.strip() else None,
            )
            tool_deltas = self._parse_new_invokes()
            if tool_deltas:
                result.tool_call_deltas = tool_deltas
            return result

        # No tool call yet — emit content up to the safe boundary
        safe_end = self._find_safe_content_end(text)
        new_content = text[self._content_emitted_to : safe_end]
        self._content_emitted_to = safe_end

        if new_content:
            return StreamingParseResult(content_delta=new_content)
        return StreamingParseResult(buffered=safe_end < len(text))

    def _find_safe_content_end(self, text: str) -> int:
        """Find position up to which content can be safely emitted.

        Avoids emitting characters that could be the start of a
        ``<minimax:tool_call>`` or ``<think>`` tag.
        """
        max_tag_len = len(TOOL_CALL_OPEN)  # longest sentinel tag
        search_start = max(
            len(text) - max_tag_len, self._content_emitted_to,
        )

        for i in range(len(text) - 1, search_start - 1, -1):
            if text[i] == "<":
                suffix = text[i:]
                if any(
                    tag.startswith(suffix)
                    for tag in (
                        TOOL_CALL_OPEN, TOOL_CALL_CLOSE,
                        THINK_OPEN, THINK_CLOSE,
                    )
                ):
                    return i
                # '<' doesn't match any sentinel prefix — safe to emit
                break
        return len(text)

    # ── Tool Call Handling ───────────────────────────────────────────────

    def _handle_tool_call(self) -> StreamingParseResult:
        """Parse complete invokes inside <minimax:tool_call> block."""
        tool_deltas = self._parse_new_invokes()

        if TOOL_CALL_CLOSE in self._full_text:
            self._state = _ParserState.DONE

        if tool_deltas:
            return StreamingParseResult(tool_call_deltas=tool_deltas)
        return StreamingParseResult(buffered=True)

    def _parse_new_invokes(self) -> list[ToolCallDelta] | None:
        """Parse any complete <invoke> blocks not yet emitted."""
        tc_start = self._full_text.find(TOOL_CALL_OPEN)
        if tc_start < 0:
            return None

        search_text = self._full_text[tc_start:]
        all_invokes = list(INVOKE_RE.finditer(search_text))
        new_invokes = all_invokes[self._tool_calls_emitted :]
        if not new_invokes:
            return None

        deltas: list[ToolCallDelta] = []
        for invoke_match in new_invokes:
            func_name = invoke_match.group(1).strip().strip('"')
            invoke_body = invoke_match.group(2)

            params: dict[str, Any] = {}
            for param_match in PARAM_RE.finditer(invoke_body):
                param_name = param_match.group(1).strip().strip('"')
                param_value_str = param_match.group(2)
                param_schema = _get_param_schema(
                    self._tools, func_name, param_name,
                )
                params[param_name] = convert_param_value(
                    param_value_str, param_schema,
                )

            deltas.append(ToolCallDelta(
                index=self._tool_index,
                id=_generate_call_id(),
                name=func_name,
                arguments_delta=json.dumps(params),
            ))
            self._tool_index += 1
            self._tool_calls_emitted += 1

        return deltas if deltas else None


# ─── Stream Wrapping ────────────────────────────────────────────────────────


async def wrap_stream_with_tool_parsing(
    token_stream: AsyncIterator[str],
    tools: list[dict[str, Any]] | None = None,
) -> AsyncIterator[StreamChunk]:
    """Wrap a token stream with MiniMax XML tool call parsing.

    Converts a raw string token stream into StreamChunk objects.
    When ``<minimax:tool_call>`` XML is detected, it is parsed and emitted
    as structured ToolCallDelta objects instead of raw XML text.

    When no tool calls are present, all tokens pass through as content.

    Args:
        token_stream: Raw token stream from the inference engine.
        tools: Tool definitions for parameter type coercion.

    Yields:
        StreamChunk objects with either content or tool call data.
    """
    parser = StreamingToolParser(tools=tools)

    async for token in token_stream:
        result = parser.feed(token)

        if result.content_delta:
            yield StreamChunk(content=result.content_delta)

        if result.tool_call_deltas:
            for delta in result.tool_call_deltas:
                yield StreamChunk(tool_call_delta=delta)

    # Flush remaining buffered content
    result = parser.flush()
    if result.content_delta:
        yield StreamChunk(content=result.content_delta)
    if result.tool_call_deltas:
        for delta in result.tool_call_deltas:
            yield StreamChunk(tool_call_delta=delta)
