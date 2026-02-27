---
title: KNOWLEDGE.md — Resource Guide & References
created: 2026-02-15
updated: 2026-02-15
type: reference
audience: All (learning & research)
status: Active
---

# KNOWLEDGE.md — Opta-LMX Knowledge Base

This file curates the best learning resources for each major component. Use this to find authoritative docs, examples, and reference material.

---

## 🔶 MLX — Inference Engine

### Official Documentation
| Resource | URL | Why Read | Key Chapters |
|----------|-----|----------|--------------|
| **MLX Docs** | https://ml-explore.github.io/mlx/ | Official framework guide | Installation, models, arrays, compute |
| **MLX GitHub** | https://github.com/ml-explore/mlx | Source code, issues, examples | Examples/, benchmark/, python/mlx/ |
| **MLX Python API** | https://ml-explore.github.io/mlx/build/html/python/index.html | Python binding reference | mlx.core, mlx.nn |

### MLX-LM (Model Loading & Generation)
| Resource | URL | Why Read |
|----------|-----|----------|
| **mlx-lm GitHub** | https://github.com/ml-explore/mlx-lm | Model loading, conversation, generation |
| **mlx-lm Docs** | https://github.com/ml-explore/mlx-lm/tree/main/docs | How to load models, run generation |
| **Supported Models** | https://huggingface.co/mlx-community | See which models have MLX weights |

### Key Concepts to Understand
- **Unified Memory** — M3 Ultra's zero-copy memory architecture (why MLX is fast)
- **Quantization** — 4-bit, 8-bit formats (reduces VRAM)
- **Token Generation** — How MLX.generate() works, streaming
- **Model Loading** — mlx_lm.load(), unload patterns

### Getting Started Code
```python
# Load a model (from mlx-lm)
from mlx_lm import load, generate

model, tokenizer = load("mlx-community/mistral-7b-instruct-v0.1")

# Generate with streaming
response = ""
for chunk in generate(model, tokenizer, prompt="Hello"):
    response += chunk
    print(chunk, end="", flush=True)
```

---

## 🟦 FastAPI — HTTP Server

### Official Documentation
| Resource | URL | Why Read |
|----------|-----|----------|
| **FastAPI Docs** | https://fastapi.tiangolo.com/ | Complete guide, examples, best practices |
| **FastAPI GitHub** | https://github.com/tiangolo/fastapi | Source, issues, discussions |
| **Starlette** (async framework) | https://www.starlette.io/ | Underlying ASGI framework |

### Key Concepts for LMX
- **Async/await** — All route handlers must be `async def`
- **Pydantic** — Request/response validation (v2+ API)
- **Streaming responses** — SSE (Server-Sent Events) format
- **Dependency Injection** — FastAPI's DI system (for shared state)
- **Background Tasks** — For non-blocking operations

### Common Patterns
```python
# Async route
@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest) -> ChatResponse:
    # request is auto-validated by Pydantic
    ...

# Streaming response
from fastapi.responses import StreamingResponse
@app.get("/v1/chat/completions")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in engine.generate(request.prompt):
            yield f"data: {chunk}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

# Dependency (shared state)
async def get_model_engine() -> ModelEngine:
    return model_engine
```

---

## 🟩 Pydantic V2 — Validation & Schemas

### Official Documentation
| Resource | URL | Why Read |
|----------|-----|----------|
| **Pydantic Docs** | https://docs.pydantic.dev/ | Full v2 API reference |
| **Pydantic GitHub** | https://github.com/pydantic/pydantic | Source, issues |

### Key Concepts
- **BaseModel** — Base class for all schemas
- **Field** — Validate individual fields (min_length, regex, etc.)
- **Validators** — Custom validation logic
- **model_dump_json()** — Serialize to JSON (replaces .json() in v1)

### Example for LMX
```python
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    model: str = Field(..., description="Model ID to use")
    messages: list[ChatMessage]
    temperature: float = Field(0.7, ge=0, le=2.0)
    stream: bool = False
```

---

## 🟨 OpenAI API — Specification & Compatibility

