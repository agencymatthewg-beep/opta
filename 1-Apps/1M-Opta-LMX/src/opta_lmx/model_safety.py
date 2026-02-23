"""Model admission/readiness safety guardrails for Opta-LMX.

Provides:
- Deterministic admission error taxonomy
- Model readiness state machine (admitted -> loading -> canary -> routable/quarantined)
- Compatibility registry persistence for model/backend/version outcomes
"""

from __future__ import annotations

import json
import platform
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class AdmissionFailure(Exception):
    """Deterministic admission error with code + stable HTTP status."""

    code: str
    message: str
    status_code: int = 400
    param: str | None = "model_id"
    error_type: str = "invalid_request_error"

    def __str__(self) -> str:
        return self.message


class ErrorCodes:
    """Canonical model admission/runtime guardrail error codes."""

    MODEL_INCOMPLETE = "model_incomplete"
    MODEL_UNSUPPORTED_BACKEND = "model_unsupported_backend"
    MODEL_UNSUPPORTED_ARCH = "model_unsupported_arch"
    MODEL_NOT_READY = "model_not_ready"
    MODEL_UNSTABLE = "model_unstable"
    MODEL_CANARY_FAILED = "model_canary_failed"
    MODEL_LOAD_TIMEOUT = "model_load_timeout"
    MODEL_LOADER_CRASHED = "model_loader_crashed"
    MODEL_PROBE_FAILED = "model_probe_failed"


def detect_backend_type(model_id: str) -> str:
    if model_id.endswith(".gguf") or "gguf" in model_id.lower():
        return "gguf"
    return "mlx"


def backend_version(backend_type: str) -> str:
    try:
        from importlib.metadata import version

        if backend_type == "mlx":
            return version("vllm-mlx")
        if backend_type == "gguf":
            return version("llama-cpp-python")
    except Exception:
        pass
    return "unknown"


def validate_architecture(model_id: str) -> None:
    backend = detect_backend_type(model_id)
    arch = platform.machine().lower()
    if backend == "mlx" and arch not in {"arm64", "aarch64"}:
        raise AdmissionFailure(
            code=ErrorCodes.MODEL_UNSUPPORTED_ARCH,
            status_code=422,
            message=(
                f"MLX backend requires Apple Silicon/arm64; detected architecture '{arch}'."
            ),
            error_type="not_supported_error",
        )


class CompatibilityRegistry:
    """Persistent pass/fail ledger for model/backend/version compatibility."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = (path or (Path.home() / ".opta-lmx" / "compatibility-registry.json")).expanduser()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        try:
            payload = json.loads(self._path.read_text())
            if isinstance(payload, list):
                return payload
        except Exception:
            return []
        return []

    def _save(self, rows: list[dict[str, Any]]) -> None:
        self._path.write_text(json.dumps(rows[-2000:], indent=2, sort_keys=True))

    def record(
        self,
        *,
        model_id: str,
        backend: str,
        backend_version_value: str,
        outcome: str,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        rows = self._load()
        rows.append({
            "ts": time.time(),
            "model_id": model_id,
            "backend": backend,
            "backend_version": backend_version_value,
            "outcome": outcome,
            "reason": reason,
            "metadata": metadata or {},
        })
        self._save(rows)


class ReadinessTracker:
    """Tracks model readiness and crash-loop quarantine state."""

    def __init__(self) -> None:
        self._state: dict[str, dict[str, Any]] = {}

    def set_state(self, model_id: str, state: str, *, reason: str | None = None) -> None:
        row = self._state.setdefault(model_id, {})
        row["state"] = state
        row["reason"] = reason
        row["updated_at"] = time.time()
        if state != "quarantined":
            row.setdefault("crash_count", 0)

    def mark_failure(self, model_id: str, *, reason: str, quarantine_threshold: int = 3) -> None:
        row = self._state.setdefault(model_id, {"state": "loading", "crash_count": 0})
        crash_count = int(row.get("crash_count", 0)) + 1
        row["crash_count"] = crash_count
        row["last_failure_reason"] = reason
        row["updated_at"] = time.time()
        if crash_count >= quarantine_threshold:
            row["state"] = "quarantined"
            row["reason"] = f"crash_loop:{crash_count}"

    def get(self, model_id: str) -> dict[str, Any]:
        return dict(self._state.get(model_id, {"state": "unknown"}))

    def is_routable(self, model_id: str) -> bool:
        return self._state.get(model_id, {}).get("state") == "routable"

    def clear(self, model_id: str) -> None:
        self._state.pop(model_id, None)
