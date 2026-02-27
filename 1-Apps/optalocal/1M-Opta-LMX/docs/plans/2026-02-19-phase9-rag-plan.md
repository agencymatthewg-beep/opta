# Phase 9: Advanced RAG & Context — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-02-19
**Phase:** 9 of Opta-LMX roadmap
**Goal:** Improve RAG quality through hybrid search tuning, reranking, markdown-aware chunking, embedding configuration, and dimension safety.
**Research:** `docs/research/2026-02-19-phase-9-advanced-rag-context.md`
**Estimated total:** ~35 tasks, ~90 minutes

---

## Scope (In / Out)

### IN (7 features)
1. Configurable RRF k parameter + weighted fusion
2. Reranking integration (Jina Reranker v3 MLX, lazy-loaded, opt-in)
3. Markdown-header-aware chunking
4. Embedding model config fields on RAGConfig
5. Embedding dimension metadata per collection (mismatch prevention)
6. RAGConfig expansion (reranker fields, chunking strategy)
7. Search API enhancement (`rerank` parameter)

### OUT (deferred)
- LanceDB migration (JSON persistence is fine for current scale)
- KV cache persistence (vllm-mlx handles this)
- Semantic chunking (nice-to-have, not Phase 9)
- LLMLingua context compression (Phase 10+)
- Custom embedding model training
- Query expansion (RAKE/HyDE — Phase 10+)

---

## Feature A: RAGConfig Expansion

Add new fields to `RAGConfig` in `config.py`. All fields have safe defaults so existing configs remain valid.

### Task A1: Test — RAGConfig new fields parse with defaults
**File:** `tests/test_rag.py`
**Time:** 2 min

Add test at bottom of file:

