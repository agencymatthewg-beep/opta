# Claude Code Prompt — Opta-LMX Phase 2: MVP Implementation

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX/tasks/claude-prompt-phase2-mvp.md`

---

<context>
You are building Opta-LMX — a headless MLX inference server for Apple Silicon that replaces LM Studio.

**Read these files IN ORDER before doing anything:**
1. `APP.md` — Project identity, 12 non-negotiable capabilities
2. `CLAUDE.md` — Coding rules, project structure, constraints
3. `docs/plans/ARCHITECTURE.md` — Module map, data flows, deployment model, YAML config schema
4. `docs/plans/API-SPEC.md` — Full API contract (13 endpoints with schemas + examples)
5. `docs/plans/TECH-DECISIONS.md` — 12 justified decisions (fork vllm-mlx, FastAPI, port 1234, etc.)
6. `docs/GUARDRAILS.md` — Safety rules (90% memory cap, SHA256 verification, no cloud calls)
7. `docs/ROADMAP.md` — Phase 2 sub-phases (2A scaffolding, 2B inference core, 2C API, 2D testing)

**Key decision already made:** Fork vllm-mlx (https://github.com/waybarrios/vllm-mlx) as the base. It already has continuous batching, OpenAI API, streaming, tool calling. We add the Admin API layer on top.

**Target hardware:** Mac Studio M3 Ultra 512GB (primary), MacBook M4 Max 48GB (secondary)
**Port:** 1234 (drop-in LM Studio replacement)
**Python:** 3.11+
**Dependencies:** FastAPI, uvicorn, mlx, mlx-lm, huggingface_hub, pydantic, pyyaml, psutil
</context>

<instructions>
Develop a PLAN to implement Opta-LMX Phase 2 (MVP) in 4 sub-phases. The plan should be detailed enough that sub-agents can execute each phase independently.

**Phase 2A: Project Scaffolding**
- Clone/fork vllm-mlx into our project structure
- Create `pyproject.toml` with all dependencies pinned
- Set up the `src/opta_lmx/` package structure from ARCHITECTURE.md
- Create `config.yaml` with defaults from ARCHITECTURE.md Section 5
- Create `tests/conftest.py` with pytest fixtures
- Verify: `pip install -e .` works, `python -m opta_lmx` starts without error

**Phase 2B: Inference Core Integration**
- Wire vllm-mlx's inference engine into our `InferenceEngine` class
- Implement `load_model()`, `unload_model()`, `generate()`, `stream_generate()`
- Implement `MemoryMonitor` — track unified memory via psutil + MLX stats, enforce 90% cap
- Implement `ModelManager.list_available()` — scan models directory
- Verify: Can load an MLX model and generate tokens programmatically

**Phase 2C: API Layer**
- Mount inference routes: `POST /v1/chat/completions`, `GET /v1/models`
- Mount admin routes: `POST /admin/models/load`, `POST /admin/models/unload`, `GET /admin/status`, `GET /admin/health`, `GET /admin/memory`
- Implement Pydantic request/response models matching API-SPEC.md exactly
- SSE streaming format matching OpenAI exactly (`data: {json}\n\n` terminated by `data: [DONE]\n\n`)
- Error responses in OpenAI format: `{"error": {"message": "...", "type": "...", "code": "..."}}`
- Verify: `curl http://localhost:1234/v1/chat/completions` returns a valid response

**Phase 2D: Drop-in LM Studio Test**
- Start server on port 1234
- Test with OpenAI Python SDK: `openai.ChatCompletion.create(base_url="http://localhost:1234/v1")`
- Test streaming with SSE
- Test `GET /v1/models` returns loaded models
- Test admin endpoints: load model, check status, unload model
- Test memory monitoring: verify OOM prevention refuses oversize models
- Document any vllm-mlx compatibility issues found

**For each sub-phase, the plan must include:**
1. Exact files to create/modify with full paths
2. Key classes and functions with signatures
3. How it integrates with vllm-mlx (what we import vs what we override)
4. Dependencies between sub-phases
5. Test plan (what commands to run, expected output)
6. Sub-agents to spawn (which sub-phases can parallelize)
</instructions>

<constraints>
- Python 3.11+ with type hints on every function
- FastAPI + Uvicorn (async everywhere)
- Pydantic v2 for all request/response models
- YAML config (not JSON, not env-only)
- Port 1234 (non-negotiable — drop-in LM Studio replacement)
- Memory cap at 90% unified memory — refuse model load above this
- SHA256 verification on all model downloads
- Gateway/API tokens NEVER logged
- OpenAI API compatibility is sacred — any deviation is a bug
- All models must be Sendable/thread-safe (concurrent bot requests)
- Structured JSON logging
- No GUI, no Electron, pure Python
- Zero cloud API calls — this is a LOCAL inference server
- Follow the module structure in ARCHITECTURE.md exactly
</constraints>

<examples>
Example: Testing the MVP works
```bash
# Start server
python -m opta_lmx --config ~/.opta-lmx/config.yaml

# Check health
curl http://localhost:1234/admin/health
# Expected: {"status": "ok", "version": "0.1.0"}

# List models
curl http://localhost:1234/v1/models
# Expected: {"data": [{"id": "mlx-community/Mistral-7B-Instruct-4bit", "object": "model"}]}

# Chat completion
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mlx-community/Mistral-7B-Instruct-4bit", "messages": [{"role": "user", "content": "Hello"}]}'

# Admin: load a model
curl -X POST http://localhost:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -d '{"model_id": "mlx-community/Qwen2.5-7B-Instruct-4bit"}'

# Admin: check memory
curl http://localhost:1234/admin/memory
# Expected: {"total_gb": 512, "used_gb": 48.2, "available_gb": 463.8, "threshold_percent": 90}

# Admin: unload
curl -X POST http://localhost:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -d '{"model_id": "mlx-community/Qwen2.5-7B-Instruct-4bit"}'
```

Example: OpenAI SDK compatibility test
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:1234/v1", api_key="not-needed")
response = client.chat.completions.create(
    model="mlx-community/Mistral-7B-Instruct-4bit",
    messages=[{"role": "user", "content": "What is MLX?"}],
    stream=True
)
for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```
</examples>

<output>
Write the plan to: `tasks/plans/2026-02-15-phase2-mvp-plan.md`

Include:
1. Sub-phase breakdown (2A → 2B → 2C → 2D) with exact file lists
2. Dependency graph (2A blocks all; 2B blocks 2C; 2C blocks 2D)
3. vllm-mlx integration strategy (what to import, what to wrap, what to override)
4. Sub-agent assignments (2B inference + 2C API can partially parallelize after 2A)
5. Risk assessment (vllm-mlx API changes, MLX version compatibility)
6. Testing matrix (endpoint × method × expected result)
7. Estimated time per sub-phase
8. Definition of "MVP done" (minimum viable: load 1 model, chat completion works, admin status returns data)
</output>
