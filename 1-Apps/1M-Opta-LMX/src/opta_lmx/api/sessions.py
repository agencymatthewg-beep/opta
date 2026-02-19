"""Session API routes — browse and manage CLI sessions via /admin/sessions.

These endpoints expose Opta CLI session files (stored at
``~/.config/opta/sessions/``) to web clients. The SessionStore reads
session JSON files from disk; LMX acts as a bridge between the filesystem
and the web UI.

All endpoints require admin key authentication (X-Admin-Key header).
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query

from opta_lmx.api.deps import AdminAuth, SessionStoreDep
from opta_lmx.sessions.models import (
    SessionFull,
    SessionListResponse,
    SessionSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    _auth: AdminAuth,
    store: SessionStoreDep,
    limit: int = Query(50, ge=1, le=200, description="Max sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    model: str | None = Query(None, description="Filter by model (case-insensitive substring)"),
    tag: str | None = Query(None, description="Filter by tag (exact match)"),
    since: str | None = Query(None, description="ISO 8601 date cutoff"),
) -> SessionListResponse:
    """List session summaries with pagination and optional filtering."""
    return await asyncio.to_thread(
        store.list_sessions,
        limit=limit,
        offset=offset,
        model=model,
        tag=tag,
        since=since,
    )


@router.get("/search", response_model=list[SessionSummary])
async def search_sessions(
    _auth: AdminAuth,
    store: SessionStoreDep,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
) -> list[SessionSummary]:
    """Search sessions by title, model, tags, and first user message.

    NOTE: This route MUST be defined before ``/{session_id}`` to prevent
    FastAPI from interpreting ``"search"`` as a session ID.
    """
    return await asyncio.to_thread(store.search_sessions, q, limit=limit)


@router.get("/{session_id}", response_model=SessionFull)
async def get_session(
    session_id: str,
    _auth: AdminAuth,
    store: SessionStoreDep,
) -> SessionFull:
    """Get a full session including all messages."""
    session = await asyncio.to_thread(store.get_session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}", response_model=None)
async def delete_session(
    session_id: str,
    _auth: AdminAuth,
    store: SessionStoreDep,
) -> dict[str, bool]:
    """Delete a session file from disk."""
    deleted = await asyncio.to_thread(store.delete_session, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True}
