---
title: Opta-LMX API Specification — Phase 1
version: 1.0
date: 2026-02-15
status: Approved for Implementation
target_audience: Backend engineers, OpenClaw bots, Opta CLI, external clients
api_compatibility: OpenAI-compatible Inference + Opta-LMX Admin
---

# Opta-LMX API Specification — Phase 1

**Complete API contract for Opta-LMX inference server.**

Two API groups: **Inference API** (`/v1/*` — OpenAI compatible) and **Admin API** (`/admin/*` — Opta-LMX exclusive).

---

## API Group 1: Inference API (`/v1/*`)

OpenAI-compatible endpoints. Any client using the OpenAI SDK will work without modification.

### 1. POST /v1/chat/completions

**Purpose**: Chat-based completion with streaming support, tool calling, and all OpenAI parameters.

#### Request

```json
{
  "model": "llama-3.2-8b",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "top_p": 1.0,
  "max_tokens": 2048,
  "stream": false,
  "stop": null,
  "tools": [...],
  "tool_choice": "auto",
  "response_format": {"type": "text"},
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0
}
```

**Parameters** (types, required/optional, defaults):

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ | — | Model ID to use |
| `messages` | array | ✅ | — | Conversation (role: system/user/assistant/tool/developer) |
| `temperature` | number | ❌ | 0.7 | Sampling temperature (0-2) |
| `top_p` | number | ❌ | 1.0 | Nucleus sampling (0-1) |
| `max_tokens` | integer | ❌ | null | Max output tokens |
| `stream` | boolean | ❌ | false | Stream response as SSE |
| `stop` | string\|array | ❌ | null | Stop sequences (max 4) |
| `tools` | array | ❌ | null | Function definitions for tool calling |
| `tool_choice` | string\|object | ❌ | "auto" | "auto", "none", "required", or {"type": "function", ...} |
| `response_format` | object | ❌ | {type: "text"} | {"type": "text"} or {"type": "json_object"} |
| `frequency_penalty` | number | ❌ | 0.0 | Token frequency penalty (-2 to 2) |
| `presence_penalty` | number | ❌ | 0.0 | Token presence penalty (-2 to 2) |

#### Response (Non-Streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1707912345,
  "model": "llama-3.2-8b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help?",
        "tool_calls": null
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

#### Response (Streaming — SSE)

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1707912345,"model":"llama-3.2-8b","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1707912345,"model":"llama-3.2-8b","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1707912345,"model":"llama-3.2-8b","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1707912345,"model":"llama-3.2-8b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

#### Tool Calling Example

**Request:**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "llama-3.2-8b",
    "messages": [{"role": "user", "content": "Whats the weather in NYC?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      }
    }],
    "tool_choice": "auto"
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1707912345,
  "model": "llama-3.2-8b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"location\":\"NYC\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_request_error` | Bad JSON, missing required params, invalid values |
| 401 | `invalid_authentication` | Bad/missing API key |
| 404 | `not_found_error` | Model doesn't exist or endpoint not found |
| 429 | `rate_limit_exceeded` | Too many requests (future rate limiting) |
| 500 | `internal_server_error` | Server error (model crash, OOM, etc.) |

**Example error:**
```json
{
  "error": {
    "message": "The model 'invalid-model' does not exist",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

#### Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="YOUR_API_KEY"
)

# Non-streaming
response = client.chat.completions.create(
    model="llama-3.2-8b",
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0.7,
    max_tokens=256
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="llama-3.2-8b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

---

### 2. GET /v1/models

**Purpose**: List all loaded and available models.

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "llama-3.2-8b",
      "object": "model",
      "created": 1704067200,
      "owned_by": "meta"
    },
    {
      "id": "qwen3-vl-2b",
      "object": "model",
      "created": 1707912345,
      "owned_by": "alibaba"
    }
  ]
}
```

#### curl Example

```bash
curl -X GET http://localhost:8000/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Python Example

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="YOUR_API_KEY")
models = client.models.list()
for model in models.data:
    print(f"{model.id} (owned by {model.owned_by})")
```

---

### 3. POST /v1/completions

**Purpose**: Legacy text completion (lower priority, for compatibility).

#### Request / Response

Same structure as `/v1/chat/completions` but with flat text input/output (no message roles).

#### curl Example

```bash
curl -X POST http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "llama-3.2-8b",
    "prompt": "Once upon a time",
    "max_tokens": 100
  }'
```

---

### 4. POST /v1/embeddings

**Purpose**: Generate embeddings (if supported by loaded model).

#### Request

```json
{
  "model": "embedding-model",
  "input": "The quick brown fox",
  "encoding_format": "float"
}
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.123, -0.456, ...],
      "index": 0
    }
  ],
  "model": "embedding-model",
  "usage": {
    "prompt_tokens": 5,
    "total_tokens": 5
  }
}
```

---

## API Group 2: Admin API (`/admin/*`)

**Authentication**: Required. Use `X-Admin-Key: <key>` header (separate from inference API key).

