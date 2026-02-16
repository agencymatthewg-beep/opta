# Existing MLX-based Inference Servers & API Projects
*Research compiled: 2026-02-15*

## Executive Summary

**Key Finding:** Multiple mature MLX server projects exist. **Building from scratch is NOT recommended.**

**Top Recommendation:** Fork/extend **vllm-mlx** or **mlx-omni-server** rather than building from scratch.

---

## 1. mlx-lm (Apple's Official Library)

**GitHub:** https://github.com/ml-explore/mlx-lm  
**Stars:** 3,647 ⭐  
**Last Updated:** 2026-02-14 (actively maintained)  
**Status:** ✅ Production-ready, official Apple project

### What It Is
- **Python library** for LLM inference on Apple Silicon
- **NOT a server** - just the core inference engine
- All other MLX servers are built on top of this

### Built-in Server Capabilities
- ❌ **No HTTP server** - CLI tools only (`mlx_lm.generate`, `mlx_lm.chat`)
- ❌ No OpenAI-compatible API
- ✅ Python API for embedding in custom servers
- ✅ Streaming generation via `stream_generate()`

### Model Support
- ✅ All quantization formats (4-bit, 8-bit, 16-bit)
- ✅ MLX safetensors format
- ✅ Direct HuggingFace integration
- ✅ Prompt caching (saves to `.safetensors` files)
- ✅ Rotating KV cache for long contexts
- ✅ Speculative decoding (draft models)

### Features
- ✅ Text generation (streaming)
- ✅ Model quantization and conversion
- ✅ Fine-tuning (LoRA)
- ✅ Distributed inference (`mx.distributed`)
- ❌ No API endpoints
- ❌ No multi-model management
- ❌ No admin UI

### Architecture
- Pure Python library
- Designed as building block for servers

### Use Case
**Foundation layer** - every MLX server uses this underneath. Don't build on this directly; use a server framework.

---

## 2. vllm-mlx ⭐ **TOP RECOMMENDATION**

**GitHub:** https://github.com/waybarrios/vllm-mlx  
**Stars:** 365 ⭐  
**Last Updated:** 2026-02-14 (very active)  
**Status:** ✅ Production-ready, feature-rich

### What It Is
**Most advanced MLX server** - vLLM architecture ported to MLX with continuous batching, multimodal support, and extensive features.

### API Format
- ✅ **OpenAI-compatible** (`/v1/chat/completions`, `/v1/embeddings`)
- ✅ **Anthropic-compatible** (`/v1/messages`) - native Claude Code support
- ✅ Streaming (SSE)
- ✅ Tool calling (MCP protocol)

### Model Formats
- ✅ MLX 4-bit, 8-bit quantized models
- ✅ MLX safetensors
- ✅ Auto-download from HuggingFace
- ✅ Multimodal (text, image, video, audio)

### Features
- ✅ **Continuous batching** (5 concurrent requests = 3.4x speedup)
- ✅ **Paged KV cache** with prefix sharing
- ✅ **Multimodal** (LLM, VLM, audio, embeddings)
- ✅ **Audio:** TTS (11 voices, 8+ languages), STT (Whisper)
- ✅ **Reasoning models** (Qwen3, DeepSeek-R1) with thinking extraction
- ✅ **MCP tool calling** (Model Context Protocol)
- ✅ **Embeddings** via mlx-embeddings
- ✅ Streaming
- ✅ API key authentication
- ✅ Multiple model serving (lazy loading)

### Architecture
- **FastAPI** server
- Built on: mlx-lm, mlx-vlm, mlx-audio, mlx-embeddings
- vLLM-inspired paging and batching
- Metal GPU acceleration

### Performance (M4 Max, 128GB)
| Model | Single | Batched (5x) | Speedup |
|-------|--------|--------------|---------|
| Qwen3-0.6B-8bit | 328 tok/s | 1112 tok/s | **3.4x** |
| Llama-3.2-1B-4bit | 299 tok/s | 613 tok/s | **2.0x** |

### Limitations
- No admin UI (CLI/API only)
- No built-in model management UI
- Requires manual model downloads or config

### Could We Fork/Extend?
**YES - BEST CANDIDATE**
- ✅ Clean architecture
- ✅ Actively maintained
- ✅ Most complete feature set
- ✅ Apache 2.0 license
- ✅ Well-documented
- **What's missing:** Admin UI, model gallery, per-model config

---

## 3. mlx-omni-server ⭐ **SECOND CHOICE**

