"""In-memory vector store with cosine similarity search and JSON persistence.

Stores document chunks as embeddings with metadata. Supports multiple
named collections for organizing different types of content (project docs,
conversation history, code snippets, etc.).
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

logger = logging.getLogger(__name__)


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


class VectorStore:
    """In-memory vector store with cosine similarity search.

    Organizes documents into named collections. Supports:
    - Adding documents with pre-computed embeddings
    - Cosine similarity search within a collection
    - JSON persistence to disk
    - Collection management (create, list, delete, stats)

    Thread safety: NOT thread-safe. Use from a single async context
    (FastAPI runs on a single event loop, so this is fine).
    """

    def __init__(self, persist_path: Path | None = None) -> None:
        self._collections: dict[str, list[Document]] = {}
        self._persist_path = persist_path

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

        if collection not in self._collections:
            self._collections[collection] = []

        metas = metadata_list or [{} for _ in texts]
        doc_ids: list[str] = []

        for text, emb, meta in zip(texts, embeddings, metas):
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

        logger.info("documents_added", extra={
            "collection": collection,
            "count": len(texts),
            "total": len(self._collections[collection]),
        })

        return doc_ids

    def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
        min_score: float = 0.0,
    ) -> list[SearchResult]:
        """Search for similar documents using cosine similarity.

        Args:
            collection: Collection to search in.
            query_embedding: Query vector.
            top_k: Maximum results to return.
            min_score: Minimum cosine similarity threshold (0-1).

        Returns:
            Top matching documents sorted by descending similarity.
        """
        docs = self._collections.get(collection, [])
        if not docs:
            return []

        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        # Batch compute cosine similarity
        doc_embeddings = np.array([d.embedding for d in docs])
        doc_norms = np.linalg.norm(doc_embeddings, axis=1)

        # Avoid division by zero
        valid_mask = doc_norms > 0
        similarities = np.zeros(len(docs), dtype=np.float32)
        if valid_mask.any():
            similarities[valid_mask] = (
                doc_embeddings[valid_mask] @ query_vec
            ) / (doc_norms[valid_mask] * query_norm)

        # Filter by min_score and get top_k
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

    def delete_collection(self, collection: str) -> int:
        """Delete a collection and all its documents. Returns count deleted."""
        docs = self._collections.pop(collection, [])
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
            logger.info("documents_deleted", extra={
                "collection": collection, "count": deleted,
            })
        return deleted

    def get_stats(self) -> dict[str, Any]:
        """Return store statistics."""
        collections: dict[str, dict[str, Any]] = {}
        for name, docs in self._collections.items():
            if docs:
                dim = len(docs[0].embedding)
            else:
                dim = 0
            collections[name] = {
                "document_count": len(docs),
                "embedding_dimensions": dim,
            }

        return {
            "total_documents": self.total_documents(),
            "collection_count": len(self._collections),
            "collections": collections,
        }

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
        total = 0
        for collection, doc_dicts in data.items():
            self._collections[collection] = [
                Document.from_dict(d) for d in doc_dicts
            ]
            total += len(doc_dicts)

        logger.info("store_loaded", extra={
            "path": str(target),
            "total_documents": total,
            "collections": len(self._collections),
        })
        return total
