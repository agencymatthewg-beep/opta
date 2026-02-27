---
title: CLAUDE.md — Coding Rules for Opta-LMX
created: 2026-02-15
updated: 2026-02-15
type: development-guide
audience: Claude Code (coding agent)
status: Active
---

# CLAUDE.md — Opta-LMX Coding Rules

This file defines how Claude Code should approach coding work on Opta-LMX. **Read this before every coding session.**

---

## 1. Foundations

### Language & Version
- **Python 3.11+** — type hints required everywhere
- **No Python < 3.11** — features like `from __future__ import annotations` must work
- **Async/await first** — all I/O is async, use `asyncio` throughout
- **Type hints in signatures AND docstrings** — `def foo(x: int) -> str: ...`

### Key Technologies
| Tech | Role | Version |
|------|------|---------|
| **MLX** | Inference engine | Latest (Apple) |
| **mlx-lm** | Model loading & generation | Tracks MLX |
| **FastAPI** | HTTP API server | 0.104+ |
| **Uvicorn** | ASGI server | 0.24+ |
| **Pydantic** | Request/response validation | v2+ |
| **huggingface_hub** | Model downloads | Latest |
| **llama-cpp-python** | GGUF fallback | Latest |
| **pytest** | Testing | Latest |

### Project Structure (from MASTER-PLAN.md)
```
opta-lmx/
├── pyproject.toml              # Project config, deps, build
├── src/opta_lmx/               # Main package
│   ├── __init__.py
│   ├── main.py                 # Entry point (uvicorn)
│   ├── config.py               # Configuration loading
│   ├── inference/              # MLX inference core
│   │   ├── __init__.py
│   │   ├── engine.py           # MLX model loading/generation
│   │   ├── schema.py           # Type models
│   │   └── streaming.py        # SSE streaming logic
│   ├── api/                    # FastAPI routes
│   │   ├── __init__.py
│   │   ├── inference.py        # /v1/chat/completions, /v1/models
│   │   ├── admin.py            # /admin/load, /admin/unload, etc.
│   │   └── health.py           # Health checks
│   ├── manager/                # Model + memory management
│   │   ├── __init__.py
│   │   ├── model.py            # Model inventory, download
│   │   ├── memory.py           # Memory monitoring
│   │   └── gguf.py             # GGUF fallback handler
│   └── router/                 # Smart routing (Phase 4)
│       ├── __init__.py
│       └── strategy.py         # Task-to-model routing
├── tests/
│   ├── conftest.py             # pytest fixtures
│   ├── test_api.py             # API contract tests
│   ├── test_inference.py       # MLX tests
│   ├── test_manager.py         # Model manager tests
│   └── test_integration.py     # End-to-end tests
├── docs/                       # All docs (already populated)
└── README.md
```

---

## 2. Code Patterns & Conventions

### Async First
```python
# ✅ Good
async def stream_completion(request: CompletionRequest) -> AsyncIterator[str]:
    async for chunk in engine.generate(request.prompt):
        yield chunk

# ❌ Wrong
def stream_completion(request: CompletionRequest):
    for chunk in engine.generate(request.prompt):
        yield chunk
```

### Pydantic for All API Types
```python
# ✅ From Pydantic v2
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str = Field(..., min_length=1)
    tool_calls: list[ToolCall] | None = None

class CompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float = Field(0.7, ge=0, le=2.0)
    stream: bool = False
```

### Error Handling (Never Crash)
```python
# ✅ Graceful degradation
try:
    await engine.load_model(model_id)
except OOMError as e:
    logger.error(f"OOM loading {model_id}: {e}")
    # Unload smaller model, retry
    await engine.unload_least_used()
    await engine.load_model(model_id)
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise HTTPException(status_code=500, detail="Model load failed")

# ❌ Never do this
except Exception:
    pass  # Silent failure = debugging nightmare
```