### Official References
| Resource | URL | Why Read |
|----------|-----|----------|
| **OpenAI API Docs** | https://platform.openai.com/docs/api-reference | Official API spec |
| **OpenAI Chat Completions** | https://platform.openai.com/docs/guides/chat | Full Chat API reference |
| **Python openai Library** | https://github.com/openai/openai-python | Reference SDK |

### LMX-Specific Reference
| File | Purpose |
|------|---------|
| `docs/research/openai-api-spec.md` | Our interpretation of the spec for LMX |
| `tests/test_openai_compat.py` | Test that LMX works with openai SDK |

### Request Format (MUST Match)
```python
POST /v1/chat/completions
{
    "model": "mistral-7b",
    "messages": [
        {"role": "user", "content": "Hello"}
    ],
    "temperature": 0.7,
    "stream": true
}
```

### Response Format (MUST Match)
```json
{
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "mistral-7b",
    "choices": [{
        "index": 0,
        "message": {
            "role": "assistant",
            "content": "Hello! How can I help you?"
        },
        "finish_reason": "stop"
    }],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30
    }
}
```

### Streaming Response (MUST Match)
```
data: {"choices":[{"delta":{"role":"assistant","content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
data: [DONE]
```

---

## 🟪 Apple Silicon Optimization

### Resources
| Resource | URL | Why Read |
|----------|-----|----------|
| **MLX Unified Memory Blog** | https://ml-explore.github.io/mlx/ | Why MLX is fast on Apple Silicon |
| **Apple Metal Performance Shaders** | https://developer.apple.com/metal/ | GPU acceleration primer |
| `docs/research/apple-silicon-optimization.md` | Our research findings | M3 Ultra-specific optimizations |

### Key Concepts
- **Unified Memory** — CPU and GPU share memory (no copy overhead)
- **Neural Engine** — Separate ML accelerator (not used by MLX yet)
- **Memory Bandwidth** — M3 Ultra: 800GB/s (vs 600GB/s on RTX 4090)
- **GPU Layer Placement** — Can split large models across CPU+GPU
- **Power Efficiency** — Lower thermal output than NVIDIA

---

## 🟥 HuggingFace Hub — Model Distribution

### Official Documentation
| Resource | URL | Why Read |
|----------|-----|----------|
| **HuggingFace Hub Docs** | https://huggingface.co/docs/hub/index | Hub platform guide |
| **huggingface_hub (Python)** | https://huggingface.co/docs/hub/security-tokens | Model downloading API |

### Common Patterns for LMX
```python
from huggingface_hub import hf_hub_download
import hashlib

# Download a model
model_path = hf_hub_download(
    repo_id="mlx-community/mistral-7b-instruct-v0.1",
    filename="model.safetensors"
)

# Verify SHA256
with open(model_path, 'rb') as f:
    sha256_hash = hashlib.sha256(f.read()).hexdigest()
    assert sha256_hash == expected_sha256, "Hash mismatch!"
```

### MLX Community Models
- **mlx-community org** — https://huggingface.co/mlx-community
- Popular conversions: Mistral, Llama, Phi, etc.
- Each model has `README.md` with usage instructions

---

## 📦 Project Management Tools

### Python Packaging
| Tool | URL | Purpose |
|------|-----|---------|
| **Poetry** or **pip-tools** | https://python-poetry.org/ | Dependency management |
| **pyproject.toml** | https://peps.python.org/pep-0621/ | Modern project config |

### Development Tools
| Tool | URL | Purpose |
|------|-----|---------|
| **pytest** | https://pytest.org/ | Testing framework |
| **ruff** | https://astral.sh/ruff | Fast Python linter |
| **mypy** | https://mypy.readthedocs.io/ | Static type checker |

### Example pyproject.toml Structure
```toml
[project]
name = "opta-lmx"
version = "0.1.0"
dependencies = [
    "mlx>=0.13.0",
    "mlx-lm>=0.9.0",
    "fastapi>=0.104.0",
    "uvicorn>=0.24.0",
    "pydantic>=2.0.0",
    "huggingface-hub>=0.19.0"
]

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]
```

---

## 🔍 Competitor Analysis & Learning

