"""Persistence for per-model/backend autotune best profiles."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from opta_lmx.inference.autotune_scoring import score_profile


class AutotuneRegistry:
    """Stores best-known autotune profile per (model_id, backend, backend_version)."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = (path or (Path.home() / ".opta-lmx" / "autotune-registry.json")).expanduser()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, dict[str, Any]] | None = None

    @staticmethod
    def _record_key(model_id: str, backend: str, backend_version: str) -> str:
        return f"{model_id}::{backend}::{backend_version}"

    def _load(self) -> dict[str, dict[str, Any]]:
        if self._cache is not None:
            return dict(self._cache)
        if not self._path.exists():
            return {}
        try:
            payload = json.loads(self._path.read_text())
            if isinstance(payload, dict):
                self._cache = {str(k): v for k, v in payload.items() if isinstance(v, dict)}
                return dict(self._cache)
        except Exception:
            return {}
        return {}

    def _save(self, data: dict[str, dict[str, Any]]) -> None:
        self._path.write_text(json.dumps(data, indent=2, sort_keys=True))
        self._cache = dict(data)

    def save_best(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version: str,
        profile: dict[str, Any],
        metrics: dict[str, Any],
        score: float,
    ) -> None:
        data = self._load()
        key = self._record_key(model_id, backend, backend_version)

        new_score_result = score_profile(
            avg_tokens_per_second=float(metrics.get("avg_tokens_per_second", 0.0) or 0.0),
            avg_ttft_ms=float(metrics.get("avg_ttft_ms", 0.0) or 0.0),
            error_rate=float(metrics.get("error_rate", 0.0) or 0.0),
            avg_total_ms=float(metrics.get("avg_total_ms", 0.0) or 0.0),
            queue_wait_ms=float(
                metrics.get("queue_wait_ms", metrics.get("avg_queue_wait_ms", 0.0)) or 0.0
            ),
        )
        new_sort_key = new_score_result.sort_key

        existing = data.get(key)
        if existing is not None:
            old_metrics = existing.get("metrics", {})
            if not isinstance(old_metrics, dict):
                old_metrics = {}
            old_score_result = score_profile(
                avg_tokens_per_second=float(old_metrics.get("avg_tokens_per_second", 0.0) or 0.0),
                avg_ttft_ms=float(old_metrics.get("avg_ttft_ms", 0.0) or 0.0),
                error_rate=float(old_metrics.get("error_rate", 0.0) or 0.0),
                avg_total_ms=float(old_metrics.get("avg_total_ms", 0.0) or 0.0),
                queue_wait_ms=float(
                    old_metrics.get("queue_wait_ms", old_metrics.get("avg_queue_wait_ms", 0.0)) or 0.0
                ),
            )
            old_sort_key = old_score_result.sort_key
            if new_sort_key >= old_sort_key:
                return

        data[key] = {
            "ts": time.time(),
            "model_id": model_id,
            "backend": backend,
            "backend_version": backend_version,
            "profile": profile,
            "metrics": metrics,
            "score": float(score),
        }
        self._save(data)

    def get_best(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version: str,
    ) -> dict[str, Any] | None:
        data = self._load()
        key = self._record_key(model_id, backend, backend_version)
        value = data.get(key)
        return dict(value) if isinstance(value, dict) else None

    def save_scored_profile(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version: str,
        profile: dict[str, Any],
        metrics: dict[str, Any],
    ) -> float:
        """Compute score from metrics and persist as best if it wins."""
        score_result = score_profile(
            avg_tokens_per_second=float(metrics.get("avg_tokens_per_second", 0.0) or 0.0),
            avg_ttft_ms=float(metrics.get("avg_ttft_ms", 0.0) or 0.0),
            error_rate=float(metrics.get("error_rate", 0.0) or 0.0),
            avg_total_ms=float(metrics.get("avg_total_ms", 0.0) or 0.0),
            queue_wait_ms=float(metrics.get("queue_wait_ms", 0.0) or 0.0),
        )
        self.save_best(
            model_id=model_id,
            backend=backend,
            backend_version=backend_version,
            profile=profile,
            metrics=metrics,
            score=score_result.score,
        )
        return score_result.score