### 1. GET /admin/status

**Purpose**: Full system health, uptime, memory, CPU/GPU, request stats.

#### Response

```json
{
  "version": "0.1.0",
  "uptime_seconds": 3600.5,
  "loaded_models": 2,
  "models": ["llama-3.2-8b", "qwen3-vl-2b"],
  "memory": {
    "total_gb": 128.0,
    "used_gb": 81.6,
    "available_gb": 46.4,
    "usage_percent": 63.8,
    "threshold_percent": 90
  }
}
```

> **Note**: `gpu` and `requests` sections from the original spec draft are deferred to Phase 3. On Apple Silicon, unified memory means GPU/CPU memory are the same — the `memory` section covers both.

#### curl Example

```bash
curl -X GET http://localhost:8000/admin/status \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

---

### 2. GET /admin/models

**Purpose**: Detailed model inventory (both loaded and available).

#### Response

```json
{
  "loaded": [
    {
      "id": "llama-3.2-8b",
      "loaded": true,
      "memory_gb": 4.25,
      "loaded_at": 1708012345.0,
      "use_batching": true,
      "request_count": 42,
      "last_used_at": 1708015678.0
    }
  ],
  "count": 1
}
```

---

### 3. POST /admin/models/load

**Purpose**: Load a model into memory.

#### Request

```json
{
  "model_id": "qwen3-vl-2b",
  "max_context_length": null,
  "gpu_layers": null
}
```

#### Response

```json
{
  "success": true,
  "model_id": "qwen3-vl-2b",
  "memory_after_load_gb": 92.0,
  "time_to_load_ms": 12345.0
}
```

#### curl Example

```bash
curl -X POST http://localhost:8000/admin/models/load \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "llama-3.2-8b"
  }'
```

#### Python Example

```python
import requests

response = requests.post(
    "http://localhost:8000/admin/models/load",
    json={"model_id": "llama-3.2-8b"},
    headers={"X-Admin-Key": "YOUR_ADMIN_KEY"}
)
print(response.json())
```

---

### 4. POST /admin/models/unload

**Purpose**: Unload a model from memory.

#### Request

```json
{
  "model_id": "qwen3-vl-2b"
}
```

#### Response

```json
{
  "success": true,
  "model_id": "qwen3-vl-2b",
  "memory_freed_gb": 4.0
}
```

---

### 5. POST /admin/models/download

**Purpose**: Download model from HuggingFace (async).

#### Request

```json
{
  "repo_id": "mlx-community/Llama-3.2-8B-Instruct-4bit",
  "filename": null,
  "revision": "main"
}
```

#### Response

```json
{
  "download_id": "dl_abc123xyz",
  "repo_id": "mlx-community/Llama-3.2-8B-Instruct-4bit",
  "estimated_size_bytes": 8589934592,
  "status": "downloading"
}
```

#### Progress Stream (SSE)

**GET** `/admin/models/download/{download_id}/progress`

```
data: {"download_id":"dl_abc123xyz","status":"downloading","progress_percent":25.5,"downloaded_bytes":2147483648,"speed_mbps":45.2}

data: {"download_id":"dl_abc123xyz","status":"downloading","progress_percent":50.0,"downloaded_bytes":4294967296,"speed_mbps":42.1}

data: {"download_id":"dl_abc123xyz","status":"completed","progress_percent":100,"model_id":"llama-3.2-8b"}
```

#### curl Example

```bash
curl -X POST http://localhost:8000/admin/models/download \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id": "mlx-community/Llama-3.2-8B-Instruct-4bit"
  }'

# Check progress
curl -N http://localhost:8000/admin/models/download/dl_abc123xyz/progress \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

---

### 6. DELETE /admin/models/{model_id}

**Purpose**: Delete a downloaded model (frees disk space).

#### Response

```json
{
  "success": true,
  "model_id": "qwen3-vl-2b",
  "freed_bytes": 1610612736
}
```

#### curl Example