**GitHub:** https://github.com/madroidmaq/mlx-omni-server  
**Stars:** 662 ⭐  
**Last Updated:** 2026-02-13 (active)  
**Status:** ✅ Production-ready

### What It Is
**Dual-API server** supporting both OpenAI and Anthropic formats. Well-polished, good docs.

### API Format
- ✅ **OpenAI-compatible** (`/v1/*`)
- ✅ **Anthropic-compatible** (`/anthropic/v1/*`)
- ✅ Streaming
- ✅ Function calling with model-specific parsers
- ✅ Structured outputs (JSON schema)

### Model Formats
- ✅ MLX 4-bit, 8-bit
- ✅ Auto-discovery from HuggingFace cache
- ✅ On-demand loading with caching

### Features
- ✅ **Chat** (tools, streaming, structured output)
- ✅ **Audio:** TTS, STT
- ✅ **Images:** Generation, editing
- ✅ **Embeddings**
- ✅ Extended reasoning ("thinking mode" for supported models)
- ✅ Auto-download models when needed
- ✅ Model-specific parsers (qwen3, glm4_moe, etc.)

### Architecture
- **FastAPI** server
- Clean, modular design
- Built on: MLX, mlx-lm, mlx-vlm, mflux (image), mlx-whisper

### Limitations
- ❌ No continuous batching (single request at a time)
- ❌ No admin UI
- ❌ No built-in model gallery

### Could We Fork/Extend?
**YES - STRONG CANDIDATE**
- ✅ MIT license
- ✅ Clean codebase
- ✅ Active development
- ✅ Good examples directory
- **What's missing:** Continuous batching, admin UI, model management

---

## 4. mlx-openai-server

**GitHub:** https://github.com/cubist38/mlx-openai-server  
**Stars:** 219 ⭐  
**Last Updated:** 2026-02-13 (active)  
**Status:** ✅ Production-ready, feature-rich

### What It Is
**Comprehensive FastAPI server** with multi-model support via YAML config. Mature project with extensive capabilities.

### API Format
- ✅ **OpenAI-compatible**
- ✅ Streaming
- ✅ Function calling (extensive parser support)
- ✅ JSON schema validation

### Model Formats
- ✅ MLX format (text, multimodal, image gen/edit, embeddings, whisper)
- ✅ Quantization: 4/8/16-bit
- ✅ Auto-convert from HuggingFace

### Features
- ✅ **Multi-model mode** via YAML config file
- ✅ **Process isolation** (each model in separate subprocess to avoid Metal semaphore leaks)
- ✅ Text, vision, audio (whisper), image gen/edit (Flux, Qwen, etc.)
- ✅ Embeddings
- ✅ **Speculative decoding** (draft model support)
- ✅ LoRA adapters for image models
- ✅ Request queue with monitoring (`/v1/queue/stats`)
- ✅ Extensive parser support (qwen3, glm4_moe, minimax_m2, etc.)
- ✅ Custom chat templates

### Architecture
- **FastAPI** server
- **HandlerProcessProxy pattern** (multiprocessing with `spawn` context)
- Built on: mlx-lm, mlx-vlm, mlx-embeddings, mflux, mlx-whisper

### Multi-Model Configuration (YAML)
```yaml
server:
  host: "0.0.0.0"
  port: 8000
  log_level: INFO

models:
  - model_path: mlx-community/GLM-4.7-Flash-8bit
    model_type: lm
    model_id: glm-4.7-flash
    enable_auto_tool_choice: true
  
  - model_path: mlx-community/Qwen3-VL-2B-Instruct-4bit
    model_type: multimodal
  
  - model_path: black-forest-labs/FLUX.2-klein-4B
    model_type: image-generation
```

### Limitations
- ❌ No continuous batching (one request per model at a time)
- ❌ No admin UI
- ❌ Manual YAML configuration required

### Could We Fork/Extend?
**YES - SOLID OPTION**
- ✅ MIT license
- ✅ Well-architected (process isolation)
- ✅ Comprehensive model support
- ✅ Extensive documentation and examples
- **What's missing:** Admin UI, continuous batching, model gallery UI

---

## 5. LocalAI (MLX Backend)

**GitHub:** https://github.com/mudler/LocalAI  
**Stars:** 42,802 ⭐ (massive project)  
**Last Updated:** 2026-02-15 (very active)  
**Status:** ✅ Production, enterprise-grade

### What It Is
**Universal AI server** supporting many backends (llama.cpp, vLLM, transformers, MLX, etc.). MLX support added in v3.5.0 (September 2025).