```python
class TestRAGConfig:
    """Tests for RAGConfig new Phase 9 fields."""

    def test_default_values(self) -> None:
        from opta_lmx.config import RAGConfig
        cfg = RAGConfig()
        assert cfg.rrf_k == 60
        assert cfg.rrf_vector_weight == 1.0
        assert cfg.rrf_keyword_weight == 1.0
        assert cfg.embedding_model is None
        assert cfg.embedding_dimensions is None
        assert cfg.reranker_model is None
        assert cfg.rerank_enabled is False
        assert cfg.rerank_initial_k == 50
        assert cfg.rerank_final_k == 5
        assert cfg.chunking_strategy == "fixed"

    def test_custom_values(self) -> None:
        from opta_lmx.config import RAGConfig
        cfg = RAGConfig(
            rrf_k=40,
            rrf_vector_weight=1.5,
            rrf_keyword_weight=0.8,
            embedding_model="nomic-ai/nomic-embed-text-v2-moe",
            embedding_dimensions=768,
            reranker_model="jinaai/jina-reranker-v3-mlx",
            rerank_enabled=True,
            rerank_initial_k=30,
            rerank_final_k=10,
            chunking_strategy="markdown_headers",
        )
        assert cfg.rrf_k == 40
        assert cfg.chunking_strategy == "markdown_headers"

    def test_rrf_k_validation(self) -> None:
        from opta_lmx.config import RAGConfig
        import pytest
        with pytest.raises(Exception):
            RAGConfig(rrf_k=0)  # Must be >= 1

    def test_chunking_strategy_validation(self) -> None:
        from opta_lmx.config import RAGConfig
        import pytest
        with pytest.raises(Exception):
            RAGConfig(chunking_strategy="banana")
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestRAGConfig -x -v`
**Expect:** FAIL (fields don't exist yet)

---

### Task A2: Implement — Add fields to RAGConfig
**File:** `src/opta_lmx/config.py`
**Time:** 3 min

Add these fields to the `RAGConfig` class, after `auto_persist`:

```python
    # Phase 9: Hybrid search tuning
    rrf_k: int = Field(60, ge=1, le=200, description="RRF fusion constant (higher = flatter ranking)")
    rrf_vector_weight: float = Field(
        1.0, ge=0.0, le=5.0, description="Weight for vector search leg in RRF fusion"
    )
    rrf_keyword_weight: float = Field(
        1.0, ge=0.0, le=5.0, description="Weight for keyword search leg in RRF fusion"
    )

    # Phase 9: Embedding configuration
    embedding_model: str | None = Field(
        None, description="Default embedding model HF ID for RAG ingestion"
    )
    embedding_dimensions: int | None = Field(
        None, ge=64, le=4096, description="Expected embedding dimensions (None = auto-detect)"
    )

    # Phase 9: Reranking
    reranker_model: str | None = Field(
        None, description="Reranker model HF ID (e.g. jinaai/jina-reranker-v3-mlx)"
    )
    rerank_enabled: bool = Field(False, description="Enable reranking by default on search")
    rerank_initial_k: int = Field(
        50, ge=5, le=200, description="Candidates to retrieve before reranking"
    )
    rerank_final_k: int = Field(
        5, ge=1, le=50, description="Results to return after reranking"
    )

    # Phase 9: Chunking strategy
    chunking_strategy: str = Field(
        "fixed",
        pattern="^(fixed|markdown_headers|code)$",
        description="Default chunking strategy: fixed, markdown_headers, or code",
    )
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestRAGConfig -x -v`
**Expect:** PASS

---

### Task A3: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/config.py tests/test_rag.py
git commit -m "feat(lmx): add Phase 9 RAGConfig fields — rrf, reranker, embedding, chunking"
```

---

## Feature B: Configurable RRF k + Weighted Fusion

Wire `rrf_k`, `rrf_vector_weight`, and `rrf_keyword_weight` from config into the hybrid search path.

### Task B1: Test — RRF k parameter changes result ordering
**File:** `tests/test_rag.py`
**Time:** 3 min

Add to `TestVectorStore`:

```python
    def test_rrf_k_parameter(self) -> None:
        """reciprocal_rank_fusion respects the k parameter."""
        from opta_lmx.rag.bm25 import reciprocal_rank_fusion

        ranked = [[(0, 10.0), (1, 5.0)], [(1, 8.0), (0, 3.0)]]
        result_k20 = reciprocal_rank_fusion(ranked, k=20)
        result_k120 = reciprocal_rank_fusion(ranked, k=120)

        # Both return same docs but with different score spreads
        assert len(result_k20) == 2
        assert len(result_k120) == 2
        # Lower k = more spread between top and bottom
        spread_k20 = result_k20[0][1] - result_k20[-1][1]
        spread_k120 = result_k120[0][1] - result_k120[-1][1]
        assert spread_k20 > spread_k120

    def test_weighted_rrf(self) -> None:
        """Weighted RRF applies per-list weights."""
        from opta_lmx.rag.bm25 import reciprocal_rank_fusion

        # Doc 0 is #1 in list A, #2 in list B
        # Doc 1 is #2 in list A, #1 in list B
        ranked = [[(0, 10.0), (1, 5.0)], [(1, 8.0), (0, 3.0)]]

        # Equal weights: symmetric, could go either way
        equal = reciprocal_rank_fusion(ranked, k=60, weights=[1.0, 1.0])
        # Heavy weight on list A: doc 0 should win (it's #1 in list A)
        weighted_a = reciprocal_rank_fusion(ranked, k=60, weights=[5.0, 1.0])
        assert weighted_a[0][0] == 0  # Doc 0 wins with high list-A weight
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore::test_rrf_k_parameter tests/test_rag.py::TestVectorStore::test_weighted_rrf -x -v`
**Expect:** FAIL (weights parameter doesn't exist)

---

### Task B2: Implement — Add weights parameter to reciprocal_rank_fusion
**File:** `src/opta_lmx/rag/bm25.py`
**Time:** 3 min

Update the `reciprocal_rank_fusion` function signature and body:

```python
def reciprocal_rank_fusion(
    ranked_lists: list[list[tuple[int, float]]],
    k: int = 60,
    weights: list[float] | None = None,
) -> list[tuple[int, float]]:
    """Combine multiple ranked lists using Reciprocal Rank Fusion.

    RRF assigns each document a score of 1/(k + rank) from each retriever,
    then sums across retrievers. Optional per-list weights scale each
    retriever's contribution.

    Args:
        ranked_lists: List of ranked results, each as [(doc_index, score), ...].
        k: RRF constant (default 60, higher = less emphasis on top ranks).
        weights: Optional per-list weights (default: all 1.0).

    Returns:
        Merged results as [(doc_index, rrf_score), ...] sorted by descending score.
    """
    rrf_scores: dict[int, float] = {}
    list_weights = weights or [1.0] * len(ranked_lists)

    for w, ranked in zip(list_weights, ranked_lists, strict=False):
        for rank, (doc_idx, _score) in enumerate(ranked):
            if doc_idx not in rrf_scores:
                rrf_scores[doc_idx] = 0.0
            rrf_scores[doc_idx] += w * (1.0 / (k + rank + 1))

    merged = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return merged
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore::test_rrf_k_parameter tests/test_rag.py::TestVectorStore::test_weighted_rrf -x -v`
**Expect:** PASS

---

### Task B3: Test — VectorStore.search passes RRF config through
**File:** `tests/test_rag.py`
**Time:** 3 min

Add to `TestVectorStore`:

```python
    def test_hybrid_search_uses_rrf_config(self) -> None:
        """Hybrid search accepts rrf_k and rrf_weights parameters."""
        store = VectorStore()
        store.add(
            "col",
            ["alpha beta gamma", "delta epsilon", "alpha delta"],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.5, 0.5, 0.0]],
        )
        # Should not raise with custom rrf params
        results = store.search(
            "col", [1.0, 0.0, 0.0], top_k=3,
            mode="hybrid", query_text="alpha",
            rrf_k=40, rrf_weights=[2.0, 1.0],
        )
        assert len(results) >= 1
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore::test_hybrid_search_uses_rrf_config -x -v`
**Expect:** FAIL (search() doesn't accept rrf_k/rrf_weights)

---

### Task B4: Implement — Wire rrf_k and rrf_weights into VectorStore.search
**File:** `src/opta_lmx/rag/store.py`
**Time:** 4 min

Update `VectorStore.search()` signature to accept optional RRF parameters:

```python
    def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
        min_score: float = 0.0,
        mode: str = "vector",
        query_text: str | None = None,
        rrf_k: int = 60,
        rrf_weights: list[float] | None = None,
    ) -> list[SearchResult]:
