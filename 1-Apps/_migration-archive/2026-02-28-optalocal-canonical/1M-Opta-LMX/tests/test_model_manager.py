"""Unit tests for ModelManager — download, inventory, and deletion."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from opta_lmx.inference.types import DownloadTask
from opta_lmx.manager.model import ModelManager



def _ample_disk_usage() -> tuple[int, int, int]:
    return (200 * 1024**3, 50 * 1024**3, 150 * 1024**3)


@pytest.fixture
def manager(tmp_path: Path) -> ModelManager:
    """ModelManager with a temp directory."""
    return ModelManager(models_directory=tmp_path)


# --- start_download ---


async def test_start_download_returns_download_id(manager: ModelManager) -> None:
    """start_download returns a DownloadTask with a unique ID."""
    with patch("opta_lmx.manager.model.shutil.disk_usage", return_value=_ample_disk_usage()), \
         patch.object(manager, "estimate_size", return_value=1000), \
         patch.object(manager, "_run_download", return_value=None):
        task = await manager.start_download("mlx-community/test-model")

    assert task.download_id
    assert len(task.download_id) >= 16
    assert task.repo_id == "mlx-community/test-model"
    assert task.status == "downloading"


async def test_start_download_estimates_size(manager: ModelManager) -> None:
    """start_download populates total_bytes from dry run estimate."""
    with patch("opta_lmx.manager.model.shutil.disk_usage", return_value=_ample_disk_usage()), \
         patch.object(manager, "estimate_size", return_value=5_000_000_000), \
         patch.object(manager, "_run_download", return_value=None):
        task = await manager.start_download("mlx-community/big-model")

    assert task.total_bytes == 5_000_000_000


async def test_download_progress_tracking(manager: ModelManager) -> None:
    """get_download_progress returns the task state."""
    with patch("opta_lmx.manager.model.shutil.disk_usage", return_value=_ample_disk_usage()), \
         patch.object(manager, "estimate_size", return_value=100), \
         patch.object(manager, "_run_download", return_value=None):
        task = await manager.start_download("mlx-community/test-model")

    progress = manager.get_download_progress(task.download_id)
    assert progress is not None
    assert progress.download_id == task.download_id
    assert progress.repo_id == "mlx-community/test-model"


async def test_download_progress_none_for_unknown(manager: ModelManager) -> None:
    """get_download_progress returns None for unknown IDs."""
    assert manager.get_download_progress("nonexistent") is None


async def test_download_failure_sets_error(manager: ModelManager) -> None:
    """A failed download sets status='failed' and captures the error message."""
    with patch("opta_lmx.manager.model.shutil.disk_usage", return_value=_ample_disk_usage()), \
         patch.object(manager, "estimate_size", return_value=0):
        async def failing_download(*args, **kwargs):
            task = manager._downloads[args[0]]
            task.status = "failed"
            task.error = "Network error"

        with patch.object(manager, "_run_download", side_effect=failing_download):
            task = await manager.start_download("mlx-community/broken")

    # Wait a tick for the task to complete
    await asyncio.sleep(0.01)

    progress = manager.get_download_progress(task.download_id)
    assert progress is not None
    assert progress.status == "failed"
    assert progress.error == "Network error"


# --- list_available ---


async def test_list_available_empty(manager: ModelManager) -> None:
    """list_available returns empty when no models cached."""
    mock_cache = MagicMock()
    mock_cache.repos = []

    with patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache):
        models = await manager.list_available()

    assert models == []


async def test_list_available_returns_cached_models(manager: ModelManager) -> None:
    """list_available returns model info from HF cache."""
    mock_revision = MagicMock()
    mock_revision.last_modified.timestamp.return_value = 1700000000.0
    mock_revision.files = ["config.json"]

    mock_repo = MagicMock()
    mock_repo.repo_id = "mlx-community/Mistral-7B-Instruct-4bit"
    mock_repo.repo_path = Path("/cache/models--mlx-community--Mistral-7B")
    mock_repo.size_on_disk = 4_000_000_000
    mock_repo.revisions = [mock_revision]

    mock_cache = MagicMock()
    mock_cache.repos = [mock_repo]

    with patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache):
        models = await manager.list_available()

    assert len(models) == 1
    assert models[0]["repo_id"] == "mlx-community/Mistral-7B-Instruct-4bit"
    assert models[0]["size_bytes"] == 4_000_000_000


# --- delete_model ---


async def test_delete_raises_for_missing_model(manager: ModelManager) -> None:
    """delete_model raises KeyError when model not in cache."""
    mock_cache = MagicMock()
    mock_cache.repos = []

    with (
        patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache),
        pytest.raises(KeyError, match="not found"),
    ):
        await manager.delete_model("nonexistent/model")


async def test_delete_model_returns_freed_bytes(manager: ModelManager) -> None:
    """delete_model calls cache deletion and returns bytes freed."""
    mock_revision = MagicMock()
    mock_revision.commit_hash = "abc123"

    mock_repo = MagicMock()
    mock_repo.repo_id = "mlx-community/Mistral-7B-Instruct-4bit"
    mock_repo.size_on_disk = 4_000_000_000
    mock_repo.revisions = [mock_revision]

    mock_delete_strategy = MagicMock()
    mock_delete_strategy.expected_freed_size = 4_000_000_000
    mock_delete_strategy.execute = MagicMock()

    mock_cache = MagicMock()
    mock_cache.repos = [mock_repo]
    mock_cache.delete_revisions = MagicMock(return_value=mock_delete_strategy)

    with patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache):
        freed = await manager.delete_model("mlx-community/Mistral-7B-Instruct-4bit")

    assert freed == 4_000_000_000
    mock_cache.delete_revisions.assert_called_once_with("abc123")
    mock_delete_strategy.execute.assert_called_once()


# --- cancel_active_downloads ---


async def test_cancel_active_downloads(manager: ModelManager) -> None:
    """cancel_active_downloads cancels running tasks."""
    # Create a fake download task with an asyncio.Task
    async def slow_download():
        await asyncio.sleep(100)

    task = DownloadTask(
        download_id="test123",
        repo_id="test/model",
    )
    task.task = asyncio.create_task(slow_download())
    manager._downloads["test123"] = task

    await manager.cancel_active_downloads()

    # Give event loop a tick to process cancellation
    await asyncio.sleep(0)
    assert task.task.cancelled()