### MLX Support Status
- ✅ **MLX backend** for LLMs (via mlx-lm)
- ✅ **MLX-VLM** for vision models
- ✅ **MLX-Audio** for TTS/STT
- ✅ **Diffusers** for image generation (Metal acceleration)
- ✅ Available on macOS (M1/M2/M3/M4)

### API Format
- ✅ **OpenAI-compatible**
- ✅ **Anthropic-compatible** (added Jan 2026)
- ✅ **Realtime API** (audio-to-audio)
- ✅ Streaming
- ✅ Tool calling (MCP support)

### Features (MLX-specific)
- ✅ Text generation (mlx-lm)
- ✅ Vision models (mlx-vlm)
- ✅ Audio (mlx-audio: TTS, STT)
- ✅ Image generation (diffusers with Metal)
- ✅ Embeddings
- ✅ **Model gallery** (auto-download models)
- ✅ **WebUI** (built-in admin interface)
- ✅ **Multi-backend** (can mix MLX with llama.cpp, etc.)

### Architecture
- **Go server** (not Python)
- Calls MLX via Python backends as plugins
- Backend auto-detection based on hardware
- OCI registry for backend management

### Acceleration Matrix
| Backend | MLX Support |
|---------|-------------|
| mlx-lm | ✅ Metal (M1/M2/M3/M4) |
| mlx-vlm | ✅ Metal |
| mlx-audio | ✅ Metal |
| diffusers | ✅ Metal |

### Limitations (for MLX use)
- ❌ **Heavy stack** (Go + Python + many backends)
- ❌ **Complex setup** (Docker/binary, not native Python)
- ❌ MLX is ONE backend among many (not optimized for Apple Silicon exclusively)
- ❌ Overhead from Go ↔ Python bridge

### Could We Fork/Extend?
**NOT RECOMMENDED FOR APPLE SILICON FOCUS**
- ❌ Too generic (supports NVIDIA, AMD, Intel, CPU, etc.)
- ❌ Go-based server (harder to customize MLX-specific features)
- ❌ Massive codebase (8,000+ files)
- ✅ But: Proven model gallery system we could learn from
- ✅ Excellent WebUI we could adapt

**Verdict:** Use as inspiration for UI/gallery, but don't fork for MLX-specific work.

---

## 6. omlx (macOS Menu Bar App)

**GitHub:** https://github.com/jundot/omlx  
**Stars:** 37 ⭐  
**Last Updated:** 2026-02-15 (very active)  
**Status:** ✅ Alpha/Beta, native macOS focus

### What It Is
**Native macOS menu bar app** with advanced caching and multi-model serving. Fork of vllm-mlx with SSD caching, admin dashboard, and desktop integration.

### API Format
- ✅ **OpenAI-compatible** (`/v1/chat/completions`, `/v1/embeddings`)
- ✅ **Anthropic-compatible** (`/v1/messages`)
- ✅ Streaming
- ✅ Tool calling (MCP)

### Model Formats
- ✅ MLX format (auto-detect from subdirectories)
- ✅ Built-in model downloader (HuggingFace)

### Features
- ✅ **macOS menu bar app** (.dmg installer)
- ✅ **Admin dashboard** (`/admin`) - web UI for model management
- ✅ **Paged KV cache with SSD tiering** (unique feature!)
- ✅ **Continuous batching** (inherited from vllm-mlx)
- ✅ **Multi-model serving** with LRU eviction
- ✅ **Model pinning** (keep frequently used models loaded)
- ✅ **Claude Code optimization** (context scaling, SSE keep-alive)
- ✅ Built-in chat UI at `/admin/chat`
- ✅ Tool calling with structured output
- ✅ Embeddings and reranking support

### Architecture
- **FastAPI** server
- **Native macOS app** (Python + PyObjC)
- Packaged with venvstacks (portable Python)
- Built on: vllm-mlx, mlx-lm, mlx-embeddings

### Unique Features
- **SSD cache persistence** - KV cache blocks saved to disk, survive restarts
- **Menu bar management** - start/stop server without terminal
- **Context scaling** for Claude Code (reports scaled token counts)
- **Block-based cache** with Copy-on-Write and prefix sharing

### Limitations
- ⚠️ Early stage (alpha/beta quality)
- ⚠️ macOS-specific (no Linux/Windows)
- ⚠️ Small community (37 stars)

### Could We Fork/Extend?
**INTERESTING FOR MACOS-NATIVE FEATURES**
- ✅ Apache 2.0 license
- ✅ Unique SSD caching approach
- ✅ Admin dashboard already built
- ✅ macOS integration patterns
- ⚠️ Less mature than vllm-mlx
- **Use case:** If we want native macOS app with desktop integration

