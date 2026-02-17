"""Usage-based model preloading predictor.

Tracks model access patterns and predicts which model is likely to be
requested next. Used to speculatively preload models during idle periods,
eliminating cold-start latency for common model switching patterns.
"""

from __future__ import annotations

import logging
import time
from collections import Counter, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# How many recent accesses to track per model
_HISTORY_SIZE = 50

# Minimum accesses before a model becomes a preload candidate
_MIN_ACCESSES = 3


@dataclass
class ModelAccessRecord:
    """A single model access event."""

    model_id: str
    timestamp: float


class UsagePredictor:
    """Predict which models to preload based on access history.

    Tracks the sequence of model accesses and uses frequency analysis
    to suggest which model should be preloaded next. Two strategies:

    1. **Frequency-based**: Most-accessed model that isn't currently loaded
    2. **Transition-based**: After model A, which model is most often requested next

    Thread safety: NOT thread-safe. Call from the event loop only.
    """

    def __init__(self, max_history: int = _HISTORY_SIZE) -> None:
        self._history: deque[ModelAccessRecord] = deque(maxlen=max_history)
        self._access_counts: Counter[str] = Counter()
        self._transitions: dict[str, Counter[str]] = {}
        self._last_model: str | None = None

    def record_access(self, model_id: str) -> None:
        """Record that a model was accessed for inference."""
        now = time.time()
        self._history.append(ModelAccessRecord(model_id=model_id, timestamp=now))
        self._access_counts[model_id] += 1

        # Track transition: last_model -> model_id
        if self._last_model and self._last_model != model_id:
            if self._last_model not in self._transitions:
                self._transitions[self._last_model] = Counter()
            self._transitions[self._last_model][model_id] += 1

        self._last_model = model_id

    def predict_next(
        self,
        loaded_models: set[str],
        exclude: set[str] | None = None,
    ) -> str | None:
        """Predict which model to preload next.

        Args:
            loaded_models: Set of currently loaded model IDs.
            exclude: Additional model IDs to exclude (e.g., models being loaded).

        Returns:
            Model ID to preload, or None if no prediction is possible.
        """
        excluded = (exclude or set()) | loaded_models

        # Strategy 1: Transition-based — what usually follows the current model?
        if self._last_model and self._last_model in self._transitions:
            transitions = self._transitions[self._last_model]
            for model_id, count in transitions.most_common():
                if count >= 2 and model_id not in excluded:
                    return model_id

        # Strategy 2: Frequency-based — most used model not currently loaded
        for model_id, count in self._access_counts.most_common():
            if count >= _MIN_ACCESSES and model_id not in excluded:
                return model_id

        return None

    def get_hot_models(self, top_k: int = 5) -> list[tuple[str, int]]:
        """Return the most frequently accessed models.

        Args:
            top_k: Number of models to return.

        Returns:
            List of (model_id, access_count) sorted by descending frequency.
        """
        return self._access_counts.most_common(top_k)

    def get_stats(self) -> dict[str, object]:
        """Return predictor statistics for admin endpoints."""
        return {
            "total_accesses": sum(self._access_counts.values()),
            "unique_models": len(self._access_counts),
            "history_size": len(self._history),
            "top_models": self.get_hot_models(5),
            "transition_count": sum(
                sum(c.values()) for c in self._transitions.values()
            ),
        }
