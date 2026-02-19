# MiniMax XML Tool Call Parser — Hybrid A+C Implementation

**Date:** 2026-02-17
**Author:** Opta Max
**Project:** Opta-LMX (`~/Synced/Opta/1-Apps/1J-Opta-LMX/`)
**Priority:** High — enables OpenClaw tool calling through local M2.5 inference

---

## Context

MiniMax M2.5 emits tool calls in a proprietary XML format instead of OpenAI-style JSON `tool_calls`:

```xml
<minimax:tool_call>
<invoke name="get_weather">
<parameter name="location">San Francisco</parameter>
<parameter name="unit">celsius</parameter>
</invoke>
</minimax:tool_call>
```

Currently, Opta-LMX passes raw model output as `content` string. Consumers (OpenClaw bots, Opta CLI) receive the XML as plain text, causing:
1. OpenClaw can't execute tool calls from local M2.5
2. Opta CLI ThinkingRenderer has to strip `<minimax:tool_call>` XML client-side (hacky)
3. No OpenAI-compatible `tool_calls` array in responses

### Hybrid A+C Approach

- **A (Server-side parsing):** Parse XML → OpenAI `tool_calls` format in responses
- **C (Streaming-aware):** Handle streaming SSE where XML arrives in chunks across multiple tokens

This makes Opta-LMX a transparent compatibility layer — any OpenAI-compatible client gets proper tool calls from M2.5 without custom parsing.

---

## Reference Implementation

vLLM's `MinimaxM2ToolParser` (Apache 2.0, ~600 lines) handles both streaming and non-streaming. Key patterns:

- **Sentinel tokens:** `<minimax:tool_call>`, `</minimax:tool_call>`, `<invoke name=`, `</invoke>`, `<parameter name=`, `</parameter>`
- **Regex parsing for non-streaming:** Three nested regexes extract tool_call blocks → invoke blocks → parameter blocks
- **Streaming state machine:** Tracks `is_tool_call_started`, `in_function`, `in_param`, `current_tool_index` etc.
- **Type coercion:** Converts param values using tool schema types (supports `anyOf`, `oneOf`, arrays, nested objects)
- **Content before tool calls preserved:** Text before `<minimax:tool_call>` stays in `content`

### M2.5 Quirks to Handle

1. **Thinking tags interleaved:** Output may start with `<think>...</think>` then tool calls
2. **Multiple invokes in one block:** Can call 2+ tools in a single `<minimax:tool_call>` block
3. **Streaming: no opening `<think>` tag:** M2.5 starts streaming reasoning immediately, only `</think>` marks boundary
4. **Parameter types from tool schema:** String values like `["keyword1"]` must be parsed as arrays if schema says `type: "array"`

---

## Implementation Plan

### Phase 1: Core Parser Module (`src/opta_lmx/inference/tool_parser.py`)

Create a new module with:

```python
# New file: src/opta_lmx/inference/tool_parser.py
```

**Classes/Functions:**

1. **`MiniMaxToolParser`** — Main parser class
   - `parse_tool_calls(text: str, tools: list[dict] | None) -> ParsedOutput`
     - Returns `ParsedOutput(content: str | None, tool_calls: list[ToolCall] | None, has_tool_calls: bool)`
   - `create_streaming_parser(tools: list[dict] | None) -> StreamingToolParser`

2. **`StreamingToolParser`** — Stateful streaming parser
   - `feed(chunk: str) -> StreamingParseResult`
     - Returns `StreamingParseResult(content_delta: str | None, tool_call_deltas: list[ToolCallDelta] | None, buffered: bool)`
   - `flush() -> StreamingParseResult`
   - Internal state machine tracking:
     - `_buffer: str` — accumulated unparsed text
     - `_state: ParserState` — enum: `CONTENT`, `TOOL_CALL_STARTED`, `IN_INVOKE`, `IN_PARAM`
     - `_current_invoke_name: str | None`
     - `_current_param_name: str | None`
     - `_current_param_value: str`
     - `_accumulated_params: dict`
     - `_tool_index: int`

3. **`convert_param_value(value: str, schema: dict | None) -> Any`** — Type coercion
   - Handle: string, integer, number, boolean, object, array, null
   - Support `anyOf`/`oneOf` schemas (extract types, try in priority order)
   - JSON parse fallback for untyped params

4. **Data classes:**
   ```python
   @dataclass
   class ParsedToolCall:
       id: str  # "call_<uuid>"
       name: str
       arguments: str  # JSON string (OpenAI format)

   @dataclass
   class ParsedOutput:
       content: str | None
       tool_calls: list[ParsedToolCall] | None
       has_tool_calls: bool

   @dataclass
   class ToolCallDelta:
       index: int
       id: str | None  # Only on first chunk
       name: str | None  # Only on first chunk
       arguments_delta: str  # Incremental JSON string
   ```

