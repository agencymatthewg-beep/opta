"""Tests for context window management (inference/context.py)."""

from __future__ import annotations

from opta_lmx.inference.context import (
    _estimate_content_part,
    estimate_conversation_tokens,
    estimate_message_tokens,
    estimate_tokens,
    fit_to_context,
)
from opta_lmx.inference.schema import (
    ChatMessage,
    FunctionCall,
    ImageContentPart,
    ImageUrlDetail,
    TextContentPart,
    ToolCall,
)


# ─── estimate_tokens ─────────────────────────────────────────────────────────


class TestEstimateTokens:
    def test_basic_string(self) -> None:
        assert estimate_tokens("Hello world") == 2  # 11 chars / 4

    def test_empty_string(self) -> None:
        assert estimate_tokens("") == 1  # max(1, 0)

    def test_short_string(self) -> None:
        assert estimate_tokens("ab") == 1  # max(1, 0)

    def test_long_string(self) -> None:
        text = "a" * 400
        assert estimate_tokens(text) == 100


# ─── estimate_message_tokens ─────────────────────────────────────────────────


class TestEstimateMessageTokens:
    def test_string_content(self) -> None:
        msg = ChatMessage(role="user", content="Hello world")
        tokens = estimate_message_tokens(msg)
        assert tokens == 4 + 2  # overhead + content

    def test_none_content(self) -> None:
        msg = ChatMessage(role="assistant", content=None)
        assert estimate_message_tokens(msg) == 4  # overhead only

    def test_multimodal_content(self) -> None:
        msg = ChatMessage(
            role="user",
            content=[
                TextContentPart(text="Describe this image"),
                ImageContentPart(image_url=ImageUrlDetail(url="data:image/png;base64,abc")),
            ],
        )
        tokens = estimate_message_tokens(msg)
        # 4 overhead + text tokens + 765 (auto detail image)
        text_tokens = estimate_tokens("Describe this image")
        assert tokens == 4 + text_tokens + 765

    def test_with_tool_calls(self) -> None:
        msg = ChatMessage(
            role="assistant",
            content="",
            tool_calls=[
                ToolCall(
                    id="call_1",
                    function=FunctionCall(name="read_file", arguments='{"path": "foo.py"}'),
                ),
            ],
        )
        tokens = estimate_message_tokens(msg)
        # 4 overhead + content("" -> 1 token) + read_file tokens + arguments tokens + 4 structural
        content_tokens = estimate_tokens("")  # 1 (min 1)
        name_tokens = estimate_tokens("read_file")
        args_tokens = estimate_tokens('{"path": "foo.py"}')
        assert tokens == 4 + content_tokens + name_tokens + args_tokens + 4

    def test_multiple_tool_calls(self) -> None:
        msg = ChatMessage(
            role="assistant",
            content=None,
            tool_calls=[
                ToolCall(id="c1", function=FunctionCall(name="fn_a", arguments="{}")),
                ToolCall(id="c2", function=FunctionCall(name="fn_b", arguments='{"x":1}')),
            ],
        )
        tokens = estimate_message_tokens(msg)
        assert tokens > 4  # overhead + tool tokens


# ─── _estimate_content_part ──────────────────────────────────────────────────


class TestEstimateContentPart:
    def test_text_part(self) -> None:
        part = TextContentPart(text="Hello world")
        assert _estimate_content_part(part) == estimate_tokens("Hello world")

    def test_image_low_detail(self) -> None:
        part = ImageContentPart(
            image_url=ImageUrlDetail(url="https://example.com/img.png", detail="low"),
        )
        assert _estimate_content_part(part) == 85

    def test_image_high_detail(self) -> None:
        part = ImageContentPart(
            image_url=ImageUrlDetail(url="https://example.com/img.png", detail="high"),
        )
        assert _estimate_content_part(part) == 765

    def test_image_auto_detail(self) -> None:
        part = ImageContentPart(
            image_url=ImageUrlDetail(url="data:image/png;base64,abc"),
        )
        assert _estimate_content_part(part) == 765  # auto defaults to high


