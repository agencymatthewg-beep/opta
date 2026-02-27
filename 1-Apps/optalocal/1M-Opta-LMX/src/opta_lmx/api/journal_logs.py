"""Admin API routes for browsing journal log files."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from opta_lmx.api.deps import AdminAuth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/logs", tags=["admin-logs"])


class LogFileEntry(BaseModel):
    """Metadata for a single log file."""

    filename: str
    size_bytes: int
    created_at: str  # ISO 8601


def _list_log_files(directory: Path, suffixes: set[str]) -> list[LogFileEntry]:
    """List log files in a directory, most recent first."""
    if not directory.is_dir():
        return []

    entries: list[tuple[float, LogFileEntry]] = []
    for path in directory.iterdir():
        if not path.is_file() or path.suffix not in suffixes:
            continue
        try:
            stat = path.stat()
        except OSError:
            continue
        created_at = datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat()
        entries.append((
            stat.st_mtime,
            LogFileEntry(
                filename=path.name,
                size_bytes=stat.st_size,
                created_at=created_at,
            ),
        ))

    # Sort by mtime descending (most recent first)
    entries.sort(key=lambda item: item[0], reverse=True)
    return [entry for _, entry in entries]


def _read_log_file(directory: Path, filename: str, suffixes: set[str]) -> str:
    """Read a specific log file, guarding against path traversal."""
    # Prevent path traversal by checking the filename is a bare name
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    target = directory / safe_name
    if not target.is_file() or target.suffix not in suffixes:
        raise HTTPException(status_code=404, detail="Log file not found")

    try:
        return target.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("journal_log_read_failed", extra={"path": str(target), "error": str(exc)})
        raise HTTPException(status_code=500, detail="Failed to read log file") from exc


# ─── Session log endpoints ──────────────────────────────────────────────────

_SESSION_SUFFIXES = {".md", ".jsonl"}


@router.get("/sessions", response_model=list[LogFileEntry])
async def list_session_logs(request: Request, _auth: AdminAuth) -> list[LogFileEntry]:
    """List session log files (filename, size, created_at), most recent first."""
    config = request.app.state.config
    return _list_log_files(config.journaling.session_logs_dir, _SESSION_SUFFIXES)


@router.get("/sessions/{filename}")
async def read_session_log(request: Request, filename: str, _auth: AdminAuth) -> PlainTextResponse:
    """Read a specific session log file."""
    config = request.app.state.config
    content = _read_log_file(config.journaling.session_logs_dir, filename, _SESSION_SUFFIXES)
    return PlainTextResponse(content)


# ─── Update log endpoints ───────────────────────────────────────────────────

_UPDATE_SUFFIXES = {".md"}


@router.get("/updates", response_model=list[LogFileEntry])
async def list_update_logs(request: Request, _auth: AdminAuth) -> list[LogFileEntry]:
    """List update log files, most recent first."""
    config = request.app.state.config
    return _list_log_files(config.journaling.update_logs_dir, _UPDATE_SUFFIXES)


@router.get("/updates/{filename}")
async def read_update_log(request: Request, filename: str, _auth: AdminAuth) -> PlainTextResponse:
    """Read a specific update log file."""
    config = request.app.state.config
    content = _read_log_file(config.journaling.update_logs_dir, filename, _UPDATE_SUFFIXES)
    return PlainTextResponse(content)
