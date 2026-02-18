"""In-memory vector store with FAISS-accelerated search and JSON persistence.

Stores document chunks as embeddings with metadata. Supports multiple
named collections for organizing different types of content (project docs,
conversation history, code snippets, etc.).

Search backends:
- **FAISS** (preferred): Uses IndexFlatIP with L2-normalised vectors for
  cosine similarity. SIMD-optimised on Apple Silicon via faiss-cpu.
- **NumPy fallback**: Batch cosine similarity when faiss-cpu is not installed.

Hybrid search combines vector similarity with BM25 keyword matching
via Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from opta_lmx.rag.bm25 import BM25Index, reciprocal_rank_fusion

logger = logging.getLogger(__name__)

# Try to import FAISS — purely optional accelerator
try:
    import faiss

    _FAISS_AVAILABLE = True
except ImportError:
    _FAISS_AVAILABLE = False


@dataclass
class Document:
    """A stored document chunk with its embedding vector."""

    id: str
    collection: str
    text: str
    embedding: NDArray[np.float32]
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON persistence (embedding as list)."""
        return {
            "id": self.id,
            "collection": self.collection,
            "text": self.text,
            "embedding": self.embedding.tolist(),
            "metadata": self.metadata,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Document:
        """Deserialize from JSON persistence."""
        return cls(
            id=data["id"],
            collection=data["collection"],
            text=data["text"],
            embedding=np.array(data["embedding"], dtype=np.float32),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", time.time()),
        )


@dataclass
class SearchResult:
    """A document with its similarity score."""

    document: Document
    score: float


def _build_faiss_index(embeddings: NDArray[np.float32]) -> Any:
    """Build a FAISS inner-product index from L2-normalised vectors."""
    if not _FAISS_AVAILABLE or len(embeddings) == 0:
        return None
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    # Normalise so inner product = cosine similarity
    normed = embeddings.copy()
    faiss.normalize_L2(normed)
    index.add(normed)
    return index


def _search_faiss(
    index: Any,
    query: NDArray[np.float32],
    top_k: int,
) -> list[tuple[int, float]]:
    """Search FAISS index. Returns [(doc_index, score), ...]."""
    q = query.reshape(1, -1).copy()
    faiss.normalize_L2(q)
    scores, indices = index.search(q, min(top_k, index.ntotal))
    results: list[tuple[int, float]] = []
    for idx, score in zip(indices[0], scores[0], strict=False):
        if idx == -1:
            break
        results.append((int(idx), float(score)))
    return results


def _search_numpy(
    docs: list[Document],
    query_vec: NDArray[np.float32],
    top_k: int,
    min_score: float,
) -> list[SearchResult]:
    """NumPy fallback: batch cosine similarity search."""
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return []

    doc_embeddings = np.array([d.embedding for d in docs])
    doc_norms = np.linalg.norm(doc_embeddings, axis=1)

    valid_mask = doc_norms > 0
    similarities = np.zeros(len(docs), dtype=np.float32)
    if valid_mask.any():
        similarities[valid_mask] = (
            doc_embeddings[valid_mask] @ query_vec
        ) / (doc_norms[valid_mask] * query_norm)

    indices = np.argsort(-similarities)
    results: list[SearchResult] = []
    for idx in indices:
        score = float(similarities[idx])
        if score < min_score:
            break
        results.append(SearchResult(document=docs[idx], score=score))
        if len(results) >= top_k:
            break

    return results


class VectorStore:
    """In-memory vector store with FAISS-accelerated cosine similarity search.

    Organizes documents into named collections. Supports:
    - Adding documents with pre-computed embeddings
    - FAISS-accelerated cosine similarity search (with numpy fallback)
    - Hybrid search combining vector + BM25 keyword matching via RRF
    - JSON persistence to disk
    - Collection management (create, list, delete, stats)

    Thread safety: NOT thread-safe. Use from a single async context
    (FastAPI runs on a single event loop, so this is fine).
    """

    def __init__(self, persist_path: Path | None = None) -> None:
        self._collections: dict[str, list[Document]] = {}
        self._collection_dims: dict[str, int] = {}  # collection -> embedding dim
        self._faiss_indexes: dict[str, Any] = {}
        self._bm25_indexes: dict[str, BM25Index] = {}
        self._persist_path = persist_path

    @property
    def faiss_available(self) -> bool:
        """Whether FAISS is installed and usable."""
        return _FAISS_AVAILABLE

    @property
    def collection_names(self) -> list[str]:
        """Return sorted list of collection names."""
        return sorted(self._collections.keys())

    def collection_count(self, collection: str) -> int:
        """Number of documents in a collection."""
        return len(self._collections.get(collection, []))

    def total_documents(self) -> int:
        """Total documents across all collections."""
        return sum(len(docs) for docs in self._collections.values())

    def add(
        self,
        collection: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata_list: list[dict[str, Any]] | None = None,
    ) -> list[str]:
        """Add documents to a collection.

        Args:
            collection: Collection name (created if doesn't exist).
            texts: Document text chunks.
            embeddings: Pre-computed embedding vectors (one per text).
            metadata_list: Optional metadata per document.

        Returns:
            List of assigned document IDs.
        """
        if len(texts) != len(embeddings):
            raise ValueError(
                f"texts ({len(texts)}) and embeddings ({len(embeddings)}) must have same length"
            )

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

        if collection not in self._collections:
            self._collections[collection] = []

        metas = metadata_list or [{} for _ in texts]
        doc_ids: list[str] = []

        for text, emb, meta in zip(texts, embeddings, metas, strict=False):
            doc_id = str(uuid.uuid4())[:12]
            doc = Document(
                id=doc_id,
                collection=collection,
                text=text,
                embedding=np.array(emb, dtype=np.float32),
                metadata=meta,
            )
            self._collections[collection].append(doc)
            doc_ids.append(doc_id)

        # Rebuild FAISS + BM25 indexes for this collection
        self._rebuild_indexes(collection)

        logger.info("documents_added", extra={
            "collection": collection,
            "count": len(texts),
            "total": len(self._collections[collection]),
            "faiss": collection in self._faiss_indexes,
        })

        return doc_ids

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
        """Search for similar documents.

        Args:
            collection: Collection to search in.
            query_embedding: Query vector.
            top_k: Maximum results to return.
            min_score: Minimum similarity threshold (0-1).
            mode: Search mode — "vector", "keyword", or "hybrid".
            query_text: Raw query text (required for keyword/hybrid modes).
            rrf_k: RRF fusion constant (hybrid mode only).
            rrf_weights: Optional per-retriever weights for RRF fusion.

        Returns:
            Top matching documents sorted by descending relevance.
        """
        docs = self._collections.get(collection, [])
        if not docs:
            return []

        # Validate query embedding dimensions
        expected_dim = self._collection_dims.get(collection)
        if expected_dim is not None and len(query_embedding) != expected_dim:
            raise ValueError(
                f"Query embedding dimension mismatch for collection '{collection}': "
                f"expected {expected_dim}, got {len(query_embedding)}"
            )

        query_vec = np.array(query_embedding, dtype=np.float32)

        if mode == "keyword":
            return self._search_keyword(collection, query_text or "", top_k, docs)

        if mode == "hybrid":
            return self._search_hybrid(
                collection, query_vec, query_text or "", top_k, min_score, docs,
                rrf_k=rrf_k, rrf_weights=rrf_weights,
            )

        # Default: vector search
        return self._search_vector(collection, query_vec, top_k, min_score, docs)

    def _search_vector(
        self,
        collection: str,
        query_vec: NDArray[np.float32],
        top_k: int,
        min_score: float,
        docs: list[Document],
    ) -> list[SearchResult]:
        """Pure vector similarity search (FAISS or numpy)."""
        faiss_index = self._faiss_indexes.get(collection)
        if faiss_index is not None:
            raw = _search_faiss(faiss_index, query_vec, top_k)
            results: list[SearchResult] = []
            for idx, score in raw:
                if score < min_score:
                    continue
                if idx < len(docs):
                    results.append(SearchResult(document=docs[idx], score=score))
            return results

        return _search_numpy(docs, query_vec, top_k, min_score)

    def _search_keyword(
        self,
        collection: str,
        query_text: str,
        top_k: int,
        docs: list[Document],
    ) -> list[SearchResult]:
        """BM25 keyword search."""
        bm25 = self._bm25_indexes.get(collection)
        if bm25 is None or not query_text:
            return []

        raw = bm25.search(query_text, top_k)
        results: list[SearchResult] = []
        for idx, score in raw:
            if idx < len(docs):
                results.append(SearchResult(document=docs[idx], score=score))
        return results

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
        """Hybrid search: merge vector + BM25 results via RRF."""
        # Build ID→index map for O(1) lookup (avoids linear scan per result)
        id_to_idx = {d.id: i for i, d in enumerate(docs)}

        # Get vector results (double top_k to ensure good candidates)
        vector_results = self._search_vector(
            collection, query_vec, top_k * 2, min_score, docs,
        )
        vector_ranked = [
            (id_to_idx.get(r.document.id, -1), r.score)
            for r in vector_results
        ]

        # Get keyword results
        bm25 = self._bm25_indexes.get(collection)
        keyword_ranked: list[tuple[int, float]] = []
        if bm25 is not None and query_text:
            keyword_ranked = bm25.search(query_text, top_k * 2)

        if not vector_ranked and not keyword_ranked:
            return []

        # Merge via RRF
        ranked_lists = [r for r in [vector_ranked, keyword_ranked] if r]
        merged = reciprocal_rank_fusion(ranked_lists, k=rrf_k, weights=rrf_weights)

        results: list[SearchResult] = []
        for idx, rrf_score in merged[:top_k]:
            if idx < len(docs):
                results.append(SearchResult(document=docs[idx], score=rrf_score))
        return results

    def _doc_index(self, collection: str, doc_id: str) -> int:
        """Find the position index of a document by ID."""
        docs = self._collections.get(collection, [])
        for i, d in enumerate(docs):
            if d.id == doc_id:
                return i
        return -1

    def delete_collection(self, collection: str) -> int:
        """Delete a collection and all its documents. Returns count deleted."""
        docs = self._collections.pop(collection, [])
        self._collection_dims.pop(collection, None)
        self._faiss_indexes.pop(collection, None)
        self._bm25_indexes.pop(collection, None)
        count = len(docs)
        if count:
            logger.info("collection_deleted", extra={
                "collection": collection, "documents_removed": count,
            })
        return count

    def delete_documents(self, collection: str, doc_ids: list[str]) -> int:
        """Delete specific documents by ID. Returns count deleted."""
        docs = self._collections.get(collection, [])
        if not docs:
            return 0

        id_set = set(doc_ids)
        before = len(docs)
        self._collections[collection] = [d for d in docs if d.id not in id_set]
        deleted = before - len(self._collections[collection])

        if deleted:
            self._rebuild_indexes(collection)
            logger.info("documents_deleted", extra={
                "collection": collection, "count": deleted,
            })
        return deleted

    def get_stats(self) -> dict[str, Any]:
        """Return store statistics."""
        collections: dict[str, dict[str, Any]] = {}
        for name, docs in self._collections.items():
            dim = len(docs[0].embedding) if docs else 0
            collections[name] = {
                "document_count": len(docs),
                "embedding_dimensions": dim,
                "faiss_indexed": name in self._faiss_indexes,
                "bm25_indexed": name in self._bm25_indexes,
            }

        return {
            "total_documents": self.total_documents(),
            "collection_count": len(self._collections),
            "faiss_available": _FAISS_AVAILABLE,
            "collections": collections,
        }

    # ── Index management ─────────────────────────────────────────────────

    def _rebuild_indexes(self, collection: str) -> None:
        """Rebuild FAISS and BM25 indexes for a collection."""
        docs = self._collections.get(collection, [])
        if not docs:
            self._faiss_indexes.pop(collection, None)
            self._bm25_indexes.pop(collection, None)
            return

        # FAISS index
        if _FAISS_AVAILABLE:
            embeddings = np.array([d.embedding for d in docs])
            faiss_idx = _build_faiss_index(embeddings)
            if faiss_idx is not None:
                self._faiss_indexes[collection] = faiss_idx
        else:
            self._faiss_indexes.pop(collection, None)

        # BM25 index
        bm25 = BM25Index()
        bm25.add([d.text for d in docs])
        self._bm25_indexes[collection] = bm25

    # ── Persistence ──────────────────────────────────────────────────────

    def save(self, path: Path | None = None) -> None:
        """Save store to JSON file."""
        target = path or self._persist_path
        if target is None:
            return

        target.parent.mkdir(parents=True, exist_ok=True)

        data: dict[str, list[dict[str, Any]]] = {}
        for collection, docs in self._collections.items():
            data[collection] = [d.to_dict() for d in docs]

        with open(target, "w") as f:
            json.dump(data, f)

        logger.info("store_saved", extra={
            "path": str(target),
            "total_documents": self.total_documents(),
        })

    def load(self, path: Path | None = None) -> int:
        """Load store from JSON file. Returns total documents loaded."""
        target = path or self._persist_path
        if target is None or not target.exists():
            return 0

        with open(target) as f:
            data = json.load(f)

        self._collections.clear()
        self._collection_dims.clear()
        self._faiss_indexes.clear()
        self._bm25_indexes.clear()
        total = 0
        for collection, doc_dicts in data.items():
            self._collections[collection] = [
                Document.from_dict(d) for d in doc_dicts
            ]
            total += len(doc_dicts)
            # Restore embedding dimensions from loaded data
            if self._collections[collection]:
                self._collection_dims[collection] = len(
                    self._collections[collection][0].embedding
                )
            self._rebuild_indexes(collection)

        logger.info("store_loaded", extra={
            "path": str(target),
            "total_documents": total,
            "collections": len(self._collections),
            "faiss": _FAISS_AVAILABLE,
        })
        return total
