"""Model manager — download, inventory, and delete models from HuggingFace Hub."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Any

from huggingface_hub import HfApi, scan_cache_dir, snapshot_download
from huggingface_hub.utils import HfHubHTTPError
from tqdm.auto import tqdm

from opta_lmx.inference.types import DownloadTask
from opta_lmx.monitoring.events import EventBus, ServerEvent

logger = logging.getLogger(__name__)


class _DownloadProgressTracker(tqdm):  # type: ignore[type-arg]
    """Custom tqdm subclass that writes progress to a DownloadTask.

    Passed to snapshot_download via tqdm_class so we capture
    real-time byte and file progress without patching internals.
    """

    _download_task: DownloadTask | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # Store and remove our custom kwarg before passing to tqdm
        self._download_task = kwargs.pop("download_task", None)
        super().__init__(*args, **kwargs)

    def update(self, n: int = 1) -> bool | None:  # type: ignore[override]
        result = super().update(n)
        if self._download_task is not None and self.total:
            self._download_task.downloaded_bytes = int(self.n)
            self._download_task.total_bytes = int(self.total)
            self._download_task.progress_percent = round(
                (self.n / self.total) * 100, 1
            )
        return result


class ModelManager:
    """Manages model downloads, disk inventory, and deletion.

    Uses HuggingFace Hub's cache directory as primary storage so
    vllm-mlx can resolve model IDs from the cache naturally.
    """

    def __init__(
        self,
        models_directory: Path | None = None,
        hf_token: str | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self._hf_api = HfApi(token=hf_token)
        self._hf_token = hf_token
        self._models_directory = models_directory
        self._downloads: dict[str, DownloadTask] = {}
        self._event_bus = event_bus

    async def start_download(
        self,
        repo_id: str,
        revision: str | None = None,
        allow_patterns: list[str] | None = None,
        ignore_patterns: list[str] | None = None,
    ) -> DownloadTask:
        """Start an async background download from HuggingFace Hub.

        Args:
            repo_id: HuggingFace repo ID.
            revision: Git revision (branch, tag, commit).
            allow_patterns: Only download matching files.
            ignore_patterns: Skip matching files.

        Returns:
            DownloadTask with download_id for progress tracking.
        """
        download_id = uuid.uuid4().hex[:12]

        # Estimate size with a dry run
        estimated_size = await self._estimate_size(
            repo_id, revision, allow_patterns, ignore_patterns
        )

        task = DownloadTask(
            download_id=download_id,
            repo_id=repo_id,
            revision=revision,
            status="downloading",
            total_bytes=estimated_size,
            started_at=time.time(),
        )
        self._downloads[download_id] = task

        # Spawn background download
        task.task = asyncio.create_task(
            self._run_download(
                download_id, repo_id, revision, allow_patterns, ignore_patterns
            )
        )

        logger.info(
            "download_started",
            extra={
                "download_id": download_id,
                "repo_id": repo_id,
                "estimated_bytes": estimated_size,
            },
        )

        return task

    async def _estimate_size(
        self,
        repo_id: str,
        revision: str | None,
        allow_patterns: list[str] | None,
        ignore_patterns: list[str] | None,
    ) -> int:
        """Estimate download size by querying repo info.

        Returns:
            Estimated size in bytes, or 0 if unknown.
        """
        try:
            info = await asyncio.to_thread(
                self._hf_api.repo_info, repo_id=repo_id, revision=revision
            )
            if info.siblings:
                import fnmatch

                total = 0
                for sibling in info.siblings:
                    filename = sibling.rfilename
                    size = sibling.size or 0

                    if allow_patterns:
                        if not any(fnmatch.fnmatch(filename, p) for p in allow_patterns):
                            continue
                    if ignore_patterns:
                        if any(fnmatch.fnmatch(filename, p) for p in ignore_patterns):
                            continue

                    total += size
                return total
        except Exception as e:
            logger.warning("size_estimate_failed", extra={"repo_id": repo_id, "error": str(e)})
        return 0

    async def _run_download(
        self,
        download_id: str,
        repo_id: str,
        revision: str | None,
        allow_patterns: list[str] | None,
        ignore_patterns: list[str] | None,
    ) -> None:
        """Run the actual download in a background thread."""
        task = self._downloads[download_id]

        try:
            # Create a tqdm class factory that injects our download task
            def make_progress_tracker(*args: Any, **kwargs: Any) -> _DownloadProgressTracker:
                kwargs["download_task"] = task
                return _DownloadProgressTracker(*args, **kwargs)

            local_path: str = await asyncio.to_thread(
                snapshot_download,
                repo_id=repo_id,
                revision=revision,
                allow_patterns=allow_patterns,
                ignore_patterns=ignore_patterns,
                token=self._hf_token,
                tqdm_class=make_progress_tracker,
            )

            task.status = "completed"
            task.local_path = local_path
            task.progress_percent = 100.0
            task.completed_at = time.time()

            # Count downloaded files for the final state
            if local_path:
                path = Path(local_path)
                task.files_completed = sum(1 for f in path.rglob("*") if f.is_file())
                task.files_total = task.files_completed

            logger.info(
                "download_completed",
                extra={
                    "download_id": download_id,
                    "repo_id": repo_id,
                    "local_path": local_path,
                    "duration_sec": round(time.time() - task.started_at, 1),
                },
            )

            if self._event_bus:
                await self._event_bus.publish(ServerEvent(
                    event_type="download_completed",
                    data={
                        "download_id": download_id,
                        "repo_id": repo_id,
                        "local_path": local_path,
                        "duration_sec": round(time.time() - task.started_at, 1),
                    },
                ))
        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            task.completed_at = time.time()

            logger.error(
                "download_failed",
                extra={
                    "download_id": download_id,
                    "repo_id": repo_id,
                    "error": str(e),
                },
            )

            if self._event_bus:
                await self._event_bus.publish(ServerEvent(
                    event_type="download_failed",
                    data={
                        "download_id": download_id,
                        "repo_id": repo_id,
                        "error": str(e),
                    },
                ))

    def get_download_progress(self, download_id: str) -> DownloadTask | None:
        """Get the current state of a download.

        Args:
            download_id: ID returned from start_download.

        Returns:
            DownloadTask or None if not found.
        """
        return self._downloads.get(download_id)

    async def is_model_available(self, model_id: str) -> bool:
        """Check if a model exists in HF cache or as a local file.

        Args:
            model_id: HuggingFace repo ID or local file path.

        Returns:
            True if the model is available on disk.
        """
        # Check local file path (e.g. for GGUF files)
        if Path(model_id).exists():
            return True
        # Check HF cache
        available = await self.list_available()
        return any(m["repo_id"] == model_id for m in available)

    async def list_available(self) -> list[dict[str, Any]]:
        """List all models available on disk via HF cache.

        Returns:
            List of dicts with repo_id, local_path, size_bytes, last_modified.
        """
        try:
            cache_info = await asyncio.to_thread(scan_cache_dir)
        except Exception as e:
            logger.warning("cache_scan_failed", extra={"error": str(e)})
            return []

        models: list[dict[str, Any]] = []
        for repo in cache_info.repos:
            # Each repo may have multiple revisions; report the latest
            latest_revision = None
            for rev in repo.revisions:
                if latest_revision is None or rev.last_modified > latest_revision.last_modified:
                    latest_revision = rev

            models.append({
                "repo_id": repo.repo_id,
                "local_path": str(repo.repo_path),
                "size_bytes": repo.size_on_disk,
                "downloaded_at": latest_revision.last_modified.timestamp() if latest_revision else 0.0,
            })

        return models

    async def delete_model(self, repo_id: str) -> int:
        """Delete a model from the HF cache.

        Args:
            repo_id: HuggingFace repo ID to delete.

        Returns:
            Bytes freed.

        Raises:
            KeyError: If model not found on disk.
        """
        try:
            cache_info = await asyncio.to_thread(scan_cache_dir)
        except Exception as e:
            raise RuntimeError(f"Failed to scan cache: {e}") from e

        # Find the repo in cache
        target_repo = None
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                target_repo = repo
                break

        if target_repo is None:
            raise KeyError(f"Model '{repo_id}' not found in HuggingFace cache")

        # Collect all revision commit hashes for deletion
        revision_hashes = [rev.commit_hash for rev in target_repo.revisions]
        if not revision_hashes:
            raise KeyError(f"Model '{repo_id}' has no revisions to delete")

        size_before = target_repo.size_on_disk

        # Use HF Hub's cache deletion strategy
        delete_strategy = cache_info.delete_revisions(*revision_hashes)

        logger.info(
            "model_deleting",
            extra={
                "repo_id": repo_id,
                "revisions": len(revision_hashes),
                "expected_freed_bytes": delete_strategy.expected_freed_size,
            },
        )

        await asyncio.to_thread(delete_strategy.execute)

        logger.info(
            "model_deleted",
            extra={
                "repo_id": repo_id,
                "freed_bytes": size_before,
            },
        )

        return size_before

    async def cancel_active_downloads(self) -> None:
        """Cancel all active download tasks. Called on shutdown."""
        for download_id, task in self._downloads.items():
            if task.task and not task.task.done():
                task.task.cancel()
                logger.info("download_cancelled", extra={"download_id": download_id})