```

Update `_search_hybrid()` to accept and pass them:

```python
    def _search_hybrid(
        self,
        collection: str,
        query_vec: NDArray[np.float32],
        query_text: str,
        top_k: int,
        min_score: float,
        docs: list[Document],
        rrf_k: int = 60,
        rrf_weights: list[float] | None = None,
    ) -> list[SearchResult]:
```

In `search()`, pass them to `_search_hybrid`:

```python
        if mode == "hybrid":
            return self._search_hybrid(
                collection, query_vec, query_text or "", top_k, min_score, docs,
                rrf_k=rrf_k, rrf_weights=rrf_weights,
            )
```

In `_search_hybrid()`, pass them to `reciprocal_rank_fusion`:

```python
        merged = reciprocal_rank_fusion(ranked_lists, k=rrf_k, weights=rrf_weights)
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore -x -v`
**Expect:** PASS (all VectorStore tests)

---

### Task B5: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/rag/bm25.py src/opta_lmx/rag/store.py tests/test_rag.py
git commit -m "feat(lmx): configurable RRF k + weighted fusion in hybrid search"
```

---

## Feature C: Markdown-Header-Aware Chunking

New `chunk_markdown()` function that splits on `##` boundaries and preserves parent headers as context.

### Task C1: Test — chunk_markdown splits on headers
**File:** `tests/test_rag.py`
**Time:** 3 min

Add a new test class:

```python
from opta_lmx.rag.chunker import chunk_markdown


class TestChunkMarkdown:
    """Tests for markdown header-aware chunking."""

    def test_empty_markdown(self) -> None:
        assert chunk_markdown("") == []

    def test_no_headers(self) -> None:
        """Text without headers falls back to single chunk."""
        chunks = chunk_markdown("Just some plain text.\nAnother line.")
        assert len(chunks) == 1
        assert "Just some plain text." in chunks[0].text

    def test_splits_on_h2(self) -> None:
        md = "## Section A\nContent A.\n\n## Section B\nContent B."
        chunks = chunk_markdown(md)
        assert len(chunks) == 2
        assert "## Section A" in chunks[0].text
        assert "Content A." in chunks[0].text
        assert "## Section B" in chunks[1].text
        assert "Content B." in chunks[1].text

    def test_preserves_h1_context(self) -> None:
        """H1 header is prepended to each H2 chunk as context."""
        md = "# Main Title\n\n## Section A\nContent A.\n\n## Section B\nContent B."
        chunks = chunk_markdown(md)
        assert len(chunks) == 2
        # Each chunk should include the parent H1 as context
        assert "# Main Title" in chunks[0].text
        assert "# Main Title" in chunks[1].text

    def test_large_section_re_split(self) -> None:
        """Sections exceeding max_chunk_size are sub-chunked."""
        lines = [f"Line {i} with some filler content here." for i in range(200)]
        md = "## Big Section\n" + "\n".join(lines)
        chunks = chunk_markdown(md, max_chunk_size=512)
        assert len(chunks) >= 2
        # All sub-chunks still have the header
        for chunk in chunks:
            assert "## Big Section" in chunk.text

    def test_h3_not_split_by_default(self) -> None:
        """By default, only split on H1 and H2."""
        md = "## Section\nIntro.\n### Subsection\nSub-content."
        chunks = chunk_markdown(md)
        assert len(chunks) == 1
        assert "### Subsection" in chunks[0].text

    def test_sequential_indices(self) -> None:
        md = "## A\nText.\n\n## B\nText.\n\n## C\nText."
        chunks = chunk_markdown(md)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestChunkMarkdown -x -v`
