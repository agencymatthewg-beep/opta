"""Tests for GGUF equivalence resolver — local GGUF file discovery."""
from __future__ import annotations

from pathlib import Path

from opta_lmx.inference.gguf_resolver import _name_tokens, resolve_local_gguf_equivalents


class TestNameTokens:
    def test_extracts_meaningful_tokens_from_hf_id(self) -> None:
        tokens = _name_tokens("mlx-community/MiniMax-M2.5-4bit")
        assert "minimax" in tokens
        assert "m2" in tokens
        assert "5" in tokens
        assert "4bit" in tokens
        # Filtered words should be excluded
        assert "mlx" not in tokens
        assert "community" not in tokens

    def test_extracts_tokens_from_bare_model_name(self) -> None:
        tokens = _name_tokens("Qwen2.5-72B-Instruct")
        assert "qwen2" in tokens
        assert "72b" in tokens
        assert "instruct" in tokens

    def test_empty_model_id_returns_empty_tokens(self) -> None:
        assert _name_tokens("") == []

    def test_filters_common_noise_words(self) -> None:
        tokens = _name_tokens("mlx-community/model")
        assert tokens == []


class TestResolveLocalGgufEquivalents:
    def test_finds_gguf_by_name_token_match(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        match_file = gguf_dir / "MiniMax-M2.5-Q4_K_M.gguf"
        match_file.touch()
        unrelated = gguf_dir / "totally-different.gguf"
        unrelated.touch()

        results = resolve_local_gguf_equivalents(
            "mlx-community/MiniMax-M2.5-4bit",
            search_roots=[gguf_dir],
        )
        assert len(results) == 1
        assert "MiniMax" in results[0]

    def test_returns_empty_when_no_matches(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        (gguf_dir / "unrelated-model.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "mlx-community/MiniMax-M2.5-4bit",
            search_roots=[gguf_dir],
        )
        assert results == []

    def test_returns_empty_when_search_root_missing(self, tmp_path: Path) -> None:
        results = resolve_local_gguf_equivalents(
            "mlx-community/MiniMax-M2.5-4bit",
            search_roots=[tmp_path / "nonexistent"],
        )
        assert results == []

    def test_returns_empty_for_noise_only_model_id(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        (gguf_dir / "anything.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "mlx-community/model",
            search_roots=[gguf_dir],
        )
        assert results == []

    def test_direct_gguf_path_returns_if_exists(self, tmp_path: Path) -> None:
        gguf_file = tmp_path / "specific-model.gguf"
        gguf_file.touch()

        results = resolve_local_gguf_equivalents(str(gguf_file))
        assert len(results) == 1
        assert results[0] == str(gguf_file)

    def test_direct_gguf_path_returns_empty_if_missing(self) -> None:
        results = resolve_local_gguf_equivalents("/tmp/nonexistent-model.gguf")
        assert results == []

    def test_sorts_by_name_length_then_path(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        (gguf_dir / "qwen2-short.gguf").touch()
        (gguf_dir / "qwen2-much-longer-name.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "Qwen2.5-72B",
            search_roots=[gguf_dir],
        )
        assert len(results) == 2
        # Shorter name should come first
        assert "short" in results[0]

    def test_respects_max_results_limit(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        for i in range(5):
            (gguf_dir / f"qwen2-variant-{i}.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "Qwen2.5-72B",
            search_roots=[gguf_dir],
            max_results=2,
        )
        assert len(results) == 2

    def test_searches_subdirectories_recursively(self, tmp_path: Path) -> None:
        nested = tmp_path / "models" / "subfolder" / "deep"
        nested.mkdir(parents=True)
        (nested / "minimax-q4.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "mlx-community/MiniMax-M2.5-4bit",
            search_roots=[tmp_path / "models"],
        )
        assert len(results) == 1

    def test_deduplicates_candidates(self, tmp_path: Path) -> None:
        gguf_dir = tmp_path / "models"
        gguf_dir.mkdir()
        (gguf_dir / "minimax-q4.gguf").touch()

        results = resolve_local_gguf_equivalents(
            "mlx-community/MiniMax-M2.5-4bit",
            search_roots=[gguf_dir, gguf_dir],  # Same root twice
        )
        assert len(results) == 1
