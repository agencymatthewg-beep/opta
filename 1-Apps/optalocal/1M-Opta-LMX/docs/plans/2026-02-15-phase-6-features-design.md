---
status: review
---

# Phase 6: Advanced Features — Design Document

**Created:** 2026-02-15
**Status:** Design — Ready for Review
**Author:** Claude Code (Opus 4.6)
**Rule:** Each feature is independent. Implement in priority order.

---

## Feature Priority & Dependencies

| # | Feature | Priority | Depends On | Est. Complexity |
|---|---------|----------|------------|-----------------|
| 1 | GGUF Fallback Engine | High | None | Large (~400 LOC) |
| 2 | WebSocket Streaming | Medium | None | Medium (~200 LOC) |
| 3 | Model Presets Library | High | None | Medium (~250 LOC) |
| 4 | Auto-Download on Load | High | Feature 1 (partial) | Small (~150 LOC) |
| 5 | Admin Dashboard SSE Feed | Medium | None | Medium (~300 LOC) |

**Recommended implementation order:** 3 → 4 → 1 → 5 → 2

Rationale: Presets (3) and auto-download (4) are high-value, low-risk improvements to existing flows. GGUF (1) unlocks 10x more models but adds a new dependency. SSE feed (5) enables the admin dashboard. WebSocket (2) is lowest priority — SSE already works well on LAN.

---

## Feature 1: GGUF Fallback Engine

### Problem