---

## 7. mlxengine (Fork of mlx-omni-server)

**GitHub:** https://github.com/justrach/mlxengine  
**Stars:** 4 ⭐  
**Last Updated:** 2025-05-11 (⚠️ stale - 9 months old)  
**Status:** ⚠️ Inactive

### What It Is
Fork of mlx-omni-server refactored to use "TurboAPI" framework. Limited activity.

### Features
- Same as mlx-omni-server (chat, TTS, STT, image gen, embeddings)
- OpenAI-compatible API

### Verdict
**SKIP** - Original mlx-omni-server is more active and better maintained.

---

## 8. mlx-engine (LM Studio Integration)

**GitHub:** https://github.com/NTarek4741/mlx-engine  
**Stars:** 1 ⭐  
**Last Updated:** 2026-02-12 (somewhat active)  
**Status:** ⚠️ Early development, experimental

### What It Is
"LM Studio Apple MLX engine" - appears to be an attempt to integrate MLX with LM Studio.

### API Format
- ✅ OpenAI-compatible
- ✅ Ollama-compatible
- 🚧 Anthropic-compatible (work in progress)

### Features
- ✅ Smart model caching
- ✅ KV cache quantization
- ✅ Speculative decoding
- 🚧 Tool calling (WIP)
- 🚧 Audio models (WIP)
- 🚧 Embeddings (WIP)

### Architecture
- FastAPI server
- Built on mlx-lm

### Limitations
- ⚠️ "Early stages of development"
- ⚠️ Many features marked "Work in Progress"
- ⚠️ Minimal community (1 star)

### Verdict
**SKIP** - Too early/experimental. Better options exist.

---

## 9. Jan.ai / Nitro MLX Support

**Status:** ❌ **NO MLX SUPPORT**

### Research Findings
- Jan.ai uses **Nitro** engine (fork of llama.cpp)
- Nitro supports: CUDA, Vulkan, CPU
- **No MLX backend** in Nitro or Jan.ai
- Jan.ai is optimized for cross-platform (Windows, macOS, Linux)
- For Apple Silicon, Jan.ai uses **Metal via llama.cpp**, not MLX

### Conclusion
Jan.ai is **not relevant** for MLX-specific server research.

---

## Comparison Matrix

| Project | Stars | Updated | API | Batching | Multimodal | Admin UI | License |
|---------|-------|---------|-----|----------|------------|----------|---------|
| **vllm-mlx** | 365 | 2026-02-14 | OpenAI + Anthropic | ✅ Continuous | ✅ Full | ❌ | Apache 2.0 |
| **mlx-omni-server** | 662 | 2026-02-13 | OpenAI + Anthropic | ❌ | ✅ Full | ❌ | MIT |
| **mlx-openai-server** | 219 | 2026-02-13 | OpenAI | ❌ | ✅ Full | ❌ | MIT |
| **omlx** | 37 | 2026-02-15 | OpenAI + Anthropic | ✅ Continuous | ✅ LLM only | ✅ Web | Apache 2.0 |
| **LocalAI** | 42,802 | 2026-02-15 | OpenAI + Anthropic | ❌ (MLX) | ✅ Full | ✅ Full | MIT |
| **mlx-lm** | 3,647 | 2026-02-14 | ❌ Library | N/A | ❌ | ❌ | MIT |

---

## Feature Comparison

| Feature | vllm-mlx | mlx-omni-server | mlx-openai-server | omlx | LocalAI |
|---------|----------|-----------------|-------------------|------|---------|
| **Continuous Batching** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Multi-model Config** | Manual | Auto-discovery | ✅ YAML | Auto-detect | ✅ Gallery |
| **SSD KV Cache** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Admin Dashboard** | ❌ | ❌ | ❌ | ✅ Web | ✅ Full |
| **Model Gallery** | ❌ | ❌ | ❌ | ✅ Built-in | ✅ Full |
| **Tool Calling** | ✅ MCP | ✅ | ✅ | ✅ MCP | ✅ MCP |
| **Embeddings** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audio (TTS/STT)** | ✅ Native | ✅ | ✅ Whisper | ❌ | ✅ |
| **Image Gen** | ❌ | ✅ | ✅ Flux | ❌ | ✅ |
| **Reasoning Models** | ✅ Extract | ✅ Thinking | ❌ | ❌ | ❌ |
| **Native macOS App** | ❌ | ❌ | ❌ | ✅ .dmg | ❌ |

