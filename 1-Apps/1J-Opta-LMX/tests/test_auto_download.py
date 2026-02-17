"""Tests for Feature 4: Auto-Download on Load."""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from opta_lmx.manager.model import ModelManager

# ─── Unit Tests: is_model_available ──────────────────────────────────────────


async def test_is_model_available_local_file(tmp_path: Path) -> None:
    """is_model_available returns True for existing local file paths."""
    model_file = tmp_path / "model.gguf"
    model_file.touch()

    manager = ModelManager(models_directory=tmp_path)
    assert await manager.is_model_available(str(model_file)) is True


async def test_is_model_available_missing_file(tmp_path: Path) -> None:
    """is_model_available returns False for non-existent file paths."""
    manager = ModelManager(models_directory=tmp_path)
    with patch.object(manager, "list_available", new_callable=AsyncMock, return_value=[]):
        assert await manager.is_model_available("/nonexistent/model.gguf") is False


async def test_is_model_available_hf_cache(tmp_path: Path) -> None:
    """is_model_available returns True when model is in HF cache."""
    manager = ModelManager(models_directory=tmp_path)
    mock_available = [{
        "repo_id": "mlx-community/Qwen2.5-7B",
        "local_path": "/cache/q",
        "size_bytes": 100,
        "downloaded_at": 0.0,
    }]
    with patch.object(
        manager, "list_available", new_callable=AsyncMock, return_value=mock_available,
    ):
        assert await manager.is_model_available("mlx-community/Qwen2.5-7B") is True
        assert await manager.is_model_available("mlx-community/other-model") is False


# ─── Unit Tests: _human_size ─────────────────────────────────────────────────


def test_human_size() -> None:
    """_human_size converts bytes to human-readable strings."""
    from opta_lmx.api.admin import _human_size

    assert _human_size(0) == "unknown"
    assert _human_size(500) == "500.0 B"
    assert _human_size(1024) == "1.0 KB"
    assert _human_size(1024 * 1024 * 50) == "50.0 MB"
    assert _human_size(1024 * 1024 * 1024 * 37) == "37.0 GB"


# ─── API Tests: Two-Phase Download Flow ──────────────────────────────────────