### Resources to Review
| Project | Why | Reference File |
|---------|-----|-----------------|
| **LM Studio** | What we're replacing | `docs/research/competitor-analysis.md` |
| **Ollama** | Model management approach | `docs/research/competitor-analysis.md` |
| **llama.cpp** | Raw inference performance | `docs/research/competitor-analysis.md` |
| **Jan.ai** | Local-first architecture | `docs/research/competitor-analysis.md` |
| **vLLM** | Continuous batching | `docs/research/competitor-analysis.md` |

See `docs/research/competitor-analysis.md` for detailed analysis.

---

## 🔗 Related LMX Documentation

### Internal Project Docs
| File | Purpose |
|------|---------|
| `APP.md` | Project identity & goals |
| `CLAUDE.md` | Python coding rules |
| `MASTER-PLAN.md` | Development phases |
| `DECISIONS.md` | Architecture choices |
| `GUARDRAILS.md` | Safety rules |
| `ECOSYSTEM.md` | System integration |
| `ROADMAP.md` | Phase breakdown |
| `OPTA-CLI-MIGRATION.md` | CLI integration plan |

### Research Outputs (Phase 0)
| File | Purpose |
|------|---------|
| `docs/research/existing-mlx-servers.md` | Landscape of MLX servers |
| `docs/research/mlx-capabilities.md` | What MLX can do |
| `docs/research/openai-api-spec.md` | Full OpenAI spec |
| `docs/research/competitor-analysis.md` | LM Studio, Ollama, etc. |
| `docs/research/apple-silicon-optimization.md` | M3 Ultra optimization |

---

## 🚀 Quick Links by Task

### "I need to understand MLX"
1. Read: `docs/research/mlx-capabilities.md` (our summary)
2. Then: https://ml-explore.github.io/mlx/ (official docs)
3. Try: https://github.com/ml-explore/mlx/tree/main/examples

### "I need to implement the API"
1. Read: `docs/research/openai-api-spec.md` (our spec)
2. Then: https://fastapi.tiangolo.com/ (FastAPI docs)
3. Try: `tests/test_openai_compat.py` (compatibility test)

### "I need to download models"
1. Read: `docs/GUARDRAILS.md` G-LMX-02 (SHA256 requirement)
2. Then: https://huggingface.co/docs/hub/security-tokens
3. Try: https://huggingface.co/mlx-community (available models)

### "I need to deploy to Mac Studio"
1. Read: `CLAUDE.md` §5 (deployment commands)
2. Then: `docs/GUARDRAILS.md` G-DEPLOY-01 (launchd plist)
3. Try: `docs/WORKFLOWS.md` (deployment workflow)

---

## 📚 Learning Path (For New Developers)

**Week 1: Foundation**
1. Read `APP.md` (30 min)
2. Read `CLAUDE.md` (30 min)
3. Watch MLX intro (15 min) — https://youtu.be/tLbBgfBo3ME
4. Read MLX docs basics (1 hour)

**Week 2: API & Integration**
1. Read OpenAI API spec (1 hour)
2. Read FastAPI tutorial (1 hour)
3. Read `docs/ECOSYSTEM.md` (30 min)
4. Try: Run `openai.ChatCompletion.create()` locally (1 hour)

**Week 3: Implementation**
1. Read `MASTER-PLAN.md` (Phase 2) (30 min)
2. Read `DECISIONS.md` (30 min)
3. Read `GUARDRAILS.md` (30 min)
4. Start coding Phase 2A scaffolding (2+ hours)

---

## Version Reference Table

| Component | Version | Why This Version |
|-----------|---------|------------------|
| Python | 3.11+ | Modern async/await, type hints |
| MLX | Latest | Bug fixes, performance, new models |
| mlx-lm | Latest | Tracks MLX updates |
| FastAPI | 0.104+ | Async native, good streaming |
| Pydantic | v2+ | Better validation, performance |
| huggingface_hub | Latest | Latest download/auth features |
| pytest | Latest | Good test discovery |

---

## How to Stay Updated

### Official Channels
- **MLX GitHub Releases** — https://github.com/ml-explore/mlx/releases
- **HuggingFace Discussions** — https://huggingface.co/mlx-community (join community)
- **OpenAI API Changelog** — https://platform.openai.com/docs/changelog

### Project-Specific
- Check `docs/research/` files regularly (they guide Phase 1 decisions)
- Update this file when you find new resources

---

*This knowledge base grows as we learn. Add new resources as you find them.*
