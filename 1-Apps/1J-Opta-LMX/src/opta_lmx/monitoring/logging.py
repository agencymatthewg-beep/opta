"""Structured JSON logging setup for Opta-LMX."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path


class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured querying."""

    # Standard LogRecord attributes to exclude when extracting extra fields
    _STANDARD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())
    _SENSITIVE_KEYS = frozenset(("api_key", "token", "secret", "password", "credential"))

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            log_data["exception"] = str(record.exc_info[1])
        # Extract extra fields: anything in record.__dict__ that isn't a standard LogRecord attribute
        for key, value in record.__dict__.items():
            if key not in self._STANDARD_ATTRS and key not in self._SENSITIVE_KEYS:
                log_data[key] = value
        return json.dumps(log_data, default=str)


class TextFormatter(logging.Formatter):
    """Human-readable text formatter for development."""

    FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    def __init__(self) -> None:
        super().__init__(self.FORMAT)


def setup_logging(
    level: str = "INFO",
    structured: bool = True,
    log_file: str | None = None,
    max_bytes: int = 50 * 1024 * 1024,
    backup_count: int = 5,
) -> None:
    """Configure logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR).
        structured: Use JSON format (True) or text format (False).
        log_file: Optional file path for log output.
        max_bytes: Max log file size before rotation (default 50MB).
        backup_count: Number of rotated backup files to keep (default 5).
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    root.handlers.clear()

    formatter: logging.Formatter = JSONFormatter() if structured else TextFormatter()

    if log_file:
        # File handler with rotation — skip console to avoid unbounded stderr growth
        # under launchd (which captures stderr without rotation).
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
    else:
        # Console handler for dev/interactive use
        console = logging.StreamHandler(sys.stderr)
        console.setFormatter(formatter)
        root.addHandler(console)