async def test_load_available_model_returns_200(client: AsyncClient) -> None:
    """Loading a model that's on disk returns 200 (existing behavior)."""
    # mock_model_manager.is_model_available always returns True
    resp = await client.post(
        "/admin/models/load",
        json={"model_id": "test-model"},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_load_unavailable_model_returns_202_with_token(client: AsyncClient) -> None:
    """Loading a model not on disk returns 202 with confirmation token."""
    app = client._transport.app  # type: ignore[union-attr]

    # Make is_model_available return False for this model
    original = app.state.model_manager.is_model_available

    async def unavailable(model_id: str) -> bool:
        if model_id == "mlx-community/big-model":
            return False
        return await original(model_id)

    app.state.model_manager.is_model_available = unavailable  # type: ignore[assignment]

    # Mock _estimate_size to return a known value
    async def mock_estimate(*args, **kwargs) -> int:
        return 40_000_000_000  # ~37.3 GB

    app.state.model_manager.estimate_size = mock_estimate  # type: ignore[assignment]

    resp = await client.post(
        "/admin/models/load",
        json={"model_id": "mlx-community/big-model"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "download_required"
    assert data["model_id"] == "mlx-community/big-model"
    assert data["confirmation_token"].startswith("dl-")
    assert data["confirm_url"] == "/admin/models/load/confirm"
    assert data["estimated_size_human"] is not None
    assert data["message"] == "Model not found locally. Confirm download?"


async def test_confirm_valid_token_starts_download(client: AsyncClient) -> None:
    """Confirming with a valid token starts download."""
    app = client._transport.app  # type: ignore[union-attr]

    # Insert a pending download token
    token = "dl-testtoken123"
    app.state.pending_downloads[token] = {
        "model_id": "mlx-community/test-model",
        "estimated_bytes": 1000,
        "created_at": time.time(),
    }

    # Mock start_download to avoid real HF calls
    from opta_lmx.inference.types import DownloadTask

    mock_task = DownloadTask(
        download_id="dl-abc123",
        repo_id="mlx-community/test-model",
        status="downloading",
    )

    async def mock_start(*args, **kwargs) -> DownloadTask:
        return mock_task

    app.state.model_manager.start_download = mock_start  # type: ignore[assignment]

    resp = await client.post(
        "/admin/models/load/confirm",
        json={"confirmation_token": token},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "downloading"
    assert data["download_id"] == "dl-abc123"
    assert data["progress_url"] == "/admin/models/download/dl-abc123/progress"

    # Token should be consumed (removed from pending)
    assert token not in app.state.pending_downloads


async def test_confirm_invalid_token_returns_404(client: AsyncClient) -> None:
    """Confirming with an invalid/expired token returns 404."""
    resp = await client.post(
        "/admin/models/load/confirm",
        json={"confirmation_token": "dl-doesnotexist"},
    )
    assert resp.status_code == 404


async def test_confirm_expired_token_returns_404(client: AsyncClient) -> None:
    """Confirming with an expired token (>10 min) returns 404."""
    app = client._transport.app  # type: ignore[union-attr]

    token = "dl-expired123"
    app.state.pending_downloads[token] = {
        "model_id": "mlx-community/test-model",
        "estimated_bytes": 1000,
        "created_at": time.time() - 700,  # 11+ minutes ago
    }

    resp = await client.post(
        "/admin/models/load/confirm",
        json={"confirmation_token": token},
    )
    assert resp.status_code == 404
    assert "expired" in resp.json()["error"]["message"].lower()


async def test_auto_download_skips_confirmation(client: AsyncClient) -> None:
    """auto_download=True skips confirmation and starts download immediately."""
    app = client._transport.app  # type: ignore[union-attr]

    # Make model unavailable
    async def unavailable(model_id: str) -> bool:
        return False

    app.state.model_manager.is_model_available = unavailable  # type: ignore[assignment]

    # Mock estimate and download
    async def mock_estimate(*args, **kwargs) -> int:
        return 5_000_000_000

    app.state.model_manager.estimate_size = mock_estimate  # type: ignore[assignment]

    from opta_lmx.inference.types import DownloadTask

    mock_task = DownloadTask(
        download_id="dl-auto123",
        repo_id="mlx-community/auto-model",
        status="downloading",
    )

    async def mock_start(*args, **kwargs) -> DownloadTask:
        return mock_task

    app.state.model_manager.start_download = mock_start  # type: ignore[assignment]

    resp = await client.post(
        "/admin/models/load",
        json={"model_id": "mlx-community/auto-model", "auto_download": True},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "downloading"
    assert data["download_id"] == "dl-auto123"
    assert "auto-load" in data["message"].lower()


async def test_load_already_loaded_model_returns_200(client: AsyncClient) -> None:
    """Loading a model that's already loaded returns success immediately."""
    app = client._transport.app  # type: ignore[union-attr]

    # Pre-load the model
    await app.state.engine.load_model("already-loaded")

    resp = await client.post(
        "/admin/models/load",
        json={"model_id": "already-loaded"},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


async def test_confirm_requires_auth(client_with_auth: AsyncClient) -> None:
    """Confirm endpoint requires admin key when auth is configured."""
    resp = await client_with_auth.post(
        "/admin/models/load/confirm",
        json={"confirmation_token": "dl-test"},
    )
    assert resp.status_code == 403

    resp = await client_with_auth.post(
        "/admin/models/load/confirm",
        json={"confirmation_token": "dl-test"},
        headers={"X-Admin-Key": "test-secret-key"},
    )
    # 404 because token doesn't exist, but auth passed
    assert resp.status_code == 404
