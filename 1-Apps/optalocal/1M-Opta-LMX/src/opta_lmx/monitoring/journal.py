"""Runtime and update journaling helpers for YJS-style markdown logs."""

from __future__ import annotations

import getpass
import json
import logging
import re
import socket
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, tzinfo
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from opta_lmx.config import JournalingConfig
from opta_lmx.monitoring.events import ServerEvent

logger = logging.getLogger(__name__)

_DEFAULT_SUMMARY = "runtime-session"
_UPDATE_FILENAME_RE = re.compile(r"^(?P<id>\d{3,})_\d{4}-\d{2}-\d{2}_.+\.md$")
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _resolve_timezone(timezone_name: str | None) -> tzinfo:
    """Resolve configured timezone with fail-safe fallback."""
    if timezone_name:
        try:
            return ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            logger.warning("journaling_invalid_timezone", extra={"timezone": timezone_name})
    local_tz = datetime.now().astimezone().tzinfo
    return local_tz if local_tz is not None else UTC


def _to_timezone(dt: datetime, tz: tzinfo) -> datetime:
    """Convert datetimes to target timezone (assume UTC for naive values)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).astimezone(tz)
    return dt.astimezone(tz)


def _slugify(value: str, fallback: str) -> str:
    """Create lowercase filesystem-safe slugs."""
    slug = _SLUG_RE.sub("-", value.lower()).strip("-")
    return slug or fallback


def _duration_hms(started_at: datetime, ended_at: datetime) -> str:
    """Format elapsed duration as HH:MM:SS."""
    seconds = max(0, int((ended_at - started_at).total_seconds()))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _next_update_id(update_logs_dir: Path, series_start: int) -> int:
    """Allocate next update log ID from existing numbered update files."""
    highest = series_start - 1
    for path in update_logs_dir.glob("*.md"):
        match = _UPDATE_FILENAME_RE.match(path.name)
        if match is None:
            continue
        log_id = int(match.group("id"))
        if log_id > highest:
            highest = log_id
    return max(series_start, highest + 1)


def _stringify_value(value: Any) -> str:
    if value is None:
        return "(unset)"
    if isinstance(value, (dict, list, tuple, set)):
        return json.dumps(value, sort_keys=True, default=str)
    return str(value)


def _render_command_inputs(command_inputs: Mapping[str, Any] | None) -> list[str]:
    if not command_inputs:
        return ["- (none)"]
    lines: list[str] = []
    for key in sorted(command_inputs):
        lines.append(f"- `{key}`: `{_stringify_value(command_inputs[key])}`")
    return lines


def _render_step_results(steps: list[Mapping[str, Any]] | None) -> list[str]:
    lines = [
        "| Target | Component | Step | Status | Message |",
        "| --- | --- | --- | --- | --- |",
    ]
    if not steps:
        lines.append("| (none) | (none) | (none) | skip | (none) |")
        return lines

    def _cell(value: Any) -> str:
        return _stringify_value(value).replace("|", "\\|")

    for step in steps:
        target = _cell(step.get("target", "(none)"))
        component = _cell(step.get("component", "(none)"))
        step_name = _cell(step.get("step", "(none)"))
        status = _cell(step.get("status", "unknown"))
        message = _cell(step.get("message", ""))
        lines.append(
            f"| {target} | {component} | {step_name} | {status} | {message} |",
        )
    return lines


def _render_update_markdown(
    *,
    log_id: int,
    timestamp: datetime,
    author: str,
    title: str,
    summary: str,
    category: str,
    version_before: str | None,
    version_after: str | None,
    commit: str | None,
    promoted: bool | None,
    command_inputs: Mapping[str, Any] | None,
    steps: list[Mapping[str, Any]] | None,
) -> str:
    """Render a numbered update log markdown document."""
    promoted_value = (
        "true" if promoted else "false" if promoted is not None else "null"
    )
    command_input_lines = _render_command_inputs(command_inputs)
    step_lines = _render_step_results(steps)

    return "\n".join(
        [
            "---",
            f"id: {log_id:03d}",
            f"date: {timestamp:%Y-%m-%d}",
            f"time: \"{timestamp:%H:%M:%S}\"",
            f"author: \"{author}\"",
            f"version_before: \"{version_before or ''}\"",
            f"version_after: \"{version_after or ''}\"",
            f"commit: \"{commit or ''}\"",
            f"promoted: {promoted_value}",
            f"category: \"{category}\"",
            "---",
            "",
            f"# {title}",
            "",
            "## Summary",
            f"- {summary.strip()}",
            "",
            "## Command Inputs",
            *command_input_lines,
            "",
            "## Step Results",
            *step_lines,
            "",
        ]
    )


def write_update_log(
    *,
    update_logs_dir: Path,
    title: str,
    summary: str,
    slug: str | None = None,
    category: str = "sync",
    author: str | None = None,
    timezone: str | None = None,
    version_before: str | None = None,
    version_after: str | None = None,
    commit: str | None = None,
    promoted: bool | None = None,
    command_inputs: Mapping[str, Any] | None = None,
    steps: list[Mapping[str, Any]] | None = None,
    series_start: int | None = None,
    series_end: int = 999,
    now: datetime | None = None,
) -> Path:
    """Write a numbered YJS-style update log markdown file."""
    tz = _resolve_timezone(timezone)
    timestamp = _to_timezone(now or datetime.now(tz), tz)
    resolved_slug = _slugify(slug or title or category, fallback="update")
    resolved_author = author or getpass.getuser()
    resolved_start = series_start
    if resolved_start is None:
        resolved_start = 200 if category in {"sync", "update"} else 1
    if resolved_start > series_end:
        raise ValueError("series_start must be <= series_end")

    update_logs_dir.mkdir(parents=True, exist_ok=True)
    next_id = _next_update_id(update_logs_dir, series_start=resolved_start)
    if next_id > series_end:
        raise RuntimeError("Unable to allocate update log filename: series exhausted")

    for log_id in range(next_id, series_end + 1):
        candidate = update_logs_dir / f"{log_id:03d}_{timestamp:%Y-%m-%d}_{resolved_slug}.md"
        content = _render_update_markdown(
            log_id=log_id,
            timestamp=timestamp,
            author=resolved_author,
            title=title,
            summary=summary,
            category=category,
            version_before=version_before,
            version_after=version_after,
            commit=commit,
            promoted=promoted,
            command_inputs=command_inputs,
            steps=steps,
        )
        try:
            with candidate.open("x", encoding="utf-8") as handle:
                handle.write(content)
            return candidate
        except FileExistsError:
            continue
    raise RuntimeError("Unable to allocate update log filename: series exhausted")


@dataclass
class _RuntimeSession:
    """In-memory state for the active runtime journaling session."""

    started_at: datetime
    device: str
    user: str
    model: str
    metadata: dict[str, str] = field(default_factory=dict)


class RuntimeJournalManager:
    """Manage runtime session journaling and optional event JSONL mirroring."""

    def __init__(self, config: JournalingConfig) -> None:
        self._config = config
        self._tz = _resolve_timezone(config.timezone)
        self._session: _RuntimeSession | None = None
        self._event_counts: Counter[str] = Counter()
        self._total_events = 0
        self._event_jsonl_path: Path | None = None

    def prune_old_logs(self) -> int:
        """Remove stale session and update log files based on retention policy.

        Deletes:
        - Session log files (*.md and *.jsonl) older than ``retention_days``.
        - Update log files (*.md) older than ``retention_days``.
        - Excess session log *.md files beyond ``max_session_logs`` (oldest first).

        Returns:
            Total number of files deleted.
        """
        retention_days = self._config.retention_days
        max_session_logs = self._config.max_session_logs
        cutoff = datetime.now(tz=UTC) - timedelta(days=retention_days)
        cutoff_ts = cutoff.timestamp()
        deleted = 0

        # --- Prune session logs by age ---
        session_dir = self._config.session_logs_dir
        if session_dir.is_dir():
            for path in list(session_dir.iterdir()):
                if not path.is_file():
                    continue
                if path.suffix not in (".md", ".jsonl"):
                    continue
                try:
                    mtime = path.stat().st_mtime
                except OSError:
                    continue
                if mtime < cutoff_ts:
                    try:
                        path.unlink()
                        deleted += 1
                        logger.info(
                            "journal_pruned_session_log",
                            extra={"path": str(path), "reason": "age"},
                        )
                    except OSError:
                        logger.warning(
                            "journal_prune_failed",
                            extra={"path": str(path)},
                        )

        # --- Prune update logs by age ---
        update_dir = self._config.update_logs_dir
        if update_dir.is_dir():
            for path in list(update_dir.iterdir()):
                if not path.is_file() or path.suffix != ".md":
                    continue
                try:
                    mtime = path.stat().st_mtime
                except OSError:
                    continue
                if mtime < cutoff_ts:
                    try:
                        path.unlink()
                        deleted += 1
                        logger.info(
                            "journal_pruned_update_log",
                            extra={"path": str(path), "reason": "age"},
                        )
                    except OSError:
                        logger.warning(
                            "journal_prune_failed",
                            extra={"path": str(path)},
                        )

        # --- Enforce max_session_logs on session *.md files ---
        if session_dir.is_dir():
            md_files = sorted(
                (p for p in session_dir.iterdir() if p.is_file() and p.suffix == ".md"),
                key=lambda p: p.stat().st_mtime,
            )
            excess = len(md_files) - max_session_logs
            if excess > 0:
                for path in md_files[:excess]:
                    try:
                        path.unlink()
                        deleted += 1
                        logger.info(
                            "journal_pruned_session_log",
                            extra={"path": str(path), "reason": "max_session_logs"},
                        )
                    except OSError:
                        logger.warning(
                            "journal_prune_failed",
                            extra={"path": str(path)},
                        )

        if deleted:
            logger.info("journal_prune_complete", extra={"deleted": deleted})
        return deleted

    @property
    def event_jsonl_path(self) -> Path | None:
        """Path to the active session event JSONL file."""
        return self._event_jsonl_path

    def start_runtime_session(
        self,
        *,
        model: str | None = None,
        device: str | None = None,
        user: str | None = None,
        metadata: Mapping[str, Any] | None = None,
        started_at: datetime | None = None,
    ) -> None:
        """Start a runtime journaling session and capture startup metadata."""
        if not self._config.enabled:
            return

        self._config.session_logs_dir.mkdir(parents=True, exist_ok=True)
        self._config.update_logs_dir.mkdir(parents=True, exist_ok=True)

        started = _to_timezone(started_at or datetime.now(self._tz), self._tz)
        resolved_device = _slugify(device or socket.gethostname(), fallback="device")
        resolved_user = user or self._config.author or getpass.getuser()
        resolved_model = model or "opta-lmx"

        metadata_dump: dict[str, str] = {}
        if metadata:
            for key, value in metadata.items():
                if value is None:
                    continue
                metadata_dump[str(key)] = str(value)

        self._session = _RuntimeSession(
            started_at=started,
            device=resolved_device,
            user=resolved_user,
            model=resolved_model,
            metadata=metadata_dump,
        )
        self._event_counts.clear()
        self._total_events = 0

        if self._config.event_jsonl_enabled:
            jsonl_name = f"{started:%Y-%m-%d-%H%M%S}-{resolved_device}-events.jsonl"
            self._event_jsonl_path = self._config.session_logs_dir / jsonl_name
            self._event_jsonl_path.touch(exist_ok=True)
        else:
            self._event_jsonl_path = None

    def record_event(self, event: ServerEvent) -> None:
        """Record one runtime event into summary counters and optional JSONL journal."""
        if not self._config.enabled or self._session is None:
            return

        self._total_events += 1
        self._event_counts[event.event_type] += 1

        if self._config.event_jsonl_enabled and self._event_jsonl_path is not None:
            payload = {
                "timestamp": _to_timezone(
                    datetime.fromtimestamp(event.timestamp, tz=UTC), self._tz
                ).isoformat(),
                "timestamp_unix": event.timestamp,
                "event_type": event.event_type,
                "data": event.data,
            }
            with self._event_jsonl_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, default=str, sort_keys=True))
                handle.write("\n")

    def finalize_runtime_session(
        self,
        *,
        summary: str = _DEFAULT_SUMMARY,
        ended_at: datetime | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> Path | None:
        """Write final session markdown summary and return the file path."""
        if not self._config.enabled or self._session is None:
            return None

        session = self._session
        finished_at = _to_timezone(ended_at or datetime.now(self._tz), self._tz)
        summary_slug = _slugify(summary, fallback="session")
        filename = (
            f"{session.started_at:%Y-%m-%d-%H%M}-"
            f"{session.device}-{summary_slug}.md"
        )
        output_path = self._config.session_logs_dir / filename
        suffix = 2
        while output_path.exists():
            output_path = self._config.session_logs_dir / (
                f"{session.started_at:%Y-%m-%d-%H%M}-{session.device}-"
                f"{summary_slug}-{suffix}.md"
            )
            suffix += 1

        runtime_lines = [
            f"- Started: {session.started_at:%Y-%m-%d %H:%M:%S %Z}",
            f"- Ended: {finished_at:%Y-%m-%d %H:%M:%S %Z}",
            f"- Duration: {_duration_hms(session.started_at, finished_at)}",
            f"- Total events: {self._total_events}",
        ]

        metadata_lines = [f"- {key}: {value}" for key, value in sorted(session.metadata.items())]
        if metadata:
            for key, value in sorted(metadata.items()):
                if value is None:
                    continue
                metadata_lines.append(f"- {key}: {value}")

        issue_lines: list[str] = []
        for event_type, count in sorted(
            self._event_counts.items(),
            key=lambda item: (-item[1], item[0]),
        ):
            if any(token in event_type for token in ("failed", "error", "warning")):
                issue_lines.append(f"- {event_type}: {count}")

        status_table_lines = [
            "| Area | Before | After |",
            "| --- | --- | --- |",
            "| Runtime | starting | shutdown |",
            f"| Events seen | 0 | {self._total_events} |",
            f"| Uptime | 00:00:00 | {_duration_hms(session.started_at, finished_at)} |",
        ]

        event_summary_lines: list[str] = ["| Event Type | Count |", "| --- | ---: |"]
        if self._event_counts:
            for event_type, count in sorted(
                self._event_counts.items(),
                key=lambda item: (-item[1], item[0]),
            ):
                event_summary_lines.append(f"| {event_type} | {count} |")
        else:
            event_summary_lines.append("| none | 0 |")

        markdown = "\n".join(
            [
                "---",
                f"date: {session.started_at:%Y-%m-%d}",
                f"time: \"{session.started_at:%H:%M %Z}\"",
                f"device: \"{session.device}\"",
                f"user: \"{session.user}\"",
                f"model: \"{session.model}\"",
                f"duration: \"{_duration_hms(session.started_at, finished_at)}\"",
                "---",
                "",
                "# Session: Runtime Session",
                "",
                "## Summary",
                *runtime_lines,
                "",
                "## Files Changed",
                "### Created",
                "- (none)",
                "",
                "### Modified",
                "- (none)",
                "",
                "### Deleted",
                "- (none)",
                "",
                "## Status Changes",
                *status_table_lines,
                "",
                "## Decisions Made",
                "- Runtime journaling active for this server lifecycle.",
                "",
                "## Issues Encountered",
                *(issue_lines or ["- (none)"]),
                "",
                "## Next Steps",
                "- [ ] Review event summary for failures/warnings before next restart.",
                "",
                "## Notes",
                "### Event Summary",
                *event_summary_lines,
                "",
                "### Startup Metadata",
                *(metadata_lines or ["- none"]),
                "",
            ]
        )
        output_path.write_text(markdown, encoding="utf-8")
        return output_path

    def write_update_log(self, **kwargs: Any) -> Path:
        """Write a numbered update log using manager defaults for author/timezone."""
        kwargs.setdefault("update_logs_dir", self._config.update_logs_dir)
        kwargs.setdefault("author", self._config.author)
        kwargs.setdefault("timezone", self._config.timezone)
        return write_update_log(**kwargs)
