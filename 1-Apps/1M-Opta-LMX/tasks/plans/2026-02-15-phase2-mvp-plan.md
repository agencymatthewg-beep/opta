# Phase 2 MVP Implementation Plan — Opta-LMX

**Created:** 2026-02-15
**Status:** Ready for implementation
**Goal:** Working MVP that replaces LM Studio on port 1234

---

## Executive Summary

Build Opta-LMX as a Python package that uses vllm-mlx as a dependency (not a full fork). We import vllm-mlx's engine classes for MLX inference and build our own FastAPI application around them with both OpenAI-compatible inference routes and Opta-LMX admin routes.

**Why dependency over fork for Phase 2:** vllm-mlx's `server.py` bundles Gradio, MCP, audio, video, and embedding features we don't need. Forking means maintaining all that code. Instead, we import only the engine layer (`SimpleEngine`/`BatchedEngine`) and build a clean API layer on top. If we need to patch the engine later (Phase 4+), we can fork then.

**MVP Definition (Done When):**
1. Server starts on port 1234 with `python -m opta_lmx`
2. Loads one MLX model (e.g., `mlx-community/Mistral-7B-Instruct-4bit`)
3. `POST /v1/chat/completions` works (streaming + non-streaming)
4. `GET /v1/models` returns loaded models in OpenAI format
5. `GET /admin/health` returns `{"status": "ok", "version": "0.1.0"}`
6. `GET /admin/status` returns memory + model info
7. `POST /admin/models/load` and `/admin/models/unload` work
8. OpenAI Python SDK connects with zero config change
9. Memory usage stays under 90% threshold

---

## Dependency Graph

```
2A: Scaffolding ──┐
                  ├──► 2B: Inference Core ──► 2C: API Layer ──► 2D: Integration Tests
                  │
                  └──► (2C Pydantic schemas can start in parallel with 2B)
```

- **2A blocks everything** — project structure must exist first
- **2B blocks 2C** — API layer needs the engine to call
- **2C blocks 2D** — can't test endpoints that don't exist
- **Partial parallelism:** 2C's Pydantic request/response models can be written while 2B builds the engine (they're independent data structures)

---

## Sub-Phase 2A: Project Scaffolding

### Files to Create

| File | Purpose |
|------|---------|
| `pyproject.toml` | Project config, dependencies, entry points |
| `src/opta_lmx/__init__.py` | Package root, version string |
| `src/opta_lmx/main.py` | FastAPI app factory, uvicorn startup |
| `src/opta_lmx/config.py` | YAML config loading with Pydantic validation |
| `src/opta_lmx/inference/__init__.py` | Inference package |
| `src/opta_lmx/inference/engine.py` | InferenceEngine class (stub) |
| `src/opta_lmx/inference/schema.py` | Pydantic models (stub) |
| `src/opta_lmx/inference/streaming.py` | SSE streaming (stub) |
| `src/opta_lmx/inference/types.py` | Enums: FinishReason, Role |
| `src/opta_lmx/api/__init__.py` | API package |
| `src/opta_lmx/api/inference.py` | Inference routes (stub) |
| `src/opta_lmx/api/admin.py` | Admin routes (stub) |
| `src/opta_lmx/api/health.py` | Health routes (stub) |
| `src/opta_lmx/api/errors.py` | OpenAI error response helper |
| `src/opta_lmx/manager/__init__.py` | Manager package |
| `src/opta_lmx/manager/model.py` | ModelManager (stub) |
| `src/opta_lmx/manager/memory.py` | MemoryMonitor class |
| `src/opta_lmx/monitoring/__init__.py` | Monitoring package |
| `src/opta_lmx/monitoring/logging.py` | Structured JSON logging setup |
| `config/default-config.yaml` | Default YAML config template |
| `tests/__init__.py` | Tests package |
| `tests/conftest.py` | Pytest fixtures (app client, mock engine) |

### pyproject.toml — Key Details

```toml
[project]
name = "opta-lmx"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "vllm-mlx>=0.2.6",           # MLX inference engine
    "fastapi>=0.104.0",           # HTTP server
    "uvicorn[standard]>=0.24.0",  # ASGI server
    "pydantic>=2.0",              # Request/response validation
    "pyyaml>=6.0",                # Config parsing
    "psutil>=5.9",                # Memory monitoring
    "huggingface-hub>=0.20",      # Model downloads
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-asyncio>=0.21",
    "httpx>=0.25",               # For TestClient
    "ruff>=0.1",
    "mypy>=1.0",
    "openai>=1.0",               # For compat tests
]

[project.scripts]
opta-lmx = "opta_lmx.main:cli"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### config/default-config.yaml

```yaml
server:
  host: "127.0.0.1"
  port: 1234
  workers: 1
  timeout_sec: 300

