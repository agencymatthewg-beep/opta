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
