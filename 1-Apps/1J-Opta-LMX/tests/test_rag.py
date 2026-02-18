"""Tests for the RAG pipeline — vector store, chunker, and API endpoints."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import numpy as np
import pytest
from httpx import AsyncClient

from opta_lmx.rag.chunker import Chunk, chunk_code, chunk_text
from opta_lmx.rag.store import Document, SearchResult, VectorStore


# ── VectorStore Unit Tests ────────────────────────────────────────────────


class TestVectorStore:
    """Tests for the in-memory vector store."""

    def test_empty_store(self) -> None:
        store = VectorStore()
        assert store.total_documents() == 0
        assert store.collection_names == []
        assert store.collection_count("nonexistent") == 0

    def test_add_documents(self) -> None:
        store = VectorStore()
        ids = store.add(
            "test_col",
            ["hello world", "goodbye world"],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
        )
        assert len(ids) == 2
        assert store.total_documents() == 2
        assert store.collection_count("test_col") == 2
        assert "test_col" in store.collection_names

    def test_add_with_metadata(self) -> None:
        store = VectorStore()
        ids = store.add(
            "docs",
            ["text one"],
            [[1.0, 0.0]],
            metadata_list=[{"source": "file.txt", "page": 1}],
        )
        assert len(ids) == 1

    def test_add_mismatched_lengths_raises(self) -> None:
        store = VectorStore()
        with pytest.raises(ValueError, match="same length"):
            store.add("col", ["one", "two"], [[1.0, 0.0]])

    def test_search_basic_cosine(self) -> None:
        store = VectorStore()
        store.add(
            "col",
            ["similar", "different"],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
        )
        results = store.search("col", [1.0, 0.0, 0.0], top_k=2)
        assert len(results) == 2
        assert results[0].document.text == "similar"
        assert results[0].score > results[1].score
        assert results[0].score == pytest.approx(1.0, abs=0.01)

    def test_search_empty_collection(self) -> None:
        store = VectorStore()
        results = store.search("nonexistent", [1.0, 0.0])
        assert results == []

    def test_search_min_score_filter(self) -> None:
        store = VectorStore()
        store.add(
            "col",
            ["match", "no match"],
            [[1.0, 0.0], [0.0, 1.0]],
        )
        results = store.search("col", [1.0, 0.0], top_k=10, min_score=0.9)
        assert len(results) == 1
        assert results[0].document.text == "match"

    def test_search_top_k_limit(self) -> None:
        store = VectorStore()
        embeddings = [[float(i == j) for j in range(5)] for i in range(5)]
        store.add("col", [f"doc_{i}" for i in range(5)], embeddings)
        results = store.search("col", [1.0, 0.0, 0.0, 0.0, 0.0], top_k=2)
        assert len(results) == 2

    def test_search_zero_query_vector(self) -> None:
        store = VectorStore()
        store.add("col", ["text"], [[1.0, 0.0]])
        results = store.search("col", [0.0, 0.0])
        assert results == []

    def test_delete_collection(self) -> None:
        store = VectorStore()
        store.add("to_delete", ["doc"], [[1.0]])
        assert store.collection_count("to_delete") == 1
        count = store.delete_collection("to_delete")
        assert count == 1
        assert store.collection_count("to_delete") == 0
        assert store.total_documents() == 0

    def test_delete_nonexistent_collection(self) -> None:
        store = VectorStore()
        count = store.delete_collection("no_such_col")
        assert count == 0

    def test_delete_documents(self) -> None:
        store = VectorStore()
        ids = store.add("col", ["a", "b", "c"], [[1.0], [2.0], [3.0]])
        deleted = store.delete_documents("col", [ids[1]])
        assert deleted == 1
        assert store.collection_count("col") == 2

    def test_get_stats(self) -> None:
        store = VectorStore()
        store.add("alpha", ["doc"], [[1.0, 2.0, 3.0]])
        store.add("beta", ["d1", "d2"], [[1.0, 0.0], [0.0, 1.0]])
        stats = store.get_stats()
        assert stats["total_documents"] == 3
        assert stats["collection_count"] == 2
        assert stats["collections"]["alpha"]["document_count"] == 1
        assert stats["collections"]["alpha"]["embedding_dimensions"] == 3
        assert stats["collections"]["beta"]["document_count"] == 2

    def test_persistence_save_and_load(self, tmp_path: Path) -> None:
        persist_file = tmp_path / "store.json"
        # Save
        store = VectorStore(persist_path=persist_file)
        store.add("col", ["persisted text"], [[0.5, 0.5]], [{"key": "val"}])
        store.save()
        assert persist_file.exists()

        # Load into a new store
        store2 = VectorStore(persist_path=persist_file)
        loaded = store2.load()
        assert loaded == 1
        assert store2.total_documents() == 1
        assert store2.collection_count("col") == 1
        results = store2.search("col", [0.5, 0.5], top_k=1)
        assert len(results) == 1
        assert results[0].document.text == "persisted text"
        assert results[0].document.metadata["key"] == "val"

    def test_load_nonexistent_file(self, tmp_path: Path) -> None:
        store = VectorStore(persist_path=tmp_path / "nope.json")
        loaded = store.load()
        assert loaded == 0

    def test_save_no_path_is_noop(self) -> None:
        store = VectorStore()
        store.add("col", ["doc"], [[1.0]])
        store.save()  # Should not raise

    def test_multiple_collections(self) -> None:
        store = VectorStore()
        store.add("a", ["doc_a"], [[1.0, 0.0]])
        store.add("b", ["doc_b"], [[0.0, 1.0]])
        assert store.collection_names == ["a", "b"]
        assert store.total_documents() == 2
        # Search scoped to collection
        results = store.search("a", [1.0, 0.0])
        assert len(results) == 1
        assert results[0].document.text == "doc_a"


class TestDocument:
    """Tests for Document serialization."""

    def test_round_trip(self) -> None:
        doc = Document(
            id="abc",
            collection="test",
            text="hello",
            embedding=np.array([1.0, 2.0, 3.0], dtype=np.float32),
            metadata={"source": "unit_test"},
            created_at=1000.0,
        )
        as_dict = doc.to_dict()
        restored = Document.from_dict(as_dict)
        assert restored.id == "abc"
        assert restored.collection == "test"
        assert restored.text == "hello"
        assert np.allclose(restored.embedding, [1.0, 2.0, 3.0])
        assert restored.metadata == {"source": "unit_test"}
        assert restored.created_at == 1000.0


# ── Chunker Unit Tests ─────────────────────────────────────────────────


class TestChunkText:
    """Tests for the text chunker."""

    def test_empty_text(self) -> None:
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_single_chunk(self) -> None:
        text = "This is a short sentence."
        chunks = chunk_text(text, chunk_size=512)
        assert len(chunks) == 1
        assert chunks[0].text == text
        assert chunks[0].index == 0
        assert chunks[0].start_char == 0

    def test_multiple_chunks_with_overlap(self) -> None:
        # Each line ~20 chars. chunk_size=5 tokens = 20 chars.
        lines = [f"Line number {i:04d}." for i in range(20)]
        text = "\n".join(lines)
        chunks = chunk_text(text, chunk_size=5, chunk_overlap=1)
        assert len(chunks) > 1
        # Each chunk has position metadata
        for chunk in chunks:
            assert isinstance(chunk.text, str)
            assert chunk.index >= 0
            assert chunk.start_char >= 0
            assert chunk.end_char > chunk.start_char

    def test_chunk_indices_sequential(self) -> None:
        text = "\n".join([f"paragraph {i}" for i in range(50)])
        chunks = chunk_text(text, chunk_size=10, chunk_overlap=2)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_custom_separator(self) -> None:
        text = "Part A---Part B---Part C"
        chunks = chunk_text(text, chunk_size=512, separator="---")
        assert len(chunks) == 1  # Small enough for single chunk
        assert "Part A" in chunks[0].text


class TestChunkCode:
    """Tests for the code chunker."""

    def test_empty_code(self) -> None:
        assert chunk_code("") == []

    def test_small_code_single_chunk(self) -> None:
        code = "def hello():\n    return 'world'"
        chunks = chunk_code(code, chunk_size=512)
        assert len(chunks) == 1

    def test_multi_function_code(self) -> None:
        functions = []
        for i in range(10):
            functions.append(f"def func_{i}():\n    x = {i}\n    return x * 2")
        code = "\n\n".join(functions)
        chunks = chunk_code(code, chunk_size=10, chunk_overlap=2)
        assert len(chunks) >= 2
        # All chunks have valid indices
        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_large_function_re_split(self) -> None:
        # Single function with many lines (no blank lines to split on)
        lines = [f"    x_{i} = {i}" for i in range(100)]
        code = "def big():\n" + "\n".join(lines)
        chunks = chunk_code(code, chunk_size=5, chunk_overlap=1)
        # Should produce multiple chunks via re-splitting on single newlines
        assert len(chunks) > 1


# ── RAG API Endpoint Tests ────────────────────────────────────────────


def _mock_embed(texts: list[str], **_kw: object) -> list[list[float]]:
    """Deterministic mock embeddings: hash-based 8-dim vectors."""
    embeddings = []
    for text in texts:
        h = hash(text) % 10000
        vec = [(h >> i & 1) * 0.5 + 0.1 for i in range(8)]
        # Normalize
        norm = sum(v ** 2 for v in vec) ** 0.5
        embeddings.append([v / norm for v in vec])
    return embeddings


@pytest.fixture
async def rag_client(
    mock_engine: object, mock_model_manager: object, tmp_path: Path,
) -> AsyncClient:
    """Test HTTP client with RAG store initialized and mock embeddings."""
    from collections.abc import AsyncIterator

    from httpx import ASGITransport

    from opta_lmx.config import LMXConfig
    from opta_lmx.inference.embedding_engine import EmbeddingEngine
    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.main import create_app
    from opta_lmx.manager.memory import MemoryMonitor
    from opta_lmx.manager.model import ModelManager
    from opta_lmx.monitoring.events import EventBus
    from opta_lmx.monitoring.metrics import MetricsCollector
    from opta_lmx.presets.manager import PresetManager
    from opta_lmx.rag.store import VectorStore
    from opta_lmx.router.strategy import TaskRouter

    config = LMXConfig()
    test_app = create_app(config)

    # Initialize RAG store via app.state (no module-level global)
    rag_store = VectorStore(persist_path=tmp_path / "test-rag-store.json")
    test_app.state.rag_store = rag_store

    # Mock embedding engine with deterministic embeddings
    mock_emb_engine = EmbeddingEngine()
    mock_emb_engine.embed = AsyncMock(side_effect=lambda texts, **kw: _mock_embed(texts))

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        engine_inst: InferenceEngine = mock_engine  # type: ignore[assignment]
        test_app.state.engine = engine_inst
        test_app.state.memory_monitor = MemoryMonitor(max_percent=90)
        test_app.state.model_manager = mock_model_manager
        test_app.state.router = TaskRouter(config.routing)
        test_app.state.metrics = MetricsCollector()
        test_app.state.preset_manager = PresetManager(tmp_path / "presets")
        test_app.state.event_bus = EventBus()
        test_app.state.embedding_engine = mock_emb_engine
        test_app.state.pending_downloads = {}
        test_app.state.start_time = 0.0
        test_app.state.admin_key = None
        test_app.state.config = config
        test_app.state.remote_embedding = None
        test_app.state.remote_reranking = None
        yield http_client


async def test_ingest_documents(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest stores documents and returns chunk count."""
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "test_docs",
            "documents": ["Hello world. This is a test.", "Another document here."],
            "chunking": "none",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["collection"] == "test_docs"
    assert data["documents_ingested"] == 2
    assert data["chunks_created"] == 2
    assert len(data["document_ids"]) == 2
    assert data["duration_ms"] >= 0


