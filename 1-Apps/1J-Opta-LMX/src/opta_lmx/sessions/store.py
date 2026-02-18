"""SessionStore — read-only access to CLI session files on disk.

The Opta CLI stores sessions as JSON files at ``~/.config/opta/sessions/``.
This module provides listing, searching, retrieval, and deletion of those
files so the LMX server can serve them to web clients.

File layout::

    ~/.config/opta/sessions/
        index.json          # Fast listing index (optional)
        <session-id>.json   # Individual session files
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from opta_lmx.sessions.models import (
    SessionFull,
    SessionListResponse,
    SessionMessage,
    SessionSummary,
)

logger = logging.getLogger(__name__)

_DEFAULT_SESSIONS_DIR = Path.home() / ".config" / "opta" / "sessions"


class SessionStore:
    """Read CLI session files from disk.

    Args:
        sessions_dir: Path to the CLI sessions directory.
            Defaults to ``~/.config/opta/sessions/``.
    """

    def __init__(self, sessions_dir: Path | None = None) -> None:
        self.sessions_dir = sessions_dir or _DEFAULT_SESSIONS_DIR

    # ── List ──────────────────────────────────────────────────────────────

    def list_sessions(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        model: str | None = None,
        tag: str | None = None,
        since: str | None = None,
    ) -> SessionListResponse:
        """Return paginated session summaries, newest first.

        Uses ``index.json`` for fast listing when available, falling back
        to scanning individual session files.

        Args:
            limit: Maximum number of sessions to return.
            offset: Number of sessions to skip (pagination).
            model: Filter by model (case-insensitive substring match).
            tag: Filter by tag (exact match).
            since: ISO 8601 date cutoff — only sessions updated on or after.
        """
        summaries = self._load_summaries()

        # Apply filters
        if model:
            model_lower = model.lower()
            summaries = [s for s in summaries if model_lower in s.model.lower()]
        if tag:
            summaries = [s for s in summaries if tag in s.tags]
        if since:
            summaries = [s for s in summaries if s.updated >= since or s.created >= since]

        # Sort by updated descending (ISO dates sort lexicographically)
        summaries.sort(key=lambda s: s.updated or s.created, reverse=True)

        total = len(summaries)
        page = summaries[offset : offset + limit]
        return SessionListResponse(sessions=page, total=total)

    # ── Get ───────────────────────────────────────────────────────────────

    def get_session(self, session_id: str) -> SessionFull | None:
        """Load a full session by ID, or None if not found."""
        path = self.sessions_dir / f"{session_id}.json"
        if not path.is_file():
            return None

        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("session_read_error", extra={
                "session_id": session_id,
                "error": str(exc),
            })
            return None

        return self._parse_full_session(session_id, raw)

    # ── Delete ────────────────────────────────────────────────────────────

    def delete_session(self, session_id: str) -> bool:
        """Delete a session file and remove it from the index.

        Returns True if the session was deleted, False if not found.
        """
        path = self.sessions_dir / f"{session_id}.json"
        if not path.is_file():
            return False

        try:
            path.unlink()
        except OSError as exc:
            logger.error("session_delete_error", extra={
                "session_id": session_id,
                "error": str(exc),
            })
            return False

        # Update index.json if it exists
        self._remove_from_index(session_id)

        logger.info("session_deleted", extra={"session_id": session_id})
        return True

    # ── Search ────────────────────────────────────────────────────────────

    def search_sessions(self, query: str, *, limit: int = 20) -> list[SessionSummary]:
        """Search sessions by title, model, tags, and first user message.

        Simple case-insensitive substring matching across fields.
        Acts as a server-side fallback to client-side Fuse.js.
        """
        q = query.lower()
        summaries = self._load_summaries()
        matches: list[SessionSummary] = []

        for s in summaries:
            if (
                q in s.title.lower()
                or q in s.model.lower()
                or q in s.id.lower()
                or any(q in t.lower() for t in s.tags)
            ):
                matches.append(s)
                if len(matches) >= limit:
                    break

        # If we haven't filled the limit, do a deeper search through
        # the first user message in each session file.
        if len(matches) < limit:
            matched_ids = {m.id for m in matches}
            for s in summaries:
                if s.id in matched_ids:
                    continue
                if self._first_message_matches(s.id, q):
                    matches.append(s)
                    if len(matches) >= limit:
                        break

        # Sort by updated descending
        matches.sort(key=lambda s: s.updated or s.created, reverse=True)
        return matches

    # ── Internal helpers ──────────────────────────────────────────────────

    def _load_summaries(self) -> list[SessionSummary]:
        """Load session summaries from index.json or by scanning files."""
        if not self.sessions_dir.is_dir():
            return []

        index_path = self.sessions_dir / "index.json"
        if index_path.is_file():
            return self._load_from_index(index_path)

        return self._scan_session_files()

    def _load_from_index(self, index_path: Path) -> list[SessionSummary]:
        """Parse index.json for fast session listing.

        Index schema (from CLI)::

            {
              "entries": {
                "<id>": {
                  "title": "...",
                  "model": "...",
                  "tags": [...],
                  "created": "...",
                  "messageCount": N
                }
              },
              "updatedAt": "..."
            }
        """
        try:
            raw = json.loads(index_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("index_read_error", extra={"error": str(exc)})
            return self._scan_session_files()

        entries: dict = raw.get("entries", {})
        summaries: list[SessionSummary] = []

        for sid, entry in entries.items():
            if not isinstance(entry, dict):
                continue
            summaries.append(SessionSummary(
                id=sid,
                title=entry.get("title", ""),
                model=entry.get("model", ""),
                tags=entry.get("tags", []),
                created=entry.get("created", ""),
                updated=entry.get("updated", entry.get("created", "")),
                message_count=entry.get("messageCount", 0),
            ))

        return summaries

    def _scan_session_files(self) -> list[SessionSummary]:
        """Scan individual session JSON files (slow path)."""
        summaries: list[SessionSummary] = []

        for path in self.sessions_dir.glob("*.json"):
            if path.name == "index.json":
                continue

            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("session_scan_error", extra={
                    "file": path.name,
                    "error": str(exc),
                })
                continue

            if not isinstance(raw, dict):
                continue

            sid = raw.get("id", path.stem)
            messages = raw.get("messages", [])

            summaries.append(SessionSummary(
                id=sid,
                title=raw.get("title", ""),
                model=raw.get("model", ""),
                tags=raw.get("tags", []),
                created=raw.get("created", ""),
                updated=raw.get("updated", raw.get("created", "")),
                message_count=len(messages) if isinstance(messages, list) else 0,
            ))

        return summaries

    def _parse_full_session(self, session_id: str, raw: dict) -> SessionFull:
        """Parse a raw session dict into a SessionFull model."""
        raw_messages = raw.get("messages", [])
        messages: list[SessionMessage] = []

        for msg in raw_messages:
            if not isinstance(msg, dict):
                continue
            messages.append(SessionMessage(
                role=msg.get("role", "user"),
                content=msg.get("content"),
                tool_calls=msg.get("tool_calls"),
                tool_call_id=msg.get("tool_call_id"),
            ))

        return SessionFull(
            id=raw.get("id", session_id),
            title=raw.get("title", ""),
            model=raw.get("model", ""),
            tags=raw.get("tags", []),
            created=raw.get("created", ""),
            updated=raw.get("updated", raw.get("created", "")),
            cwd=raw.get("cwd", ""),
            messages=messages,
            tool_call_count=raw.get("toolCallCount", 0),
            compacted=raw.get("compacted", False),
        )

    def _remove_from_index(self, session_id: str) -> None:
        """Remove a session entry from index.json if it exists."""
        index_path = self.sessions_dir / "index.json"
        if not index_path.is_file():
            return

        try:
            raw = json.loads(index_path.read_text(encoding="utf-8"))
            entries = raw.get("entries", {})
            if session_id in entries:
                del entries[session_id]
                raw["entries"] = entries
                index_path.write_text(
                    json.dumps(raw, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
                logger.info("index_entry_removed", extra={"session_id": session_id})
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("index_update_error", extra={
                "session_id": session_id,
                "error": str(exc),
            })

    def _first_message_matches(self, session_id: str, query: str) -> bool:
        """Check if the first user message in a session matches the query."""
        path = self.sessions_dir / f"{session_id}.json"
        if not path.is_file():
            return False

        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return False

        messages = raw.get("messages", [])
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            if msg.get("role") != "user":
                continue
            content = msg.get("content", "")
            if isinstance(content, str) and query in content.lower():
                return True
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        text = part.get("text", "")
                        if isinstance(text, str) and query in text.lower():
                            return True
            break  # Only check first user message

        return False