### Logging (Structured, Queryable)
```python
# ✅ Good — every relevant event logged with context
import logging
logger = logging.getLogger(__name__)

logger.info("model_loaded", extra={
    "model_id": model_id,
    "size_gb": size_gb,
    "duration_sec": elapsed,
    "memory_used_pct": memory_pct
})

# ❌ Avoid
print(f"Loaded {model_id}")  # Not structured, not queryable
```

### Type Hints Everywhere
```python
# ✅ Full typing
async def select_model(
    task: str,
    available: dict[str, ModelInfo],
    preferences: RoutingPreferences | None = None
) -> ModelInfo:
    """Select best model for task."""
    ...

# ❌ Incomplete
def select_model(task, available, preferences=None):
    ...
```

---

## 3. OpenAI API Compatibility (Non-Negotiable)

### What "Compatible" Means
- Any Python `openai` SDK client must work with zero config changes
- Requests sent to LMX `/v1/chat/completions` must return the exact same JSON shape
- Streaming responses must be identical SSE format
- Error codes must match OpenAI conventions

### Reference Docs
- See: `docs/research/openai-api-spec.md` (Appendix A)
- See: `docs/DECISIONS.md` for why this is non-negotiable
- **Test**: Every API change must pass OpenAI SDK compatibility test

### Key Contract Points
```python
# Request shape (exact OpenAI format)
POST /v1/chat/completions
{
    "model": "mlx/mistral",
    "messages": [{"role": "user", "content": "..."}],
    "stream": true,
    "temperature": 0.7
}

# Response shape (streaming)
data: {"choices": [{"delta": {"role": "assistant", "content": "token"}}]}
data: {"choices": [{"delta": {"content": "more"}}]}
data: [DONE]

# Response shape (non-streaming)
{
    "id": "chatcmpl-xxx",
    "choices": [{"message": {"role": "assistant", "content": "response"}}],
    "usage": {"prompt_tokens": 10, "completion_tokens": 20}
}
```

---

## 4. Testing Requirements

### Unit Tests (pytest)
- **Router logic**: Task classification, model selection
- **Model manager**: Download, convert, inventory tracking
- **Config parsing**: YAML validation
- **Memory monitor**: Threshold detection, reporting

```bash
# Run unit tests
pytest tests/test_*.py -v

# With coverage
pytest --cov=src/opta_lmx tests/
```

### Integration Tests
- Load real (small) MLX model
- Send actual completion request
- Verify streaming output format
- Verify non-streaming response shape

```bash
# Run integration tests
pytest tests/test_integration.py -v --log-cli-level=DEBUG
```

### API Contract Tests
- Load OpenAI Python SDK
- Point at LMX on port 1234
- Run standard chat completion examples
- Verify response format matches OpenAI

```python
# Example: tests/test_openai_compat.py
import openai
openai.api_base = "http://localhost:1234/v1"
openai.api_key = "not-used-locally"

response = openai.ChatCompletion.create(
    model="mlx/mistral",
    messages=[{"role": "user", "content": "Hello"}],
    stream=False
)
assert "choices" in response
assert response["choices"][0]["message"]["role"] == "assistant"
```

---

## 5. Build, Test, Run

### Install for Development
```bash
cd ~/Synced/Opta/1-Apps/1M-Opta-LMX
pip install -e ".[dev]"  # Editable install with dev deps
```

### Run Tests
```bash
pytest tests/ -v                          # All tests
pytest tests/test_api.py -v               # API only
pytest tests/ --cov=src -v                # With coverage
```

### Run Locally (for debugging)
```bash
# Start on port 1234 (replace LM Studio)
uvicorn src.opta_lmx.main:app --host 127.0.0.1 --port 1234

# Or with debug logging
LOGLEVEL=DEBUG uvicorn src.opta_lmx.main:app --host 127.0.0.1 --port 1234 --log-level debug

# In another terminal, test it
curl -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mlx/mistral","messages":[{"role":"user","content":"Hello"}]}'
```