models:
  default_model: null
  models_directory: "/Users/Shared/Opta-LMX/models"
  auto_load: []
  use_batching: true

memory:
  max_memory_percent: 90
  auto_evict_lru: true

logging:
  level: "INFO"
  format: "structured"
  file: null  # null = stderr only
```

### config.py — Key Class

```python
from pydantic import BaseModel, Field
from pathlib import Path
import yaml

class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 1234
    workers: int = 1
    timeout_sec: int = 300

class ModelsConfig(BaseModel):
    default_model: str | None = None
    models_directory: Path = Path("/Users/Shared/Opta-LMX/models")
    auto_load: list[str] = []
    use_batching: bool = True

class MemoryConfig(BaseModel):
    max_memory_percent: int = 90
    auto_evict_lru: bool = True

class LoggingConfig(BaseModel):
    level: str = "INFO"
    format: str = "structured"
    file: str | None = None

class LMXConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    models: ModelsConfig = ModelsConfig()
    memory: MemoryConfig = MemoryConfig()
    logging: LoggingConfig = LoggingConfig()

def load_config(path: Path | None = None) -> LMXConfig:
    """Load config from YAML file, falling back to defaults."""
    ...
```

### main.py — App Factory

```python
from fastapi import FastAPI
import uvicorn

def create_app(config: LMXConfig) -> FastAPI:
    """Create FastAPI application with all routes mounted."""
    app = FastAPI(title="Opta-LMX", version="0.1.0")
    # Mount routes in 2C
    return app

def cli():
    """CLI entry point: parse args, load config, start uvicorn."""
    ...

if __name__ == "__main__":
    cli()
```

### Verification

```bash
cd ~/Synced/Opta/1-Apps/1J-Opta-LMX
pip install -e ".[dev]"
python -c "import opta_lmx; print(opta_lmx.__version__)"
# Expected: 0.1.0
python -m opta_lmx --help
# Expected: shows CLI help (host, port, config options)
```

---

## Sub-Phase 2B: Inference Core Integration

### What We Import from vllm-mlx

```python
# vllm-mlx provides two engine classes:
from vllm_mlx.engine_core import SimpleEngine   # Single-request, max throughput
from vllm_mlx.engine_core import BatchedEngine  # Continuous batching, concurrent

# We also use its model loading infrastructure:
# - SimpleEngine.from_model_name(model_name) → loads model
# - engine.chat(messages, ...) → generate response
# - engine.generate(prompt, ...) → text completion
```

### What We Build (Our Wrapper)

The `InferenceEngine` class wraps vllm-mlx's engines and adds:
- Model lifecycle management (load multiple, track state, unload)
- Memory checking before load (delegates to MemoryMonitor)
- Standardized response formatting
- Error handling that never crashes

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/opta_lmx/inference/engine.py` | **Implement** | InferenceEngine wrapping vllm-mlx |
| `src/opta_lmx/inference/schema.py` | **Implement** | All Pydantic request/response models |
| `src/opta_lmx/inference/streaming.py` | **Implement** | SSE chunk formatting |
| `src/opta_lmx/inference/types.py` | **Implement** | Enums and type aliases |
| `src/opta_lmx/manager/memory.py` | **Implement** | MemoryMonitor with psutil |

### InferenceEngine — Full Design

