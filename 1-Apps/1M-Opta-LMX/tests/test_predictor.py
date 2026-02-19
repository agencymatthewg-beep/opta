"""Tests for usage-based model preloading predictor (inference/predictor.py)."""

from __future__ import annotations

from opta_lmx.inference.predictor import UsagePredictor

# ─── record_access ───────────────────────────────────────────────────────────


class TestRecordAccess:
    def test_records_single_access(self) -> None:
        p = UsagePredictor()
        p.record_access("model-a")
        stats = p.get_stats()
        assert stats["total_accesses"] == 1
        assert stats["unique_models"] == 1

    def test_tracks_counts(self) -> None:
        p = UsagePredictor()
        p.record_access("model-a")
        p.record_access("model-a")
        p.record_access("model-b")
        hot = p.get_hot_models()
        assert hot[0] == ("model-a", 2)
        assert hot[1] == ("model-b", 1)

    def test_tracks_transitions(self) -> None:
        p = UsagePredictor()
        p.record_access("model-a")
        p.record_access("model-b")
        p.record_access("model-a")
        p.record_access("model-b")
        stats = p.get_stats()
        assert stats["transition_count"] >= 2

    def test_no_self_transition(self) -> None:
        """Consecutive accesses to the same model don't create transitions."""
        p = UsagePredictor()
        p.record_access("model-a")
        p.record_access("model-a")
        p.record_access("model-a")
        stats = p.get_stats()
        assert stats["transition_count"] == 0

    def test_history_bounded(self) -> None:
        p = UsagePredictor(max_history=5)
        for i in range(10):
            p.record_access(f"model-{i}")
        assert p.get_stats()["history_size"] == 5


# ─── predict_next ────────────────────────────────────────────────────────────


class TestPredictNext:
    def test_no_data_returns_none(self) -> None:
        p = UsagePredictor()
        assert p.predict_next(loaded_models=set()) is None

    def test_frequency_based(self) -> None:
        """Most-accessed unloaded model should be predicted."""
        p = UsagePredictor()
        for _ in range(5):
            p.record_access("model-a")
        for _ in range(3):
            p.record_access("model-b")

        # model-a is loaded, so model-b should be predicted
        result = p.predict_next(loaded_models={"model-a"})
        assert result == "model-b"

    def test_frequency_needs_min_accesses(self) -> None:
        """Models with fewer than 3 accesses aren't predicted."""
        p = UsagePredictor()
        p.record_access("model-a")
        p.record_access("model-a")
        assert p.predict_next(loaded_models=set()) is None

    def test_transition_based(self) -> None:
        """After model-a, model-b is usually next."""
        p = UsagePredictor()
        # Create a strong transition: a -> b
        p.record_access("model-a")
        p.record_access("model-b")
        p.record_access("model-a")
        p.record_access("model-b")
        p.record_access("model-a")  # last model is a

        # Transition a -> b should predict b
        result = p.predict_next(loaded_models={"model-a"})
        assert result == "model-b"

    def test_excludes_loaded_models(self) -> None:
        p = UsagePredictor()
        for _ in range(5):
            p.record_access("model-a")
        for _ in range(4):
            p.record_access("model-b")
        for _ in range(3):
            p.record_access("model-c")

        result = p.predict_next(loaded_models={"model-a", "model-b"})
        assert result == "model-c"

    def test_excludes_additional_models(self) -> None:
        p = UsagePredictor()
        for _ in range(5):
            p.record_access("model-a")
        for _ in range(4):
            p.record_access("model-b")

        result = p.predict_next(loaded_models=set(), exclude={"model-a"})
        assert result == "model-b"

    def test_all_models_excluded_returns_none(self) -> None:
        p = UsagePredictor()
        for _ in range(5):
            p.record_access("model-a")
        result = p.predict_next(loaded_models={"model-a"})
        assert result is None

    def test_transition_priority_over_frequency(self) -> None:
        """Transition-based prediction takes priority over frequency."""
        p = UsagePredictor()
        # model-c has highest frequency
        for _ in range(10):
            p.record_access("model-c")
        # But a -> b transition is strong
        p.record_access("model-a")
        p.record_access("model-b")
        p.record_access("model-a")
        p.record_access("model-b")
        p.record_access("model-a")  # last access is model-a

        result = p.predict_next(loaded_models={"model-a"})
        # Should predict model-b (transition) over model-c (frequency)
        assert result == "model-b"


# ─── get_hot_models ──────────────────────────────────────────────────────────


class TestGetHotModels:
    def test_empty(self) -> None:
        p = UsagePredictor()
        assert p.get_hot_models() == []

    def test_top_k(self) -> None:
        p = UsagePredictor()
        for _ in range(5):
            p.record_access("a")
        for _ in range(3):
            p.record_access("b")
        for _ in range(1):
            p.record_access("c")
        result = p.get_hot_models(top_k=2)
        assert len(result) == 2
        assert result[0] == ("a", 5)
        assert result[1] == ("b", 3)

    def test_returns_all_when_fewer_than_k(self) -> None:
        p = UsagePredictor()
        p.record_access("a")
        assert len(p.get_hot_models(top_k=10)) == 1


# ─── get_stats ───────────────────────────────────────────────────────────────


class TestGetStats:
    def test_empty_stats(self) -> None:
        p = UsagePredictor()
        stats = p.get_stats()
        assert stats["total_accesses"] == 0
        assert stats["unique_models"] == 0
        assert stats["history_size"] == 0
        assert stats["top_models"] == []
        assert stats["transition_count"] == 0

    def test_populated_stats(self) -> None:
        p = UsagePredictor()
        p.record_access("a")
        p.record_access("b")
        p.record_access("a")
        stats = p.get_stats()
        assert stats["total_accesses"] == 3
        assert stats["unique_models"] == 2
        assert stats["history_size"] == 3
        assert len(stats["top_models"]) == 2
        assert stats["transition_count"] == 2  # a->b and b->a
