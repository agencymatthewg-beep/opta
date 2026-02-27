"""BM25 keyword search index for hybrid retrieval.

Provides term-frequency-based keyword matching alongside vector similarity
search. Uses the rank-bm25 library (BM25Okapi) for scoring.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Common English stop words for filtering
_STOP_WORDS = frozenset({
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "of", "for",
    "and", "or", "but", "not", "with", "as", "by", "this", "that", "from",
    "be", "are", "was", "were", "been", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can",
    "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
})

# Simple tokenizer: split on non-alphanumeric, lowercase, filter short/stop words
_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")


def tokenize(text: str) -> list[str]:
    """Tokenize text for BM25 indexing.

    Lowercases, splits on non-alphanumeric boundaries, removes
    stop words and single-character tokens. Preserves underscored
    identifiers (useful for code search).
    """
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if len(t) > 1 and t not in _STOP_WORDS]


@dataclass
class BM25Index:
    """BM25 keyword index for a single collection.

    Maintains a parallel index alongside the vector store for hybrid search.
    Documents are identified by their position index (matching the order
    in the VectorStore's document list).
    """

    _corpus: list[list[str]] = field(default_factory=list)
    _bm25: object | None = field(default=None, repr=False)

    def add(self, texts: list[str]) -> None:
        """Add documents to the BM25 index.

        Args:
            texts: Document text chunks to index.
        """
        tokenized = [tokenize(t) for t in texts]
        self._corpus.extend(tokenized)
        self._rebuild()

    def remove_by_indices(self, indices: set[int]) -> None:
        """Remove documents at the given positions and rebuild.

        Args:
            indices: Set of document indices to remove.
        """
        self._corpus = [
            doc for i, doc in enumerate(self._corpus) if i not in indices
        ]
        self._rebuild()

    def clear(self) -> None:
        """Remove all documents from the index."""
        self._corpus.clear()
        self._bm25 = None

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Search for documents matching the query.

        Args:
            query: Search query text.
            top_k: Maximum results to return.

        Returns:
            List of (document_index, score) tuples, sorted by descending score.
        """
        if not self._corpus or self._bm25 is None:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        scores = self._bm25.get_scores(query_tokens)  # type: ignore[union-attr]

        # Get top-k indices with positive scores
        indexed_scores = [
            (i, float(s)) for i, s in enumerate(scores) if s > 0
        ]
        indexed_scores.sort(key=lambda x: x[1], reverse=True)
        return indexed_scores[:top_k]

    @property
    def document_count(self) -> int:
        """Number of indexed documents."""
        return len(self._corpus)

    def _rebuild(self) -> None:
        """Rebuild the BM25 index from the current corpus."""
        if not self._corpus:
            self._bm25 = None
            return

        # Guard: BM25Okapi raises ZeroDivisionError if all documents tokenize
        # to empty lists (e.g. single-character texts filtered by tokenizer).
        if not any(doc for doc in self._corpus):
            self._bm25 = None
            return

        try:
            from rank_bm25 import BM25Okapi

            self._bm25 = BM25Okapi(self._corpus)
        except (ImportError, ZeroDivisionError):
            self._bm25 = None


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
