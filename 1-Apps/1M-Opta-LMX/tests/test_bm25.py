"""Tests for BM25 keyword search index (rag/bm25.py)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from opta_lmx.rag.bm25 import BM25Index, reciprocal_rank_fusion, tokenize

_has_rank_bm25 = True
try:
    import rank_bm25 as _  # noqa: F401
except ImportError:
    _has_rank_bm25 = False

_requires_rank_bm25 = pytest.mark.skipif(not _has_rank_bm25, reason="rank_bm25 not installed")


# ─── tokenize ────────────────────────────────────────────────────────────────


class TestTokenize:
    def test_basic_tokenization(self) -> None:
        tokens = tokenize("Hello world foo bar")
        assert "hello" in tokens
        assert "world" in tokens
        assert "foo" in tokens
        assert "bar" in tokens

    def test_lowercases(self) -> None:
        tokens = tokenize("HELLO World")
        assert "hello" in tokens
        assert "world" in tokens

    def test_removes_stop_words(self) -> None:
        tokens = tokenize("this is a test of the system")
        assert "test" in tokens
        assert "system" in tokens
        # Stop words removed
        assert "this" not in tokens
        assert "is" not in tokens
        assert "the" not in tokens

    def test_removes_single_chars(self) -> None:
        tokens = tokenize("a b c hello world")
        assert "hello" in tokens
        assert "world" in tokens
        # Single chars removed
        assert len([t for t in tokens if len(t) == 1]) == 0

    def test_preserves_underscored_identifiers(self) -> None:
        tokens = tokenize("my_function another_var")
        assert "my_function" in tokens
        assert "another_var" in tokens

    def test_splits_on_non_alphanumeric(self) -> None:
        tokens = tokenize("hello-world foo.bar")
        assert "hello" in tokens
        assert "world" in tokens
        assert "foo" in tokens
        assert "bar" in tokens

    def test_empty_string(self) -> None:
        assert tokenize("") == []

    def test_only_stop_words(self) -> None:
        assert tokenize("the is a an") == []


# ─── BM25Index ───────────────────────────────────────────────────────────────


class TestBM25Index:
    def test_empty_index(self) -> None:
        idx = BM25Index()
        assert idx.document_count == 0
        assert idx.search("hello") == []

    def test_add_documents(self) -> None:
        idx = BM25Index()
        idx.add(["Hello world", "Foo bar baz"])
        assert idx.document_count == 2

    @_requires_rank_bm25
    def test_search_returns_results(self) -> None:
        idx = BM25Index()
        idx.add([
            "Python programming language",
            "Rust systems programming",
            "TypeScript web development",
        ])
        results = idx.search("python programming")
        assert len(results) > 0
        # First result should be the Python document (index 0)
        assert results[0][0] == 0
        assert results[0][1] > 0  # positive score

    def test_search_empty_query(self) -> None:
        idx = BM25Index()
        idx.add(["Hello world"])
        # Query with only stop words tokenizes to empty
        assert idx.search("the is a") == []

    @_requires_rank_bm25
    def test_search_no_match(self) -> None:
        idx = BM25Index()
        idx.add(["Python programming"])
        results = idx.search("quantum physics")
        # BM25 may return low scores; if no tokens match, should be empty
        matching = [(i, s) for i, s in results if s > 0]
        # Either empty or very low scores
        assert len(matching) == 0 or matching[0][1] < 0.5

    @_requires_rank_bm25
    def test_search_top_k(self) -> None:
        idx = BM25Index()
        idx.add([f"document {i} about programming" for i in range(20)])
        results = idx.search("programming", top_k=3)
        assert len(results) <= 3

    def test_remove_by_indices(self) -> None:
        idx = BM25Index()
        idx.add(["doc zero", "doc one", "doc two"])
        assert idx.document_count == 3
        idx.remove_by_indices({1})
        assert idx.document_count == 2

    def test_clear(self) -> None:
        idx = BM25Index()
        idx.add(["Hello", "World"])
        assert idx.document_count == 2
        idx.clear()
        assert idx.document_count == 0
        assert idx.search("hello") == []

    def test_add_incremental(self) -> None:
        idx = BM25Index()
        idx.add(["First batch"])
        idx.add(["Second batch"])
        assert idx.document_count == 2

    def test_rank_bm25_not_installed(self) -> None:
        idx = BM25Index()
        with patch.dict("sys.modules", {"rank_bm25": None}):
            # Force rebuild with missing import
            idx._corpus = [["hello", "world"]]
            idx._rebuild()
        # Should handle gracefully — bm25 is None, search returns empty
        assert idx.search("hello") == []


# ─── reciprocal_rank_fusion ──────────────────────────────────────────────────


class TestReciprocalRankFusion:
    def test_single_list(self) -> None:
        ranked = [(0, 1.0), (1, 0.5), (2, 0.2)]
        result = reciprocal_rank_fusion([ranked])
        assert len(result) == 3
        # First ranked document should have highest RRF score
        assert result[0][0] == 0

    def test_merge_two_lists(self) -> None:
        list1 = [(0, 1.0), (1, 0.5)]  # doc 0 first
        list2 = [(1, 1.0), (2, 0.5)]  # doc 1 first
        result = reciprocal_rank_fusion([list1, list2])
        # Doc 1 appears in both lists, should rank high
        doc_ids = [r[0] for r in result]
        assert 1 in doc_ids
        # Doc 1 should be first (rank 1 in list1, rank 0 in list2 = best combined)
        assert result[0][0] == 1

    def test_empty_lists(self) -> None:
        assert reciprocal_rank_fusion([]) == []
        assert reciprocal_rank_fusion([[]]) == []

    def test_no_overlap(self) -> None:
        list1 = [(0, 1.0)]
        list2 = [(1, 1.0)]
        result = reciprocal_rank_fusion([list1, list2])
        assert len(result) == 2
        # Both have same rank (1st in their list), so same RRF score
        assert result[0][1] == result[1][1]

    def test_custom_k(self) -> None:
        list1 = [(0, 1.0), (1, 0.5)]
        result_k60 = reciprocal_rank_fusion([list1], k=60)
        result_k10 = reciprocal_rank_fusion([list1], k=10)
        # Higher k compresses scores — top result score should differ
        assert result_k60[0][1] != result_k10[0][1]
        # Lower k gives higher absolute scores
        assert result_k10[0][1] > result_k60[0][1]

    def test_three_lists_with_overlap(self) -> None:
        list1 = [(0, 1.0), (1, 0.8), (2, 0.5)]
        list2 = [(2, 1.0), (0, 0.8), (3, 0.5)]
        list3 = [(0, 1.0), (3, 0.8), (1, 0.5)]
        result = reciprocal_rank_fusion([list1, list2, list3])
        # Doc 0 appears in all three lists at rank 0, 1, 0 — should be top
        assert result[0][0] == 0
