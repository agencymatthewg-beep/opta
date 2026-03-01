"""Pydantic models for CLI session data.

These models mirror the Opta CLI session schema stored at
``~/.config/opta/sessions/<id>.json``. The canonical TypeScript
definitions live in ``1-Apps/optalocal/1D-Opta-CLI-TS/src/memory/store.ts``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SessionSummary(BaseModel):
    """Lightweight session metadata for list views (no messages)."""

    id: str
    title: str = ""
    model: str = ""
    tags: list[str] = Field(default_factory=list)
    created: str = ""
    updated: str = ""
    message_count: int = 0


class SessionMessage(BaseModel):
    """A single message in a session (OpenAI chat format).

    Matches CLI's ``AgentMessage`` type: role + content (string, content
    parts array, or null) + optional tool_calls / tool_call_id.
    """

    role: str
    content: str | list | None = None
    tool_calls: list | None = None
    tool_call_id: str | None = None


class SessionFull(BaseModel):
    """Complete session with all messages, returned by get_session."""

    id: str
    title: str = ""
    model: str = ""
    tags: list[str] = Field(default_factory=list)
    created: str = ""
    updated: str = ""
    cwd: str = ""
    messages: list[SessionMessage] = Field(default_factory=list)
    tool_call_count: int = 0
    compacted: bool = False


class SessionListResponse(BaseModel):
    """Paginated session list response."""

    sessions: list[SessionSummary]
    total: int