async def test_ingest_with_text_chunking(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest with text chunking splits long documents."""
    long_doc = "\n".join([f"Paragraph {i} with enough content to exceed a small chunk size limit." for i in range(200)])
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "chunked",
            "documents": [long_doc],
            "chunk_size": 64,
            "chunk_overlap": 16,
            "chunking": "text",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_created"] >= 2  # Long doc should produce multiple chunks


async def test_ingest_empty_document(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest with empty documents returns 400."""
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "empty",
            "documents": [""],
            "chunking": "text",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "empty_content"


async def test_query_collection(rag_client: AsyncClient) -> None:
    """POST /v1/rag/query returns relevant results after ingest."""
    # Ingest first
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "search_test",
            "documents": ["Python is great for ML", "JavaScript runs in browsers"],
            "chunking": "none",
        },
    )

    # Query
    response = await rag_client.post(
        "/v1/rag/query",
        json={
            "collection": "search_test",
            "query": "machine learning language",
            "top_k": 5,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["collection"] == "search_test"
    assert data["query"] == "machine learning language"
    assert data["total_in_collection"] == 2
    assert len(data["results"]) <= 5
    assert data["duration_ms"] >= 0
    # Each result has expected fields
    for r in data["results"]:
        assert "id" in r
        assert "text" in r
        assert "score" in r
        assert "metadata" in r


async def test_query_empty_collection(rag_client: AsyncClient) -> None:
    """POST /v1/rag/query on empty collection returns empty results."""
    response = await rag_client.post(
        "/v1/rag/query",
        json={
            "collection": "no_docs",
            "query": "anything",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["total_in_collection"] == 0


async def test_context_assembly(rag_client: AsyncClient) -> None:
    """POST /v1/rag/context assembles context from multiple collections."""
    # Ingest into two collections
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "docs",
            "documents": ["API documentation for the system"],
            "chunking": "none",
        },
    )
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "code",
            "documents": ["def main(): pass"],
            "chunking": "none",
        },
    )

    # Assemble context
    response = await rag_client.post(
        "/v1/rag/context",
        json={
            "query": "How does the system work?",
            "collections": ["docs", "code"],
            "top_k_per_collection": 3,
            "max_context_tokens": 4096,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "context" in data
    assert data["total_chunks"] >= 1
    assert data["estimated_tokens"] >= 1
    assert data["duration_ms"] >= 0
    assert isinstance(data["sources"], list)


async def test_list_collections(rag_client: AsyncClient) -> None:
    """GET /v1/rag/collections lists all collections."""
    # Ingest some docs
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "alpha",
            "documents": ["doc in alpha"],
            "chunking": "none",
        },
    )

    response = await rag_client.get("/v1/rag/collections")
    assert response.status_code == 200
    data = response.json()
    assert data["collection_count"] >= 1
    assert data["total_documents"] >= 1
    names = [c["name"] for c in data["collections"]]
    assert "alpha" in names


