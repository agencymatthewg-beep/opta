"""Persistent JSON-backed run store for multi-agent runtime state."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from threading import Lock
from typing import cast

from opta_lmx.agents.models import AgentRun

logger = logging.getLogger(__name__)

_DEFAULT_STATE_PATH = Path.home() / ".opta-lmx" / "agents-runs.json"


class AgentsStateStore:
    """Persist and retrieve agent runs from a JSON file."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or _DEFAULT_STATE_PATH
        self._lock = Lock()
        self._runs: dict[str, AgentRun] = {}
        self._idempotency_index: dict[str, dict[str, str]] = {}
        self._load_from_disk()

    def list_runs(self) -> list[AgentRun]:
        """Return a copy of all known runs, newest first."""
        with self._lock:
            runs = [run.model_copy(deep=True) for run in self._runs.values()]
        runs.sort(key=lambda run: run.created_at, reverse=True)
        return runs

    def get_run(self, run_id: str) -> AgentRun | None:
        """Return one run by ID."""
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None
            return run.model_copy(deep=True)

    def upsert_run(self, run: AgentRun) -> None:
        """Insert or update a run, then persist to disk."""
        with self._lock:
            self._runs[run.id] = run.model_copy(deep=True)
            self._write_locked()

    def delete_run(self, run_id: str) -> None:
        """Delete one run by ID if it exists, then persist to disk."""
        with self._lock:
            if run_id not in self._runs:
                return
            self._runs.pop(run_id, None)
            stale_keys = [
                key for key, data in self._idempotency_index.items()
                if data.get("run_id") == run_id
            ]
            for key in stale_keys:
                self._idempotency_index.pop(key, None)
            self._write_locked()

    def get_idempotency(self, key: str) -> tuple[str, str] | None:
        """Return (run_id, fingerprint) for an idempotency key."""
        normalized = key.strip()
        if not normalized:
            return None
        with self._lock:
            entry = self._idempotency_index.get(normalized)
            if entry is None:
                return None
            run_id = entry.get("run_id", "")
            fingerprint = entry.get("fingerprint", "")
            if not run_id:
                return None
            return run_id, fingerprint

    def bind_idempotency(self, key: str, run_id: str, fingerprint: str) -> None:
        """Bind an idempotency key to a run id and fingerprint."""
        normalized = key.strip()
        if not normalized:
            return
        with self._lock:
            self._idempotency_index[normalized] = {
                "run_id": run_id,
                "fingerprint": fingerprint,
            }
            self._write_locked()

    def clear_idempotency(self, key: str) -> None:
        """Remove one idempotency mapping."""
        normalized = key.strip()
        if not normalized:
            return
        with self._lock:
            if normalized not in self._idempotency_index:
                return
            self._idempotency_index.pop(normalized, None)
            self._write_locked()

    def _load_from_disk(self) -> None:
        if not self._path.exists():
            return
        try:
            loaded = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("agents_state_store_load_failed", extra={"error": str(exc)})
            return

        if not isinstance(loaded, dict):
            return
        runs_raw = loaded.get("runs", [])
        if not isinstance(runs_raw, list):
            return

        restored: dict[str, AgentRun] = {}
        for item in runs_raw:
            if not isinstance(item, dict):
                continue
            try:
                run = AgentRun.model_validate(item)
            except Exception as exc:  # pragma: no cover - defensive against corrupt entries
                logger.warning("agents_state_store_entry_invalid", extra={"error": str(exc)})
                continue
            restored[run.id] = run

        with self._lock:
            self._runs = restored
            idempotency_raw = loaded.get("idempotency", {})
            if isinstance(idempotency_raw, dict):
                rebuilt: dict[str, dict[str, str]] = {}
                for key, value in idempotency_raw.items():
                    if not isinstance(key, str) or not key.strip():
                        continue
                    if not isinstance(value, dict):
                        continue
                    run_id = value.get("run_id")
                    if not isinstance(run_id, str) or not run_id:
                        continue
                    fingerprint = value.get("fingerprint")
                    if not isinstance(fingerprint, str):
                        fingerprint = ""
                    rebuilt[key.strip()] = {
                        "run_id": run_id,
                        "fingerprint": fingerprint,
                    }
                self._idempotency_index = rebuilt

    def _write_locked(self) -> None:
        payload = {
            "runs": [run.model_dump(mode="json") for run in self._runs.values()],
            "idempotency": self._idempotency_index,
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(payload, indent=2, sort_keys=True)
        temp_path = self._path.with_name(f"{self._path.name}.tmp")
        temp_path.write_text(serialized, encoding="utf-8")
        temp_path.replace(self._path)

    def analytics_rows(self) -> list[dict[str, object]]:
        """Return flattened run rows for long-horizon analytics exports."""
        with self._lock:
            runs = [run.model_copy(deep=True) for run in self._runs.values()]

        rows: list[dict[str, object]] = []
        for run in runs:
            rows.append(
                {
                    "run_id": run.id,
                    "status": run.status.value,
                    "created_at": run.created_at,
                    "updated_at": run.updated_at,
                    "duration_sec": max(0.0, run.updated_at - run.created_at),
                    "model": run.resolved_model or run.request.model,
                    "roles": list(run.request.roles),
                    "role_count": len(run.request.roles),
                    "priority": run.request.priority.value,
                    "submitted_by": run.request.submitted_by,
                }
            )
        rows.sort(key=lambda row: float(cast(float, row["created_at"])), reverse=True)
        return rows

    def export_analytics(self, path: Path) -> int:
        """Export run analytics as JSON payload. Returns number of rows."""
        rows = self.analytics_rows()
        payload = {
            "generated_at": time.time(),
            "rows": rows,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return len(rows)

    @property
    def path(self) -> Path:
        """State file path."""
        return self._path