Opta-LMX only supports MLX-format models (safetensors from mlx-community). Many popular models are only available in GGUF format (e.g., TheBloke's quantized collection). Users who want to run these models must use a separate tool like Ollama.

### Research Findings

- **llama-cpp-python** (latest: 0.3.x) has full Metal acceleration on Apple Silicon via `n_gpu_layers=-1`
- Its API is already OpenAI-compatible: `create_chat_completion(messages=[...])` returns the same JSON shape
- Supports streaming, function calling, JSON mode, embeddings
- Can load from HuggingFace: `Llama.from_pretrained(repo_id="...", filename="*q8_0.gguf")`
- Model format detection is trivial: GGUF files end in `.gguf`, MLX models are directories with `config.json` + `*.safetensors`
- LM Studio treats MLX and GGUF as separate "runtimes" — users can mix and match simultaneously

### Approach: Backend Abstraction

**Recommended approach:** Introduce a `Backend` protocol that both MLX and GGUF engines implement.

```
                  InferenceEngine
                  ├── _models: dict[str, LoadedModel]
                  ├── load_model() → detects format → creates correct backend
                  └── generate() / stream_generate() → delegates to backend
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        MLXBackend           GGUFBackend
        (vllm-mlx)         (llama-cpp-python)
```

**Why this over separate engines:** The current `InferenceEngine` already manages model lifecycle (LRU eviction, memory checking). Duplicating that logic for GGUF would be wasteful. Instead, each loaded model carries a `backend` field indicating which engine handles inference.

### Architecture

**New file:** `src/opta_lmx/inference/backend.py`

```python
from typing import Protocol, AsyncIterator

class InferenceBackend(Protocol):
    """Protocol for inference backends (MLX, GGUF)."""

    async def generate(
        self, messages: list[dict], temperature: float,
        max_tokens: int, top_p: float, stop: list[str] | None,
        tools: list[dict] | None,
    ) -> tuple[str, int, int]:
        """Non-streaming generation. Returns (content, prompt_tokens, completion_tokens)."""
        ...

    async def stream(
        self, messages: list[dict], temperature: float,
        max_tokens: int, top_p: float, stop: list[str] | None,
        tools: list[dict] | None,
    ) -> AsyncIterator[str]:
        """Streaming generation. Yields token strings."""
        ...

    def close(self) -> None:
        """Release model resources."""
        ...
```

**New file:** `src/opta_lmx/inference/gguf_backend.py`

```python
class GGUFBackend:
    """GGUF inference via llama-cpp-python with Metal acceleration."""

    def __init__(self, model_path: str, n_ctx: int = 4096) -> None:
        from llama_cpp import Llama
        self._llm = Llama(
            model_path=model_path,
            n_gpu_layers=-1,   # Full Metal offload
            n_ctx=n_ctx,
            verbose=False,
        )

    async def generate(self, messages, temperature, max_tokens, top_p, stop, tools):
        result = await asyncio.to_thread(
            self._llm.create_chat_completion,
            messages=messages, temperature=temperature,
            max_tokens=max_tokens, top_p=top_p, stop=stop,
        )
        content = result["choices"][0]["message"]["content"]
        usage = result.get("usage", {})
        return content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)

    async def stream(self, messages, temperature, max_tokens, top_p, stop, tools):
        stream = await asyncio.to_thread(
            self._llm.create_chat_completion,
            messages=messages, temperature=temperature,
            max_tokens=max_tokens, stream=True,
        )
        for chunk in stream:
            delta = chunk["choices"][0].get("delta", {})
            if content := delta.get("content"):
                yield content

    def close(self) -> None:
        del self._llm
```

### Format Detection

Add to `InferenceEngine.load_model()`:

```python
def _detect_format(self, model_id: str) -> str:
    """Detect whether model_id is MLX or GGUF.

    Rules:
    1. If model_id ends with .gguf → GGUF (local file path)
    2. If model_id contains 'GGUF' or 'gguf' → GGUF (HF repo)
    3. Otherwise → MLX (default, handled by vllm-mlx)
    """
    if model_id.endswith(".gguf"):
        return "gguf"
    if "gguf" in model_id.lower():
        return "gguf"
    return "mlx"
```

### Config Changes

Add to `ModelsConfig`:

```yaml
models:
  gguf_context_length: 4096    # Default n_ctx for GGUF models
  gguf_gpu_layers: -1          # -1 = full Metal offload
```

### Dependency

Add `llama-cpp-python` as an **optional** dependency:

```toml
[project.optional-dependencies]
gguf = ["llama-cpp-python>=0.3.0"]
```

This keeps the base install lightweight. GGUF support is opt-in via `pip install -e ".[gguf]"`.

### LoadedModel Changes

Add `backend: str` and `backend_instance: InferenceBackend` fields to `LoadedModel` dataclass.

### Test Strategy

- Unit tests with a mock `Llama` class (no actual GGUF file needed)
- Test format detection for edge cases
- Test that generate/stream return OpenAI-compatible format
- Test unload calls `close()` on backend

---

## Feature 2: WebSocket Streaming

### Problem

SSE (Server-Sent Events) works well but has two limitations:
1. No client-side cancellation — once streaming starts, the client can't signal "stop generating"
2. Each SSE request is a new HTTP connection (no reuse across requests)

### Research Findings

- **Latency difference is minimal on LAN**: SSE overhead is ~2-6 bytes per chunk (`data: ` prefix + `\n\n`). WebSocket frame overhead is 2-6 bytes. On LAN, this difference is sub-millisecond and irrelevant compared to token generation time (~20-80ms per token for MLX).
- **The real value is bidirectional communication**: WebSocket enables client → server messages during streaming (cancel, adjust params).
- **No major LLM provider uses WebSocket for chat completions**: OpenAI, Anthropic, Google all use SSE. vLLM has a "Realtime" WebSocket API but it's for audio/speech, not text chat.
- **OpenAI SDK compatibility requires SSE**: Changing the primary endpoint would break all clients.
- **SSE over HTTP/2 gets multiplexing**: Up to 100 concurrent streams on one TCP connection — effectively matching WebSocket's connection reuse.

### Approach: Supplementary WebSocket Endpoint

Keep SSE as the primary endpoint (`/v1/chat/completions`). Add WebSocket as an **optional secondary** endpoint for clients that need cancellation.

```
Client options:
  POST /v1/chat/completions  →  SSE stream (OpenAI-compatible, existing)
  WS   /v1/chat/stream       →  WebSocket (bidirectional, new)
```

### Protocol Design

```
Client → Server (JSON):
{
    "type": "chat.request",
    "model": "mlx-community/Qwen2.5-32B-4bit",
    "messages": [...],
    "temperature": 0.7,
    "stream": true
}

Server → Client (JSON, per token):
{
    "type": "chat.token",
    "request_id": "chatcmpl-abc123",
    "content": "Hello"
}

Server → Client (JSON, final):
{
    "type": "chat.done",
    "request_id": "chatcmpl-abc123",
    "finish_reason": "stop",
    "usage": {"prompt_tokens": 10, "completion_tokens": 50}
}

Client → Server (cancel):
{
    "type": "chat.cancel",
    "request_id": "chatcmpl-abc123"
}

Server → Client (error):
{
    "type": "chat.error",
    "request_id": "chatcmpl-abc123",
    "error": "Model not loaded"
}
```

### Implementation

**New file:** `src/opta_lmx/api/websocket.py`

```python
@router.websocket("/v1/chat/stream")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_tasks: dict[str, asyncio.Task] = {}

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "chat.request":
                request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
                task = asyncio.create_task(
                    _handle_stream(websocket, request_id, data, engine, router)
                )
                active_tasks[request_id] = task

            elif msg_type == "chat.cancel":
                request_id = data.get("request_id")
                if task := active_tasks.get(request_id):
                    task.cancel()
                    del active_tasks[request_id]

    except WebSocketDisconnect:
        # Cancel all active generation tasks on disconnect
        for task in active_tasks.values():
            task.cancel()
```

### Cancellation Benefit

The key differentiator: when a user clicks "Stop" in a chat UI, the WebSocket client sends `{"type": "chat.cancel"}` and the server immediately cancels the generation task, freeing GPU resources. With SSE, the best the client can do is close the connection — the server may continue generating tokens until it notices the disconnection.

### Config Changes

```yaml
server:
  websocket_enabled: true    # Default: true
```

### DEFERRED: WebSocket is lower priority than features 1, 3, 4, 5

The latency argument doesn't hold up for LAN use. Implement this after the higher-value features, when a client (like OptaPlus) actually needs cancellation.

---

## Feature 3: Model Presets Library

### Problem

Every time a model is loaded, inference parameters (temperature, max_tokens, system prompt) must be specified per-request. There's no way to save "this model works best with temperature 0.3 and a coding-focused system prompt" and recall it by name.

### Research Findings

- **Ollama**: Modelfile format — `FROM model`, `PARAMETER temperature 0.3`, `SYSTEM "You are..."`, `TEMPLATE "{{.System}}..."` — a Dockerfile-like declarative format. Community shares Modelfiles via `ollama.com/library`.
- **LM Studio**: `.preset.json` files containing all inference params + system prompt. Recently added community preset sharing.
- **Jan.ai**: `model.json` / `model.yml` per model. Cortex uses YAML.
- **Convention**: All tools use declarative config files. YAML is the natural fit for Opta-LMX (already using YAML for config).

### Approach: YAML Preset Files

Presets are YAML files in a `presets/` directory. Each preset defines a model + default parameters. Presets can be referenced by name in API requests.

### Preset Format

```yaml
# presets/code-assistant.yaml
name: code-assistant
description: "Fast coding assistant with low temperature"
model: "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
parameters:
  temperature: 0.2
  top_p: 0.95
  max_tokens: 4096
  stop: ["```\n\n"]
system_prompt: |
  You are a senior software engineer. Write clean, idiomatic code.
  When asked to write code, output only the code without explanations
  unless explicitly asked.
routing_alias: code        # Optional: bind this preset to a routing alias
auto_load: false           # Optional: load this model on startup
```

```yaml
# presets/reasoning.yaml
name: reasoning
description: "Deep reasoning model for complex problems"
model: "mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit"
parameters:
  temperature: 0.6
  top_p: 0.9
  max_tokens: 8192
system_prompt: |
  Think step by step. Show your reasoning process.
routing_alias: reasoning
auto_load: false
```

### Architecture

**New file:** `src/opta_lmx/presets/manager.py`

```python
@dataclass
class Preset:
    name: str
    description: str
    model: str
    parameters: dict[str, Any]     # temperature, top_p, max_tokens, stop
    system_prompt: str | None
    routing_alias: str | None
    auto_load: bool

class PresetManager:
    def __init__(self, presets_dir: Path) -> None: ...
    def load_presets(self) -> None: ...           # Scan dir, parse YAML
    def get(self, name: str) -> Preset | None: ...
    def list_all(self) -> list[Preset]: ...
    def apply(self, preset: Preset, request: ChatCompletionRequest) -> ChatCompletionRequest: ...
    def reload(self) -> None: ...                 # Hot-reload from disk
```

### API Integration

**How presets are used in requests:**

```json
POST /v1/chat/completions
{
    "model": "preset:code-assistant",
    "messages": [{"role": "user", "content": "Write a Python quicksort"}]
}
```

When the model field starts with `preset:`, the inference endpoint:
1. Looks up the preset by name
2. Resolves `preset.model` to the actual model ID
3. Applies preset parameters as defaults (request params override preset params)
4. Prepends `system_prompt` if set and no system message exists in the request

This is transparent to the OpenAI SDK — clients just use `model="preset:code-assistant"`.

### Admin Endpoints

```
GET  /admin/presets          → list all presets (name, description, model)
GET  /admin/presets/{name}   → get full preset details
POST /admin/presets/reload   → re-read presets from disk
```

### Config Changes

```yaml
presets:
  directory: "~/.opta-lmx/presets"    # Default preset directory
  enabled: true
```

### Directory Structure

```
~/.opta-lmx/
├── config.yaml
└── presets/
    ├── code-assistant.yaml
    ├── reasoning.yaml
    ├── chat.yaml
    └── creative-writing.yaml
```

### Startup Behavior

On startup, `PresetManager` scans the presets directory and:
1. Validates all preset YAML files
2. Registers `routing_alias` mappings with `TaskRouter`
3. Queues `auto_load: true` models for automatic loading

---

## Feature 4: Auto-Download on Load

### Problem

When a client requests `POST /admin/models/load` with a model that isn't on disk, it fails with a cryptic vllm-mlx error. The user must separately call `/admin/models/download`, wait for it to complete, then retry the load. This is a poor experience for bots and CLI users.

### Approach: Two-Phase Load with Confirmation

**User requirement:** "Prompt the user before starting any downloads."

The load endpoint should detect missing models and return a confirmation prompt instead of silently downloading. This respects the user's bandwidth and disk space.

### Flow

```
Client: POST /admin/models/load {"model_id": "mlx-community/Qwen2.5-72B-4bit"}

Case 1: Model on disk → load immediately (existing behavior)

Case 2: Model NOT on disk →
  Server responds 202:
  {
      "status": "download_required",
      "model_id": "mlx-community/Qwen2.5-72B-4bit",
      "estimated_size_bytes": 40265318400,
      "estimated_size_human": "37.5 GB",
      "confirmation_token": "dl-abc123",
      "message": "Model not found locally. Confirm download?",
      "confirm_url": "/admin/models/load/confirm"
  }

Client: POST /admin/models/load/confirm {"confirmation_token": "dl-abc123"}

  Server: starts download, then auto-loads when complete
  Response 202:
  {
      "status": "downloading",
      "download_id": "abc123",
      "progress_url": "/admin/models/download/abc123/progress"
  }
```

### Implementation

Modify `load_model` endpoint in `admin.py`:

```python
@router.post("/admin/models/load")
async def load_model(body: AdminLoadRequest, request: Request, ...):
    # ... existing auth check ...

    # Check if model is on disk (HF cache or local path)
    manager = get_model_manager(request)
    is_available = await manager.is_model_available(body.model_id)

    if not is_available and body.auto_download is not True:
        # Return confirmation prompt
        estimated = await manager._estimate_size(body.model_id, None, None, None)
        token = uuid.uuid4().hex[:12]
        # Store pending confirmation
        request.app.state.pending_downloads[token] = {
            "model_id": body.model_id,
            "estimated_bytes": estimated,
            "created_at": time.time(),
        }
        return JSONResponse(status_code=202, content={
            "status": "download_required",
            "model_id": body.model_id,
            "estimated_size_bytes": estimated,
            "estimated_size_human": _human_size(estimated),
            "confirmation_token": token,
            "message": "Model not found locally. Confirm download?",
            "confirm_url": "/admin/models/load/confirm",
        })

    # Existing load logic...
```

**New endpoint:** `POST /admin/models/load/confirm`

```python
@router.post("/admin/models/load/confirm")
async def confirm_and_load(body: ConfirmLoadRequest, request: Request, ...):
    pending = request.app.state.pending_downloads.pop(body.confirmation_token, None)
    if not pending:
        return JSONResponse(status_code=404, content={"error": "Token expired or invalid"})

    # Start download, then auto-load on completion
    manager = get_model_manager(request)
    task = await manager.start_download(pending["model_id"])

    # Register callback to auto-load when download completes
    asyncio.create_task(_load_after_download(
        task.download_id, pending["model_id"], manager, engine
    ))

    return JSONResponse(status_code=202, content={
        "status": "downloading",
        "download_id": task.download_id,
        "progress_url": f"/admin/models/download/{task.download_id}/progress",
    })
```

### ModelManager Addition

Add `is_model_available()` method:

```python
async def is_model_available(self, model_id: str) -> bool:
    """Check if a model exists in HF cache or as a local file."""
    # Check local file path (for GGUF files)
    if Path(model_id).exists():
        return True
    # Check HF cache
    available = await self.list_available()
    return any(m["repo_id"] == model_id for m in available)
```

### Schema Additions

```python
class ConfirmLoadRequest(BaseModel):
    confirmation_token: str

class AutoDownloadResponse(BaseModel):
    status: str  # "download_required", "downloading"
    model_id: str
    estimated_size_bytes: int | None = None
    estimated_size_human: str | None = None
    confirmation_token: str | None = None
    download_id: str | None = None
    message: str | None = None
```

### Pending Download Cleanup

Confirmation tokens expire after 10 minutes. A cleanup task runs periodically to remove stale entries from `app.state.pending_downloads`.

### AdminLoadRequest Change

Add optional `auto_download: bool = False` field. If `True`, skip the confirmation step and download immediately. This is for programmatic/bot use where the caller has already decided.

---

## Feature 5: Admin Dashboard SSE Feed

### Problem

Admin clients (dashboard UIs, CLI monitors) must poll individual endpoints to get status updates. There's no push-based notification when models load/unload, downloads complete, or memory changes.

### Research Findings

- FastAPI's `StreamingResponse` with `media_type="text/event-stream"` is the standard pattern
- SSE is firewall-friendly (regular HTTP), works through reverse proxies
- Pattern: async generator yields from a shared event bus
- Multiple clients can subscribe simultaneously
- Heartbeat keepalives prevent connection drops

### Approach: Event Bus + SSE Endpoint

```
                 ┌─────────────────────┐
                 │    EventBus          │
                 │  (asyncio.Queue      │
                 │   per subscriber)    │
                 └──────────┬──────────┘
                            │ publish()
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     model_loaded    download_progress   request_metric
     model_unloaded  download_complete   memory_warning
     config_reloaded download_failed     error_occurred

            │               │               │
            ▼               ▼               ▼
     GET /admin/events (SSE stream to N admin clients)
```

### Event Format

```
event: model_loaded
data: {"model_id": "mlx-community/Qwen2.5-32B-4bit", "memory_gb": 18.4, "timestamp": 1708012345.6}

event: download_progress
data: {"download_id": "abc123", "repo_id": "...", "percent": 45.2, "bytes": 18000000000}

event: request_completed
data: {"model_id": "...", "latency_ms": 450, "tokens": 128, "stream": true}

event: memory_warning
data: {"usage_percent": 87.5, "threshold": 90, "available_gb": 64.0}

event: heartbeat
data: {"timestamp": 1708012345.6}
```

### Architecture

**New file:** `src/opta_lmx/monitoring/events.py`

```python
import asyncio
from dataclasses import dataclass
from typing import Any

@dataclass
class ServerEvent:
    event_type: str   # "model_loaded", "download_progress", etc.
    data: dict[str, Any]
    timestamp: float

class EventBus:
    """Publish-subscribe event bus for admin SSE feed.

    Each subscriber gets their own asyncio.Queue so slow
    consumers don't block the event bus.
    """

    def __init__(self, max_queue_size: int = 100) -> None:
        self._subscribers: list[asyncio.Queue[ServerEvent]] = []
        self._max_queue_size = max_queue_size

    def subscribe(self) -> asyncio.Queue[ServerEvent]:
        queue: asyncio.Queue[ServerEvent] = asyncio.Queue(maxsize=self._max_queue_size)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[ServerEvent]) -> None:
        self._subscribers = [q for q in self._subscribers if q is not queue]

    async def publish(self, event: ServerEvent) -> None:
        dead_queues = []
        for queue in self._subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dead_queues.append(queue)  # Slow consumer — disconnect
        for q in dead_queues:
            self._subscribers.remove(q)