**Regex patterns (compile once at module level):**
```python
TOOL_CALL_BLOCK_RE = re.compile(r"<minimax:tool_call>(.*?)</minimax:tool_call>", re.DOTALL)
INVOKE_RE = re.compile(r'<invoke name=([^>]+)>(.*?)</invoke>', re.DOTALL)
PARAM_RE = re.compile(r'<parameter name=([^>]+)>(.*?)</parameter>', re.DOTALL)
```

### Phase 2: Integrate into Engine (`src/opta_lmx/inference/engine.py`)

**Non-streaming (`generate()`):**

After getting raw `content` from vllm-mlx, check for `<minimax:tool_call>`:

```python
from opta_lmx.inference.tool_parser import MiniMaxToolParser

# After getting content from model:
if tools and "<minimax:tool_call>" in content:
    parser = MiniMaxToolParser()
    parsed = parser.parse_tool_calls(content, tools)
    if parsed.has_tool_calls:
        return ChatCompletionResponse(
            ...,
            choices=[Choice(
                index=0,
                message=ResponseMessage(
                    role="assistant",
                    content=parsed.content,  # Text before tool calls (or None)
                    tool_calls=[
                        ToolCall(
                            id=tc.id,
                            type="function",
                            function=FunctionCall(name=tc.name, arguments=tc.arguments)
                        ) for tc in parsed.tool_calls
                    ],
                ),
                finish_reason="tool_calls",
            )],
            ...
        )
```

**Streaming (`stream_generate()`):**

Wrap the token stream with a parsing layer when `tools` is provided:

```python
async def stream_generate(self, ..., tools=None) -> AsyncIterator[str]:
    # ... existing code to get raw token stream ...

    if tools:
        # Use streaming parser to intercept tool call XML
        yield from self._tool_parsed_stream(raw_stream, tools)
    else:
        # Pass through directly (no tool parsing overhead)
        async for delta in raw_stream:
            yield delta
```

The streaming parser should:
1. Buffer tokens when `<minimax:tool_call` is detected mid-stream
2. Yield content tokens that appear before tool calls
3. Once a complete `<invoke>...</invoke>` is parsed, yield structured tool call data
4. The SSE formatter (Phase 3) converts this to proper streaming tool call chunks

### Phase 3: Update SSE Streaming (`src/opta_lmx/inference/streaming.py`)

Currently `format_sse_stream` treats all yields as content deltas. Update to support tool call deltas:

**Option A (Recommended — Typed stream):** Change the token stream to yield `StreamChunk` objects:

```python
@dataclass
class StreamChunk:
    """A chunk in a streaming response."""
    content: str | None = None
    tool_call: ToolCallDelta | None = None
    finish: bool = False
```

Then `format_sse_stream` emits proper `delta.tool_calls` in SSE chunks:

```json
{"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "call_abc", "type": "function", "function": {"name": "get_weather", "arguments": ""}}]}}]}
{"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"location\":"}}]}}]}
{"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": " \"San Francisco\"}"}}]}}]}
```

This matches OpenAI's streaming tool call format exactly.

### Phase 4: Update Schema (`src/opta_lmx/inference/schema.py`)

The schema already has `ToolCall`, `FunctionCall`, `DeltaMessage.tool_calls`, and `ResponseMessage.tool_calls` defined. Verify:
- `DeltaMessage.tool_calls` supports incremental function arguments
- `Choice.finish_reason` can be `"tool_calls"` (not just `"stop"`)
- No changes needed if schema is already correct (it appears to be ✅)

### Phase 5: Think Tag Stripping

The parser should also strip `<think>...</think>` blocks from content:
- If output starts with thinking then has tool calls, strip thinking from content
- Optionally: expose thinking in a separate field (future: `reasoning_content`)
- At minimum: don't leak `<think>` tags into `content` or `arguments`

```python
THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

def strip_thinking(text: str) -> str:
    """Remove think blocks. Also handle no-opening-tag pattern."""
    # Pattern 1: <think>...</think>
    text = THINK_RE.sub("", text)
    # Pattern 2: content starts immediately, </think> appears later
    if "</think>" in text:
        text = text[text.index("</think>") + 8:]
    return text.strip()
```

### Phase 6: Tests (`tests/test_tool_parser.py`)

Create comprehensive tests:

```python
# tests/test_tool_parser.py — Target: 25+ tests
```

**Test categories:**