# ─── estimate_conversation_tokens ────────────────────────────────────────────


class TestEstimateConversationTokens:
    def test_empty_conversation(self) -> None:
        assert estimate_conversation_tokens([]) == 3  # overhead only

    def test_basic_conversation(self) -> None:
        msgs = [
            ChatMessage(role="system", content="You are helpful."),
            ChatMessage(role="user", content="Hi"),
        ]
        total = estimate_conversation_tokens(msgs)
        expected = sum(estimate_message_tokens(m) for m in msgs) + 3
        assert total == expected


# ─── fit_to_context ──────────────────────────────────────────────────────────


class TestFitToContext:
    def test_empty_messages(self) -> None:
        assert fit_to_context([], 1000) == []

    def test_already_fits(self) -> None:
        msgs = [
            ChatMessage(role="user", content="Hi"),
            ChatMessage(role="assistant", content="Hello"),
        ]
        result = fit_to_context(msgs, 10000)
        assert result == msgs

    def test_preserves_system_and_last(self) -> None:
        msgs = [
            ChatMessage(role="system", content="System prompt"),
            ChatMessage(role="user", content="First message " * 50),
            ChatMessage(role="assistant", content="Response " * 50),
            ChatMessage(role="user", content="Second message " * 50),
            ChatMessage(role="assistant", content="Response " * 50),
            ChatMessage(role="user", content="Latest question"),
        ]
        # Use a very small budget so middle messages get trimmed
        result = fit_to_context(msgs, 50)
        # System message should be first
        assert result[0].role == "system"
        assert result[0].content == "System prompt"
        # Last message should be preserved
        assert result[-1].content == "Latest question"
        # Some middle messages should have been dropped
        assert len(result) < len(msgs)

    def test_reserves_output_tokens(self) -> None:
        msgs = [
            ChatMessage(role="system", content="System"),
            ChatMessage(role="user", content="Hello " * 100),
            ChatMessage(role="assistant", content="World " * 100),
            ChatMessage(role="user", content="Question"),
        ]
        # Without reserve
        result_no_reserve = fit_to_context(msgs, 200, reserve_for_output=0)
        # With reserve — should trim more aggressively
        result_with_reserve = fit_to_context(msgs, 200, reserve_for_output=100)
        assert len(result_with_reserve) <= len(result_no_reserve)

    def test_zero_budget_returns_last_message(self) -> None:
        msgs = [
            ChatMessage(role="user", content="Question"),
            ChatMessage(role="assistant", content="Answer"),
        ]
        result = fit_to_context(msgs, 0, reserve_for_output=100)
        assert len(result) == 1
        assert result[0] == msgs[-1]

    def test_all_system_messages_returned(self) -> None:
        msgs = [
            ChatMessage(role="system", content="Rule 1"),
            ChatMessage(role="system", content="Rule 2"),
        ]
        result = fit_to_context(msgs, 5)
        assert result == msgs

    def test_trims_oldest_middle_first(self) -> None:
        """Newest middle messages should be kept over oldest."""
        msgs = [
            ChatMessage(role="system", content="Sys"),
            ChatMessage(role="user", content="Old " * 30),
            ChatMessage(role="assistant", content="Old reply " * 30),
            ChatMessage(role="user", content="Recent"),
            ChatMessage(role="assistant", content="Recent reply"),
            ChatMessage(role="user", content="Latest"),
        ]
        result = fit_to_context(msgs, 60)
        contents = [m.content for m in result]
        # "Latest" (tail) should always be there
        assert "Latest" in contents
        # If trimmed, "Recent" should survive over "Old..."
        if len(result) > 2:
            # Check recent messages are kept
            mid_contents = [m.content for m in result[1:-1]]
            # Old messages should be dropped first
            assert not any(c and c.startswith("Old ") for c in mid_contents)
