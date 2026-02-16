# OpenAI Chat Completions API — Complete Implementation Reference

**Research Date:** 2026-02-15  
**Purpose:** Document exactly what Opta-LMX needs to implement for OpenAI API compatibility  
**Target Clients:** OpenClaw bots, Opta CLI, LM Studio users, Ollama users

---

## Table of Contents

1. [POST /v1/chat/completions Request Schema](#1-post-v1chatcompletions-request-schema)
2. [POST /v1/chat/completions Response Schema](#2-post-v1chatcompletions-response-schema)
3. [SSE Streaming Format](#3-sse-streaming-format)
4. [Tool/Function Calling](#4-toolfunction-calling)
5. [GET /v1/models Response Format](#5-get-v1models-response-format)
6. [Error Response Format](#6-error-response-format)
7. [LM Studio Implementation](#7-lm-studio-implementation)
8. [Ollama Implementation](#8-ollama-implementation)
9. [OpenClaw Bot Usage Patterns](#9-openclaw-bot-usage-patterns)
10. [Opta CLI Usage Patterns](#10-opta-cli-usage-patterns)
11. [Implementation Priority Matrix](#11-implementation-priority-matrix)

---

## 1. POST /v1/chat/completions Request Schema

### Request Body (JSON)

```json
{
  "model": "string",                    // CRITICAL
  "messages": [...],                    // CRITICAL
  "temperature": 0.7,                   // CRITICAL
  "top_p": 1.0,                        // CRITICAL
  "max_tokens": null,                  // CRITICAL
  "stream": false,                     // CRITICAL
  "stop": null,                        // NICE-TO-HAVE
  "tools": [...],                      // CRITICAL (for function calling)
  "tool_choice": "auto",               // NICE-TO-HAVE
  "response_format": {...},            // NICE-TO-HAVE
  "seed": null,                        // NICE-TO-HAVE
  "frequency_penalty": 0.0,            // NICE-TO-HAVE
  "presence_penalty": 0.0,             // NICE-TO-HAVE
  "logit_bias": {},                    // IGNORE
  "user": "string",                    // IGNORE
  "n": 1,                              // IGNORE (multi-completions)
  "logprobs": false,                   // IGNORE
  "top_logprobs": null,                // IGNORE
  "service_tier": null,                // IGNORE
  "stream_options": {...}              // NICE-TO-HAVE
}
```

### Parameter Details

#### **CRITICAL Parameters** (Break clients if missing/incorrect)

##### `model` (string, required)
- Model identifier (e.g., `"gpt-4"`, `"llama-3.2"`)
- **Must** validate and return error if model doesn't exist
- Case-sensitive

##### `messages` (array, required)
Array of message objects. Each message has:
```json
{
  "role": "user" | "assistant" | "system" | "tool" | "developer",
  "content": "string" | [...],  // string OR array of content parts
  "name": "optional-string",    // participant name
  "tool_calls": [...],          // only for assistant role
  "tool_call_id": "string"      // only for tool role
}
```

**Content variations:**
1. **Simple text:** `"content": "Hello"`
2. **Text + image (multimodal):**
```json
"content": [
  { "type": "text", "text": "What's in this image?" },
  { 
    "type": "image_url", 
    "image_url": {
      "url": "https://..." | "data:image/png;base64,...",
      "detail": "auto" | "low" | "high"  // optional
    }
  }
]
```
3. **Audio input:**
```json
"content": [
  { "type": "text", "text": "..." },
  {
    "type": "input_audio",
    "input_audio": {
      "data": "base64-encoded-audio",
      "format": "wav" | "mp3"
    }
  }
]
```

**Role types:**
- `system`: Instructions for model behavior
- `developer`: New role replacing system for o1+ models (treat as system if not supported)
- `user`: User messages
- `assistant`: Model responses (may include `tool_calls`)
- `tool`: Tool execution results (requires `tool_call_id`)

##### `temperature` (number, 0-2, default: 1.0)
- Sampling temperature
- 0 = deterministic, 2 = very random
- **Must** clamp to [0, 2] range

##### `top_p` (number, 0-1, default: 1.0)
- Nucleus sampling parameter
- Alternative to temperature
- **Must** clamp to [0, 1] range

##### `max_tokens` (integer | null, optional)
- Maximum tokens to generate
- If `null`, use model's natural limit
- **Must** respect model's context limit

##### `stream` (boolean, default: false)
- If `true`, return SSE stream
- If `false`, return complete JSON response
- **Must** handle both modes correctly

##### `tools` (array, optional but critical for tool use)
Array of tool definitions for function calling:
```json
[
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get current weather for a location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City name"
          },
          "unit": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"]
          }
        },
        "required": ["location"]
      }
    }
  }
]
```

#### **NICE-TO-HAVE Parameters** (Can return defaults)

##### `tool_choice` (string | object, default: "auto")
- `"auto"`: Model decides
- `"none"`: No tools
- `"required"`: Must call a tool
- `{"type": "function", "function": {"name": "..."}}`: Force specific tool

##### `response_format` (object, optional)
```json
{
  "type": "text" | "json_object" | "json_schema"
}
```
- `text`: Normal text response (default)
- `json_object`: Valid JSON (no schema enforcement)
- `json_schema`: Structured output with schema (advanced)

##### `seed` (integer, optional)
- For reproducible outputs
- If provided, return same `system_fingerprint` for deterministic results

##### `stop` (string | array, optional)
- Stop sequences (up to 4)
- Example: `"stop": ["END", "\n\n"]`

##### `frequency_penalty` (number, -2 to 2, default: 0)
- Penalize token frequency
- Positive = reduce repetition

##### `presence_penalty` (number, -2 to 2, default: 0)
- Penalize token presence
- Positive = encourage new topics

##### `stream_options` (object, optional)
```json
{
  "include_usage": true  // Include token usage in final stream chunk
}
```

#### **IGNORE Parameters** (OpenAI-specific, can ignore)

- `logit_bias`: Token probability manipulation
- `user`: User tracking ID
- `n`: Number of completions (we only support 1)
- `logprobs`: Log probabilities
- `top_logprobs`: Top K log probs
- `service_tier`: OpenAI pricing tiers

---

## 2. POST /v1/chat/completions Response Schema

### Non-Streaming Response (JSON)

```json
{
  "id": "chatcmpl-123",                      // CRITICAL
  "object": "chat.completion",               // CRITICAL
  "created": 1677652288,                     // CRITICAL (Unix timestamp)
  "model": "gpt-4",                          // CRITICAL
  "choices": [                               // CRITICAL
    {
      "index": 0,                            // CRITICAL
      "message": {                           // CRITICAL
        "role": "assistant",                 // CRITICAL
        "content": "Hello! How can I help?", // CRITICAL (can be null if tool_calls)
        "tool_calls": [...],                 // CRITICAL (if tools used)
        "refusal": null                      // NICE-TO-HAVE
      },
      "finish_reason": "stop",               // CRITICAL
      "logprobs": null                       // IGNORE
    }
  ],
  "usage": {                                 // NICE-TO-HAVE
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30,
    "completion_tokens_details": {...},      // IGNORE
    "prompt_tokens_details": {...}           // IGNORE
  },
  "system_fingerprint": "fp_123"             // NICE-TO-HAVE
}
```

### Field Details

#### **CRITICAL Fields**

##### `id` (string)
- Unique completion ID
- Format: `"chatcmpl-" + random_id`
- Example: `"chatcmpl-9x7K2Lv3m4nP8qR0sT1uV2w"`

##### `object` (string)
- Always `"chat.completion"` (non-streaming)
- Always `"chat.completion.chunk"` (streaming)

##### `created` (integer)
- Unix timestamp (seconds since epoch)
- Example: `1677652288`

##### `model` (string)
- Echo back the model name from request
- Must match requested model

##### `choices` (array)
- Always single element for Opta-LMX (we don't support `n > 1`)
- Contains the completion result

##### `choices[0].index` (integer)
- Always `0` (since we only return 1 choice)

##### `choices[0].message` (object)
- **role**: Always `"assistant"`
- **content**: Generated text (can be `null` if `tool_calls` present)
- **tool_calls**: Array of tool calls (if model wants to call functions)

##### `choices[0].finish_reason` (string)
- **CRITICAL VALUES:**
  - `"stop"`: Natural completion
  - `"length"`: Hit max_tokens limit
  - `"tool_calls"`: Model requested tool execution
  - `"content_filter"`: Content policy violation (optional)
  - `"function_call"`: Deprecated, use `"tool_calls"` instead

#### **NICE-TO-HAVE Fields**

##### `usage` (object)
```json
{
  "prompt_tokens": 10,
  "completion_tokens": 20,
  "total_tokens": 30
}
```
- Token counts for billing/monitoring
- Can estimate from character count if tokenizer unavailable

##### `system_fingerprint` (string)
- Backend configuration identifier
- For reproducibility tracking with `seed`
- Can be model version or commit hash

---

## 3. SSE Streaming Format

### HTTP Headers
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Stream Format

Each line starts with `data: ` followed by JSON, ending with `\n\n`:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

```

### Streaming Response Structure

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion.chunk",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "delta": {                       // "delta" instead of "message"
        "role": "assistant",           // Only in first chunk
        "content": "Hello"             // Incremental text
      },
      "finish_reason": null            // null until final chunk
    }
  ]
}
```

### Streaming Lifecycle

1. **First chunk:** Contains `role` in delta
```json
{"delta": {"role": "assistant", "content": ""}, "finish_reason": null}
```

2. **Content chunks:** Incremental text
```json
{"delta": {"content": "Hello"}, "finish_reason": null}
{"delta": {"content": " world"}, "finish_reason": null}
```

3. **Final chunk:** Empty delta with finish_reason
```json
{"delta": {}, "finish_reason": "stop"}
```

4. **Optional usage chunk** (if `stream_options.include_usage: true`):
```json
{
  "choices": [],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

5. **Termination:** `data: [DONE]\n\n`

### Tool Call Streaming

When model calls a function:

```json
// Chunk 1: Start tool call
{"delta": {"tool_calls": [{"index": 0, "id": "call_abc", "type": "function", "function": {"name": "get_weather", "arguments": ""}}]}}

// Chunk 2-N: Stream arguments
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"loc"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "ation\":"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"NYC\"}"}}]}}

// Final chunk
{"delta": {}, "finish_reason": "tool_calls"}
```

**CRITICAL:** Accumulate tool call data by `index`. Each chunk may only contain partial JSON in `arguments`.

---

## 4. Tool/Function Calling

### Request Format

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "What's the weather in NYC?"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"},
            "unit": {"type": "string", "enum": ["c", "f"]}
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Response with Tool Call

```json
{
  "id": "chatcmpl-123",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"NYC\",\"unit\":\"f\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### Sending Tool Results Back

Client executes the function and sends result:

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "What's the weather in NYC?"},
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"location\":\"NYC\",\"unit\":\"f\"}"
        }
      }]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"temperature\": 72, \"condition\": \"sunny\"}"
    }
  ]
}
```

### Tool Call Flow

1. **User asks question**
2. **Model responds with `tool_calls`** (finish_reason: `"tool_calls"`)
3. **Client executes function(s)**
4. **Client sends conversation + tool results**
5. **Model generates final answer** (finish_reason: `"stop"`)

---

## 5. GET /v1/models Response Format

### Request
```http
GET /v1/models HTTP/1.1
Authorization: Bearer YOUR_API_KEY
```

### Response
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1686935002,
      "owned_by": "openai"
    },
    {
      "id": "llama-3.2",
      "object": "model",
      "created": 1704067200,
      "owned_by": "meta"
    }
  ]
}
```

### Field Details

- **object**: Always `"list"`
- **data**: Array of model objects
  - **id**: Model identifier (used in chat completions)
  - **object**: Always `"model"`
  - **created**: Unix timestamp (when model was added/modified)
  - **owned_by**: Organization name (e.g., `"openai"`, `"meta"`, `"library"`)

### Optional: GET /v1/models/{model}

```json
{
  "id": "gpt-4",
  "object": "model",
  "created": 1686935002,
  "owned_by": "openai"
}
```

---

## 6. Error Response Format

### HTTP Status Codes

| Code | Type | Meaning |
|------|------|---------|
| 400 | `invalid_request_error` | Bad request (missing params, invalid JSON) |
| 401 | `invalid_authentication` | Invalid API key |
| 403 | `permission_denied` | Valid key, but no access to resource |
| 404 | `not_found_error` | Model/resource doesn't exist |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_server_error` | Server error |
| 503 | `service_unavailable` | Server overloaded |

### Error Response Body

```json
{
  "error": {
    "message": "Invalid API key provided.",
    "type": "invalid_request_error",
    "param": "api_key",
    "code": "invalid_api_key"
  }
}
```

### Field Details

- **message** (string, required): Human-readable error description
- **type** (string, required): Error category (see table above)
- **param** (string, optional): Which parameter caused the error
- **code** (string, optional): Specific error code

### Common Error Scenarios

#### Invalid Model
```json
{
  "error": {
    "message": "The model `invalid-model` does not exist",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

#### Missing Required Field
```json
{
  "error": {
    "message": "Missing required parameter: 'messages'",
    "type": "invalid_request_error",
    "param": "messages",
    "code": null
  }
}
```

#### Context Length Exceeded
```json
{
  "error": {
    "message": "This model's maximum context length is 4096 tokens. However, your messages resulted in 5000 tokens.",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "context_length_exceeded"
  }
}
```

---

## 7. LM Studio Implementation

### What LM Studio Supports

#### Endpoints
- ✅ `/v1/models` (GET)
- ✅ `/v1/chat/completions` (POST)
- ✅ `/v1/completions` (POST) — legacy
- ✅ `/v1/embeddings` (POST)
- ✅ `/v1/responses` (POST) — Codex support

#### Parameters Supported
- ✅ `model`, `messages`, `temperature`, `top_p`, `max_tokens`
- ✅ `stream`, `stop`
- ✅ `presence_penalty`, `frequency_penalty`
- ✅ `logit_bias` (partial)
- ✅ `repeat_penalty` (custom parameter)
- ✅ `seed`
- ❌ `tools` / `tool_choice` — **NO FUNCTION CALLING**
- ❌ `logprobs`
- ❌ `n` (always 1)

#### Key Differences
1. **No function calling:** LM Studio doesn't support `tools` parameter
2. **Custom parameters:** Adds `repeat_penalty`, `top_k`
3. **Model names:** Uses local model identifiers from LM Studio UI
4. **API key:** Accepts any value (not validated)

### LM Studio Base URL
```
http://localhost:1234/v1
```

---

## 8. Ollama Implementation

### What Ollama Supports

#### Endpoints
- ✅ `/v1/models` (GET)
- ✅ `/v1/chat/completions` (POST)
- ✅ `/v1/completions` (POST)
- ✅ `/v1/embeddings` (POST)
- ✅ `/v1/responses` (POST)
- ✅ `/v1/images/generations` (POST) — experimental

#### Chat Completions Support

##### ✅ Supported Features
- Chat completions (text)
- Streaming
- JSON mode (`response_format: {type: "json_object"}`)
- Reproducible outputs (`seed`)
- Vision (multimodal with `image_url`)
- **Tools (function calling)** ✅

##### Supported Parameters
- ✅ `model`, `messages`, `temperature`, `top_p`, `max_tokens`
- ✅ `stream`, `stream_options.include_usage`
- ✅ `frequency_penalty`, `presence_penalty`
- ✅ `response_format` (JSON mode)
- ✅ `seed`, `stop`
- ✅ `tools` — **FUNCTION CALLING SUPPORTED**
- ❌ `tool_choice` — defaults to `"auto"`
- ❌ `logit_bias`, `logprobs`, `n`

#### Key Differences
1. **Function calling:** Ollama **DOES** support tools (unlike LM Studio)
2. **Vision:** Supports `image_url` with base64 (not remote URLs yet)
3. **Model names:** Uses Ollama model format (e.g., `llama3.2`, `qwen3-vl:8b`)
4. **API key:** Required but ignored (use `"ollama"`)

### Ollama Base URL
```
http://localhost:11434/v1
```

### Ollama-Specific Notes

#### Model Format
- Use Ollama model names: `llama3.2`, `gpt-oss:20b`, `qwen3-vl:8b`
- Can create aliases: `ollama cp llama3.2 gpt-3.5-turbo`

#### Context Size
- No OpenAI-compatible way to set context length
- Must create Modelfile:
```dockerfile
FROM llama3.2
PARAMETER num_ctx 8192
```
Then: `ollama create mymodel`

---

## 9. OpenClaw Bot Usage Patterns

### API Calls Made

*Note: Actual OpenClaw source not accessible in this research. Documenting expected patterns based on typical agent frameworks.*

#### Expected Usage

1. **System prompts:** Uses `system` role for agent behavior
2. **Streaming:** Likely uses `stream: true` for responsive UX
3. **Tools:** May use function calling for integrations
4. **Token management:** Likely includes `max_tokens` limit

#### Typical Request Pattern
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant..."},
    {"role": "user", "content": "User message"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2000
}
```

---

## 10. Opta CLI Usage Patterns

### Actual Implementation (from agent.ts)

```typescript
const client = new OpenAI({
  baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
  apiKey: 'lm-studio',
});

const stream = await client.chat.completions.create({
  model,
  messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
  tools: TOOL_SCHEMAS as Parameters<typeof client.chat.completions.create>[0]['tools'],
  tool_choice: 'auto',
  stream: true,
});
```

### Parameters Used

1. **model** — From config
2. **messages** — Conversation history (system + user + assistant + tool)
3. **tools** — Function definitions for file operations, command execution
4. **tool_choice** — Always `"auto"`
5. **stream** — Always `true`

### Critical Requirements for Opta CLI

- ✅ Streaming support (blocking requirement)
- ✅ Tool calling support (blocking requirement)
- ✅ Proper tool call accumulation in streams
- ✅ Context management (compaction when near limit)

### Tool Call Pattern

Opta CLI uses multi-turn conversations:
1. User provides task
2. Model calls tools (e.g., `read_file`, `edit_file`, `run_command`)
3. CLI executes tools
4. Results sent back as `tool` role messages
5. Model generates next step or final answer

---

## 11. Implementation Priority Matrix

### 🔴 CRITICAL (Must implement first)

| Feature | Why Critical | Breaks Without It |
|---------|--------------|-------------------|
| `model` parameter | Routing to correct model | All clients |
| `messages` array | Core functionality | All clients |
| `temperature`, `top_p` | Response quality | All clients |
| `max_tokens` | Prevent runaway generation | All clients |
| `stream: false` | Non-streaming clients | Half of integrations |
| `stream: true` | Opta CLI, real-time UX | Opta CLI, OpenClaw |
| SSE `[DONE]` sentinel | Stream termination | All streaming clients |
| `tools` array | Function calling | Opta CLI (blocking) |
| `tool_calls` response | Tool execution | Opta CLI (blocking) |
| `finish_reason` | Clients detect completion type | All clients |
| `/v1/models` endpoint | Model discovery | Most clients |
| Error responses (400, 404, 500) | Error handling | All clients |

### 🟡 NICE-TO-HAVE (Implement later)

| Feature | Why Useful | Can Default To |
|---------|------------|----------------|
| `tool_choice` | Force/prevent tool use | `"auto"` |
| `response_format` | JSON mode | `"text"` |
| `seed` | Reproducibility | Ignore (non-deterministic) |
| `stop` sequences | Custom stopping | Model's default stops |
| `frequency_penalty` | Reduce repetition | 0.0 |
| `presence_penalty` | Topic diversity | 0.0 |
| `usage` tokens | Monitoring/billing | Estimate or omit |
| `system_fingerprint` | Reproducibility tracking | Random or model version |
| `stream_options.include_usage` | Token counts in streams | Omit |

### 🔵 OPTIONAL (Ignore safely)

| Feature | Why Ignore | Impact |
|---------|-----------|--------|
| `logit_bias` | Token probability manipulation | None (advanced use case) |
| `logprobs` | Log probabilities | None (research use) |
| `top_logprobs` | Top K log probs | None (research use) |
| `n` (multiple completions) | Multi-output mode | None (always n=1) |
| `user` tracking | OpenAI billing/abuse | None (local deployment) |
| `service_tier` | OpenAI pricing | None (local deployment) |

---

## Implementation Checklist

### Phase 1: Basic Chat (Week 1)
- [ ] POST /v1/chat/completions (non-streaming)
- [ ] GET /v1/models
- [ ] Parameters: model, messages, temperature, top_p, max_tokens
- [ ] Response: id, object, created, model, choices, finish_reason
- [ ] Error handling: 400, 404, 500

### Phase 2: Streaming (Week 2)
- [ ] SSE response with proper headers
- [ ] Delta-based chunks
- [ ] First chunk with `role`
- [ ] Content chunks
- [ ] Final chunk with `finish_reason`
- [ ] `data: [DONE]` termination

### Phase 3: Tool Calling (Week 3)
- [ ] Accept `tools` array in request
- [ ] Generate `tool_calls` in response
- [ ] `finish_reason: "tool_calls"`
- [ ] Tool call streaming (incremental `arguments`)
- [ ] Accept `tool` role messages
- [ ] Multi-turn tool conversations

### Phase 4: Polish (Week 4)
- [ ] `tool_choice` parameter
- [ ] `response_format` (JSON mode)
- [ ] `seed` + `system_fingerprint`
- [ ] `stop` sequences
- [ ] `usage` token counts
- [ ] `stream_options.include_usage`
- [ ] Penalty parameters

---

## Testing Checklist

### Compatibility Tests

#### Test with Opta CLI
```bash
cd ~/Synced/Opta/1-Apps/1D-Opta-CLI-TS
# Configure to point at Opta-LMX
opta connect
opta ask "Read the file README.md and summarize it"
```

#### Test with OpenAI SDK (Python)
```python
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:PORT/v1",
    api_key="test-key"
)

# Non-streaming
response = client.chat.completions.create(
    model="test-model",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="test-model",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

#### Test with curl
```bash
# Non-streaming
curl -X POST http://localhost:PORT/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Streaming
curl -N -X POST http://localhost:PORT/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

#### Test Tool Calling
```bash
curl -X POST http://localhost:PORT/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "messages": [{"role": "user", "content": "What is the weather in NYC?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather",
        "parameters": {
          "type": "object",
          "properties": {"location": {"type": "string"}},
          "required": ["location"]
        }
      }
    }]
  }'
```

---

## References

1. **OpenAI API Documentation**
   - Chat Completions: https://platform.openai.com/docs/api-reference/chat
   - Models: https://platform.openai.com/docs/api-reference/models
   - Error Codes: https://platform.openai.com/docs/guides/error-codes

2. **LM Studio Documentation**
   - OpenAI Compatibility: https://lmstudio.ai/docs/developer/openai-compat
   - Chat Completions: https://lmstudio.ai/docs/developer/openai-compat/chat-completions

3. **Ollama Documentation**
   - OpenAI Compatibility: https://docs.ollama.com/api/openai-compatibility
   - Blog: https://ollama.com/blog/openai-compatibility

4. **Implementation Sources**
   - Opta CLI: `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/src/core/agent.ts`

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-15  
**Maintained by:** Opta-LMX Development Team
