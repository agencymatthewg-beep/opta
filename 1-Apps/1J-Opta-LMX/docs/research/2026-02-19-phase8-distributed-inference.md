# Phase 8 Research: Model Stack & Distributed Inference

**Date:** 2026-02-19
**Author:** Claude (research agent)
**Status:** Research Complete
**Confidence:** High (multi-source cross-verified)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Distributed LLM Inference Across LAN](#2-distributed-llm-inference-across-lan)
3. [Service Discovery for LAN Inference Nodes](#3-service-discovery-for-lan-inference-nodes)
4. [Model Stack Configuration Patterns](#4-model-stack-configuration-patterns)
5. [Health Monitoring for Distributed Nodes](#5-health-monitoring-for-distributed-nodes)
6. [Embedding Model Serving on Apple Silicon](#6-embedding-model-serving-on-apple-silicon)
7. [Reranking Model Serving](#7-reranking-model-serving)
8. [GPU Worker Inference on Windows/NVIDIA](#8-gpu-worker-inference-on-windowsnvidia)
9. [Architecture Recommendations for Opta-LMX](#9-architecture-recommendations-for-opta-lmx)
10. [Don't-Hand-Roll List](#10-dont-hand-roll-list)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Sources](#12-sources)

---

## 1. Executive Summary

Opta-LMX Phase 8 extends the existing helper node system into a principled distributed inference architecture. The core insight from this research is:

**Task-level distribution (different models on different machines) is the right pattern for Opta's LAN topology.** Tensor parallelism across heterogeneous hardware (splitting one model across Apple Silicon + NVIDIA) is technically possible (EXO, Parallax) but adds enormous complexity for marginal gain in a 512GB unified-memory environment. The Mac Studio already has enough memory for any single model; the win comes from offloading auxiliary tasks (embedding, reranking) to helper nodes.

### Key Recommendations

| Decision | Recommendation | Confidence |
|----------|---------------|------------|
| Distribution strategy | Task-level routing, NOT tensor parallelism | HIGH |
| Service discovery | Static config + health polling (NOT mDNS) | HIGH |
| Helper node server (NVIDIA) | **Ollama** on Windows (simplest) or **vLLM** (highest perf) | HIGH |
| Helper node server (Apple Silicon) | **vllm-mlx** or standalone **mlx-embeddings** | HIGH |
| Embedding model (MLX) | Qwen3-Embedding-0.6B or all-MiniLM-L6-v2 | HIGH |
| Embedding model (NVIDIA) | nomic-embed-text-v1.5 via Ollama | HIGH |
| Reranking model (MLX) | jina-reranker-v3-mlx (0.6B, native MLX) | HIGH |
| Reranking model (NVIDIA) | Qwen3-Reranker-0.6B via vLLM or Ollama | MEDIUM |
| Circuit breaker | Hand-roll (~30 lines) or `aiobreaker` | HIGH |
| Config format | Extend existing YAML `helper_nodes` section | HIGH |

---

## 2. Distributed LLM Inference Across LAN

### 2.1 Distribution Strategies (Taxonomy)

There are three fundamentally different approaches to distributing LLM workloads:

**A. Tensor Parallelism (single model, multiple GPUs)**
- Splits model layers/tensors across devices
- Requires high-bandwidth interconnect (NVLink, Thunderbolt 5, RDMA)
- Examples: EXO, Parallax, DeepSpeed
- NOT recommended for Opta (LAN bandwidth too low for inter-layer communication)

**B. Pipeline Parallelism (single model, sequential stages)**
- Each device handles different layers of the same model
- Prefill on one device, decode on another
- EXO 1.0 does this across Apple Silicon + NVIDIA DGX Spark
- Interesting but premature for Opta's use case

**C. Task-Level Distribution (different models, different machines)**
- Mono512 runs large LLMs (32B-456B coding/reasoning/chat)
- Helper nodes run small specialized models (embedding, reranking)
- Requests routed by task type, not split across devices
- **This is what Opta-LMX already does with HelperNodeClient**

### 2.2 Why Task-Level Distribution Wins for Opta

1. **Mono512 has 512GB unified memory** -- it can load any single model without sharding
2. **Embedding/reranking are embarrassingly parallel** -- no inter-device synchronization needed
3. **LAN latency (~0.1-1ms round trip)** is fine for task routing but too high for tensor communication
4. **Heterogeneous hardware** -- Apple Silicon (MLX) and NVIDIA (CUDA) can't share tensor ops anyway
5. **Existing code already implements this** -- `HelperNodeClient` + `HelperNodesConfig` are the right abstractions

### 2.3 EXO and Parallax (For Reference Only)

**EXO** (exo-explore/exo) demonstrated Apple M3 Ultra + NVIDIA DGX Spark clustering in 2025, achieving 2.8x benchmark gains by assigning compute-bound prefill to NVIDIA and bandwidth-bound decode to Apple Silicon. However:
- EXO 1.0 with heterogeneous scheduling is not yet open-source (v0.0.15-alpha is public)
- Requires intimate hardware coordination that LAN topologies can't support well
- Designed for a single-model-across-devices use case, not multi-model orchestration

**Parallax** (GradientHQ/parallax) achieved 3.1x latency reduction and 5.3x inter-token latency improvement over baselines via a two-phase scheduler on heterogeneous GPUs. Like EXO, it targets pipeline parallelism for single large models -- not our use case.

**Verdict:** Monitor EXO and Parallax for future phases, but task-level distribution is the correct architecture for Opta-LMX Phase 8.

### 2.4 llm-d (Red Hat)

Red Hat's llm-d separates prefill and decode phases into independent pods, running on Kubernetes with heterogeneous accelerators (NVIDIA, AMD, TPU). The key insight -- disaggregating workload phases -- is sound but the Kubernetes-native approach is overkill for a LAN of 3-5 machines.

---

## 3. Service Discovery for LAN Inference Nodes

### 3.1 Three Approaches Evaluated

| Approach | Complexity | Reliability | Fit for Opta |
|----------|-----------|-------------|-------------|
| **Static config (YAML)** | Trivial | High (deterministic) | BEST |
| **mDNS/Bonjour** | Medium | Good (auto-discovery) | Overkill |
| **Consul/etcd** | High | Very high | Way overkill |

### 3.2 Recommendation: Static Config + Health Polling

For a LAN with 3-5 known machines at fixed IPs, mDNS adds complexity without meaningful benefit. The existing `HelperNodesConfig` pattern (static URL in YAML) is the right approach. What's needed is:

1. **Health polling** -- periodic health checks to mark nodes as up/down
2. **Graceful degradation** -- fallback strategies when nodes are unreachable
3. **Hot-reload** -- change node config without server restart (already supported via `/admin/config/reload`)

This is exactly what the current `HelperNodeClient.health_check()` already does.

### 3.3 If Auto-Discovery Becomes Needed Later

The `python-zeroconf` library (v0.148.0, Oct 2025) is the gold standard for mDNS in Python:

```python
# Registration (on a helper node):
from zeroconf import ServiceInfo, Zeroconf
import socket

info = ServiceInfo(
    "_opta-lmx._tcp.local.",
    "embedding-node._opta-lmx._tcp.local.",
    addresses=[socket.inet_aton("192.168.188.20")],
    port=11434,
    properties={
        "role": "embedding",
        "model": "nomic-embed-text-v1.5",
        "gpu": "RTX-5080",
    },
)
zeroconf = Zeroconf()
zeroconf.register_service(info)

# Discovery (on Mono512):
from zeroconf import ServiceBrowser, Zeroconf

class NodeListener:
    def add_service(self, zc, type_, name):
        info = zc.get_service_info(type_, name)
        # Register new helper node...

    def remove_service(self, zc, type_, name):
        # Mark node as removed...

browser = ServiceBrowser(Zeroconf(), "_opta-lmx._tcp.local.", NodeListener())
```

**When to add this:** Only if the network expands beyond 5 nodes or if IPs become dynamic. Not Phase 8.

---

## 4. Model Stack Configuration Patterns

### 4.1 How Other Servers Handle Multi-Model Routing

**Ollama:**
- Single model per request, identified by name
- Modelfile system: declarative model config (base model + system prompt + parameters)
- No built-in role-based routing -- model selection is client-side
- OpenAI-compatible `/v1/chat/completions` accepts `model` parameter

**vLLM:**
- Single model per server instance (one `vllm serve` per model)
- Load balancing via external proxy (NGINX, HAProxy, or LiteLLM)
- New V1 architecture supports `/v1/embeddings` and `/v1/rerank` alongside `/v1/chat/completions`
- No built-in multi-model routing

**LocalAI:**
- The closest to what Opta-LMX does -- single API endpoint, multiple backends
- Model configs stored as YAML files, each mapping a model name to a backend
- Supports routing to external vLLM instances via backend configuration
- P2P federated mode for multi-node distribution
- MCP integration for tool-use workflows

**LiteLLM:**
- Purpose-built model router/gateway
- `model_list` config maps virtual model names to multiple backend deployments
- Built-in load balancing (RPM/TPM-based, weighted, least-busy)
- Fallback chains: if primary model fails, try backup
- Rate limiting per deployment
- Redis-backed state for multi-instance coordination

**LiteLLM config example (illustrative pattern):**
```yaml
model_list:
  - model_name: coding
    litellm_params:
      model: openai/mlx-community/Qwen2.5-Coder-32B-Instruct-4bit
      api_base: http://localhost:1234/v1
    rpm: 10  # requests per minute
  - model_name: embedding
    litellm_params:
      model: ollama/nomic-embed-text-v1.5
      api_base: http://192.168.188.20:11434
    rpm: 100
  - model_name: reranking
    litellm_params:
      model: ollama/jina-reranker-v3
      api_base: http://192.168.188.21:11434
    rpm: 50
```

### 4.2 What Opta-LMX Already Has (And What's Missing)

**Already implemented:**
- `RoutingConfig.aliases` -- alias -> ordered model preference list
- `TaskRouter.resolve()` -- walks preference list, returns first loaded model
- `HelperNodesConfig` -- embedding/reranking endpoint configuration
- `HelperNodeClient` -- httpx.AsyncClient with health metrics, p95 latency

**What's missing for Phase 8:**
- **Backend routing** -- the `backends` section in `mono512-current.yaml` is documentation-only; LMXConfig has no `backends` field. Supporting routing to external `mlx_lm.server` instances would enable multi-quant model switching.
- **Node health state machine** -- the current `is_healthy` is a simple boolean. A circuit breaker pattern (closed/open/half-open) would prevent hammering a failing node.
- **Multi-helper support** -- currently one embedding endpoint + one reranking endpoint. For load balancing, support multiple nodes per role.
- **Periodic health checks** -- health checks are currently only called reactively. A background task should ping helpers periodically.

### 4.3 Recommended Config Schema Extension

```yaml
# Current (Phase 7):
helper_nodes:
  embedding:
    url: "http://192.168.188.20:11434"
    model: "nomic-embed-text-v1.5"
    timeout_sec: 10
    fallback: "local"

# Phase 8 extension (additive, backward-compatible):
helper_nodes:
  embedding:
    endpoints:
      - url: "http://192.168.188.20:11434"
        model: "nomic-embed-text-v1.5"
        timeout_sec: 10
        priority: 1
      - url: "http://192.168.188.21:11434"
        model: "nomic-embed-text-v1.5"
        timeout_sec: 10
        priority: 2
    fallback: "local"
    health_check_interval_sec: 30
    circuit_breaker:
      failure_threshold: 3
      reset_timeout_sec: 60
  reranking:
    endpoints:
      - url: "http://192.168.188.20:11434"
        model: "jina-reranker-v3"
        timeout_sec: 10
        priority: 1
    fallback: "skip"
    health_check_interval_sec: 30
```

**Note:** The single-endpoint format (`url: "..."`) should remain supported as syntactic sugar for a one-item `endpoints` list. This ensures backward compatibility.

---

## 5. Health Monitoring for Distributed Nodes

### 5.1 Circuit Breaker Pattern

The circuit breaker pattern is the industry standard for protecting against cascading failures in distributed systems. Three states:

```
CLOSED ──[failure_count >= threshold]──> OPEN
OPEN ──[reset_timeout elapsed]──> HALF_OPEN
HALF_OPEN ──[success]──> CLOSED
HALF_OPEN ──[failure]──> OPEN
```

**Current state in Opta-LMX:** `HelperNodeClient._healthy` is a simple boolean flipped on each request. This is insufficient because:
- A single failed request makes the node "unhealthy" forever (until next success)
- No automatic recovery probing (half-open state)
- No failure counting/thresholding

### 5.2 Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **Hand-roll (~40 lines)** | Zero deps, fits LMX patterns, exact control | Maintenance |
| **`aiobreaker`** (1.1.0) | Battle-tested, async-native, listeners | 1 extra dep |
| **`circuitbreaker`** (2.0.0) | Decorator-based, popular | Not async-native |
| **`aiomisc.CircuitBreaker`** | Part of larger utils package | Pulls in `aiomisc` dep |

### 5.3 Recommended: Hand-Roll (Fits LMX Patterns)

The circuit breaker logic is ~40 lines. Adding a dependency for this is not worth it given LMX's "minimal deps" philosophy.

```python
"""Circuit breaker for helper node connections."""

from __future__ import annotations

import time
from enum import Enum


class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation, requests pass through
    OPEN = "open"           # Failing, all requests short-circuit
    HALF_OPEN = "half_open" # Testing recovery, allow one request


class CircuitBreaker:
    """Three-state circuit breaker for LAN helper nodes.

    Args:
        failure_threshold: Consecutive failures before opening circuit.
        reset_timeout_sec: Seconds to wait before trying half-open.
    """

    def __init__(
        self, failure_threshold: int = 3, reset_timeout_sec: float = 60.0
    ) -> None:
        self._failure_threshold = failure_threshold
        self._reset_timeout_sec = reset_timeout_sec
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_at: float = 0.0

    @property
    def state(self) -> CircuitState:
        """Current circuit state, auto-transitioning OPEN -> HALF_OPEN."""
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_at >= self._reset_timeout_sec:
                self._state = CircuitState.HALF_OPEN
        return self._state

    @property
    def allows_request(self) -> bool:
        """Whether the circuit allows a request to pass."""
        return self.state != CircuitState.OPEN

    def record_success(self) -> None:
        """Record a successful request. Resets to CLOSED."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Record a failed request. May trip to OPEN."""
        self._failure_count += 1
        self._last_failure_at = time.monotonic()
        if self._failure_count >= self._failure_threshold:
            self._state = CircuitState.OPEN

    def reset(self) -> None:
        """Manually reset to CLOSED state."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_at = 0.0
```

### 5.4 Background Health Check Task

```python
async def _health_check_loop(
    clients: list[HelperNodeClient],
    interval_sec: float = 30.0,
) -> None:
    """Periodically probe helper nodes and update circuit breakers."""
    while True:
        for client in clients:
            is_up = await client.health_check()
            if is_up:
                client.circuit_breaker.record_success()
            # Don't record_failure on health check -- only on real request failures
            # This prevents health checks from tripping the breaker
        await asyncio.sleep(interval_sec)
```

### 5.5 Heartbeat vs Health Check

| Metric | Health Check (pull) | Heartbeat (push) |
|--------|-------------------|------------------|
| Direction | LMX polls helpers | Helpers report to LMX |
| Complexity | Simple (HTTP GET) | Requires helper-side agent |
| Failure detection | Polling interval latency | Faster (immediate) |
| Recommendation | **Use this** | Overkill for 3-5 nodes |

---

## 6. Embedding Model Serving on Apple Silicon

### 6.1 Library Landscape

| Library | Maturity | Models | API | Notes |
|---------|----------|--------|-----|-------|
| **mlx-embedding-models** (taylorai) | Stable | BERT, RoBERTa, ModernBERT | Python API | Curated registry, high-quality |
| **mlx-embeddings** (Blaizzy) | Active | Vision + Language | Python API | Multi-modal capable |
| **qwen3-embeddings-mlx** (jakedahn) | New (2025) | Qwen3 0.6B/4B/8B | REST API | 44K tok/s, hot-swapping |
| **vllm-mlx** (waybarrios) | Active | Any mlx-embeddings model | OpenAI `/v1/embeddings` | Integrated with LLM serving |

### 6.2 Performance Characteristics

**Qwen3-Embedding on MLX (M2 Max 32GB benchmark):**

| Model | Params | Speed | Quality | Memory |
|-------|--------|-------|---------|--------|
| Qwen3-Embedding-0.6B | 0.6B | 44K tok/s | Good | 900MB |
| Qwen3-Embedding-4B | 4B | 18K tok/s | Very Good (0.65 coherence) | 2.5GB |
| Qwen3-Embedding-8B | 8B | 11K tok/s | Excellent | 4.5GB |

**Qwen3-Embedding-0.6B** is the sweet spot for helper nodes:
- <1GB memory -- fits on any device
- 44K tokens/sec -- faster than any cloud API
- Matches OpenAI ada-002 quality
- MTEB multilingual leaderboard #1 at 8B size (score 70.58)

**Other embedding models on MLX:**

| Model | Params | Use Case |
|-------|--------|----------|
| all-MiniLM-L6-v2-4bit | 22M | Ultra-fast, lower quality |
| bge-large-en-v1.5-4bit | 335M | English-optimized |
| nomic-embed-text-v1.5 | 137M | General purpose, good quality |

### 6.3 Serving Options for Mono512

**Option A: vllm-mlx built-in (RECOMMENDED)**

Since Opta-LMX is already built on vllm-mlx, use its native embedding support:

```bash
vllm-mlx serve my-llm-model --embedding-model mlx-community/all-MiniLM-L6-v2-4bit
```

Or programmatically:
```python
from vllm_mlx.embedding import EmbeddingEngine

engine = EmbeddingEngine("mlx-community/all-MiniLM-L6-v2-4bit")
engine.load()
vectors = engine.embed(["Hello world", "How are you?"])
```

This provides the `/v1/embeddings` endpoint natively, matching the OpenAI SDK.

**Option B: Standalone qwen3-embeddings-mlx server**

If embedding load is high enough to justify a separate process:

```bash
pip install qwen3-embeddings-mlx
qwen3-embeddings serve --model small --port 8001
```

Endpoints: `POST /embed`, `POST /embed_batch`, `GET /health`, `GET /metrics`

**Option C: Local embedding in Opta-LMX (already implemented)**

The existing `api/embeddings.py` already supports local `EmbeddingEngine` as a fallback. This is the right fallback when helper nodes are down.

### 6.4 Recommendation

- **Primary:** Helper node (Ollama on RTX 5080, see Section 8) for production embedding
- **Secondary:** Local MLX embedding (vllm-mlx `EmbeddingEngine`) as fallback
- **Model:** `nomic-embed-text-v1.5` on NVIDIA, `Qwen3-Embedding-0.6B` on MLX
- **No additional libraries needed** -- vllm-mlx already provides `EmbeddingEngine`

---

## 7. Reranking Model Serving

### 7.1 Jina Reranker v3 MLX

The gold standard for reranking on Apple Silicon:

- **Architecture:** Qwen3-0.6B base + MLP projector (1024->512->256)
- **Size:** 0.6B params, ~1.2GB on disk
- **Performance:** 61.94 nDCG-10 on BEIR (SOTA among rerankers its size)
- **Multilingual:** 66.50 on MIRACL across 18 languages
- **Mechanism:** Listwise -- processes query + up to 64 documents in a single 131K-token context window with causal cross-attention
- **License:** CC BY-NC 4.0 (non-commercial; contact Jina for commercial use)
- **Native MLX implementation:** No transformers library required

```python
# Direct usage (no server needed):
from rerank import MLXReranker

reranker = MLXReranker()
results = reranker.rerank(
    query="What are the health benefits of green tea?",
    documents=["Green tea contains...", "Coffee prices rose..."],
    top_n=3,
    return_embeddings=False,
)
# Returns: [{"document": "...", "relevance_score": 0.95, "index": 0}, ...]
```

### 7.2 Alternative Reranking Models

| Model | Params | nDCG-10 | MLX Support | License |
|-------|--------|---------|-------------|---------|
| **jina-reranker-v3-mlx** | 0.6B | 61.94 | Native | CC BY-NC 4.0 |
| **Qwen3-Reranker-0.6B** | 0.6B | ~60 | Via Ollama | Apache 2.0 |
| **Qwen3-Reranker-4B** | 4B | Higher | Via Ollama | Apache 2.0 |
| **BAAI/bge-reranker-base** | 278M | ~56 | Via ONNX/vLLM | MIT |

**Licensing note:** If Opta Operations needs commercial use without Jina's permission, Qwen3-Reranker (Apache 2.0) is the safe alternative. It's available on Ollama with `/v1/rerank` endpoint.

### 7.3 Serving Options

**Option A: Local MLX reranker (Mono512)**

Load `jina-reranker-v3-mlx` directly in the Opta-LMX process using the model's `MLXReranker` class. Wrapping it behind the existing `api/rerank.py` endpoint.

**Option B: Helper node via Ollama (NVIDIA)**

```bash
# On the RTX 5080 Windows machine:
ollama pull qwen3-reranker:0.6b
# Ollama serves /v1/rerank at http://192.168.188.20:11434
```

Opta-LMX proxies via `HelperNodeClient.rerank()` -> `POST /v1/rerank`.

**Option C: Helper node via vLLM (NVIDIA)**

```bash
# vLLM supports /v1/rerank natively:
vllm serve BAAI/bge-reranker-base --task score
# Serves at http://192.168.188.20:8000/v1/rerank
```

### 7.4 Recommendation

- **Primary:** Helper node (Ollama with `qwen3-reranker:0.6b` on RTX 5080)
- **Fallback:** Local `jina-reranker-v3-mlx` on Mono512 (loaded on-demand, ~1.2GB)
- **Fallback config:** `fallback: "local"` -- if helper node is down, load reranker locally

---

## 8. GPU Worker Inference on Windows/NVIDIA

### 8.1 Server Options for RTX 5080 16GB

| Server | Setup Complexity | OpenAI Compatible | Embedding | Reranking | Memory |
|--------|-----------------|-------------------|-----------|-----------|--------|
| **Ollama** | Trivial (installer) | Yes (`/v1/*`) | Yes | Yes (`/v1/rerank`) | ~500MB base |
| **vLLM** | Medium (Docker/pip) | Yes (full) | Yes | Yes | ~2GB base |
| **llama-cpp-python** | Medium (pip+CUDA) | Yes (partial) | Yes | No | ~200MB base |
| **llama.cpp server** | Easy (binary) | Yes (partial) | Yes | No | ~100MB base |
| **LocalAI** | Easy (binary/Docker) | Yes (full) | Yes | Yes | ~500MB base |
| **Infinity** | Medium (pip/Docker) | Yes | Yes | Yes | ~500MB base |

### 8.2 Recommendation: Ollama on Windows

**Why Ollama wins for helper nodes:**

1. **Trivial Windows setup** -- `OllamaSetup.exe` installs without admin rights, auto-detects NVIDIA GPUs
2. **Native CUDA support** -- automatic GPU detection and offloading for RTX 5080
3. **OpenAI-compatible API** -- `/v1/embeddings`, `/v1/chat/completions`, `/v1/rerank` all supported
4. **Single binary** -- no Python environment, no Docker, no CUDA toolkit installation
5. **Model management built-in** -- `ollama pull nomic-embed-text` handles everything
6. **Background service** -- runs as a Windows service, auto-starts on boot
7. **REST API at localhost:11434** -- proxy via Opta-LMX `HelperNodeClient`
8. **Qwen3 embedding and reranking models** are available natively

**Setup on RTX 5080 Windows PC:**

```powershell
# 1. Install Ollama (download from ollama.com)
# 2. Set environment variables for LAN access:
$env:OLLAMA_HOST = "0.0.0.0:11434"

# 3. Pull models:
ollama pull nomic-embed-text:v1.5     # Embedding (~275MB)
ollama pull qwen3-reranker:0.6b       # Reranking (~1.2GB)

# 4. Test:
curl http://localhost:11434/v1/embeddings -d '{
  "model": "nomic-embed-text:v1.5",
  "input": ["test embedding"]
}'
```

**Opta-LMX config for this helper node:**

```yaml
helper_nodes:
  embedding:
    url: "http://192.168.188.20:11434"
    model: "nomic-embed-text:v1.5"
    timeout_sec: 10
    fallback: "local"
  reranking:
    url: "http://192.168.188.20:11434"
    model: "qwen3-reranker:0.6b"
    timeout_sec: 10
    fallback: "skip"
```

### 8.3 Alternative: vLLM on Windows (Higher Performance)

For production workloads needing maximum throughput:

```bash
# Requires Docker with NVIDIA runtime or pip install with CUDA 12.8:
pip install vllm
vllm serve BAAI/bge-reranker-base --task score --host 0.0.0.0 --port 8000

# For embeddings:
vllm serve nomic-ai/nomic-embed-text-v1.5 --task embed --host 0.0.0.0 --port 8001
```

vLLM provides PagedAttention (better memory efficiency) and continuous batching (higher throughput) but requires more setup.

### 8.4 RTX 5080 Capacity Planning

The RTX 5080 has 16GB VRAM. Typical allocation:

| Model | VRAM Usage | Purpose |
|-------|-----------|---------|
| nomic-embed-text-v1.5 | ~550MB | Embedding |
| qwen3-reranker:0.6b | ~1.2GB | Reranking |
| **Total** | **~1.8GB** | Leaves ~14GB headroom |

Both models fit comfortably. The remaining 14GB could host an additional small LLM (e.g., Qwen3-0.6B for fast classification tasks) if needed.

### 8.5 Infinity Server (For Dedicated Embedding/Reranking)

If the helper node should ONLY serve embedding and reranking (not LLMs), `infinity-emb` is purpose-built:

```bash
# On Windows with CUDA:
pip install "infinity-emb[torch,optimum]"
infinity_emb v2 --model-id nomic-ai/nomic-embed-text-v1.5 --port 7997
```

Features: Dynamic batching, ONNX/TensorRT optimization, multi-model serving, OpenAI-compatible API. FlashAttention support for maximum throughput.

**When to use Infinity:** If Ollama's embedding throughput is insufficient (unlikely for <100 req/s workloads).

---

## 9. Architecture Recommendations for Opta-LMX

### 9.1 Recommended Standard Stack

```
                     Opta CLI / OpenClaw Bots
                              |
                              v
                    +-----------------+
                    |   Opta-LMX      |
                    |   (Mono512)     |
                    |   port 1234     |
                    +--------+--------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
     +--------+----+ +------+------+ +-----+------+
     | MLX LLM     | | Helper Node | | Helper Node|
     | (local)     | | (RTX 5080)  | | (M4 Max)   |
     | 32B-456B    | | Embedding   | | (optional) |
     | models      | | Reranking   | |            |
     +-------------+ +-----+------+ +-----+------+
                            |              |
                      Ollama :11434   vllm-mlx :8000
```

### 9.2 Request Flow

**LLM requests:** `client -> Opta-LMX -> TaskRouter.resolve() -> local MLX engine`

**Embedding requests:** `client -> Opta-LMX /v1/embeddings -> HelperNodeClient.embed() -> Ollama on RTX 5080 -> response` (fallback: local MLX embedding)

**Reranking requests:** `client -> Opta-LMX /v1/rerank -> HelperNodeClient.rerank() -> Ollama on RTX 5080 -> response` (fallback: local Jina v3 MLX or skip)

### 9.3 Implementation Priorities

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Circuit breaker for HelperNodeClient | Small (~40 lines) | High (prevents cascading failure) |
| 2 | Background health check loop | Small (~20 lines) | Medium (proactive detection) |
| 3 | Multi-endpoint support per role | Medium (~100 lines config + routing) | Low (single helper usually sufficient) |
| 4 | Backend routing (mlx_lm.server instances) | Medium (~200 lines) | Medium (multi-quant switching) |
| 5 | mDNS auto-discovery | Large (~300 lines + dependency) | Low (static config works) |

### 9.4 Backward Compatibility

All changes should be additive:
- Existing single-endpoint `HelperNodesConfig` format must keep working
- New multi-endpoint format is opt-in
- Circuit breaker is internal (no config change needed for basic operation)
- Health check loop starts automatically if any helper nodes are configured

---

## 10. Don't-Hand-Roll List

Libraries that solve specific problems better than custom code:

| Problem | Library | Why Not Hand-Roll |
|---------|---------|-------------------|
| HTTP client with connection pooling | **httpx** (already used) | Connection lifecycle, HTTP/2, timeouts |
| OpenAI-compatible API | **FastAPI + Pydantic** (already used) | Schema validation, auto-docs, SSE |
| MLX inference | **vllm-mlx** (already used) | Continuous batching, prefix caching |
| MLX embeddings | **mlx-embeddings** or vllm-mlx `EmbeddingEngine` | Model loading, tokenization |
| Model downloads | **huggingface_hub** (already used) | ETag verification, caching, resume |
| YAML config | **pydantic-settings + PyYAML** (already used) | Env override, validation |
| mDNS (if needed later) | **python-zeroconf** 0.148.0 | RFC 6762 compliance, async support |
| Structured logging | **Python stdlib logging** (already used) | Adequate for LMX scale |

**Things to hand-roll (too small for a dependency):**
- Circuit breaker (~40 lines)
- Health check polling loop (~20 lines)
- Multi-endpoint load balancing (~30 lines -- round-robin or priority-based)
- Node health state tracking (extension of existing `get_health_stats()`)

---

## 11. Common Pitfalls

### 11.1 Distributed Inference Pitfalls

1. **Over-engineering discovery** -- mDNS/Consul for 3-5 known LAN nodes is complexity without value. Start with static config.

2. **Attempting tensor parallelism over LAN** -- LAN bandwidth (1-10 Gbps) is 10-100x too slow for inter-layer tensor communication. Only EXO with Thunderbolt 5 RDMA makes this viable, and even that is experimental.

3. **Blocking the hot path** -- Helper node calls (embedding, reranking) must NEVER block `/v1/chat/completions` latency. Use asyncio properly; never await helper calls in the LLM request path.

4. **No fallback strategy** -- If a helper node goes down and there's no fallback, the entire pipeline breaks. Always configure fallback: "local" or "skip".

5. **Hammering failed nodes** -- Without a circuit breaker, every request retries the failing node, adding latency. The circuit breaker's OPEN state short-circuits immediately.

### 11.2 Embedding/Reranking Pitfalls

6. **Running reranking on CPU** -- Open WebUI's built-in sentence-transformer reranker defaults to CPU even with GPUs available. Always set `DEVICE_TYPE="cuda"` or use a dedicated serving endpoint.

7. **Dimension mismatch** -- Embedding models produce different dimension vectors. If you switch models mid-pipeline, existing embeddings in the vector store become incompatible. Pin the embedding model per vector store.

8. **Tokenizer mismatch** -- When estimating token counts for embedding requests, use `len(text) // 4` as a rough heuristic (already done in Opta-LMX). Don't over-engineer token counting for billing.

### 11.3 NVIDIA Helper Node Pitfalls

9. **Ollama on Windows: 0.0.0.0 binding** -- By default, Ollama binds to `127.0.0.1`. For LAN access, set `OLLAMA_HOST=0.0.0.0:11434`. This is a common gotcha.

10. **CUDA version mismatch** -- RTX 5080 (Blackwell architecture) requires CUDA 12.8+. vLLM and llama-cpp-python may need special build flags for Blackwell compatibility.

11. **Windows firewall** -- Ollama's port 11434 must be opened in Windows Firewall for LAN access. This is not done automatically by the installer.

### 11.4 Configuration Pitfalls

12. **Backends section is documentation-only** -- The `backends` section in `mono512-current.yaml` is NOT parsed by `LMXConfig` (no corresponding Pydantic field). If Phase 8 adds backend routing, this must be wired up explicitly.

13. **Config hot-reload and health state** -- When `/admin/config/reload` changes helper node URLs, the circuit breaker state should be reset for the new endpoint. Stale state from old endpoints could block requests to new ones.

---

## 12. Sources

### Distributed Inference
- [llm-d: Introduction to Distributed Inference](https://developers.redhat.com/articles/2025/11/21/introduction-distributed-inference-llm-d) -- Red Hat's disaggregated inference architecture
- [Parallax: Efficient Distributed LLM Inference](https://gradient.network/parallax.pdf) -- Gradient Network's heterogeneous GPU scheduler
- [Parallax GitHub](https://github.com/GradientHQ/parallax) -- Open-source distributed serving framework
- [EXO: Run Frontier AI Locally](https://github.com/exo-explore/exo) -- Apple Silicon + NVIDIA clustering
- [EXO + DGX Spark + Mac Studio](https://blog.exolabs.net/nvidia-dgx-spark/) -- 2.8x gain with heterogeneous disaggregated inference

### Service Discovery
- [python-zeroconf](https://github.com/python-zeroconf/python-zeroconf) -- Pure Python mDNS (v0.148.0, Oct 2025)
- [python-zeroconf PyPI](https://pypi.org/project/zeroconf/) -- Python 3.11-3.14 support

### Model Stack Patterns
- [LiteLLM Router Documentation](https://docs.litellm.ai/docs/routing) -- Load balancing, fallback chains, rate limiting
- [LocalAI Distributed Inference](https://localai.io/features/distribute/) -- P2P, federated, worker modes
- [Local LLM Hosting 2026 Guide](https://www.glukhov.org/post/2025/11/hosting-llms-ollama-localai-jan-lmstudio-vllm-comparison/) -- Comprehensive comparison

### Health Monitoring
- [aiobreaker](https://github.com/arlyon/aiobreaker) -- Async circuit breaker for Python
- [circuitbreaker PyPI](https://pypi.org/project/circuitbreaker/) -- Python circuit breaker pattern
- [Circuit Breaker in FastAPI](https://blog.stackademic.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342) -- Implementation guide

### Embedding Models
- [mlx-embeddings (Blaizzy)](https://github.com/Blaizzy/mlx-embeddings) -- Vision + Language embeddings on MLX
- [mlx-embedding-models (taylorai)](https://github.com/taylorai/mlx_embedding_models) -- BERT/RoBERTa on MLX
- [qwen3-embeddings-mlx](https://github.com/jakedahn/qwen3-embeddings-mlx) -- 44K tok/s, REST API, hot-swapping
- [vllm-mlx Embeddings Guide](https://github.com/waybarrios/vllm-mlx/blob/main/docs/guides/embeddings.md) -- OpenAI-compatible `/v1/embeddings`
- [Qwen3 Embedding Blog](https://qwenlm.github.io/blog/qwen3-embedding/) -- MTEB #1, multi-size

### Reranking Models
- [jina-reranker-v3-mlx](https://huggingface.co/jinaai/jina-reranker-v3-mlx) -- Native MLX, 0.6B, CC BY-NC 4.0
- [jina-ai/mlx-retrieval](https://github.com/jina-ai/mlx-retrieval) -- Train embedding/reranker on Apple Silicon
- [Qwen3 Reranker on Ollama](https://www.glukhov.org/post/2025/06/qwen3-embedding-qwen3-reranker-on-ollama/) -- Apache 2.0, 0.6B-8B sizes

### GPU Worker Servers
- [Ollama Windows Documentation](https://docs.ollama.com/windows) -- Setup, GPU detection, service mode
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility) -- `/v1/embeddings`, `/v1/rerank`
- [vLLM OpenAI-Compatible Server](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/) -- Full endpoint reference
- [Infinity (michaelfeil)](https://github.com/michaelfeil/infinity) -- Dedicated embedding/reranking server
- [Best GPUs for LLM Inference 2025](https://localllm.in/blog/best-gpus-llm-inference-2025) -- RTX 5080 benchmarks
- [llama-cpp-python Server](https://llama-cpp-python.readthedocs.io/en/latest/server/) -- OpenAI-compatible, CUDA support

### vllm-mlx (Opta-LMX's Foundation)
- [vllm-mlx GitHub](https://github.com/waybarrios/vllm-mlx) -- OpenAI + Anthropic compatible, 400+ tok/s
- [vllm-mlx Paper](https://arxiv.org/html/2601.19139v1) -- 21-87% higher throughput than llama.cpp
