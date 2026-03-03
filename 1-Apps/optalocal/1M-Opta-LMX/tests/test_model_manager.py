"""Unit tests for ModelManager — download, inventory, and deletion."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from opta_lmx.inference.types import DownloadTask
from opta_lmx.manager.model import ModelManager


@pytest.fixture
def manager(tmp_path: Path) -> ModelManager:
    """ModelManager with a temp directory."""
    return ModelManager(models_directory=tmp_path)


# --- start_download ---


async def test_start_download_returns_download_id(manager: ModelManager) -> None:
    """start_download returns a DownloadTask with a unique ID."""
    with (
        patch.object(manager, "estimate_size", return_value=1000),
        patch.object(manager, "_run_download", return_value=None),
    ):
        task = await manager.start_download("mlx-community/test-model")

    assert task.download_id
    assert len(task.download_id) >= 16
    assert task.repo_id == "mlx-community/test-model"
    assert task.status == "downloading"


async def test_start_download_estimates_size(manager: ModelManager) -> None:
    """start_download populates total_bytes from dry run estimate."""
    with (
        patch.object(manager, "estimate_size", return_value=5_000_000_000),
        patch.object(manager, "_run_download", return_value=None),
    ):
        task = await manager.start_download("mlx-community/big-model")

    assert task.total_bytes == 5_000_000_000


async def test_start_download_rejects_when_disk_space_insufficient(manager: ModelManager) -> None:
    """start_download raises OSError when free disk is below required threshold."""
    with (
        patch.object(manager, "estimate_size", return_value=1000),
        patch("opta_lmx.manager.model.shutil.disk_usage", return_value=SimpleNamespace(free=100)),
        pytest.raises(OSError, match="Insufficient disk space"),
    ):
        await manager.start_download("mlx-community/too-big")


async def test_download_progress_tracking(manager: ModelManager) -> None:
    """get_download_progress returns the task state."""
    with (
        patch.object(manager, "estimate_size", return_value=100),
        patch.object(manager, "_run_download", return_value=None),
    ):
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
    with patch.object(manager, "estimate_size", return_value=0):

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


async def test_list_available_scans_configured_cache_dir(tmp_path: Path) -> None:
    """list_available scans the manager's configured cache directory."""
    manager = ModelManager(models_directory=tmp_path / "hf-cache")
    mock_cache = MagicMock()
    mock_cache.repos = []

    with patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache) as scan:
        await manager.list_available()

    assert scan.call_count == 1
    assert scan.call_args.kwargs["cache_dir"] == tmp_path / "hf-cache"


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


async def test_delete_scans_configured_cache_dir(tmp_path: Path) -> None:
    """delete_model scans configured cache dir before delete strategy."""
    manager = ModelManager(models_directory=tmp_path / "hf-cache")
    mock_cache = MagicMock()
    mock_cache.repos = []

    with (
        patch("opta_lmx.manager.model.scan_cache_dir", return_value=mock_cache) as scan,
        pytest.raises(KeyError),
    ):
        await manager.delete_model("nonexistent/model")

    assert scan.call_count == 1
    assert scan.call_args.kwargs["cache_dir"] == tmp_path / "hf-cache"


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


# --- cancellation + event bus isolation ---


async def test_run_download_marks_task_cancelled_on_cancelled_error(manager: ModelManager) -> None:
    """_run_download transitions task to cancelled when cancellation is raised."""
    task = DownloadTask(download_id="dl-cancel", repo_id="mlx-community/test")
    manager._downloads[task.download_id] = task

    with (
        patch("opta_lmx.manager.model.asyncio.to_thread", side_effect=asyncio.CancelledError),
        pytest.raises(asyncio.CancelledError),
    ):
        await manager._run_download(task.download_id, task.repo_id, None, None, None)

    state = manager.get_download_progress(task.download_id)
    assert state is not None
    assert state.status == "cancelled"
    assert state.error_code == "download_cancelled"


async def test_run_download_stays_completed_when_event_publish_fails(tmp_path: Path) -> None:
    """Event-bus failures should not convert completed downloads into failed state."""
    manager = ModelManager(models_directory=tmp_path)
    manager._event_bus = MagicMock()
    manager._event_bus.publish = MagicMock(side_effect=RuntimeError("event bus down"))

    output = tmp_path / "hf-cache" / "models--mlx--repo"
    output.mkdir(parents=True)
    (output / "weights.bin").write_bytes(b"x" * 8)

    task = DownloadTask(download_id="dl-ok", repo_id="mlx-community/repo", started_at=1.0)
    manager._downloads[task.download_id] = task

    with patch("opta_lmx.manager.model.snapshot_download", return_value=str(output)):
        await manager._run_download(task.download_id, task.repo_id, None, None, None)

    state = manager.get_download_progress(task.download_id)
    assert state is not None
    assert state.status == "completed"
    assert state.local_path == str(output)


async def test_has_active_download_detects_in_progress(manager: ModelManager) -> None:
    """has_active_download returns True only for active downloading repo IDs."""
    active = DownloadTask(download_id="dl-1", repo_id="mlx-community/test", status="downloading")
    done = DownloadTask(download_id="dl-2", repo_id="mlx-community/test", status="completed")
    other = DownloadTask(download_id="dl-3", repo_id="mlx-community/other", status="downloading")
    manager._downloads = {
        active.download_id: active,
        done.download_id: done,
        other.download_id: other,
    }

    assert manager.has_active_download("mlx-community/test") is True
    assert manager.has_active_download("mlx-community/other") is True
    assert manager.has_active_download("mlx-community/missing") is False
