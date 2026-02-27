"""Structured logging setup for Opta-LMX using structlog.

Integrates structlog with stdlib ``logging`` so that all existing
``logger = logging.getLogger(__name__)`` calls throughout the codebase
continue to work unchanged while benefiting from structured processing,
sensitive-key redaction, and configurable renderers.
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

import structlog

# Substrings whose presence in a key name triggers redaction (C01/C02 guardrail).
_SENSITIVE_SUBSTRINGS: tuple[str, ...] = (
    "key", "token", "secret", "password", "credential", "auth",
)


def _filter_sensitive_keys(
    logger: structlog.types.WrappedLogger,
    method_name: str,
    event_dict: structlog.types.EventDict,
) -> structlog.types.EventDict:
    """Redact sensitive keys from log output using substring matching."""
    for event_key in list(event_dict):
        lower = event_key.lower()
        if any(s in lower for s in _SENSITIVE_SUBSTRINGS):
            event_dict[event_key] = "***REDACTED***"
    return event_dict


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
        structured: Use JSON renderer (True) or console renderer (False).
        log_file: Optional file path for log output.
        max_bytes: Max log file size before rotation (default 50MB).
        backup_count: Number of rotated backup files to keep (default 5).
    """
    # ── Shared processing steps (used by both structlog and stdlib paths) ─
    pre_chain: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.ExtraAdder(),
        _filter_sensitive_keys,
    ]

    # ── structlog pipeline (for structlog.get_logger() callers) ───────
    structlog.configure(
        processors=[
            *pre_chain,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # ── Choose renderer based on mode ─────────────────────────────────
    # foreign_pre_chain processes stdlib LogRecords that did NOT originate
    # from structlog (i.e. regular logging.getLogger(__name__) calls).
    if structured:
        formatter = structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=pre_chain,
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.processors.JSONRenderer(),
            ],
        )
    else:
        formatter = structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=pre_chain,
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.dev.ConsoleRenderer(),
            ],
        )

    # ── Configure stdlib root logger ──────────────────────────────────
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers to avoid duplicates on re-init
    root.handlers.clear()

    if log_file:
        # File handler with rotation — skip console to avoid unbounded
        # stderr growth under launchd (which captures stderr without rotation).
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