```bash
curl -X DELETE http://localhost:8000/admin/models/qwen3-vl-2b \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

---

### 7. GET /admin/health

**Purpose**: Simple health check (for load balancers, monitoring).

#### Response

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

Or (if degraded):
```json
{
  "status": "degraded",
  "version": "0.1.0",
  "reason": "Memory usage above 85%"
}
```

#### curl Example

```bash
curl -X GET http://localhost:8000/admin/health
```

---

### 8. GET /admin/memory

**Purpose**: Detailed memory breakdown (CPU RAM + GPU VRAM).

#### Response

```json
{
  "total_unified_memory_gb": 128.0,
  "used_gb": 81.6,
  "available_gb": 46.4,
  "threshold_percent": 90,
  "models": {
    "llama-3.2-8b": {
      "memory_gb": 4.25,
      "loaded": true
    },
    "qwen3-vl-2b": {
      "memory_gb": 2.0,
      "loaded": true
    }
  }
}
```

---

### 9. POST /admin/config/reload

**Purpose**: Hot-reload config without restart. Re-reads YAML and updates routing aliases, memory thresholds, logging level, and admin key. Does NOT restart server or unload models.

#### Response

```json
{
  "success": true,
  "updated": ["routing", "memory", "security", "logging"]
}
```

### 10. GET /admin/metrics

**Purpose**: Prometheus-compatible metrics for scraping.

#### Response (text/plain)

```
# TYPE lmx_requests_total counter
lmx_requests_total 42
# TYPE lmx_errors_total counter
lmx_errors_total 1
# TYPE lmx_request_duration_seconds histogram
lmx_request_duration_seconds_bucket{model="llama-3.2-8b",le="0.5"} 30
lmx_request_duration_seconds_bucket{model="llama-3.2-8b",le="+Inf"} 42
```

### 11. GET /admin/metrics/json

**Purpose**: JSON metrics summary for admin dashboards.

#### Response

```json
{
  "total_requests": 42,
  "total_errors": 1,
  "total_stream_requests": 20,
  "total_prompt_tokens": 5000,
  "total_completion_tokens": 12000,
  "per_model": {
    "llama-3.2-8b": {
      "requests": 42,
      "errors": 1,
      "completion_tokens": 12000
    }
  },
  "uptime_seconds": 3600.0
}
```

### 12. GET /admin/models/available

**Purpose**: List all models on disk (downloaded but not necessarily loaded).

#### Response

```json
[
  {
    "repo_id": "mlx-community/Llama-3.2-8B-Instruct-4bit",
    "local_path": "/path/to/cache/models--mlx-community--Llama-3.2-8B-Instruct-4bit",
    "size_bytes": 8589934592,
    "downloaded_at": "2026-02-15T10:30:00"
  }
]
```

---

## Authentication

### Inference API (Optional)

Use `Authorization: Bearer <key>` header:

```bash
curl -X GET http://localhost:8000/v1/models \
  -H "Authorization: Bearer YOUR_INFERENCE_KEY"
```

- Can be disabled for LAN-only deployments
- Default: Inference API accepts any key (permissive)

### Admin API (Required)

Use `X-Admin-Key: <key>` header:

```bash
curl -X GET http://localhost:8000/admin/status \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

- Always required
- Must be set at startup (config file or env var)
- Separate from inference API key

---

## Error Response Format

All errors follow OpenAI's format:

```json
{
  "error": {
    "message": "Model 'invalid' not found",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request_error` | 400 | Malformed request |
| `invalid_authentication` | 401 | Bad API key |
| `permission_denied` | 403 | Admin operation without admin key |
| `not_found_error` | 404 | Model/resource not found |
| `model_not_found` | 404 | Model doesn't exist |
| `insufficient_memory` | 507 | Not enough VRAM/RAM to load model |
| `context_length_exceeded` | 400 | Message tokens exceed model's max context |
| `rate_limit_exceeded` | 429 | Too many requests (future) |
| `internal_server_error` | 500 | Server error |

---

## Implementation Checklist

### Phase 1: MVP (Priority)

- [x] POST /v1/chat/completions (non-streaming)
- [x] GET /v1/models
- [x] POST /v1/chat/completions (streaming)
- [x] Tool calling support
- [x] GET /admin/status
- [x] GET /admin/models
- [x] POST /admin/models/load
- [x] POST /admin/models/unload
- [x] GET /admin/health
- [x] GET /admin/memory
- [x] POST /v1/completions (stub — returns 501, use /v1/chat/completions)

### Phase 2: Extended ✅

- [ ] POST /v1/embeddings (upstream in vllm-mlx v0.2.6)
- [x] POST /admin/models/download
- [x] DELETE /admin/models/{model_id}
- [x] GET /admin/models/download/{id}/progress (polling)

### Phase 3: Smart Features ✅

- [x] POST /admin/config/reload
- [x] GET /admin/metrics (Prometheus format)
- [x] GET /admin/metrics/json (JSON summary)
- [x] Smart model routing (alias resolution: auto, code, reasoning, chat)
- [x] GET /admin/models/available (disk inventory)
- [ ] Rate limiting (deferred)

---

## Conventions

- **Timestamps**: Unix seconds (integer)
- **IDs**: Unique per-request (e.g., `chatcmpl-abc123xyz`)
- **Tokens**: Estimated from character count if tokenizer unavailable
- **Model IDs**: Alphanumeric + hyphen (no spaces)
- **Finish reasons**: `stop`, `length`, `tool_calls`, `content_filter`
- **Memory units**: Implementation uses `_gb` (float) instead of `_bytes` (integer) throughout admin responses. On Apple Silicon with 64-512GB unified memory, GB is the practical unit. This is an intentional deviation from the original spec draft which used bytes.

---

**API Version**: 1.0  
**Last Updated**: 2026-02-15  
**Status**: Phases 1-3 implemented, Phase 5 (deployment) in progress
**Compatibility**: OpenAI-compatible + Opta-LMX exclusive admin endpoints