**Expect:** FAIL (chunk_markdown doesn't exist)

---

### Task C2: Implement — chunk_markdown function
**File:** `src/opta_lmx/rag/chunker.py`
**Time:** 5 min

Add after the `chunk_code` function:

```python
import re

_HEADER_RE = re.compile(r"^(#{1,2})\s+(.+)$", re.MULTILINE)


def chunk_markdown(
    text: str,
    max_chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """Split markdown at H1/H2 header boundaries.

    Each chunk contains one H2 section with any parent H1 prepended
    as context. Sections exceeding max_chunk_size (in tokens, ~4 chars/token)
    are sub-split using chunk_text().

    Args:
        text: Markdown text to chunk.
        max_chunk_size: Target tokens per chunk.
        chunk_overlap: Token overlap for sub-splitting large sections.

    Returns:
        List of Chunk objects with position metadata.
    """
    if not text.strip():
        return []

    chars_per_chunk = max_chunk_size * 4
    parent_h1 = ""
    sections: list[tuple[str, int]] = []  # (section_text, start_char)

    # Find all H1/H2 header positions
    headers = list(_HEADER_RE.finditer(text))

    if not headers:
        # No headers — return as single chunk
        return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

    # Extract H1 if present at the start (before first H2)
    first_header = headers[0]
    if first_header.group(1) == "#":
        parent_h1 = first_header.group(0)

    # Build sections: each H2 (or H1 acting as section) starts a new chunk
    for i, match in enumerate(headers):
        level = match.group(1)
        if level == "#":
            parent_h1 = match.group(0)
            # If this H1 is not followed by an H2, it becomes its own section
            next_idx = i + 1
            if next_idx >= len(headers):
                # H1 is the last header — everything after it is one section
                section_text = text[match.start():].strip()
                sections.append((section_text, match.start()))
            elif headers[next_idx].group(1) == "#":
                # Next header is also H1 — this H1's content is a section
                section_text = text[match.start():headers[next_idx].start()].strip()
                if section_text:
                    sections.append((section_text, match.start()))
            # If next is H2, the H1 content before it will be included with the H2
            continue

        # H2 header — extract content until next H1/H2
        end_pos = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        section_text = text[match.start():end_pos].strip()
        if section_text:
            # Prepend parent H1 as context (if exists and not already in section)
            if parent_h1 and not section_text.startswith(parent_h1):
                section_text = parent_h1 + "\n\n" + section_text
            sections.append((section_text, match.start()))

    if not sections:
        return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

    # Build chunks, sub-splitting oversized sections
    chunks: list[Chunk] = []
    for section_text, start_char in sections:
        if len(section_text) > chars_per_chunk * 1.5:
            # Sub-split but preserve header in each sub-chunk
            lines = section_text.split("\n")
            header_line = lines[0] if lines else ""
            body = "\n".join(lines[1:]).strip()
            sub_chunks = chunk_text(body, max_chunk_size, chunk_overlap)
            for sc in sub_chunks:
                full_text = header_line + "\n" + sc.text if header_line else sc.text
                chunks.append(Chunk(
                    text=full_text,
                    index=len(chunks),
                    start_char=start_char + sc.start_char,
                    end_char=start_char + sc.end_char,
                ))
        else:
            chunks.append(Chunk(
                text=section_text,
                index=len(chunks),
                start_char=start_char,
                end_char=start_char + len(section_text),
            ))

    return chunks
```

Note: Move the `import re` to the top of the file (it's not imported yet).

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestChunkMarkdown -x -v`
**Expect:** PASS

---

### Task C3: Test — Ingest API accepts chunking="markdown_headers"
**File:** `tests/test_rag.py`
**Time:** 2 min

Add after `test_ingest_code_chunking`:

```python
async def test_ingest_markdown_chunking(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest with markdown_headers chunking splits on H2."""
    md = "## Section A\nContent A is here.\n\n## Section B\nContent B is here."
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "md_chunks",
            "documents": [md],
            "chunking": "markdown_headers",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_created"] == 2
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::test_ingest_markdown_chunking -x -v`
**Expect:** FAIL (chunking="markdown_headers" not handled)

---

### Task C4: Implement — Wire markdown_headers into ingest endpoint
**File:** `src/opta_lmx/api/rag.py`
**Time:** 3 min

1. Update the `IngestRequest.chunking` field pattern to include `markdown_headers`:

```python
    chunking: str = Field(
        "auto", pattern="^(auto|text|code|markdown_headers|none)$",
        description="Chunking strategy"
    )
```

2. Add import at top:

```python
from opta_lmx.rag.chunker import chunk_code, chunk_markdown, chunk_text
```

3. In the `ingest_documents` route, add the `markdown_headers` branch in the chunking loop:

```python
        elif body.chunking == "markdown_headers":
            chunks = chunk_markdown(doc, body.chunk_size, body.chunk_overlap)
            for chunk in chunks:
                all_chunks.append(chunk.text)
                all_metadata.append({
                    **doc_meta,
                    "doc_index": i,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                })
```

Place this `elif` before the final `else` block (auto/text).

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::test_ingest_markdown_chunking tests/test_rag.py::TestChunkMarkdown -x -v`
**Expect:** PASS

---

### Task C5: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/rag/chunker.py src/opta_lmx/api/rag.py tests/test_rag.py
git commit -m "feat(lmx): markdown-header-aware chunking for RAG ingestion"
```

---

## Feature D: Embedding Dimension Metadata + Mismatch Prevention

Store embedding dimensions per collection so searches with wrong-dimension queries fail fast instead of silently returning garbage.

### Task D1: Test — Collection stores embedding_dimensions metadata
**File:** `tests/test_rag.py`
**Time:** 3 min

Add to `TestVectorStore`:

```python
    def test_collection_embedding_dimensions_tracked(self) -> None:
        """Collection records its embedding dimensions on first add."""
        store = VectorStore()
        store.add("col", ["text"], [[1.0, 2.0, 3.0]])
        stats = store.get_stats()
        assert stats["collections"]["col"]["embedding_dimensions"] == 3

    def test_dimension_mismatch_on_add_raises(self) -> None:
        """Adding documents with different dimensions raises ValueError."""
        store = VectorStore()
        store.add("col", ["first"], [[1.0, 2.0, 3.0]])
        with pytest.raises(ValueError, match="dimension mismatch"):
            store.add("col", ["second"], [[1.0, 2.0]])

    def test_dimension_mismatch_on_search_raises(self) -> None:
        """Searching with wrong dimensions raises ValueError."""
        store = VectorStore()
        store.add("col", ["text"], [[1.0, 2.0, 3.0]])
        with pytest.raises(ValueError, match="dimension mismatch"):
            store.search("col", [1.0, 2.0])  # 2D vs 3D
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore::test_dimension_mismatch_on_add_raises tests/test_rag.py::TestVectorStore::test_dimension_mismatch_on_search_raises -x -v`
**Expect:** FAIL (no dimension checks)

---

### Task D2: Implement — Track + enforce embedding dimensions per collection
**File:** `src/opta_lmx/rag/store.py`
**Time:** 4 min

1. Add a `_collection_dims` dict to `VectorStore.__init__`:

```python
    def __init__(self, persist_path: Path | None = None) -> None:
        self._collections: dict[str, list[Document]] = {}
        self._collection_dims: dict[str, int] = {}  # collection -> embedding dim
        self._faiss_indexes: dict[str, Any] = {}
        self._bm25_indexes: dict[str, BM25Index] = {}
        self._persist_path = persist_path
```

2. In `add()`, after the length check, add a dimension check:

```python
        # Check embedding dimensions consistency
        if embeddings:
            new_dim = len(embeddings[0])
            existing_dim = self._collection_dims.get(collection)
            if existing_dim is not None and new_dim != existing_dim:
                raise ValueError(
                    f"Embedding dimension mismatch for collection '{collection}': "
                    f"expected {existing_dim}, got {new_dim}"
                )
            self._collection_dims[collection] = new_dim
```

3. In `search()`, after the empty-docs early return, add:

```python
        # Validate query embedding dimensions
        expected_dim = self._collection_dims.get(collection)
        if expected_dim is not None and len(query_embedding) != expected_dim:
            raise ValueError(
                f"Query embedding dimension mismatch for collection '{collection}': "
                f"expected {expected_dim}, got {len(query_embedding)}"
            )
```

4. In `delete_collection()`, clean up dims:

```python
        self._collection_dims.pop(collection, None)
```

5. In `load()`, restore dims from loaded data:

```python
        self._collection_dims.clear()
```

And after each collection is loaded in the loop:

```python
            if self._collections[collection]:
                self._collection_dims[collection] = len(
                    self._collections[collection][0].embedding
                )
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestVectorStore -x -v`
**Expect:** PASS

---

### Task D3: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/rag/store.py tests/test_rag.py
git commit -m "feat(lmx): embedding dimension tracking + mismatch prevention per collection"
```

---

## Feature E: Local Reranker Engine

Add a lazy-loaded reranker that uses `rerankers` library with Jina Reranker v3 MLX. This replaces the "reranking_unavailable" fallback in `api/rerank.py`.

### Task E1: Test — RerankerEngine loads and scores
**File:** `tests/test_rag.py`
**Time:** 3 min

```python
class TestRerankerEngine:
    """Tests for the local reranker engine (mocked — no real model in CI)."""

    def test_reranker_not_loaded_initially(self) -> None:
        from opta_lmx.rag.reranker import RerankerEngine
        engine = RerankerEngine()
        assert not engine.is_loaded

    def test_reranker_rerank_returns_sorted_scores(self) -> None:
        """Mock reranker returns scores in descending order."""
        from opta_lmx.rag.reranker import RerankerEngine
        engine = RerankerEngine()
        # Simulate a loaded reranker with mock
        engine._reranker = True  # mark as loaded
        engine._rerank_fn = lambda query, docs, top_n: [
            {"index": 1, "score": 0.95},
            {"index": 0, "score": 0.70},
        ]
        results = engine.rerank("test query", ["doc A", "doc B"], top_n=2)
        assert len(results) == 2
        assert results[0]["index"] == 1
        assert results[0]["score"] > results[1]["score"]
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestRerankerEngine -x -v`
**Expect:** FAIL (module doesn't exist)

---

### Task E2: Implement — RerankerEngine module
**File:** `src/opta_lmx/rag/reranker.py` (NEW FILE)
**Time:** 5 min

```python
"""Local reranker engine with lazy model loading.

Uses the AnswerDotAI/rerankers library for cross-encoder reranking.
Supports Jina Reranker v3 MLX and other compatible models.
Model is loaded on first rerank() call and cached for subsequent use.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class RerankerEngine:
    """Lazy-loaded cross-encoder reranker.

    Loads the model on first rerank() call. Thread-safe for read-only
    operations after loading (cross-encoder inference is stateless).
    """

    def __init__(self, model_id: str | None = None) -> None:
        self._model_id = model_id
        self._reranker: Any | None = None
        self._rerank_fn: Callable[..., list[dict[str, Any]]] | None = None

    @property
    def is_loaded(self) -> bool:
        """Whether the reranker model is loaded."""
        return self._reranker is not None

    @property
    def model_id(self) -> str | None:
        """Currently configured model ID."""
        return self._model_id

    def load(self, model_id: str | None = None) -> None:
        """Load the reranker model.

        Args:
            model_id: HuggingFace model ID. If None, uses the configured default.

        Raises:
            ImportError: If the rerankers library is not installed.
            RuntimeError: If no model ID is configured or provided.
        """
        target = model_id or self._model_id
        if target is None:
            raise RuntimeError(
                "No reranker model configured. Set rag.reranker_model in config.yaml "
                "or pass model_id to load()."
            )

        try:
            from rerankers import Reranker
        except ImportError:
            raise ImportError(
                "rerankers library not installed. Install with: pip install rerankers"
            ) from None

        logger.info("reranker_loading", extra={"model_id": target})
        ranker = Reranker(target)
        self._reranker = ranker
        self._model_id = target
        self._rerank_fn = None  # use the library directly
        logger.info("reranker_loaded", extra={"model_id": target})

    def unload(self) -> None:
        """Unload the reranker model to free memory."""
        if self._reranker is not None:
            self._reranker = None
            self._rerank_fn = None
            logger.info("reranker_unloaded", extra={"model_id": self._model_id})

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        """Rerank documents by relevance to a query.

        Args:
            query: Search query text.
            documents: Candidate documents to rerank.
            top_n: Maximum results to return (None = all).

        Returns:
            List of {"index": int, "score": float} sorted by descending score.
        """
        # Allow mock injection for testing
        if self._rerank_fn is not None:
            return self._rerank_fn(query, documents, top_n)

        if self._reranker is None:
            # Lazy-load on first call
            self.load()

        results = self._reranker.rank(query=query, docs=documents)

        # Convert rerankers library output to our format
        ranked: list[dict[str, Any]] = []
        for result in results.results:
            ranked.append({
                "index": result.doc_id,
                "score": float(result.score),
            })

        # Sort by score descending
        ranked.sort(key=lambda x: x["score"], reverse=True)

        if top_n is not None:
            ranked = ranked[:top_n]

        return ranked
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::TestRerankerEngine -x -v`
**Expect:** PASS

---

### Task E3: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/rag/reranker.py tests/test_rag.py
git commit -m "feat(lmx): local RerankerEngine with lazy-loaded cross-encoder support"
```

---

## Feature F: Search API Reranking Parameter

Add `rerank: bool` to the `QueryRequest` and wire it into the search path.

### Task F1: Test — Query with rerank=true triggers reranking
**File:** `tests/test_rag.py`
**Time:** 3 min

```python
async def test_query_with_rerank(rag_client: AsyncClient) -> None:
    """POST /v1/rag/query with rerank=true returns reranked results."""
    # Ingest documents
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "rerank_test",
            "documents": ["Python ML library", "JavaScript web framework", "Python data science"],
            "chunking": "none",
        },
    )

    # Query with rerank — should succeed (falls back gracefully if no reranker)
    response = await rag_client.post(
        "/v1/rag/query",
        json={
            "collection": "rerank_test",
            "query": "Python for machine learning",
            "top_k": 3,
            "rerank": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) >= 1
```

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::test_query_with_rerank -x -v`
**Expect:** FAIL (rerank field not in QueryRequest)

---

### Task F2: Implement — Add rerank field to QueryRequest + wire into query endpoint
**File:** `src/opta_lmx/api/rag.py`
**Time:** 5 min

1. Add `rerank` and `rerank_top_k` to `QueryRequest`:

```python
class QueryRequest(BaseModel):
    """Query a RAG collection for relevant context."""

    collection: str = Field(..., min_length=1, description="Collection to search")
    query: str = Field(..., min_length=1, description="Search query text")
    top_k: int = Field(5, ge=1, le=50, description="Maximum results")
    min_score: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold")
    model: str | None = Field(
        None, description="Embedding model (uses configured default if omitted)"
    )
    include_embeddings: bool = Field(False, description="Include embedding vectors in response")
    search_mode: str = Field(
        "vector",
        pattern="^(vector|keyword|hybrid)$",
        description="Search mode: vector (semantic), keyword (BM25), or hybrid (RRF fusion)",
    )
    rerank: bool = Field(False, description="Apply cross-encoder reranking to results")
    rerank_top_k: int | None = Field(
        None, ge=1, le=200,
        description="Override initial retrieval depth when reranking (default: rag.rerank_initial_k)"
    )
```

2. Add a new dependency function for the reranker engine in `api/deps.py`:

```python
def get_reranker_engine(request: Request) -> Any:
    """Get the local reranker engine from app state, or None."""
    return getattr(request.app.state, "reranker_engine", None)

RerankerDep = Annotated[Any, Depends(get_reranker_engine)]
```

3. Add import in `api/rag.py`:

```python
from opta_lmx.api.deps import AdminAuth, Embeddings, RagStore, RerankerDep, RemoteEmbedding
```

4. Update the `query_collection` endpoint signature and body to accept and use `RerankerDep`:

```python
@router.post("/v1/rag/query", response_model=None)
async def query_collection(
    body: QueryRequest,
    embedding_engine: Embeddings,
    remote_client: RemoteEmbedding,
    rag_store: RagStore,
    reranker: RerankerDep,
) -> Response:
```

After the search results are obtained, add reranking logic:

```python
    # Optional reranking
    if body.rerank and results:
        results = _apply_reranking(
            results, body.query, body.top_k, reranker,
        )
```

Add the helper function:

```python
def _apply_reranking(
    results: list[Any],
    query: str,
    final_k: int,
    reranker: Any,
) -> list[Any]:
    """Apply cross-encoder reranking to search results."""
    from opta_lmx.rag.store import SearchResult

    if reranker is None:
        logger.info("rerank_skipped_no_engine")
        return results[:final_k]

    try:
        texts = [r.document.text for r in results]
        reranked = reranker.rerank(query, texts, top_n=final_k)
        reranked_results = []
        for item in reranked:
            idx = item["index"]
            if idx < len(results):
                reranked_results.append(
                    SearchResult(document=results[idx].document, score=item["score"])
                )
        return reranked_results
    except Exception as e:
        logger.warning("rerank_failed_fallback_to_original", extra={"error": str(e)})
        return results[:final_k]
```

5. When `rerank=True`, override initial retrieval depth:

In `query_collection`, before the search call:

```python
    # When reranking, retrieve more candidates for the reranker to work with
    retrieval_k = body.top_k
    if body.rerank:
        retrieval_k = body.rerank_top_k or 50  # default broad retrieval
```

Then use `retrieval_k` instead of `body.top_k` in the `store.search()` call.

**Run:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py::test_query_with_rerank -x -v`
**Expect:** PASS

---

### Task F3: Run full test suite
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py -x -v
```
**Expect:** All PASS

---

### Task F4: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/api/rag.py src/opta_lmx/api/deps.py tests/test_rag.py
git commit -m "feat(lmx): rerank parameter on RAG search API with graceful fallback"
```

---

## Feature G: Wire Reranker into App Lifespan

Initialize the RerankerEngine in `main.py` and attach to app state.

### Task G1: Implement — Initialize RerankerEngine in lifespan
**File:** `src/opta_lmx/main.py`
**Time:** 3 min

After the embedding engine initialization, add:

```python
    # Initialize local reranker engine (lazy-load — only loads model on first use)
    from opta_lmx.rag.reranker import RerankerEngine

    reranker_engine = RerankerEngine(model_id=config.rag.reranker_model)
    app.state.reranker_engine = reranker_engine
```

In the cleanup section (after `yield`), before the embedding cleanup:

```python
    # Cleanup: unload reranker
    reranker_ref = getattr(app.state, "reranker_engine", None)
    if reranker_ref is not None and reranker_ref.is_loaded:
        reranker_ref.unload()
```

---

### Task G2: Wire RRF config from RAGConfig into search calls
**File:** `src/opta_lmx/api/rag.py`
**Time:** 3 min

In `query_collection`, pass RAGConfig's RRF settings to the store.search call when using hybrid mode.

Add a dependency to get the config:

```python
from opta_lmx.api.deps import AdminAuth, Embeddings, RagStore, RerankerDep, RemoteEmbedding
from opta_lmx.config import LMXConfig


def _get_rag_config(request: Request) -> Any:
    config: LMXConfig = request.app.state.config
    return config.rag
```

In `query_collection`, pass config RRF params:

```python
    rag_config = request.app.state.config.rag  # accessed via request

    results = store.search(
        collection=body.collection,
        query_embedding=query_embeddings[0],
        top_k=retrieval_k,
        min_score=body.min_score,
        mode=body.search_mode,
        query_text=body.query,
        rrf_k=rag_config.rrf_k,
        rrf_weights=[rag_config.rrf_vector_weight, rag_config.rrf_keyword_weight],
    )
```

Add `Request` to the endpoint signature:

```python
from fastapi import APIRouter, Request
```

---

### Task G3: Run full test suite
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/ -x -v --timeout=60
```
**Expect:** All PASS

---

### Task G4: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/main.py src/opta_lmx/api/rag.py
git commit -m "feat(lmx): wire RerankerEngine + RRF config into app lifespan and search"
```

---

## Feature H: Update pyproject.toml + Default Config

### Task H1: Add rerankers to optional dependencies
**File:** `pyproject.toml`
**Time:** 2 min

Add a new optional dependency group and extend the `rag` group:

```toml
[project.optional-dependencies]
# ... existing ...
rag = [
    "faiss-cpu>=1.7.4",
    "rank-bm25>=0.2.2",
    "pypdf>=4.0",
    "rerankers>=0.6.0",
]
```

---

### Task H2: Add Phase 9 fields to default-config.yaml
**File:** `config/default-config.yaml`
**Time:** 2 min

Add a `rag:` section:

```yaml
rag:
  enabled: true
  default_chunk_size: 512
  default_chunk_overlap: 64
  max_documents_per_ingest: 100
  auto_persist: true
  # Phase 9: Hybrid search tuning
  rrf_k: 60
  rrf_vector_weight: 1.0
  rrf_keyword_weight: 1.0
  # Phase 9: Reranking (opt-in)
  reranker_model: null         # Set to "jinaai/jina-reranker-v3-mlx" to enable
  rerank_enabled: false
  rerank_initial_k: 50
  rerank_final_k: 5
  # Phase 9: Chunking
  chunking_strategy: "fixed"   # fixed, markdown_headers, or code
```

---

### Task H3: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add pyproject.toml config/default-config.yaml
git commit -m "chore(lmx): add rerankers dep, Phase 9 RAG config to default-config.yaml"
```

---

## Feature I: Context Assembly with Reranking

Wire reranking into the `/v1/rag/context` endpoint as well.

### Task I1: Test — Context assembly with reranking
**File:** `tests/test_rag.py`
**Time:** 2 min

```python
async def test_context_assembly_with_rerank(rag_client: AsyncClient) -> None:
    """POST /v1/rag/context with rerank=true applies reranking."""
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "ctx_rerank",
            "documents": ["Doc A about Python", "Doc B about Java", "Doc C about Python ML"],
            "chunking": "none",
        },
    )

    response = await rag_client.post(
        "/v1/rag/context",
        json={
            "query": "Python machine learning",
            "collections": ["ctx_rerank"],
            "top_k_per_collection": 3,
            "rerank": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_chunks"] >= 1
```

---

### Task I2: Implement — Add rerank to ContextAssemblyRequest
**File:** `src/opta_lmx/api/rag.py`
**Time:** 3 min

Add to `ContextAssemblyRequest`:

```python
    rerank: bool = Field(False, description="Apply reranking to cross-collection results")
```

In `assemble_context`, after all results are gathered and sorted by score, add reranking:

```python
    # Optional reranking across all collected results
    if body.rerank and all_results:
        reranker = getattr(request.app.state, "reranker_engine", None)
        if reranker is not None:
            try:
                texts = [r.document.text for collection, r in all_results]
                reranked = reranker.rerank(body.query, texts, top_n=len(all_results))
                reordered = []
                for item in reranked:
                    idx = item["index"]
                    if idx < len(all_results):
                        reordered.append(all_results[idx])
                all_results = reordered
            except Exception as e:
                logger.warning("context_rerank_failed", extra={"error": str(e)})
```

Also add `Request` to the endpoint signature.

---

### Task I3: Run full test suite
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/test_rag.py -x -v
```

---

### Task I4: Commit
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
git add src/opta_lmx/api/rag.py tests/test_rag.py
git commit -m "feat(lmx): reranking support in context assembly endpoint"
```

---

## Feature J: Final Integration + Full Regression

### Task J1: Run ALL tests
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m pytest tests/ -x -v --timeout=60
```
**Expect:** All existing + new tests PASS.

---

### Task J2: Lint check
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m ruff check src/opta_lmx/rag/ src/opta_lmx/api/rag.py src/opta_lmx/config.py
```

---

### Task J3: Type check (non-blocking)
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && python -m mypy src/opta_lmx/rag/ src/opta_lmx/api/rag.py src/opta_lmx/config.py --ignore-missing-imports
```

---

### Task J4: Push
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX && git push origin main
```

---

## Summary Table

| # | Feature | Tasks | Est. Time | Files Modified |
|---|---------|-------|-----------|----------------|
| A | RAGConfig expansion | 3 | 7 min | config.py, test_rag.py |
| B | Configurable RRF + weighted fusion | 5 | 16 min | bm25.py, store.py, test_rag.py |
| C | Markdown-header chunking | 5 | 16 min | chunker.py, rag.py, test_rag.py |
| D | Embedding dimension safety | 3 | 10 min | store.py, test_rag.py |
| E | RerankerEngine | 3 | 11 min | rag/reranker.py (new), test_rag.py |
| F | Search API rerank param | 4 | 14 min | api/rag.py, api/deps.py, test_rag.py |
| G | Wire into app lifespan | 4 | 11 min | main.py, api/rag.py |
| H | pyproject + default config | 3 | 6 min | pyproject.toml, default-config.yaml |
| I | Context assembly reranking | 4 | 10 min | api/rag.py, test_rag.py |
| J | Final integration | 4 | 8 min | (verification only) |
| **Total** | | **38** | **~109 min** | |

### New Test Count: ~15 tests
### Commits: 9 (one per feature + final push)

### Files Created
- `src/opta_lmx/rag/reranker.py` — local reranker engine

### Files Modified
- `src/opta_lmx/config.py` — RAGConfig expansion (11 new fields)
- `src/opta_lmx/rag/bm25.py` — weights parameter on RRF
- `src/opta_lmx/rag/store.py` — RRF config pass-through + dimension checks
- `src/opta_lmx/rag/chunker.py` — chunk_markdown() function
- `src/opta_lmx/api/rag.py` — rerank param, markdown_headers chunking, RRF config wiring
- `src/opta_lmx/api/deps.py` — RerankerDep type alias
- `src/opta_lmx/main.py` — RerankerEngine initialization + cleanup
- `pyproject.toml` — rerankers dependency
- `config/default-config.yaml` — Phase 9 RAG defaults
- `tests/test_rag.py` — ~15 new tests
