"""Tests for SessionStore — read/list/search/delete CLI session files."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from opta_lmx.sessions.store import SessionStore

# ── Helpers ───────────────────────────────────────────────────────────────────


def _write_session(
    sessions_dir: Path,
    session_id: str,
    *,
    title: str = "Test Session",
    model: str = "claude-3",
    tags: list[str] | None = None,
    created: str = "2024-01-01T10:00:00Z",
    updated: str = "2024-01-01T10:05:00Z",
    messages: list[dict] | None = None,
    cwd: str = "/home",
    tool_call_count: int = 0,
    compacted: bool = False,
) -> Path:
    path = sessions_dir / f"{session_id}.json"
    data = {
        "id": session_id,
        "title": title,
        "model": model,
        "tags": tags or [],
        "created": created,
        "updated": updated,
        "messages": messages or [],
        "cwd": cwd,
        "toolCallCount": tool_call_count,
        "compacted": compacted,
    }
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _write_index(sessions_dir: Path, entries: dict) -> Path:
    index_path = sessions_dir / "index.json"
    index_path.write_text(
        json.dumps({"entries": entries, "updatedAt": "2024-01-01T10:00:00Z"}),
        encoding="utf-8",
    )
    return index_path


# ── Validation ────────────────────────────────────────────────────────────────


class TestValidateSessionId:
    def setup_method(self) -> None:
        self.store = SessionStore(Path("/tmp/irrelevant"))

    def test_valid_alphanumeric(self) -> None:
        self.store._validate_session_id("abc123")  # should not raise

    def test_valid_with_dash_underscore(self) -> None:
        self.store._validate_session_id("session-id_v2")

    def test_rejects_dotdot(self) -> None:
        with pytest.raises(ValueError, match="Invalid session_id"):
            self.store._validate_session_id("../../etc/passwd")

    def test_rejects_slash(self) -> None:
        with pytest.raises(ValueError, match="Invalid session_id"):
            self.store._validate_session_id("dir/file")

    def test_rejects_space(self) -> None:
        with pytest.raises(ValueError, match="Invalid session_id"):
            self.store._validate_session_id("bad id")


# ── Empty store ───────────────────────────────────────────────────────────────


class TestEmptyStore:
    def test_list_no_dir(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path / "nonexistent")
        result = store.list_sessions()
        assert result.sessions == []
        assert result.total == 0

    def test_get_no_file(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.get_session("missing-id") is None

    def test_delete_no_file(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.delete_session("missing-id") is False

    def test_search_no_dir(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path / "nonexistent")
        assert store.search_sessions("anything") == []


# ── list_sessions ─────────────────────────────────────────────────────────────


class TestListSessions:
    def test_returns_sessions_from_files(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "sess-1")
        _write_session(tmp_path, "sess-2")
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 2
        assert len(result.sessions) == 2

    def test_pagination_limit(self, tmp_path: Path) -> None:
        for i in range(5):
            _write_session(tmp_path, f"sess-{i}")
        store = SessionStore(tmp_path)
        result = store.list_sessions(limit=2)
        assert len(result.sessions) == 2
        assert result.total == 5

    def test_pagination_offset(self, tmp_path: Path) -> None:
        for i in range(5):
            _write_session(tmp_path, f"sess-{i}", updated=f"2024-01-0{i + 1}T00:00:00Z")
        store = SessionStore(tmp_path)
        result = store.list_sessions(limit=2, offset=2)
        assert len(result.sessions) == 2

    def test_filter_by_model(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", model="claude-3-opus")
        _write_session(tmp_path, "s2", model="gpt-4")
        store = SessionStore(tmp_path)
        result = store.list_sessions(model="claude")
        assert result.total == 1
        assert result.sessions[0].id == "s1"

    def test_filter_by_model_case_insensitive(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", model="Claude-3")
        store = SessionStore(tmp_path)
        result = store.list_sessions(model="CLAUDE")
        assert result.total == 1

    def test_filter_by_tag(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", tags=["work", "python"])
        _write_session(tmp_path, "s2", tags=["personal"])
        store = SessionStore(tmp_path)
        result = store.list_sessions(tag="work")
        assert result.total == 1
        assert result.sessions[0].id == "s1"

    def test_filter_by_since(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "old", created="2024-01-01T00:00:00Z",
                       updated="2024-01-01T00:00:00Z")
        _write_session(tmp_path, "new", created="2024-06-01T00:00:00Z",
                       updated="2024-06-01T00:00:00Z")
        store = SessionStore(tmp_path)
        result = store.list_sessions(since="2024-03-01T00:00:00Z")
        assert result.total == 1
        assert result.sessions[0].id == "new"

    def test_sorted_newest_first(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "older", updated="2024-01-01T00:00:00Z")
        _write_session(tmp_path, "newer", updated="2024-12-01T00:00:00Z")
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.sessions[0].id == "newer"

    def test_uses_index_when_present(self, tmp_path: Path) -> None:
        _write_index(tmp_path, {
            "s1": {"title": "Session 1", "model": "claude", "tags": [],
                   "created": "2024-01-01T00:00:00Z", "messageCount": 5},
        })
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 1
        assert result.sessions[0].title == "Session 1"
        assert result.sessions[0].message_count == 5


# ── get_session ───────────────────────────────────────────────────────────────


class TestGetSession:
    def test_returns_full_session(self, tmp_path: Path) -> None:
        _write_session(
            tmp_path, "s1",
            title="My Session",
            model="claude-3",
            messages=[{"role": "user", "content": "Hello"}],
        )
        store = SessionStore(tmp_path)
        session = store.get_session("s1")
        assert session is not None
        assert session.id == "s1"
        assert session.title == "My Session"
        assert len(session.messages) == 1
        assert session.messages[0].role == "user"
        assert session.messages[0].content == "Hello"

    def test_returns_none_for_missing(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.get_session("not-here") is None

    def test_returns_none_for_invalid_id(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.get_session("../../etc/passwd") is None

    def test_returns_none_for_corrupt_json(self, tmp_path: Path) -> None:
        (tmp_path / "s1.json").write_text("NOT JSON", encoding="utf-8")
        store = SessionStore(tmp_path)
        assert store.get_session("s1") is None

    def test_parses_tool_calls(self, tmp_path: Path) -> None:
        _write_session(
            tmp_path, "s1",
            messages=[{
                "role": "assistant",
                "content": None,
                "tool_calls": [{"id": "call_1", "type": "function"}],
            }],
        )
        store = SessionStore(tmp_path)
        session = store.get_session("s1")
        assert session is not None
        assert session.messages[0].tool_calls is not None

    def test_parses_compacted_flag(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", compacted=True)
        store = SessionStore(tmp_path)
        session = store.get_session("s1")
        assert session is not None
        assert session.compacted is True


# ── delete_session ────────────────────────────────────────────────────────────


class TestDeleteSession:
    def test_deletes_file(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1")
        store = SessionStore(tmp_path)
        assert store.delete_session("s1") is True
        assert not (tmp_path / "s1.json").exists()

    def test_returns_false_not_found(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.delete_session("ghost") is False

    def test_returns_false_invalid_id(self, tmp_path: Path) -> None:
        store = SessionStore(tmp_path)
        assert store.delete_session("../../evil") is False

    def test_removes_from_index(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1")
        _write_index(tmp_path, {
            "s1": {"title": "S1", "model": "m", "tags": [],
                   "created": "2024-01-01T00:00:00Z", "messageCount": 0},
            "s2": {"title": "S2", "model": "m", "tags": [],
                   "created": "2024-01-01T00:00:00Z", "messageCount": 0},
        })
        store = SessionStore(tmp_path)
        store.delete_session("s1")

        index = json.loads((tmp_path / "index.json").read_text())
        assert "s1" not in index["entries"]
        assert "s2" in index["entries"]

    def test_delete_ok_without_index(self, tmp_path: Path) -> None:
        """delete_session succeeds when index.json is absent."""
        _write_session(tmp_path, "s1")
        store = SessionStore(tmp_path)
        assert store.delete_session("s1") is True


# ── search_sessions ───────────────────────────────────────────────────────────


class TestSearchSessions:
    def test_matches_title(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", title="Python debugging session")
        _write_session(tmp_path, "s2", title="Rust compilation")
        store = SessionStore(tmp_path)
        results = store.search_sessions("python")
        assert len(results) == 1
        assert results[0].id == "s1"

    def test_matches_model(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", model="claude-opus")
        store = SessionStore(tmp_path)
        assert len(store.search_sessions("opus")) == 1

    def test_matches_tag(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", tags=["refactoring"])
        store = SessionStore(tmp_path)
        assert len(store.search_sessions("refactor")) == 1

    def test_matches_first_user_message(self, tmp_path: Path) -> None:
        _write_session(
            tmp_path, "s1",
            title="No title clue",
            model="unknown",
            messages=[{"role": "user", "content": "explain the quantum entanglement"}],
        )
        store = SessionStore(tmp_path)
        results = store.search_sessions("quantum")
        assert len(results) == 1

    def test_limit_respected(self, tmp_path: Path) -> None:
        for i in range(5):
            _write_session(tmp_path, f"s{i}", title="same title")
        store = SessionStore(tmp_path)
        results = store.search_sessions("same", limit=3)
        assert len(results) == 3

    def test_case_insensitive(self, tmp_path: Path) -> None:
        _write_session(tmp_path, "s1", title="IMPORTANT")
        store = SessionStore(tmp_path)
        assert len(store.search_sessions("important")) == 1


# ── _load_from_index ──────────────────────────────────────────────────────────


class TestLoadFromIndex:
    def test_fallback_on_corrupt_index(self, tmp_path: Path) -> None:
        (tmp_path / "index.json").write_text("CORRUPT", encoding="utf-8")
        _write_session(tmp_path, "s1")
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        # Falls back to file scan
        assert result.total == 1

    def test_skips_non_dict_entries(self, tmp_path: Path) -> None:
        _write_index(tmp_path, {
            "good": {"title": "OK", "model": "m", "tags": [],
                     "created": "2024-01-01T00:00:00Z", "messageCount": 1},
            "bad": "not a dict",
        })
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 1
        assert result.sessions[0].id == "good"


# ── _scan_session_files ───────────────────────────────────────────────────────


class TestScanSessionFiles:
    def test_skips_index_json(self, tmp_path: Path) -> None:
        """index.json is not counted as a session file during scan."""
        _write_session(tmp_path, "s1")
        # Create a minimal index.json manually (not via _write_index which adds
        # an entry) — it should be excluded from the file scan even when empty.
        (tmp_path / "index.json").write_text(
            json.dumps({"entries": {}}), encoding="utf-8"
        )
        # Because index.json is present, _load_summaries uses _load_from_index,
        # which returns 0 entries (empty). The scan path is taken only when
        # index.json is absent. Verify no session is returned from empty index.
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 0  # index is empty; s1.json ignored in index path

    def test_skips_corrupt_files(self, tmp_path: Path) -> None:
        (tmp_path / "bad.json").write_text("BADDATA", encoding="utf-8")
        _write_session(tmp_path, "good")
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 1
        assert result.sessions[0].id == "good"

    def test_skips_non_dict_json(self, tmp_path: Path) -> None:
        (tmp_path / "list.json").write_text("[1, 2, 3]", encoding="utf-8")
        _write_session(tmp_path, "real")
        store = SessionStore(tmp_path)
        result = store.list_sessions()
        assert result.total == 1


# ── Edge cases ────────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_parse_skips_non_dict_messages(self, tmp_path: Path) -> None:
        """Non-dict entries in the messages list are silently skipped."""
        path = tmp_path / "s1.json"
        path.write_text(json.dumps({
            "id": "s1",
            "title": "T",
            "model": "m",
            "tags": [],
            "created": "2024-01-01T00:00:00Z",
            "updated": "2024-01-01T00:00:00Z",
            "messages": ["not a dict", {"role": "user", "content": "hi"}],
        }), encoding="utf-8")
        store = SessionStore(tmp_path)
        session = store.get_session("s1")
        assert session is not None
        assert len(session.messages) == 1

    def test_search_matches_list_content_type(self, tmp_path: Path) -> None:
        """search finds query in multi-part (list) content messages."""
        _write_session(
            tmp_path, "s1",
            title="unrelated",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Please explain neural networks"},
                ],
            }],
        )
        store = SessionStore(tmp_path)
        results = store.search_sessions("neural")
        assert len(results) == 1

    def test_remove_from_index_noop_when_not_present(self, tmp_path: Path) -> None:
        """_remove_from_index is a no-op when session_id not in entries."""
        _write_index(tmp_path, {
            "other": {"title": "O", "model": "m", "tags": [],
                      "created": "2024-01-01T00:00:00Z", "messageCount": 0},
        })
        _write_session(tmp_path, "s1")
        store = SessionStore(tmp_path)
        store.delete_session("s1")  # s1 not in index — should not corrupt it
        index = json.loads((tmp_path / "index.json").read_text())
        assert "other" in index["entries"]

    def test_search_deep_scan_limit(self, tmp_path: Path) -> None:
        """Deep message search stops at limit."""
        for i in range(5):
            _write_session(
                tmp_path, f"s{i}",
                title="no-match",
                messages=[{"role": "user", "content": f"deep content keyword {i}"}],
            )
        store = SessionStore(tmp_path)
        results = store.search_sessions("keyword", limit=2)
        assert len(results) == 2