```

### SSE Endpoint

```python
@router.get("/admin/events")
async def admin_event_stream(
    request: Request, x_admin_key: str | None = Header(None),
):
    verify_admin_key(request, x_admin_key)
    event_bus: EventBus = request.app.state.event_bus

    async def generate():
        queue = event_bus.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: {event.event_type}\ndata: {json.dumps(event.data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Publishing Events

Instrument existing code to publish events at key lifecycle points:

| Location | Event |
|----------|-------|
| `InferenceEngine.load_model()` | `model_loaded` |
| `InferenceEngine.unload_model()` | `model_unloaded` |
| `ModelManager._run_download()` | `download_progress`, `download_completed`, `download_failed` |
| `MetricsCollector.record()` | `request_completed` |
| `MemoryMonitor` (new periodic check) | `memory_warning` (when > 80%) |
| `admin.reload_config()` | `config_reloaded` |

Each of these locations gets a one-line `await event_bus.publish(ServerEvent(...))` call.

### Admin Dashboard on optamize.biz

**Architecture for remote access:**

```
Browser → optamize.biz/admin → Cloudflare Pages (static HTML/JS)
                                    │
                                    │ EventSource("/admin/events")
                                    ▼
                            Cloudflare Tunnel
                                    │
                                    ▼
                          Mac Studio :1234 (LMX API)
```

**Components:**
1. **Static dashboard page**: `1K-Optamize-Web/apps/lm-admin.html` — HTML+JS page that connects to the SSE endpoint and renders real-time status
2. **Cloudflare Tunnel**: Already have infrastructure from OptaPlus wss:// work. Add a route for `admin.optamize.biz` → `192.168.188.11:1234`
3. **Authentication**: Two layers:
   - **Cloudflare Access**: Zero-trust auth at the edge (Google OAuth or email OTP before the request even reaches the Mac Studio)
   - **X-Admin-Key header**: LMX's existing admin auth as a second factor

**Dashboard features (static HTML, no framework):**
- Real-time model status (loaded/unloaded, memory per model)
- Download progress bars
- Request metrics graphs (using Chart.js or similar)
- Memory usage gauge
- System uptime and version
- All powered by the SSE feed — no polling needed

**Why static HTML, not a React app:**
- optamize.biz is already static HTML (no build pipeline)
- A dashboard page is ~300 lines of HTML+JS
- SSE consumption is 5 lines of JavaScript: `new EventSource("/admin/events")`
- No node_modules, no build step, no deployment pipeline

### Config Changes

```yaml
server:
  sse_events_enabled: true          # Enable /admin/events endpoint
  sse_heartbeat_interval_sec: 30    # Heartbeat to keep connections alive
```

### Considerations

- **Backpressure**: If a client can't keep up, its queue fills and the subscription is dropped. The client's `EventSource` will auto-reconnect.
- **Memory**: Each subscriber holds a Queue of up to 100 events. 10 simultaneous admin clients = ~10KB overhead.
- **Privacy**: Events may contain model IDs and request counts but never message content, tokens, or API keys.

---

## Cross-Cutting Concerns

### New Dependencies

| Feature | Dependency | Install |
|---------|-----------|---------|
| GGUF Fallback | `llama-cpp-python>=0.3.0` | Optional: `pip install -e ".[gguf]"` |
| Others | None | All use existing deps (FastAPI, asyncio, YAML) |

### Config Schema Updates

```yaml
# Full additions to config.yaml
models:
  gguf_context_length: 4096
  gguf_gpu_layers: -1

presets:
  directory: "~/.opta-lmx/presets"
  enabled: true

server:
  websocket_enabled: true
  sse_events_enabled: true
  sse_heartbeat_interval_sec: 30
```

### Test Strategy

| Feature | Unit Tests | Integration Tests |
|---------|-----------|------------------|
| GGUF Backend | Mock Llama class, format detection | Skip (needs .gguf file) |
| WebSocket | Mock WebSocket, protocol messages | Skip (needs running server) |
| Presets | YAML parsing, preset application, routing | Preset endpoint tests |
| Auto-Download | Confirmation flow, token expiry | Download+load chain |
| SSE Feed | EventBus pub/sub, heartbeat | SSE endpoint test |

---

## Implementation Plan (per feature)

### Feature 3: Model Presets (do first)

1. Create `src/opta_lmx/presets/manager.py` with `Preset` dataclass + `PresetManager`
2. Create `presets/` example directory with 2-3 starter presets
3. Add `PresetsConfig` to `config.py`
4. Wire `PresetManager` into lifespan (`main.py`)
5. Add preset resolution to inference endpoint (`inference.py`)
6. Add 3 admin endpoints (`admin.py`)
7. Add `get_preset_manager()` to `deps.py`
8. Write tests

### Feature 4: Auto-Download on Load (do second)

1. Add `is_model_available()` to `ModelManager`
2. Add `auto_download` field to `AdminLoadRequest`
3. Add confirmation flow to `load_model` endpoint
4. Add `POST /admin/models/load/confirm` endpoint
5. Add `_load_after_download()` background task
6. Add pending download cleanup
7. Write tests

### Feature 1: GGUF Fallback (do third)

1. Create `src/opta_lmx/inference/backend.py` with `InferenceBackend` protocol
2. Create `src/opta_lmx/inference/mlx_backend.py` (extract from engine.py)
3. Create `src/opta_lmx/inference/gguf_backend.py`
4. Add `_detect_format()` to engine
5. Update `LoadedModel` with backend field
6. Add GGUF config fields
7. Add optional dependency to pyproject.toml
8. Write tests

### Feature 5: Admin SSE Feed (do fourth)

1. Create `src/opta_lmx/monitoring/events.py` with `EventBus`
2. Wire `EventBus` into lifespan
3. Add `/admin/events` SSE endpoint
4. Instrument engine, manager, metrics with `publish()` calls
5. Add SSE config fields
6. Create `1K-Optamize-Web/apps/lm-admin.html` dashboard page
7. Write tests

### Feature 2: WebSocket Streaming (do last)

1. Create `src/opta_lmx/api/websocket.py`
2. Add WebSocket endpoint with cancellation protocol
3. Wire into app router
4. Add config fields
5. Write tests