---

## Recommendations

### 🥇 **Best Choice: Fork vllm-mlx**

**Why:**
- Most advanced architecture (continuous batching = 3.4x speedup)
- Active development (updated yesterday)
- Comprehensive feature set (multimodal, audio, embeddings, reasoning)
- Clean codebase, well-documented
- Apache 2.0 license (permissive)

**What to Add:**
1. **Admin UI** (learn from omlx's dashboard or LocalAI's WebUI)
2. **Model Gallery** (browse/download MLX models from HuggingFace)
3. **Multi-model YAML config** (borrow from mlx-openai-server)
4. **Model management API** (`POST /v1/models/install`, `DELETE /v1/models/{id}`)

**Estimated Effort:** Medium (2-4 weeks for UI + gallery)

---

### 🥈 **Alternative: Fork mlx-omni-server**

**Why:**
- Simpler codebase (easier to understand/modify)
- Dual API (OpenAI + Anthropic) already built
- Good model-specific parser system
- MIT license

**What to Add:**
1. Continuous batching (port from vllm-mlx)
2. Admin UI
3. Model gallery

**Estimated Effort:** Medium-High (batching is complex)

---

### 🥉 **Hybrid: Learn from omlx**

**Use Case:** If building a **native macOS app** is priority.

**What to Borrow:**
- SSD KV cache design
- Admin dashboard UI patterns
- Menu bar app structure (venvstacks packaging)
- Model management workflows

**Combine with:** vllm-mlx's inference engine

**Estimated Effort:** High (4-6 weeks for native app)

---

### ❌ **Do NOT Build from Scratch**

**Reasons:**
1. **Continuous batching is complex** - vllm-mlx already solved this
2. **Multimodal support requires extensive integration** - all major servers already have it
3. **Model-specific parsers** (tool calling) - reinventing the wheel
4. **Active projects exist** - community support, bug fixes, ongoing development

**Time saved by forking:** 3-6 months of core infrastructure work

---

## Architecture Gaps in Existing Projects

All projects are missing one or more of:

1. **Admin UI** (only LocalAI and omlx have this)
2. **Model Gallery with preview/search** (only LocalAI has full gallery)
3. **Multi-tenant support** (API keys, user isolation)
4. **Request queuing with priorities**
5. **Built-in monitoring/metrics** (Prometheus, etc.)
6. **Automatic model recommendation** based on hardware
7. **Fine-tuning UI** (mlx-lm supports it, but no server exposes it)

**Opportunity:** Build these on top of vllm-mlx or mlx-omni-server.

---

## Licensing Summary

| Project | License | Commercial Use | Attribution Required |
|---------|---------|----------------|---------------------|
| vllm-mlx | Apache 2.0 | ✅ Yes | ✅ Yes |
| mlx-omni-server | MIT | ✅ Yes | ✅ Yes |
| mlx-openai-server | MIT | ✅ Yes | ✅ Yes |
| omlx | Apache 2.0 | ✅ Yes | ✅ Yes |
| LocalAI | MIT | ✅ Yes | ✅ Yes |
| mlx-lm | MIT | ✅ Yes | ✅ Yes |

**All are permissive** - safe to fork and build upon.

---

## Final Verdict

### **DO NOT BUILD FROM SCRATCH**

✅ **Fork vllm-mlx** and add:
- Admin web UI (dashboard for model management)
- Model gallery (browse/download MLX models)
- YAML config for multi-model serving
- Enhanced monitoring/metrics

**Why this is the best path:**
1. Save 3-6 months of infrastructure work
2. Leverage continuous batching (3.4x speedup)
3. Inherit multimodal, audio, embeddings support
4. Active community and ongoing updates
5. Apache 2.0 license (commercial-friendly)

**Time to production:** 2-4 weeks (vs 3-6 months from scratch)

---

## Next Steps

1. **Clone vllm-mlx** - `git clone https://github.com/waybarrios/vllm-mlx.git`
2. **Study architecture** - understand paging, batching, platform abstraction
3. **Design admin UI** - sketch model gallery, settings, monitoring views
4. **Prototype model gallery** - integrate HuggingFace API for model browsing
5. **Add multi-model YAML config** - allow pre-loading multiple models
6. **Build dashboard** - React/Vue frontend for model management

**Reference projects for UI inspiration:**
- LocalAI's WebUI (full-featured, proven)
- omlx's admin panel (clean, focused on essentials)
- LM Studio (desktop app UX patterns)

---

*Research complete. All existing projects documented with stars, features, and fork/extend analysis.*