async def test_delete_collection(rag_client: AsyncClient) -> None:
    """DELETE /v1/rag/collections/{name} removes the collection."""
    # Ingest
    await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "deleteme",
            "documents": ["temporary doc"],
            "chunking": "none",
        },
    )

    # Delete
    response = await rag_client.delete("/v1/rag/collections/deleteme")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["documents_deleted"] >= 1

    # Verify it's gone
    response = await rag_client.get("/v1/rag/collections")
    names = [c["name"] for c in response.json()["collections"]]
    assert "deleteme" not in names


async def test_delete_nonexistent_collection(rag_client: AsyncClient) -> None:
    """DELETE /v1/rag/collections/{name} on missing collection returns 404."""
    response = await rag_client.delete("/v1/rag/collections/no_such_col")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "collection_not_found"


async def test_ingest_with_metadata(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest with per-document metadata preserves it."""
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "meta_test",
            "documents": ["doc with meta"],
            "metadata": [{"source": "test.py", "line": 42}],
            "chunking": "none",
        },
    )
    assert response.status_code == 200

    # Query and check metadata
    query_resp = await rag_client.post(
        "/v1/rag/query",
        json={
            "collection": "meta_test",
            "query": "doc with meta",
        },
    )
    results = query_resp.json()["results"]
    assert len(results) >= 1
    assert results[0]["metadata"]["source"] == "test.py"
    assert results[0]["metadata"]["line"] == 42


async def test_ingest_code_chunking(rag_client: AsyncClient) -> None:
    """POST /v1/rag/ingest with code chunking uses double-newline splits."""
    code = "\n\n".join([f"def func_{i}():\n    x = {i}\n    y = x * 2\n    return y + {i}" for i in range(50)])
    response = await rag_client.post(
        "/v1/rag/ingest",
        json={
            "collection": "code_chunks",
            "documents": [code],
            "chunk_size": 64,
            "chunking": "code",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_created"] >= 2


# ── RAGConfig Phase 9 Tests ────────────────────────────────────────────


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