```python
class InferenceEngine:
    """Manages MLX model lifecycle and inference via vllm-mlx."""

    def __init__(self, config: ModelsConfig, memory_monitor: MemoryMonitor) -> None:
        self._models: dict[str, LoadedModel] = {}  # model_id → engine instance
        self._config = config
        self._memory = memory_monitor

    async def load_model(self, model_id: str, use_batching: bool = True) -> ModelInfo:
        """Load an MLX model into memory.

        Steps:
        1. Check if already loaded → return existing
        2. MemoryMonitor.can_load() → refuse if >90%
        3. Instantiate vllm-mlx engine (SimpleEngine or BatchedEngine)
        4. Register in self._models
        5. Return ModelInfo with memory usage
        """
        ...

    async def unload_model(self, model_id: str) -> None:
        """Unload model, free memory.

        Steps:
        1. Check if model exists in self._models
        2. Delete engine reference
        3. Force garbage collection (gc.collect(), mlx.core.metal.clear_cache())
        """
        ...

    async def generate(
        self, model_id: str, messages: list[ChatMessage],
        temperature: float = 0.7, max_tokens: int | None = None,
        top_p: float = 1.0, stop: list[str] | None = None,
        tools: list[dict] | None = None,
    ) -> CompletionResponse:
        """Non-streaming completion. Returns full response."""
        ...

    async def stream_generate(
        self, model_id: str, messages: list[ChatMessage],
        temperature: float = 0.7, max_tokens: int | None = None,
        top_p: float = 1.0, stop: list[str] | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """Streaming completion. Yields SSE chunks."""
        ...

    def get_loaded_models(self) -> list[ModelInfo]:
        """Return list of currently loaded models."""
        ...

    def is_model_loaded(self, model_id: str) -> bool:
        ...
```

### MemoryMonitor — Full Design

```python
class MemoryMonitor:
    """Track unified memory usage, enforce 90% cap."""

    def __init__(self, max_percent: int = 90) -> None:
        self._max_percent = max_percent

    def total_memory_gb(self) -> float:
        """Total unified memory (e.g., 512 for Mac Studio)."""
        return psutil.virtual_memory().total / (1024 ** 3)

    def available_memory_gb(self) -> float:
        """Currently available memory."""
        return psutil.virtual_memory().available / (1024 ** 3)

    def used_memory_gb(self) -> float:
        """Currently used memory."""
        return psutil.virtual_memory().used / (1024 ** 3)

    def usage_percent(self) -> float:
        """Current memory usage as percentage."""
        return psutil.virtual_memory().percent

    def can_load(self, estimated_size_gb: float) -> bool:
        """Check if loading a model of given size would exceed threshold."""
        current = self.usage_percent()
        additional = (estimated_size_gb / self.total_memory_gb()) * 100
        return (current + additional) < self._max_percent

    def get_status(self) -> MemoryStatus:
        """Return full memory status for API response."""
        ...
```

### LoadedModel — Internal Tracking

```python
@dataclass
class LoadedModel:
    model_id: str
    engine: Any  # SimpleEngine or BatchedEngine
    loaded_at: float  # timestamp
    use_batching: bool
    estimated_memory_gb: float
```

### Key Integration Points with vllm-mlx

| Our Method | vllm-mlx Call | Notes |
|-----------|---------------|-------|
| `load_model()` | `SimpleEngine(model_name)` or `BatchedEngine(model_name)` | Pass model HF ID directly |
| `generate()` | `engine.chat(messages, ...)` | vllm-mlx returns full text |
| `stream_generate()` | `engine.chat(messages, stream=True)` | vllm-mlx yields token chunks |
| `unload_model()` | `del engine; gc.collect()` | MLX memory freed on GC |

### Verification

```python
# tests/test_inference.py (requires real MLX model — integration test)
async def test_load_and_generate():
    engine = InferenceEngine(config, memory_monitor)
    info = await engine.load_model("mlx-community/Qwen2.5-0.5B-Instruct-4bit")
    assert info.model_id == "mlx-community/Qwen2.5-0.5B-Instruct-4bit"

    response = await engine.generate(
        model_id="mlx-community/Qwen2.5-0.5B-Instruct-4bit",
        messages=[{"role": "user", "content": "Say hello"}],
    )
    assert len(response.choices) == 1
    assert response.choices[0].message.content  # non-empty
```

---

## Sub-Phase 2C: API Layer

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/opta_lmx/api/inference.py` | **Implement** | `/v1/chat/completions`, `/v1/models` |
| `src/opta_lmx/api/admin.py` | **Implement** | `/admin/models/load`, `/admin/models/unload`, `/admin/status` |
| `src/opta_lmx/api/health.py` | **Implement** | `/admin/health`, `/admin/memory` |
| `src/opta_lmx/api/errors.py` | **Implement** | OpenAI error format helper |
| `src/opta_lmx/main.py` | **Modify** | Mount all route groups |
| `src/opta_lmx/inference/schema.py` | **Finalize** | All request/response Pydantic models |

### Inference Routes

#### POST /v1/chat/completions

```python
@router.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest) -> Response:
    """OpenAI-compatible chat completion.

    Non-streaming: returns ChatCompletionResponse JSON
    Streaming: returns StreamingResponse with SSE chunks
    """
    if request.stream:
        return StreamingResponse(
            _stream_response(request),
            media_type="text/event-stream",
        )
    else:
        response = await engine.generate(
            model_id=request.model,
            messages=request.messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            top_p=request.top_p,
            stop=request.stop,
            tools=request.tools,
        )
        return response
