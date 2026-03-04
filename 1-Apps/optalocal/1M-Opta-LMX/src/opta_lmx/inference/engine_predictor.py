"""Prediction delegation module for the InferenceEngine facade."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine


class EnginePredictorDelegator:
    """Handles access pattern prediction and preloading suggestions."""

    def __init__(self, engine: InferenceEngine) -> None:
        self._engine = engine

    def predict_next_model(self) -> str | None:
        """Predict which model to preload based on access patterns."""
        loaded = set(self._engine._models.keys())
        return self._engine._predictor.predict_next(loaded, exclude=self._engine._loading_models)

    def suggest_prefetch_models(self, max_candidates: int = 1) -> list[str]:
        """Suggest models to prefetch based on access patterns."""
        candidates: list[str] = []
        excluded = set(self._engine._models.keys()) | set(self._engine._loading_models)
        while len(candidates) < max(1, max_candidates):
            predicted = self._engine._predictor.predict_next(set(self._engine._models.keys()), exclude=excluded)
            if predicted is None:
                break
            candidates.append(predicted)
            excluded.add(predicted)
        return candidates
