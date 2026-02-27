"""IPC protocol objects for isolated child loader communication."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class LoadSpec:
    """Input payload sent from parent supervisor to child loader worker."""

    model_id: str
    backend: str
    use_batching: bool
    performance_overrides: dict[str, Any]
    probe_only: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "backend": self.backend,
            "use_batching": self.use_batching,
            "performance_overrides": self.performance_overrides,
            "probe_only": self.probe_only,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> LoadSpec:
        return cls(
            model_id=str(payload["model_id"]),
            backend=str(payload["backend"]),
            use_batching=bool(payload["use_batching"]),
            performance_overrides=dict(payload.get("performance_overrides", {})),
            probe_only=bool(payload.get("probe_only", False)),
        )


@dataclass(slots=True)
class LoadResult:
    """Outcome payload returned by child loader worker when execution succeeds."""

    ok: bool
    backend: str
    reason: str | None = None
    telemetry: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "backend": self.backend,
            "reason": self.reason,
            "telemetry": self.telemetry,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> LoadResult:
        return cls(
            ok=bool(payload.get("ok", False)),
            backend=str(payload["backend"]),
            reason=None if payload.get("reason") is None else str(payload["reason"]),
            telemetry=dict(payload.get("telemetry", {})),
        )


@dataclass(slots=True)
class LoaderFailure:
    """Structured failure payload emitted on worker errors."""

    code: str
    message: str
    exit_code: int | None = None
    signal: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "exit_code": self.exit_code,
            "signal": self.signal,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> LoaderFailure:
        def _as_int(value: Any) -> int | None:
            if value is None:
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        return cls(
            code=str(payload.get("code", "loader_failure")),
            message=str(payload.get("message", "")),
            exit_code=_as_int(payload.get("exit_code")),
            signal=_as_int(payload.get("signal")),
            metadata=dict(payload.get("metadata", {})),
        )

