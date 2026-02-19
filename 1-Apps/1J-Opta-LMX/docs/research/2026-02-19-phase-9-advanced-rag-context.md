# Phase 9 Research: Advanced RAG & Context on Apple Silicon

**Date:** 2026-02-19
**Author:** Research Agent
**Status:** Complete
**Confidence:** HIGH (cross-verified across multiple sources)
**Applies to:** Opta-LMX running on Mac Studio M3 Ultra 512GB

---

## Table of Contents

1. [KV Cache Persistence & Management](#1-kv-cache-persistence--management)
2. [Hybrid Search Optimization](#2-hybrid-search-optimization)
3. [RAG Pipeline Optimization for Apple Silicon](#3-rag-pipeline-optimization-for-apple-silicon)
4. [Context Compression](#4-context-compression)
5. [Document Processing Pipelines](#5-document-processing-pipelines)
6. [Embedding Quality Optimization](#6-embedding-quality-optimization)
7. [Reranking in RAG Pipelines](#7-reranking-in-rag-pipelines)
8. [Architecture Recommendation](#8-architecture-recommendation)
9. [Don't-Hand-Roll List](#9-dont-hand-roll-list)
10. [Common Pitfalls](#10-common-pitfalls)

---

## 1. KV Cache Persistence & Management

### Current State in Opta-LMX

The InferenceEngine already supports:
- `kv_bits` (4 or 8) for KV cache quantization
- `kv_group_size` (default 64) for quantization granularity
- `prefix_cache_enabled` (default True) for multi-turn caching
- `scheduler_cache_memory_percent` (default 0.2 = 20% of memory)

These are passed through to vllm-mlx's `BatchedEngine`/`SimpleEngine`. The engine handles in-memory KV cache automatically, but there is **no disk persistence** of KV cache today.

### What Exists in the Ecosystem

#### vllm-mlx Prefix Caching (Already Used)
vllm-mlx implements prefix caching that achieves **5.8x speedup on TTFT** by reusing KV cache from previously processed prompts with matching prefixes. This is active in Opta-LMX when `prefix_cache_enabled=True`. The implementation uses hash-based block identification where logical KV blocks are mapped to their hash value in a global hash table.

**Confidence: HIGH** -- This is already working in production.

#### oMLX: SSD-Tiered KV Cache (Reference Architecture)
[oMLX](https://github.com/jundot/omlx) is built on top of vllm-mlx and adds:
- **Paged KV cache with SSD tiering** -- block-based cache management inspired by vLLM
- **Prefix sharing and Copy-on-Write** -- when GPU memory fills, blocks offload to SSD
- **Cross-restart persistence** -- KV cache restored from disk on next request with matching prefix
- Architecture: `PagedCacheManager` (GPU) + `PagedSSDCacheManager` (SSD, safetensors format)

This is the most relevant reference for disk-based KV cache on Apple Silicon. oMLX proves the pattern works on M-series hardware with unified memory.

**Confidence: HIGH** -- Production project with active development.

#### vLLM PagedAttention (Theory Reference)
vLLM's [PagedAttention](https://arxiv.org/abs/2309.06180) partitions KV cache into fixed-size blocks stored in non-contiguous physical memory, reducing waste to under 4%. Key innovations:
- Block-level hash-based prefix caching
- PagedEviction (2025): identifies and removes low-importance blocks
- LMCache integration for external storage via kv-connector interface

#### LMCache + External Storage
[LMCache](https://ceph.io/en/news/blog/2025/vllm-kv-caching/) provides disk/network persistence for vLLM:
- Stores/streams cache blocks via connector interface
- Hash-based cache block identification (same hashes as vLLM)
- Supports Ceph object storage backend

### Recommendation for Opta-LMX

**Short term (Phase 9):** Do NOT implement custom KV cache persistence. The existing vllm-mlx prefix caching handles multi-turn sessions well. With 512GB unified memory, the M3 Ultra can hold massive KV caches in RAM.

**Medium term (Phase 10+):** If session continuity across server restarts becomes a requirement, study oMLX's `PagedSSDCacheManager` implementation as a reference. The safetensors-on-SSD pattern is proven and compatible with the vllm-mlx architecture already in use.

**What NOT to build:**
- Custom block-level KV cache managers (use oMLX's or wait for upstream vllm-mlx support)
- Ceph/object-storage backends (overkill for single-machine deployment)

---

## 2. Hybrid Search Optimization

### Current State in Opta-LMX

`rag/store.py` implements hybrid search combining:
- **Vector search**: FAISS `IndexFlatIP` with L2-normalized vectors (cosine similarity)
- **BM25 keyword search**: via `rank_bm25.BM25Okapi`
- **RRF merging**: `reciprocal_rank_fusion()` with k=60

The current implementation is functionally correct but has room for optimization.

### Research Findings

#### Reciprocal Rank Fusion Tuning

RRF score formula: `1/(k + rank)` where k is a constant.

- **k=60** is the standard default (used in Azure AI Search, Elasticsearch, and the current Opta-LMX implementation)
- [Microsoft's research](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking) confirms k=60 works well for general-purpose RAG
- Experiments show **k values between 40-80 perform similarly**; the algorithm is robust to this parameter
- For domain-specific tuning: lower k (e.g., 20-40) emphasizes top results more; higher k (80-120) flattens the distribution

**Recommendation:** Keep k=60 as default. Add it as a configurable parameter in `RAGConfig` for tuning.

**Confidence: HIGH** -- Well-established algorithm with clear research backing.

#### Weighted Combination Strategies

Beyond RRF, there are three main fusion approaches:

1. **RRF (current)**: Position-based, normalization-free. Best for production because it requires no score calibration between retrievers.

2. **Convex Combination (CC)**: `score = alpha * vector_score + (1-alpha) * bm25_score`. Requires score normalization. Typical alpha: 0.7 (favor vector). More tunable but harder to maintain.

3. **Distribution-Based Score Fusion (DBSF)**: Normalizes scores by fitting them to a distribution. Better than CC but significantly more complex.

**Recommendation:** Stay with RRF. It is normalization-free, works purely on position, and is extremely efficient. This is the [industry consensus](https://weaviate.io/blog/hybrid-search-explained) for RAG pipelines.

#### Query Expansion

Expanding queries before retrieval can improve recall:

1. **HyDE (Hypothetical Document Embeddings)**: Generate a hypothetical answer, embed that, search. Expensive (requires LLM call per query).
2. **Multi-query**: Rephrase the query 3-5 ways, retrieve for each, merge results. Good recall boost.
3. **Keyword extraction**: Pull important terms from the query for BM25 boost. Cheap.

**Recommendation for Phase 9:** Implement keyword extraction (RAKE or YAKE) as a BM25 boost. Defer HyDE and multi-query to a future phase -- they add latency and LLM cost.

### Specific Improvements for Opta-LMX

1. **Make RRF k configurable** in `RAGConfig` (currently hardcoded at 60)
2. **Add score normalization option** for the vector search leg (min-max within result set)
3. **Consider weighting** the RRF fusion: `vector_weight * vector_rrf + keyword_weight * keyword_rrf` (default both 1.0)
4. **Expand BM25 retrieval depth** beyond `top_k * 2` -- for hybrid, retrieve `top_k * 3` from each leg for better fusion coverage

---

## 3. RAG Pipeline Optimization for Apple Silicon

### FAISS on Apple Silicon

#### faiss-cpu (Current)
The current implementation uses `faiss-cpu` which provides:
- ARM NEON SIMD acceleration on Apple Silicon
- `IndexFlatIP` for exact cosine similarity (brute force)
- Good performance for <100K vectors

Issues on ARM:
- [FAISS issue #1880](https://github.com/facebookresearch/faiss/issues/1880): SIMD compilation problems on M1
- [FAISS issue #4763](https://github.com/facebookresearch/faiss/issues/4763): Active work on ARM performance (HNSW, IVFPQ, IVFFLAT optimizations from Huawei Kunpeng team)
- Install via conda-forge for ARM-optimized binary: `conda install -c conda-forge faiss-cpu`

**Confidence: MEDIUM** -- Works but not Metal-accelerated. Performance adequate for typical RAG corpus sizes.

#### Faiss-MLX (Metal-Accelerated Alternative)
[Faiss-MLX](https://github.com/MLXPorts/Faiss-mlx) is a pure Python FAISS implementation using MLX for Metal GPU acceleration:
- **20x speedup in specialized cases** vs faiss-cpu
- Sub-millisecond operations on Apple Silicon
- Pure Python (no C++ deps, easy installation)
- Lazy evaluation via MLX computation graphs
- Benchmarks available in `docs/benchmarks/`

**Caveats:** Newer project, smaller community, may lack advanced index types. Good for flat/IVF indices.

**Recommendation:** Look at Faiss-MLX for collections >10K vectors. For smaller collections, faiss-cpu is fine.

#### Alternative Vector Stores

| Store | Type | Apple Silicon | Key Feature | Recommendation |
|-------|------|---------------|-------------|----------------|
| **faiss-cpu** | Library | ARM SIMD | Mature, well-tested | Keep as current default |
| **Faiss-MLX** | Library | Metal GPU | 20x speedup potential | Consider for large collections |
| **LanceDB** | Embedded DB | Native Rust | Serverless, Lance format, zero-copy | Strong candidate for Phase 9 |
| **ChromaDB** | Embedded DB | hnswlib (C++) | Easy API, LangChain native | Good for prototyping, weaker at scale |
| **Qdrant** | Client/Server | Rust binary | Rich filtering, payload storage | Overkill for single-machine |

#### LanceDB: Top Recommendation for Persistent Vector Store

[LanceDB](https://lancedb.com/) stands out for Opta-LMX because:
- **Embedded/serverless** -- no separate process, just a Python library
- **Rust core** -- fast, low resource usage
- **Lance format** -- faster than Parquet, multimodal support, zero-copy versioning
- **Hybrid search built-in** -- vector + full-text search in one query
- **100x faster than Parquet** for vector queries; 1B vectors searchable in <100ms on MacBook
- **Active development**: v0.29.2 released Feb 9, 2026
- Python API works with pandas, Arrow, Pydantic
- LangChain and LlamaIndex integrations

```python
# LanceDB example: replace JSON persistence with proper vector DB
import lancedb

db = lancedb.connect("~/.opta-lmx/rag-store")
table = db.create_table("documents", data=[
    {"text": "chunk text", "vector": embedding, "source": "file.md", "collection": "docs"}
])

# Vector search
results = table.search(query_embedding).limit(10).to_pandas()

# Hybrid search (vector + FTS)
results = (table.search(query_embedding, query_type="hybrid")
           .limit(10).to_pandas())
```

**Recommendation:** Migrate from JSON persistence + in-memory FAISS to LanceDB. This replaces `store.py`'s JSON save/load and FAISS index management with a proper embedded database. Keep the current implementation as fallback for zero-dependency mode.

**Confidence: HIGH** -- Well-established project, Rust-backed, proven performance.

---

## 4. Context Compression

### The Problem

Large RAG results can fill or exceed context windows. On the M3 Ultra, models typically have 4K-128K context windows. Compression helps fit more retrieved context into limited windows while filtering noise.

### Techniques

#### LLMLingua (Microsoft)
[LLMLingua](https://llmlingua.com/) is the dominant context compression library:
- **LLMLingua-1**: Perplexity-based token removal, up to 20x compression with minimal loss
- **LLMLingua-2**: Token classification approach, 3-6x faster than v1, 95-98% accuracy retention
- **LongLLMLingua**: Specifically for RAG, mitigates "lost in the middle" problem, up to 21.4% accuracy improvement using 1/4 tokens

Integrated with LangChain and LlamaIndex.

**Caveat:** Requires a small language model (e.g., LLaMA-7B) to run compression. On M3 Ultra with 512GB, this is feasible but adds latency.

#### ACC-RAG (Adaptive Context Compression)
[ACC-RAG](https://aclanthology.org/2025.findings-emnlp.1307/) dynamically adjusts compression rate based on input complexity:
- >4x faster inference vs standard RAG
- Maintains or improves accuracy
- No fixed compression ratio -- adapts per query

#### Extractive Compression (Simpler, Faster)
For multi-document QA, **extractive compression using rerankers** often outperforms generative compression:
- Reranker scores each retrieved chunk
- Top-k chunks selected (natural compression)
- 2-10x compression with accuracy improvement (noise filtering)

This is effectively what a reranking stage does -- see Section 7.

#### Summary Chains
For very long documents:
1. Chunk the document
2. Summarize each chunk
3. Use summaries as context (or recursive summarization)

Simple, but loses detail. Good for "get the gist" use cases.

### Recommendation for Opta-LMX

**Phase 9:** Implement **two-stage retrieval with reranking** as the primary compression strategy. This naturally filters noise and reduces context size without requiring a separate compression model.

**Phase 10+:** If context window pressure persists, look at LLMLingua-2 for aggressive compression. The M3 Ultra can easily run the small compression model alongside the main model.

**Do NOT implement:**
- Custom token-level compression (LLMLingua does this better)
- Sliding window approaches for RAG (these are for inference, not retrieval)

---

## 5. Document Processing Pipelines

### Current State in Opta-LMX

`rag/processors.py` supports: PDF (pypdf), Markdown, HTML, Code (14 extensions), Text
`rag/chunker.py` provides: `chunk_text()` (separator-based) and `chunk_code()` (double-newline aware)

Both are functional but basic. The chunker uses a ~4 chars/token heuristic.

### Chunking Strategy Research

#### Strategy Comparison (2025-2026 Benchmarks)

| Strategy | Accuracy | Speed | Best For |
|----------|----------|-------|----------|
| **Fixed-size (RecursiveCharacterTextSplitter)** | 85-90% recall | Fast | General text |
| **Semantic chunking** | 95.83% recall | Slow (requires embeddings) | High-precision RAG |
| **Page-level chunking** | 0.648 accuracy (NVIDIA benchmark winner) | Fast | PDFs, structured docs |
| **Code-aware chunking** | High for code search | Medium | Source code |
| **Markdown header chunking** | Good for structured docs | Fast | Documentation |

#### Semantic Chunking
Splits based on embedding similarity between adjacent sentences:
1. Embed each sentence
2. Compute cosine similarity between adjacent embeddings
3. Split where similarity drops below threshold

[Weaviate benchmarks](https://weaviate.io/blog/chunking-strategies-for-rag) show **up to 9% recall improvement** over fixed-size chunking.

**Trade-off:** Requires embedding each sentence during ingestion. On M3 Ultra with a local embedding model, this adds ~1-5ms per sentence.

#### Code-Specific Chunking
The current `chunk_code()` splits on double-newlines (function boundaries). Better approaches:
- **AST-based splitting**: Parse code into AST, split at function/class boundaries
- **Language-aware splitters**: LangChain has `PythonCodeTextSplitter`, `JavaScriptCodeTextSplitter`, etc.
- **Tree-sitter parsing**: Universal parser supporting 100+ languages

```python
# Example: improved code chunking with tree-sitter
from tree_sitter_languages import get_language, get_parser

parser = get_parser('python')
tree = parser.parse(code.encode())
# Extract function/class nodes as natural chunk boundaries
```

#### Markdown-Specific Chunking
The current implementation treats Markdown as plain text with newline separators. Better:
- **Header-based splitting**: Split at `##` boundaries, preserving the header with each chunk
- **Hierarchical chunking**: Include parent headers as context prefix

```python
# Example: Markdown header-aware chunking
def chunk_markdown_by_headers(text: str, max_level: int = 2) -> list[Chunk]:
    """Split markdown at header boundaries, preserving hierarchy."""
    import re
    header_re = re.compile(r'^(#{1,' + str(max_level) + r'})\s+(.+)$', re.MULTILINE)
    # Split at headers, keep header with following content
    ...
```

### Optimal Chunk Sizes (Research Consensus)

| Content Type | Optimal Chunk Size | Optimal Overlap |
|-------------|-------------------|-----------------|
| General text | 400-512 tokens | 50-100 tokens |
| Code | 256-512 tokens | 64-128 tokens |
| Technical docs | 512-1024 tokens | 100-200 tokens |
| Conversations | 256-384 tokens | 32-64 tokens |

The current Opta-LMX defaults (512 chunk, 64 overlap) are in the right range.

### Recommendations

1. **Add Markdown header-aware chunking** -- split at `##` boundaries, include parent headers
2. **Add semantic chunking as an option** -- for high-precision collections
3. **Use tree-sitter for code chunking** -- proper AST-aware splitting (don't hand-roll parsers)
4. **Keep current `chunk_text()` as default** -- it works well for general text
5. **Add chunk size per collection** -- let users tune per content type via RAGConfig

---

## 6. Embedding Quality Optimization

### Current State in Opta-LMX

Opta-LMX has an `/v1/embeddings` endpoint using `mlx-embeddings`. The config supports `models.embedding_model` for specifying which model to use.

### Top Embedding Models for MLX (2026)

| Model | Dims | Params | MLX Support | Matryoshka | Key Strength |
|-------|------|--------|-------------|------------|--------------|
| **Nomic Embed v2** | 768 (truncatable to 256) | 475M (305M active) | Via mlx_embedding_models | Yes | MoE architecture, 100 languages, SOTA efficiency |
| **BGE-M3** | 1024 | 568M | Via mlx_embedding_models | No | Dense + sparse + multi-vector in one model |
| **GTE-multilingual-base** | 768 | 305M | Yes | No | 10x faster inference than competitors |
| **Jina Embeddings v4** | 2048 | 3B (Qwen2.5-VL-3B) | Via jina-ai/mlx-retrieval | No | Multimodal (text + images + documents) |
| **Qwen3 Embeddings** | Various | 0.6B/4B/8B | [Native MLX server](https://github.com/jakedahn/qwen3-embeddings-mlx) | No | 44K tokens/sec on Apple Silicon |

#### Nomic Embed v2 (Top Recommendation)

[Nomic Embed Text V2](https://www.nomic.ai/blog/posts/nomic-embed-text-v2) is the best all-around choice:
- **MoE architecture**: 475M total, only 305M active -- efficient inference
- **Matryoshka support**: Truncate from 768 to 256 dims with minimal quality loss
- **100+ languages**
- **SOTA on BEIR and MIRACL benchmarks**
- Trained on 1.6 billion high-quality pairs
- Predecessor (v1.5): >100 queries/sec on M2 MacBook

```python
# Example: Nomic v2 with Matryoshka truncation
from mlx_embedding_models import EmbeddingModel

model = EmbeddingModel("nomic-ai/nomic-embed-text-v2-moe")
full_embedding = model.encode(["search_query: How to configure RAG?"])  # 768 dims

# Truncate to 256 dims for faster search with ~98% quality retention
truncated = full_embedding[:, :256]
```

#### Qwen3 Embeddings (High Throughput)

For maximum throughput on Apple Silicon, [qwen3-embeddings-mlx](https://github.com/jakedahn/qwen3-embeddings-mlx) achieves:
- **44K tokens/sec** on M2 Max 32GB
- Model hot-swapping between 0.6B/4B/8B variants
- REST API with batch processing
- Expected even better on M3 Ultra

### Matryoshka Embeddings (Dimension Reduction)

[Matryoshka Representation Learning (MRL)](https://huggingface.co/blog/matryoshka) trains models to store important information in early dimensions:

- **Full (768d)**: 100% performance baseline
- **256d**: 98.37% performance, 3x less storage
- **64d**: ~95% performance, 12x less storage

Combined with binary quantization:
- **32x memory savings** from binary quantization alone
- **Additional 8x** from MRL truncation
- Total: up to **256x storage reduction** with ~90% quality

```python
# Matryoshka + binary quantization example
import numpy as np

embedding_768d = model.encode(text)  # float32, 768 dims = 3072 bytes
embedding_256d = embedding_768d[:256]  # float32, 256 dims = 1024 bytes

# Binary quantization: each dim -> 1 bit
binary_256d = np.packbits((embedding_256d > 0).astype(np.uint8))  # 32 bytes!
# Use Hamming distance for search (extremely fast)
```

### Quantized Embeddings

For storage-constrained deployments:
- **int8 quantization**: 4x compression, <1% quality loss
- **Binary quantization**: 32x compression, ~5% quality loss (use with rescoring)
- Voyage AI combines MRL + quantization for maximum efficiency

### Recommendations

1. **Default model: Nomic Embed v2** -- Best balance of quality, speed, and Matryoshka support
2. **Store full 768d embeddings** but enable 256d truncation for search (rerank with full dims)
3. **Add Matryoshka dimension config** to RAGConfig: `embedding_dimensions: 768 | 512 | 256`
4. **Binary quantization for large collections** (>100K docs): store binary, rescore top-100 with float32
5. **Allow embedding model hot-swap** via admin API (already partially supported)

---

## 7. Reranking in RAG Pipelines

### Why Rerank

[Two-stage retrieval](https://www.pinecone.io/learn/series/rag/rerankers/) is the industry standard:
1. **Stage 1 (Retriever)**: Fast, approximate -- retrieve 50-100 candidates via vector/hybrid search
2. **Stage 2 (Reranker)**: Slow, precise -- cross-encoder scores each candidate against the query, return top 5-10

Rerankers improved retrieval accuracy by [15-40%](https://www.analyticsvidhya.com/blog/2025/06/top-rerankers-for-rag/) compared to semantic search alone, resulting in cleaner context, fewer hallucinations, and more reliable RAG.

### Reranker Models for Apple Silicon

| Model | Params | MLX Support | Speed | Languages | Best For |
|-------|--------|-------------|-------|-----------|----------|
| **Jina Reranker v3** | 0.6B | [Native MLX](https://huggingface.co/jinaai/jina-reranker-v3-mlx) | Fast | 100+ | General RAG, code search |
| **Jina Reranker v2** | ~0.3B | HuggingFace | 6x faster than v1 | 100+ | Agentic RAG, function calling |
| **BGE Reranker v2 M3** | ~0.6B | HuggingFace | Moderate | Multilingual | Good balance |
| **Jina ColBERT** | ~0.1B | Yes | Very fast | EN-focused | Long documents |

#### Jina Reranker v3 (Top Recommendation)

[jina-reranker-v3](https://jina.ai/models/jina-reranker-v3/) has a native MLX port:
- **0.6B parameters** -- fits easily alongside main model on M3 Ultra
- **100% score matching** with original implementation
- **Listwise reranking** -- considers all candidates together, not independently
- Available at `jinaai/jina-reranker-v3-mlx` on HuggingFace

Jina also provides [mlx-retrieval](https://github.com/jina-ai/mlx-retrieval) for training custom embedding and reranker models on Apple Silicon -- on M3 Ultra 512GB, training speed is ~4000-5000 tokens/sec.

### Integration Pattern

```python
# Two-stage retrieval with reranking
async def search_with_rerank(
    store: VectorStore,
    reranker: JinaReranker,
    collection: str,
    query: str,
    query_embedding: list[float],
    initial_k: int = 50,
    final_k: int = 5,
) -> list[SearchResult]:
    """Retrieve broadly, then rerank precisely."""
    # Stage 1: Fast hybrid retrieval (broad net)
    candidates = store.search(
        collection=collection,
        query_embedding=query_embedding,
        top_k=initial_k,
        mode="hybrid",
        query_text=query,
    )

    if not candidates:
        return []

    # Stage 2: Cross-encoder reranking (precise scoring)
    texts = [c.document.text for c in candidates]
    rerank_scores = await reranker.rerank(query, texts)

    # Merge rerank scores back to candidates
    scored = sorted(
        zip(candidates, rerank_scores),
        key=lambda x: x[1],
        reverse=True,
    )

    return [
        SearchResult(document=c.document, score=s)
        for c, s in scored[:final_k]
    ]
```

### AnswerDotAI/rerankers (Unified API)

[rerankers](https://github.com/AnswerDotAI/rerankers) provides a lightweight, unified API for all common reranking models:
```python
from rerankers import Reranker

# Works with Jina, Cohere, BGE, ColBERT, FlashRank, etc.
ranker = Reranker("jinaai/jina-reranker-v3-mlx", model_type="cross-encoder")
results = ranker.rank(query="search query", docs=candidate_texts)
```

### Recommendations

1. **Add Jina Reranker v3 MLX** as the default reranker
2. **Expose reranking as an optional stage** in the search API: `rerank: bool = False` parameter
3. **Configure via RAGConfig**: `reranker_model`, `rerank_top_k` (initial retrieval depth), `final_top_k`
4. **Lazy-load the reranker** on first use (same pattern as embedding model)
5. **Use AnswerDotAI/rerankers** for the abstraction layer -- don't write model-specific inference code
6. **Helper Node support**: Allow reranking on a LAN helper node (already architected in `HelperNodesConfig`)

---

## 8. Architecture Recommendation

### Recommended Phase 9 RAG Pipeline

```
Query
  |
  v
[1. Query Processing]
  - Keyword extraction (BM25 boost)
  - Embedding via Nomic Embed v2
  |
  v
[2. Hybrid Retrieval] (top_k=50)
  - Vector search (FAISS or LanceDB)
  - BM25 keyword search
  - RRF fusion (k=60)
  |
  v
[3. Reranking] (optional, top_k=5-10)
  - Jina Reranker v3 MLX
  - Cross-encoder scoring
  |
  v
[4. Context Assembly]
  - Scored & filtered chunks
  - Metadata preserved
  - Ready for LLM prompt injection
```

### Component Stack

| Component | Current | Phase 9 Recommendation |
|-----------|---------|----------------------|
| **Vector Store** | In-memory FAISS + JSON persistence | LanceDB (embedded, persistent) with FAISS fallback |
| **Keyword Search** | rank_bm25 (BM25Okapi) | Keep (LanceDB also has FTS, but BM25 is fine) |
| **Fusion** | RRF (k=60) | RRF with configurable k and optional weighting |
| **Embedding** | mlx-embeddings (model unspecified) | Nomic Embed v2 (768d, Matryoshka to 256d) |
| **Reranking** | None | Jina Reranker v3 MLX (lazy-loaded) |
| **Chunking** | Fixed-size + code-aware | Add: Markdown-header, semantic (optional) |
| **Compression** | None | Two-stage retrieval IS the compression |
| **KV Cache** | vllm-mlx prefix caching | Keep as-is (sufficient for 512GB) |

### Config Additions

```yaml
rag:
  enabled: true
  persist_path: ~/.opta-lmx/rag-store  # Now a directory for LanceDB
  default_chunk_size: 512
  default_chunk_overlap: 64
  max_documents_per_ingest: 100
  auto_persist: true
  # New Phase 9 settings
  embedding_model: "nomic-ai/nomic-embed-text-v2-moe"
  embedding_dimensions: 768  # or 256 for Matryoshka truncation
  reranker_model: "jinaai/jina-reranker-v3-mlx"
  rerank_enabled: false  # opt-in per request
  rerank_initial_k: 50
  rerank_final_k: 5
  rrf_k: 60
  vector_store_backend: "lancedb"  # or "faiss" for in-memory
  chunking_strategy: "fixed"  # "fixed", "semantic", "markdown_headers"
```

---

## 9. Don't-Hand-Roll List

These components should use existing libraries. Building custom versions would be a waste of time and produce inferior results.

| Component | Use This | Don't Build |
|-----------|----------|-------------|
| **BM25 search** | `rank_bm25` (already used) | Custom TF-IDF scorer |
| **Vector similarity** | FAISS / LanceDB / Faiss-MLX | Custom cosine similarity at scale |
| **Embedding models** | `mlx-embeddings` / `mlx_embedding_models` | Custom encoder training |
| **Reranking** | `rerankers` (AnswerDotAI) or Jina MLX directly | Custom cross-encoder inference |
| **PDF parsing** | `pypdf` (already used), `unstructured` for complex PDFs | Custom PDF text extraction |
| **Code parsing** | `tree-sitter-languages` | Custom regex-based code splitters |
| **Context compression** | `LLMLingua` (if needed) | Custom token importance scoring |
| **RRF fusion** | Current implementation is fine (simple algorithm) | Over-engineered fusion pipelines |
| **KV cache persistence** | Study oMLX, wait for vllm-mlx upstream | Custom block-level cache manager |
| **Matryoshka truncation** | NumPy slicing (trivial) | Custom dimension reduction |
| **Score normalization** | scikit-learn `MinMaxScaler` or NumPy | Custom normalization schemes |

---

## 10. Common Pitfalls

### Performance Traps on Apple Silicon

1. **FAISS GPU mode does not exist for Metal.** `faiss-gpu` requires CUDA. Use `faiss-cpu` with ARM SIMD, or Faiss-MLX for Metal acceleration. Installing `faiss-gpu` on macOS will fail.

2. **JSON persistence does not scale.** The current `store.py` saves all embeddings as JSON lists. For 10K documents at 768 dimensions, this is ~30MB of JSON with slow serialization. LanceDB or even NumPy `.npy` files are orders of magnitude better.

3. **Embedding model + main model memory contention.** On M3 Ultra 512GB this is less critical, but loading a 568M parameter BGE-M3 alongside a 70B parameter main model still consumes memory. Use lazy loading and consider unloading the embedding model after batch ingestion.

4. **BM25 index rebuild on every insert.** The current `_rebuild_indexes()` calls `BM25Okapi(self._corpus)` which rebuilds the entire index. For incremental additions at scale, consider `rank_bm25`'s limitations -- it has no incremental update. For large corpora, switch to Tantivy (Rust-based FTS) or LanceDB's built-in FTS.

5. **Reranking adds latency.** A cross-encoder processes each (query, document) pair sequentially. For 50 candidates with Jina v3 (0.6B params), expect 100-500ms on M3 Ultra. Make reranking opt-in, not default.

6. **Unified memory is shared.** MLX models, FAISS indices, Python heap, and OS all share the same 512GB pool. The 90% memory threshold in `MemoryConfig` protects against OOM, but large vector stores can silently consume significant memory without triggering the model-loading guardrail.

7. **Embedding dimension mismatch.** If you switch embedding models (e.g., from 384d to 768d), existing stored embeddings become incompatible. Always store the embedding model ID with the collection metadata. Add a check on search that the query embedding dimension matches the stored dimension.

8. **MLX lazy computation gotcha.** MLX uses lazy computation -- operations are not executed until results are needed. If you benchmark embedding throughput, make sure to force computation by accessing the result array. Otherwise, you will measure graph construction time, not actual compute time.

9. **Don't embed the same text twice.** During hybrid search, the query text is both embedded (for vector search) and tokenized (for BM25). The current implementation handles this correctly, but any refactoring should preserve this separation -- embedding is expensive, tokenization is cheap.

10. **chunk_overlap too large wastes embedding budget.** The current default (64/512 = 12.5% overlap) is reasonable. Going above 25% wastes embedding compute with diminishing returns on retrieval quality.

### Architectural Pitfalls

1. **Don't couple the RAG store to the inference engine.** The vector store should be independent of which LLM is loaded. The current architecture correctly separates these -- keep it that way.

2. **Don't make reranking mandatory.** Many queries (simple lookups, exact keyword matches) don't benefit from reranking. Make it opt-in per request.

3. **Don't persist embeddings in the same format as documents.** Binary formats (Lance, NumPy, FAISS native) are 10-100x more space-efficient than JSON arrays.

4. **Don't ignore collection isolation.** Different collections may use different embedding models or dimensions. The current collection-based organization in `VectorStore` is good -- extend it with per-collection embedding model metadata.

---

## Sources

### KV Cache & Inference
- [vllm-mlx GitHub](https://github.com/waybarrios/vllm-mlx)
- [oMLX - SSD KV Cache for Apple Silicon](https://github.com/jundot/omlx)
- [vLLM Automatic Prefix Caching](https://docs.vllm.ai/en/stable/design/prefix_caching/)
- [vLLM PagedAttention Paper](https://arxiv.org/abs/2309.06180)
- [KV Caching with vLLM, LMCache, and Ceph](https://ceph.io/en/news/blog/2025/vllm-kv-caching/)
- [How Prompt Caching Works](https://sankalp.bearblog.dev/how-prompt-caching-works/)
- [vLLM Quantized KV Cache](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/)
- [vllm-mlx Paper](https://arxiv.org/html/2601.19139v2)

### Hybrid Search & RRF
- [Advanced RAG - Understanding RRF in Hybrid Search](https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/)
- [Hybrid Search Explained - Weaviate](https://weaviate.io/blog/hybrid-search-explained)
- [Azure AI Search - Hybrid Search Scoring](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)
- [Optimizing RAG with Hybrid Search & Reranking - Superlinked](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [Hybrid Search in PostgreSQL - ParadeDB](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)

### Vector Stores & FAISS
- [Faiss-MLX: Metal-Accelerated Vector Search](https://github.com/MLXPorts/Faiss-mlx)
- [FAISS ARM SIMD Issue #1880](https://github.com/facebookresearch/faiss/issues/1880)
- [FAISS AArch64 Performance Issue #4763](https://github.com/facebookresearch/faiss/issues/4763)
- [LanceDB](https://lancedb.com/)
- [LanceDB Documentation](https://docs.lancedb.com)
- [Lance vs Chroma Comparison](https://medium.com/@patricklenert/vector-databases-lance-vs-chroma-cc8d124372e9)

### Context Compression
- [LLMLingua](https://llmlingua.com/)
- [LLMLingua GitHub](https://github.com/microsoft/LLMLingua)
- [LongLLMLingua for RAG](https://www.llamaindex.ai/blog/longllmlingua-bye-bye-to-middle-loss-and-save-on-your-rag-costs-via-prompt-compression-54b559b9ddf7)
- [ACC-RAG: Adaptive Context Compression](https://aclanthology.org/2025.findings-emnlp.1307/)
- [Contextual Compression in RAG Survey](https://arxiv.org/html/2409.13385v1)
- [Prompt Compression Techniques](https://medium.com/@kuldeep.paul08/prompt-compression-techniques-reducing-context-window-costs-while-improving-llm-performance-afec1e8f1003)

### Chunking
- [Chunking Strategies for RAG - Weaviate](https://weaviate.io/blog/chunking-strategies-for-rag)
- [Best Chunking Strategies for RAG 2025 - Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag-2025)
- [Chunking Best Practices - Unstructured](https://unstructured.io/blog/chunking-for-rag-best-practices)
- [25 Chunking Tricks for RAG](https://medium.com/@dev_tips/25-chunking-tricks-for-rag-that-devs-actually-use-12bebd0375bc)

### Embedding Models
- [Best Open-Source Embedding Models 2026 - BentoML](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [Best Embedding Models 2026 - Openxcell](https://www.openxcell.com/blog/best-embedding-models/)
- [Nomic Embed Text V2](https://www.nomic.ai/blog/posts/nomic-embed-text-v2)
- [Qwen3 Embeddings MLX](https://github.com/jakedahn/qwen3-embeddings-mlx)
- [Jina MLX Retrieval](https://github.com/jina-ai/mlx-retrieval)
- [mlx_embedding_models](https://github.com/taylorai/mlx_embedding_models)
- [Matryoshka Embeddings - HuggingFace](https://huggingface.co/blog/matryoshka)
- [Matryoshka Embeddings: 5x Faster Vector Search](https://medium.com/data-science-collective/matryoshka-embeddings-how-to-make-vector-search-5x-faster-f9fdc54d5ffd)
- [RAG Embeddings Storage Optimization](https://link.springer.com/chapter/10.1007/978-3-032-08465-1_16)

### Reranking
- [Rerankers and Two-Stage Retrieval - Pinecone](https://www.pinecone.io/learn/series/rag/rerankers/)
- [Top 7 Rerankers for RAG - Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/06/top-rerankers-for-rag/)
- [Jina Reranker v3 MLX](https://huggingface.co/jinaai/jina-reranker-v3-mlx)
- [Jina Reranker v2 for Agentic RAG](https://jina.ai/news/jina-reranker-v2-for-agentic-rag-ultra-fast-multilingual-function-calling-and-code-search/)
- [AnswerDotAI/rerankers](https://github.com/AnswerDotAI/rerankers)
- [Reranker Leaderboard](https://agentset.ai/rerankers)
- [Ultimate Guide to Reranking Models 2026](https://www.zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025)

### Apple Silicon & MLX Performance
- [Benchmarking ML on Apple Silicon with MLX](https://arxiv.org/abs/2510.18921)
- [Exploring LLMs with MLX and M5 Neural Accelerators](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)
- [vllm-mlx Paper](https://studylib.net/doc/28213158/vllm-mlx-paper--1-)
