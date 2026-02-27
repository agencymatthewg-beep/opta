"""Tracing helpers for the agents runtime."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Protocol

from opta_lmx.agents.models import RunStatus, StepStatus

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class TraceEvent:
    """Runtime trace event."""

    run_id: str
    event: str
    timestamp: float = field(default_factory=time.time)
    step_id: str | None = None
    status: RunStatus | StepStatus | None = None
    message: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)


class Tracer(Protocol):
    """Tracing interface for runtime state transitions."""

    def emit(self, event: TraceEvent) -> None:
        """Emit a trace event."""


class NullTracer:
    """No-op tracer."""

    def emit(self, event: TraceEvent) -> None:
        return


class LoggingTracer:
    """Structured logging tracer."""

    def emit(self, event: TraceEvent) -> None:
        logger.info(
            "agents_trace_event",
            extra={
                "run_id": event.run_id,
                "step_id": event.step_id,
                "event": event.event,
                "status": event.status,
                "message": event.message,
                "metadata": event.metadata,
                "timestamp": event.timestamp,
            },
        )


class OpenTelemetryTracer:
    """OpenTelemetry-backed tracer for run and step lifecycle events."""

    def __init__(self, *, service_name: str = "opta-lmx") -> None:
        self._tracer = None
        try:
            from opentelemetry import trace  # type: ignore[import-not-found]

            self._tracer = trace.get_tracer(f"{service_name}.agents")
        except Exception:
            logger.warning("agents_opentelemetry_unavailable")

    def emit(self, event: TraceEvent) -> None:
        if self._tracer is None:
            return

        with self._tracer.start_as_current_span(f"agents.{event.event}") as span:
            span.set_attribute("agents.run_id", event.run_id)
            if event.step_id is not None:
                span.set_attribute("agents.step_id", event.step_id)
            if event.status is not None:
                span.set_attribute("agents.status", str(event.status))
            if event.message is not None:
                span.set_attribute("agents.message", event.message)
            for key, value in event.metadata.items():
                span.set_attribute(f"agents.meta.{key}", value)


def extract_trace_id(traceparent: str | None) -> str:
    """Extract trace-id from W3C traceparent header.

    Format: version-trace_id-parent_id-flags (e.g., 00-abc123...-def456...-01)
    """
    if not traceparent:
        return ""
    parts = traceparent.split("-")
    if len(parts) >= 2:
        return parts[1]
    return ""


@dataclass(slots=True)
class AuditEvent:
    """Actor-level audit event for governance and compliance."""

    timestamp: float = field(default_factory=time.time)
    actor: str = ""           # "user", "agent:<role>", "service:<name>", "system"
    action: str = ""          # "run_created", "run_cancelled", "skill_executed", "approval_granted"
    resource_type: str = ""   # "agent_run", "skill", "model"
    resource_id: str = ""     # run_id or skill_name
    trace_id: str = ""        # From traceparent
    details: dict[str, str] = field(default_factory=dict)


class AuditTrail:
    """Append-only audit log for agent/skill actions."""

    def __init__(self, *, persist_path: Path | None = None, max_events: int = 10000) -> None:
        self._events: list[AuditEvent] = []
        self._persist_path = persist_path
        self._max_events = max_events
        self._lock = Lock()
        if persist_path and persist_path.exists():
            self._load_from_disk()

    def record(self, event: AuditEvent) -> None:
        """Record an audit event."""
        with self._lock:
            self._events.append(event)
            if len(self._events) > self._max_events:
                self._events = self._events[-self._max_events:]
            if self._persist_path:
                self._write_to_disk()

    def query(
        self,
        *,
        actor: str | None = None,
        action: str | None = None,
        resource_id: str | None = None,
        since: float | None = None,
        limit: int = 100,
    ) -> list[AuditEvent]:
        """Query audit events with optional filters."""
        with self._lock:
            results = list(self._events)

        if actor:
            results = [e for e in results if e.actor == actor]
        if action:
            results = [e for e in results if e.action == action]
        if resource_id:
            results = [e for e in results if e.resource_id == resource_id]
        if since is not None:
            results = [e for e in results if e.timestamp >= since]

        results.sort(key=lambda e: e.timestamp, reverse=True)
        return results[:limit]

    def _load_from_disk(self) -> None:
        """Load audit events from JSON file."""
        if not self._persist_path or not self._persist_path.exists():
            return
        try:
            data = json.loads(self._persist_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        self._events.append(AuditEvent(**{
                            k: v for k, v in item.items()
                            if k in AuditEvent.__dataclass_fields__
                        }))
        except Exception:
            logger.warning("audit_trail_load_failed")

    def _write_to_disk(self) -> None:
        """Persist audit events to JSON file."""
        if not self._persist_path:
            return
        import dataclasses
        payload = [dataclasses.asdict(e) for e in self._events]
        self._persist_path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._persist_path.with_suffix(".tmp")
        temp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        temp.replace(self._persist_path)
