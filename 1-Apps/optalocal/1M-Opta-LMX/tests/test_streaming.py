"""Tests for SSE streaming format utilities."""

from __future__ import annotations

import json

import pytest

from opta_lmx.inference.streaming import format_sse_stream, format_sse_tool_stream
from opta_lmx.inference.tool_parser import StreamChunk, ToolCallDelta


async def _async_tokens(*tokens: str):
    """Helper: async generator yielding tokens."""
    for t in tokens:
        yield t


async def _async_chunks(*chunks: StreamChunk):
    """Helper: async generator yielding StreamChunks."""
    for c in chunks:
        yield c


class TestFormatSSEStream:
    """Tests for plain text SSE streaming."""

    @pytest.mark.asyncio
    async def test_emits_role_chunk_first(self) -> None:
        """First chunk sets role=assistant."""
        chunks = []
        async for line in format_sse_stream(_async_tokens(), "req-1", "test-model"):
            chunks.append(line)

        # First chunk is the role chunk
        first = json.loads(chunks[0].removeprefix("data: ").strip())
        assert first["choices"][0]["delta"]["role"] == "assistant"
        assert first["model"] == "test-model"
        assert first["id"] == "req-1"

    @pytest.mark.asyncio
    async def test_emits_content_chunks(self) -> None:
        """Content tokens are emitted as SSE data lines."""
        chunks = []
        async for line in format_sse_stream(_async_tokens("Hello", " World"), "req-1", "m"):
            chunks.append(line)

        # role + 2 content + final + [DONE] = 5
        assert len(chunks) == 5

        content1 = json.loads(chunks[1].removeprefix("data: ").strip())
        assert content1["choices"][0]["delta"]["content"] == "Hello"

        content2 = json.loads(chunks[2].removeprefix("data: ").strip())
        assert content2["choices"][0]["delta"]["content"] == " World"

    @pytest.mark.asyncio
    async def test_final_chunk_has_finish_reason_stop(self) -> None:
        """Final chunk has finish_reason=stop."""
        chunks = []
        async for line in format_sse_stream(_async_tokens("hi"), "req-1", "m"):
            chunks.append(line)

        # Second to last is the final chunk
        final = json.loads(chunks[-2].removeprefix("data: ").strip())
        assert final["choices"][0]["finish_reason"] == "stop"

    @pytest.mark.asyncio
    async def test_ends_with_done_sentinel(self) -> None:
        """Stream ends with data: [DONE]."""
        chunks = []
        async for line in format_sse_stream(_async_tokens(), "req-1", "m"):
            chunks.append(line)

        assert chunks[-1] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_handles_mid_stream_error(self) -> None:
        """Mid-stream error emits error content then finishes cleanly."""
        async def _failing_stream():
            yield "ok"
            raise RuntimeError("boom")

        chunks = []
        async for line in format_sse_stream(_failing_stream(), "req-1", "m"):
            chunks.append(line)

        # Should include error content chunk
        error_chunk = json.loads(chunks[2].removeprefix("data: ").strip())
        assert "[Error: boom]" in error_chunk["choices"][0]["delta"]["content"]

        # Should still end with [DONE]
        assert chunks[-1] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_choice_index_override_applies_to_all_chunks(self) -> None:
        """Custom choice index is propagated through role/content/final chunks."""
        chunks = []
        async for line in format_sse_stream(
            _async_tokens("x"),
            "req-1",
            "m",
            choice_index=3,
        ):
            chunks.append(line)

        first = json.loads(chunks[0].removeprefix("data: ").strip())
        middle = json.loads(chunks[1].removeprefix("data: ").strip())
        final = json.loads(chunks[-2].removeprefix("data: ").strip())
        assert first["choices"][0]["index"] == 3
        assert middle["choices"][0]["index"] == 3
        assert final["choices"][0]["index"] == 3

    @pytest.mark.asyncio
    async def test_emit_done_false_suppresses_done_sentinel(self) -> None:
        """emit_done=False omits terminal [DONE] marker for composition."""
        chunks = []
        async for line in format_sse_stream(
            _async_tokens("x"),
            "req-1",
            "m",
            emit_done=False,
        ):
            chunks.append(line)
        assert all(line != "data: [DONE]\n\n" for line in chunks)

    @pytest.mark.asyncio
    async def test_logprobs_placeholder_can_be_injected(self) -> None:
        """Requested logprobs compatibility emits `choices[].logprobs: null`."""
        chunks = []
        async for line in format_sse_stream(
            _async_tokens("x"),
            "req-1",
            "m",
            include_logprobs_placeholder=True,
        ):
            chunks.append(line)

        data_lines = [line for line in chunks if line.startswith("data: {")]
        for line in data_lines:
            payload = json.loads(line.removeprefix("data: ").strip())
            for choice in payload.get("choices", []):
                assert "logprobs" in choice
                assert choice["logprobs"] is None


