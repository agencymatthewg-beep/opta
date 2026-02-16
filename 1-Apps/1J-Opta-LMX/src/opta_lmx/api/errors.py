"""OpenAI-compatible error response helpers."""

from __future__ import annotations

import logging

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def openai_error(
    status_code: int,
    message: str,
    error_type: str,
    param: str | None = None,
    code: str | None = None,
) -> JSONResponse:
    """Return an OpenAI-format error response.

    Args:
        status_code: HTTP status code.
        message: Human-readable error message.
        error_type: Error type (e.g., 'invalid_request_error').
        param: Which parameter caused the error.
        code: Machine-readable error code.

    Returns:
        JSONResponse with OpenAI error format.
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": message,
                "type": error_type,
                "param": param,
                "code": code,
            }
        },
    )


def model_not_found(model_id: str) -> JSONResponse:
    """Model not found error."""
    return openai_error(
        status_code=404,
        message=f"The model '{model_id}' does not exist or is not loaded",
        error_type="invalid_request_error",
        param="model",
        code="model_not_found",
    )


def insufficient_memory(detail: str) -> JSONResponse:
    """Insufficient memory to load model."""
    return openai_error(
        status_code=507,
        message=detail,
        error_type="insufficient_memory",
        code="insufficient_memory",
    )


def internal_error(detail: str) -> JSONResponse:
    """Internal server error. Logs full detail but returns generic message to clients."""
    logger.error("internal_error", extra={"detail": detail})
    return openai_error(
        status_code=500,
        message="Internal server error",
        error_type="internal_server_error",
        code="internal_error",
    )


def model_in_use(model_id: str) -> JSONResponse:
    """Model is currently loaded and cannot be deleted."""
    return openai_error(
        status_code=409,
        message=f"Model '{model_id}' is currently loaded. Unload it before deleting.",
        error_type="conflict",
        param="model_id",
        code="model_in_use",
    )


def download_not_found(download_id: str) -> JSONResponse:
    """Download task not found."""
    return openai_error(
        status_code=404,
        message=f"Download '{download_id}' not found",
        error_type="invalid_request_error",
        param="download_id",
        code="download_not_found",
    )