```

#### GET /v1/models

```python
@router.get("/v1/models")
async def list_models() -> ModelsListResponse:
    """Return loaded models in OpenAI format."""
    models = engine.get_loaded_models()
    return ModelsListResponse(
        object="list",
        data=[ModelObject(id=m.model_id, object="model", ...) for m in models]
    )
```

### Admin Routes

#### POST /admin/models/load

```python
@router.post("/admin/models/load")
async def load_model(request: AdminLoadRequest) -> AdminLoadResponse:
    """Load a model into memory."""
    if not memory_monitor.can_load(estimated_size):
        raise HTTPException(507, detail="Insufficient memory")
    info = await engine.load_model(request.model_id)
    return AdminLoadResponse(success=True, model_id=request.model_id, ...)
```

#### POST /admin/models/unload

```python
@router.post("/admin/models/unload")
async def unload_model(request: AdminUnloadRequest) -> AdminUnloadResponse:
    """Unload a model and free memory."""
    await engine.unload_model(request.model_id)
    return AdminUnloadResponse(success=True, model_id=request.model_id, ...)
```

#### GET /admin/status

```python
@router.get("/admin/status")
async def get_status() -> AdminStatusResponse:
    """System status: memory, models, uptime."""
    return AdminStatusResponse(
        version="0.1.0",
        uptime_seconds=...,
        loaded_models=len(engine.get_loaded_models()),
        models=[m.model_id for m in engine.get_loaded_models()],
        memory=memory_monitor.get_status(),
    )
```

#### GET /admin/health

```python
@router.get("/admin/health")
async def health_check() -> dict:
    """Simple health check."""
    return {"status": "ok", "version": "0.1.0"}
```

#### GET /admin/memory

```python
@router.get("/admin/memory")
async def memory_status() -> AdminMemoryResponse:
    """Detailed memory breakdown."""
    return memory_monitor.get_detailed_status(engine.get_loaded_models())
```

### Pydantic Models (schema.py) — Critical Shapes

```python
# Request
class ChatMessage(BaseModel):
    role: str  # system, user, assistant, tool
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None

class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float = Field(0.7, ge=0, le=2.0)
    top_p: float = Field(1.0, ge=0, le=1.0)
    max_tokens: int | None = None
    stream: bool = False
    stop: str | list[str] | None = None
    tools: list[dict] | None = None
    tool_choice: str | dict | None = None
    response_format: dict | None = None
    frequency_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    presence_penalty: float = Field(0.0, ge=-2.0, le=2.0)

# Response (non-streaming)
class ChatCompletionResponse(BaseModel):
    id: str  # "chatcmpl-xxx"
    object: str = "chat.completion"
    created: int  # unix timestamp
    model: str
    choices: list[Choice]
    usage: Usage

class Choice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str  # "stop", "length", "tool_calls"

class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

# Response (streaming chunk)
class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChunkChoice]

class ChunkChoice(BaseModel):
    index: int = 0
    delta: dict  # {"role": "assistant"} or {"content": "token"} or {}
    finish_reason: str | None = None

# Error response
class ErrorResponse(BaseModel):
    error: ErrorDetail

class ErrorDetail(BaseModel):
    message: str
    type: str
    param: str | None = None
    code: str | None = None
```

### SSE Streaming Format (streaming.py)

```python
async def format_sse_stream(
    chunks: AsyncIterator[StreamChunk],
    request_id: str,
    model: str,
) -> AsyncIterator[str]:
    """Convert engine chunks to OpenAI SSE format.

    Each chunk: 'data: {json}\n\n'
    Final:      'data: [DONE]\n\n'
    """
    created = int(time.time())

    # First chunk: role
    yield f"data: {json.dumps({...role delta...})}\n\n"

    # Content chunks
    async for chunk in chunks:
        yield f"data: {json.dumps({...content delta...})}\n\n"

    # Final chunk: finish_reason
    yield f"data: {json.dumps({...finish delta...})}\n\n"

    # Done sentinel
    yield "data: [DONE]\n\n"