class TestFormatSSEToolStream:
    """Tests for SSE streaming with tool call support."""

    @pytest.mark.asyncio
    async def test_content_passthrough(self) -> None:
        """Content-only chunks pass through normally."""
        stream = _async_chunks(
            StreamChunk(content="Hello"),
            StreamChunk(content=" World"),
        )
        chunks = []
        async for line in format_sse_tool_stream(stream, "req-1", "m"):
            chunks.append(line)

        # role + 2 content + final + [DONE] = 5
        assert len(chunks) == 5
        c1 = json.loads(chunks[1].removeprefix("data: ").strip())
        assert c1["choices"][0]["delta"]["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_tool_call_delta(self) -> None:
        """Tool call deltas emit delta.tool_calls in SSE."""
        stream = _async_chunks(
            StreamChunk(tool_call_delta=ToolCallDelta(
                index=0, id="call-1", name="get_weather", arguments_delta='{"loc',
            )),
        )
        chunks = []
        async for line in format_sse_tool_stream(stream, "req-1", "m"):
            chunks.append(line)

        tc_chunk = json.loads(chunks[1].removeprefix("data: ").strip())
        tool_calls = tc_chunk["choices"][0]["delta"]["tool_calls"]
        assert len(tool_calls) == 1
        assert tool_calls[0]["index"] == 0
        assert tool_calls[0]["id"] == "call-1"
        assert tool_calls[0]["function"]["name"] == "get_weather"

    @pytest.mark.asyncio
    async def test_finish_reason_tool_calls(self) -> None:
        """finish_reason is 'tool_calls' when tool calls are present."""
        stream = _async_chunks(
            StreamChunk(tool_call_delta=ToolCallDelta(
                index=0, id="call-1", name="fn", arguments_delta="{}",
            )),
        )
        chunks = []
        async for line in format_sse_tool_stream(stream, "req-1", "m"):
            chunks.append(line)

        final = json.loads(chunks[-2].removeprefix("data: ").strip())
        assert final["choices"][0]["finish_reason"] == "tool_calls"

    @pytest.mark.asyncio
    async def test_finish_reason_stop_without_tools(self) -> None:
        """finish_reason is 'stop' when no tool calls are present."""
        stream = _async_chunks(StreamChunk(content="just text"))
        chunks = []
        async for line in format_sse_tool_stream(stream, "req-1", "m"):
            chunks.append(line)

        final = json.loads(chunks[-2].removeprefix("data: ").strip())
        assert final["choices"][0]["finish_reason"] == "stop"

    @pytest.mark.asyncio
    async def test_choice_index_override_applies_to_tool_chunks(self) -> None:
        """Tool stream respects a custom choice index in all emitted chunks."""
        stream = _async_chunks(StreamChunk(content="tool-text"))
        chunks = []
        async for line in format_sse_tool_stream(stream, "req-1", "m", choice_index=5):
            chunks.append(line)

        first = json.loads(chunks[0].removeprefix("data: ").strip())
        middle = json.loads(chunks[1].removeprefix("data: ").strip())
        final = json.loads(chunks[-2].removeprefix("data: ").strip())
        assert first["choices"][0]["index"] == 5
        assert middle["choices"][0]["index"] == 5
        assert final["choices"][0]["index"] == 5

    @pytest.mark.asyncio
    async def test_tool_stream_logprobs_placeholder_can_be_injected(self) -> None:
        """Tool-aware streaming also emits null logprobs placeholders when requested."""
        stream = _async_chunks(StreamChunk(content="tool-text"))
        chunks = []
        async for line in format_sse_tool_stream(
            stream,
            "req-1",
            "m",
            include_logprobs_placeholder=True,
        ):
            chunks.append(line)

        data_lines = [line for line in chunks if line.startswith("data: {")]
        for line in data_lines:
            payload = json.loads(line.removeprefix("data: ").strip())
            for choice in payload.get("choices", []):
                assert "logprobs" in choice
                assert choice["logprobs"] is None