1. **Non-streaming parsing (8 tests):**
   - Single tool call extraction
   - Multiple invokes in one block
   - Content before + after tool calls
   - Type coercion: string, int, float, bool, array, object, null
   - Nested `anyOf`/`oneOf` schema type resolution
   - No tool calls → returns original content
   - Malformed XML → graceful fallback (return as content)
   - Tool calls with thinking blocks interleaved

2. **Streaming parsing (8 tests):**
   - Tool call XML split across multiple chunks
   - Content before tool call in same chunk
   - Multiple tools streamed sequentially
   - Partial `<minimax:tool_call` at chunk boundary
   - `flush()` returns remaining buffered content
   - Parameter value split across chunks
   - Mixed content + tool call chunks

3. **Type coercion (5 tests):**
   - `convert_param_value("42", {"type": "integer"})` → `42`
   - `convert_param_value('["a","b"]', {"type": "array"})` → `["a", "b"]`
   - `convert_param_value("null", {"type": "string"})` → `None`
   - `anyOf` with `[{"type": "string"}, {"type": "null"}]`
   - JSON fallback for unknown types

4. **Integration (4+ tests):**
   - Full `engine.generate()` with tools → returns `tool_calls` in response
   - Full SSE stream with tool call → proper `delta.tool_calls` chunks
   - No tools provided → raw passthrough (no parsing overhead)
   - Think tags stripped before tool parsing

### Phase 7: Configuration

Add optional config to enable/disable tool parsing per-model:

```yaml
# In config.yaml
tool_parsing:
  enabled: true  # Default: true when tools in request
  parsers:
    minimax: true  # Auto-detect MiniMax XML format
    # Future: hermes, llama, generic-json
```

For now, auto-detect is sufficient: if `<minimax:tool_call>` appears in output and `tools` were in the request, parse it. No config needed for v1.

### Phase 8: Documentation

Update `docs/` with:
- `docs/tool-calling.md` — How tool calling works in Opta-LMX
- Note in README about MiniMax M2.5 tool call compatibility
- Example curl commands showing tool calls

---

## File Changes Summary

| File | Action | ~Lines |
|------|--------|--------|
| `src/opta_lmx/inference/tool_parser.py` | **NEW** | ~350 |
| `src/opta_lmx/inference/engine.py` | MODIFY | +40 |
| `src/opta_lmx/inference/streaming.py` | MODIFY | +60 |
| `src/opta_lmx/inference/schema.py` | VERIFY (likely no changes) | 0 |
| `tests/test_tool_parser.py` | **NEW** | ~400 |
| `docs/tool-calling.md` | **NEW** | ~80 |
| **Total** | | ~930 |

## Verification Checklist

After implementation, verify:

- [ ] `pytest tests/test_tool_parser.py -v` — All tests pass
- [ ] `pytest tests/ -v` — Existing 77 tests still pass (no regressions)
- [ ] Non-streaming: `curl -X POST http://localhost:1234/v1/chat/completions` with tools → response has `tool_calls` array
- [ ] Streaming: Same request with `"stream": true` → SSE chunks have `delta.tool_calls`
- [ ] No tools in request → raw content passthrough (no performance cost)
- [ ] Content before tool call preserved in `content` field
- [ ] `finish_reason` is `"tool_calls"` when tools are called, `"stop"` otherwise
- [ ] Think tags (`<think>...</think>`) stripped from content and arguments
- [ ] Type coercion works for all JSON schema types

## Architecture Notes

- **Zero external dependencies** — Uses only `re`, `json`, `uuid`, `dataclasses` from stdlib
- **Lazy activation** — Parser only instantiated when `tools` present in request AND `<minimax:tool_call>` detected in output
- **Future extensible** — `tool_parser.py` can support other XML/JSON formats (Hermes, Llama) by adding parser classes
- **Editable install** — Changes to `tool_parser.py` are live immediately on Mono512 (no restart needed for request-path code)
- **Import-level change to engine.py** — Will need server restart after modifying `engine.py` imports

## References

- [MiniMax M2 Tool Calling Guide](https://huggingface.co/MiniMaxAI/MiniMax-M2/blob/main/docs/tool_calling_guide.md)
- [vLLM MinimaxM2ToolParser source](https://github.com/vllm-project/vllm/blob/main/vllm/tool_parsers/minimax_m2_tool_parser.py) (Apache 2.0)
- [vLLM MiniMax deployment guide](https://docs.vllm.ai/projects/recipes/en/latest/MiniMax/MiniMax-M2.html)
- [OpenAI tool calling streaming format](https://platform.openai.com/docs/api-reference/chat/create)