```

### Error Handling (errors.py)

```python
def openai_error(status_code: int, message: str, error_type: str,
                 param: str | None = None, code: str | None = None) -> JSONResponse:
    """Return an OpenAI-format error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": message,
                "type": error_type,
                "param": param,
                "code": code,
            }
        }
    )
```

### Verification

```bash
# Start server
python -m opta_lmx --config config/default-config.yaml

# Health check
curl http://localhost:1234/admin/health
# Expected: {"status": "ok", "version": "0.1.0"}

# List models (empty initially)
curl http://localhost:1234/v1/models
# Expected: {"object": "list", "data": []}

# Load a model via admin
curl -X POST http://localhost:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -d '{"model_id": "mlx-community/Qwen2.5-0.5B-Instruct-4bit"}'

# Chat completion (non-streaming)
curl -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mlx-community/Qwen2.5-0.5B-Instruct-4bit","messages":[{"role":"user","content":"Hello"}]}'

# Chat completion (streaming)
curl -N -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mlx-community/Qwen2.5-0.5B-Instruct-4bit","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

---

## Sub-Phase 2D: Drop-in LM Studio Test

### Test Matrix

| Test | Method | Endpoint | Expected Result |
|------|--------|----------|-----------------|
| Health check | GET | `/admin/health` | `{"status": "ok"}` |
| System status | GET | `/admin/status` | Memory + model info JSON |
| Memory info | GET | `/admin/memory` | Detailed memory breakdown |
| List models (empty) | GET | `/v1/models` | `{"object": "list", "data": []}` |
| Load model | POST | `/admin/models/load` | `{"success": true, ...}` |
| List models (loaded) | GET | `/v1/models` | Contains loaded model |
| Chat non-streaming | POST | `/v1/chat/completions` | Full response with choices |
| Chat streaming | POST | `/v1/chat/completions` | SSE chunks + `[DONE]` |
| Unload model | POST | `/admin/models/unload` | `{"success": true, ...}` |
| List models (empty again) | GET | `/v1/models` | `{"object": "list", "data": []}` |
| Chat with unloaded model | POST | `/v1/chat/completions` | 404 model_not_found error |
| Invalid request (no model) | POST | `/v1/chat/completions` | 422 validation error |
| Invalid request (no messages) | POST | `/v1/chat/completions` | 422 validation error |
| OpenAI SDK non-streaming | Python | `client.chat.completions.create()` | Response parses correctly |
| OpenAI SDK streaming | Python | `client.chat.completions.create(stream=True)` | Chunks iterate correctly |
| OpenAI SDK list models | Python | `client.models.list()` | Models list correctly |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/test_api.py` | FastAPI TestClient tests for all routes |
| `tests/test_inference.py` | Engine unit tests (mock vllm-mlx) |
| `tests/test_openai_compat.py` | OpenAI SDK integration tests |
| `tests/test_admin.py` | Admin endpoint tests |
| `tests/test_memory.py` | MemoryMonitor tests |
| `tests/test_config.py` | Config loading tests |

### OpenAI SDK Compatibility Test

```python
# tests/test_openai_compat.py
from openai import OpenAI

def test_openai_sdk_non_streaming():
    client = OpenAI(base_url="http://localhost:1234/v1", api_key="not-needed")
    response = client.chat.completions.create(
        model="mlx-community/Qwen2.5-0.5B-Instruct-4bit",
        messages=[{"role": "user", "content": "Say hello in 5 words"}],
        stream=False,
    )
    assert response.id.startswith("chatcmpl-")
    assert response.object == "chat.completion"
    assert response.choices[0].message.role == "assistant"
    assert len(response.choices[0].message.content) > 0
    assert response.choices[0].finish_reason in ("stop", "length")
    assert response.usage.total_tokens > 0

def test_openai_sdk_streaming():
    client = OpenAI(base_url="http://localhost:1234/v1", api_key="not-needed")
    stream = client.chat.completions.create(
        model="mlx-community/Qwen2.5-0.5B-Instruct-4bit",
        messages=[{"role": "user", "content": "Say hello"}],
        stream=True,
    )
    chunks = list(stream)
    assert len(chunks) > 0
    assert chunks[-1].choices[0].finish_reason == "stop"

def test_openai_sdk_list_models():
    client = OpenAI(base_url="http://localhost:1234/v1", api_key="not-needed")
    models = client.models.list()
    assert hasattr(models, "data")
```

### Verification Commands

```bash
# Run all unit tests
pytest tests/test_api.py tests/test_inference.py tests/test_config.py tests/test_memory.py -v

# Run integration tests (requires running server + loaded model)
pytest tests/test_openai_compat.py -v --log-cli-level=DEBUG

# Run full suite with coverage
pytest tests/ --cov=src/opta_lmx -v
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| vllm-mlx engine API changes between versions | Medium | High | Pin `vllm-mlx>=0.2.6,<0.3.0` in pyproject.toml |
| vllm-mlx SimpleEngine/BatchedEngine constructor signatures change | Medium | High | Wrap in try/except with version-specific fallback |
| MLX model loading OOM on MacBook (48GB) | High | Medium | Use small test model (0.5B); MemoryMonitor enforces 90% cap |
| SSE streaming format doesn't match OpenAI exactly | Medium | High | Test with OpenAI SDK on every commit (2D tests) |
| vllm-mlx's engine.chat() returns different structure than expected | Medium | Medium | Write adapter layer in engine.py; parse whatever vllm-mlx returns |
| Port 1234 conflict with running LM Studio | Low | Low | Check port on startup, clear error message |
| psutil memory reporting differs from MLX actual usage | Medium | Medium | Cross-validate with `mlx.core.metal.get_active_memory()` |

---

## Sub-Agent Assignments

### Recommended Execution Strategy

**Sequential with partial overlap:**

1. **Agent 1 (Scaffolding):** Execute Phase 2A — create all files, pyproject.toml, verify `pip install -e .`
2. **Agent 2 (Inference):** After 2A completes, implement engine.py + memory.py + types.py
3. **Agent 3 (Schemas):** Can start in parallel with Agent 2 — implement all Pydantic models in schema.py (independent of engine)
4. **Agent 4 (API):** After 2B + schemas complete, implement all routes + streaming + errors
5. **Agent 5 (Tests):** After 2C completes, write all tests + run verification

**Parallelizable pairs:**
- 2B (engine internals) + 2C schemas (Pydantic models) — independent data structures
- 2D unit tests (mocked) can start before integration tests

---

## Implementation Notes

### vllm-mlx Engine Usage Pattern

```python
# How vllm-mlx engines work (from reading server.py):

# SimpleEngine — synchronous, one request at a time
from vllm_mlx.engine_core import SimpleEngine
engine = SimpleEngine(model_name="mlx-community/Qwen2.5-0.5B-Instruct-4bit")
# engine.chat(messages=[...], temperature=0.7, max_tokens=100)
# Returns: full text response

# BatchedEngine — async, continuous batching
from vllm_mlx.engine_core import BatchedEngine
engine = BatchedEngine(model_name="mlx-community/Qwen2.5-0.5B-Instruct-4bit")
# await engine.start()  # Must be started for batched mode
# engine.chat(messages=[...], stream=True)
# Returns: async iterator of chunks
```

### Key Differences from vllm-mlx server.py

| vllm-mlx server.py | Our main.py | Why Different |
|--------------------|----|---|
| Loads ONE model at startup | Loads ZERO models; load via admin API or auto_load config | Multi-model support |
| Global `_engine` variable | `InferenceEngine` class with model dict | Clean architecture |
| Includes Gradio, MCP, audio, embeddings | Inference + Admin only | Minimal MVP |
| No admin endpoints | Full admin API | Bot autonomy requirement |
| No memory monitoring | MemoryMonitor with 90% cap | GUARDRAILS G-LMX-01 |

### Structured Logging Setup

```python
# monitoring/logging.py
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        return json.dumps(log_data)

def setup_logging(level: str = "INFO", structured: bool = True) -> None:
    """Configure structured JSON logging."""
    ...
```

---

## File Count Summary

| Sub-Phase | New Files | Modified Files | Total |
|-----------|-----------|---------------|-------|
| 2A | 22 | 0 | 22 |
| 2B | 0 | 5 (fill stubs) | 5 |
| 2C | 0 | 6 (fill stubs + mount routes) | 6 |
| 2D | 6 (test files) | 0 | 6 |
| **Total** | **28** | **11** | **39** |

---

*This plan is the source of truth for Phase 2 implementation. Execute sub-phases in order. Test at each boundary.*