### Run as Daemon (Production)
```bash
# Install plist
sudo cp docs/launchd/com.opta.lmx.plist /Library/LaunchDaemons/

# Start
launchctl load /Library/LaunchDaemons/com.opta.lmx.plist

# Check logs
log stream --level debug --predicate 'process == "opta-lmx"'

# Stop
launchctl unload /Library/LaunchDaemons/com.opta.lmx.plist
```

---

## 6. Key Constraints & Requirements

### Constraints (Hard Limits)
| Constraint | Reason |
|-----------|--------|
| **No GUI ever** | This is a daemon, not an app |
| **No Electron/web UI** | Would complicate deployment, add deps |
| **Pure Python** | MLX is Python-native; leverage that |
| **Apple Silicon only** | MLX doesn't run on x86. Not a goal to support it. |
| **< 90% unified memory** | Beyond this is OOM risk |
| **Never crash on OOM** | Unload model + return error instead |
| **OpenAI API compat** | Any breaking change = bug |

### Requirements (From APP.md)
See full list in [APP.md §4 — Core Capabilities](../APP.md#4-core-capabilities-non-negotiable). Implement in order:
1. OpenAI-compatible `/v1/chat/completions` ✓ (Phase 2B)
2. MLX-native inference ✓ (Phase 2B)
3. SSE streaming ✓ (Phase 2C)
4. Tool/function calling pass-through ✓ (Phase 2C)
5. Headless daemon operation ✓ (Phase 2A)
6-12. Admin API, memory monitoring, concurrency, GGUF fallback, etc.

---

## 7. Before Every Coding Session

**Checklist (non-negotiable):**
- [ ] Read `APP.md` (identity, purpose, 12 non-negotiable capabilities)
- [ ] Check `docs/MASTER-PLAN.md` for current phase
- [ ] Check `docs/GUARDRAILS.md` for safety rules
- [ ] Verify you understand the current task (what phase? what component?)
- [ ] Understand any recent decisions from `docs/DECISIONS.md`

**For complex changes:**
- [ ] Write a plan in `docs/plans/` (or a comment in the task)
- [ ] Link to relevant research in `docs/research/`
- [ ] Test locally before merging/committing
- [ ] Update docs if you change architecture or API

---

## 8. Common Questions

**Q: Should I use `mlx-lm` or raw `mlx`?**
A: Use `mlx-lm` whenever possible. It provides model loading, generation utilities, and handles quantization. Only use raw `mlx` if you need custom kernels (you probably don't).

**Q: Streams or async generators?**
A: Async generators (`AsyncIterator[T]`) for FastAPI streaming. FastAPI converts them to SSE automatically.

**Q: Where do I put model weights?**
A: `/Users/Shared/Opta-LMX/models/` on Mac Studio (managed by launchd plist). Configurable via `~/.opta-lmx/config.yaml`.

**Q: How do I handle tool/function calling?**
A: Pass through request format unchanged. Decode `tool_calls` in response and return unchanged. Don't try to parse/validate tool definitions — that's the client's job.

**Q: How much memory can I allocate to models?**
A: Never exceed 90% of available unified memory. Check `psutil.virtual_memory()` before loading.

**Q: What if a model load fails?**
A: Log the error, return 400 or 503, try to unload least-recently-used model, return to user (don't crash).

---

## 9. Guardrails (Safety First)

See `docs/GUARDRAILS.md` for full rules. Key ones for development:
- C01: No keys/tokens in logs
- C02: No hardcoded credentials
- C06: All model downloads verified (SHA256)
- LMX-specific: Never exceed 90% memory, graceful degradation over crash

**On doubt:** Read `docs/GUARDRAILS.md` or ask Matthew.

---

## References
- Project charter: `APP.md` (read first)
- Architecture plan: `docs/plans/MASTER-PLAN.md`
- API details: `docs/research/openai-api-spec.md`
- MLX guide: `docs/research/mlx-capabilities.md`
- Safety rules: `docs/GUARDRAILS.md`

---

*This file defines the standard for all Python code on Opta-LMX. Update it as patterns evolve, but keep the core principles stable.*
