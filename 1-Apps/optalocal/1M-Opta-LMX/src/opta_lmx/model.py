"""Model manager — download, inventory, and delete models from HuggingFace Hub."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import shutil
import time
from pathlib import Path
from typing import Any, cast

from huggingface_hub import HfApi, scan_cache_dir, snapshot_download
from tqdm.auto import tqdm  # type: ignore[import-untyped]

from opta_lmx.inference.types import DownloadTask
from opta_lmx.monitoring.events import EventBus, ServerEvent

logger = logging.getLogger(__name__)

_CACHE_SCAN_TTL_SEC = 10.0
_DOWNLOAD_RETENTION_SEC = 15 * 60
_MIN_FREE_DISK_BYTES = 5 * (1024**3)

_DownloadKey = tuple[str, str | None, tuple[str, ...], tuple[str, ...]]


class _DownloadProgressTracker(tqdm):  # type: ignore[misc]
    """Custom tqdm subclass that writes progress to a DownloadTask.

    Passed to snapshot_download via tqdm_class so we capture
    real-time byte and file progress without patching internals.
    """

    _download_task: DownloadTask | None = None
    _default_download_task: DownloadTask | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # Store and remove our custom kwarg before passing to tqdm
        self._download_task = kwargs.pop("download_task", None)
        if self._download_task is None:
            self._download_task = getattr(self.__class__, "_default_download_task", None)
        super().__init__(*args, **kwargs)

    def update(self, n: int = 1) -> bool | None:
        result = cast(bool | None, super().update(n))
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
        self._download_keys: dict[_DownloadKey, str] = {}
        self._event_bus = event_bus
        self._available_cache: list[dict[str, Any]] | None = None
        self._available_cache_at: float = 0.0

    def _cache_dir(self) -> Path:
        """Return the HuggingFace cache directory used for model artifacts."""
        if self._models_directory is not None:
            return Path(self._models_directory).expanduser()
        return Path.home() / ".cache" / "huggingface" / "hub"

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
        self._prune_downloads()
        download_key = self._download_key(
            repo_id=repo_id,
            revision=revision,
            allow_patterns=allow_patterns,
            ignore_patterns=ignore_patterns,
        )
        existing_download_id = self._download_keys.get(download_key)
        if existing_download_id is not None:
            existing = self._downloads.get(existing_download_id)
            if (
                existing is not None
                and existing.status == "downloading"
                and existing.task is not None
                and not existing.task.done()
            ):
                logger.info(
                    "download_reused",
                    extra={
                        "download_id": existing.download_id,
                        "repo_id": repo_id,
                    },
                )
                return existing
            self._download_keys.pop(download_key, None)

        download_id = secrets.token_urlsafe(16)

        # Check disk space floor before any remote size-estimation calls.
        estimated_size = 0
        try:
            cache_dir = self._cache_dir()
            disk = shutil.disk_usage(cache_dir if cache_dir.exists() else Path.home())
            if disk.free < _MIN_FREE_DISK_BYTES:
                raise OSError(
                    f"Insufficient disk space: {disk.free / (1024**3):.1f} GB free, "
                    f"need at least {_MIN_FREE_DISK_BYTES / (1024**3):.1f} GB free before download"
                )
        except OSError:
            raise
        except Exception as e:
            logger.warning("disk_space_check_failed", extra={"error": str(e)})

        # Estimate size with a dry run (after passing minimum free-space floor).
        estimated_size = await self.estimate_size(
            repo_id, revision, allow_patterns, ignore_patterns
        )

        # If known, enforce estimated requirement with margin.
        try:
            if estimated_size > 0:
                cache_dir = self._cache_dir()
                disk = shutil.disk_usage(cache_dir if cache_dir.exists() else Path.home())
                required = int(estimated_size * 1.1)
                if disk.free < required:
                    raise OSError(
                        f"Insufficient disk space: {disk.free / (1024**3):.1f} GB free, "
                        f"need ~{required / (1024**3):.1f} GB for {repo_id}"
                    )
        except OSError:
            raise
        except Exception as e:
            logger.warning("disk_space_check_failed", extra={"error": str(e)})

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
        download_handle = asyncio.create_task(
            self._run_download(
                download_id, repo_id, revision, allow_patterns, ignore_patterns
            )
        )
        task.task = download_handle

        def _on_done(_completed: asyncio.Task[None]) -> None:
            self._on_download_task_done(download_id=download_id, download_key=download_key)

        download_handle.add_done_callback(_on_done)
        self._download_keys[download_key] = download_id

        logger.info(
            "download_started",
            extra={
                "download_id": download_id,
                "repo_id": repo_id,
                "estimated_bytes": estimated_size,
            },
        )

        return task

    async def estimate_size(
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

                    if allow_patterns and not any(
                        fnmatch.fnmatch(filename, p) for p in allow_patterns
                    ):
                        continue
                    if ignore_patterns and any(
                        fnmatch.fnmatch(filename, p) for p in ignore_patterns
                    ):
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
            # tqdm_class must be a class (not a function), otherwise HF internals
            # can break on class-level lock access ("...get_lock" errors).
            progress_tracker_cls = type(
                f"_DownloadProgressTracker_{download_id}",
                (_DownloadProgressTracker,),
                {"_default_download_task": task},
            )

            local_path: str = await asyncio.to_thread(
                snapshot_download,  # type: ignore[arg-type]
                repo_id=repo_id,
                revision=revision,
                allow_patterns=allow_patterns,
                ignore_patterns=ignore_patterns,
                token=self._hf_token,
                tqdm_class=progress_tracker_cls,
                cache_dir=self._cache_dir(),
            )

            task.status = "completed"
            task.local_path = local_path
            task.progress_percent = 100.0
            task.completed_at = time.time()
            self._invalidate_available_cache()

            # Count downloaded files for the final state
            if local_path:

                def _count_files(p: str) -> int:
                    return sum(1 for f in Path(p).rglob("*") if f.is_file())

                file_count = await asyncio.to_thread(_count_files, local_path)
                task.files_completed = file_count
                task.files_total = file_count

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
        except asyncio.CancelledError:
            task.status = "failed"
            task.error = "cancelled"
            task.completed_at = time.time()
            logger.info(
                "download_cancelled",
                extra={
                    "download_id": download_id,
                    "repo_id": repo_id,
                },
            )
            raise
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
        self._prune_downloads()
        return self._downloads.get(download_id)

    async def is_model_available(self, model_id: str) -> bool:
        """Check if a model exists in HF cache or as a local file.

        Args:
            model_id: HuggingFace repo ID or local file path.

        Returns:
            True if the model is available on disk.
        """
        # Check local file path (e.g. for GGUF files)
        if await asyncio.to_thread(Path(model_id).exists):
            return True
        # Check HF cache
        available = await self.list_available()
        return any(m["repo_id"] == model_id for m in available)

    async def is_local_snapshot_complete(
        self,
        model_id: str,
        revision: str | None = None,
    ) -> bool:
        """Return True when an HF repo can be resolved strictly from local cache.

        Uses `snapshot_download(..., local_files_only=True)` as a precise guard to
        catch partially-downloaded repos that appear in cache scans but still miss
        required files at load time.
        """
        if await asyncio.to_thread(Path(model_id).exists):
            return True

        try:
            snapshot_path = await asyncio.to_thread(
                snapshot_download,
                repo_id=model_id,
                revision=revision,
                token=self._hf_token,
                local_files_only=True,
                cache_dir=self._cache_dir(),
            )
            is_complete, reason = await asyncio.to_thread(
                self._validate_snapshot_files,
                Path(str(snapshot_path)),
            )
            if not is_complete:
                logger.info(
                    "local_snapshot_incomplete",
                    extra={"repo_id": model_id, "reason": reason},
                )
            return is_complete
        except Exception as e:
            logger.info(
                "local_snapshot_incomplete",
                extra={"repo_id": model_id, "error": str(e)},
            )
            return False

    async def list_available(self) -> list[dict[str, Any]]:
        """List all models available on disk via HF cache.

        Returns:
            List of dicts with repo_id, local_path, size_bytes, last_modified.
        """
        now = time.monotonic()
        if (
            self._available_cache is not None
            and (now - self._available_cache_at) <= _CACHE_SCAN_TTL_SEC
        ):
            return list(self._available_cache)

        try:
            cache_info = await asyncio.to_thread(
                scan_cache_dir,
                cache_dir=self._cache_dir(),
            )
        except Exception as e:
            logger.warning("cache_scan_failed", extra={"error": str(e)})
            return []

        models: list[dict[str, Any]] = []
        for repo in cache_info.repos:
            if repo.size_on_disk <= 0:
                continue

            latest_revision = self._latest_complete_revision(repo)
            if latest_revision is None:
                logger.debug("cache_repo_skipped_incomplete", extra={"repo_id": repo.repo_id})
                continue

            local_path = self._resolve_repo_local_path(repo, latest_revision)
            models.append({
                "repo_id": repo.repo_id,
                "local_path": local_path,
                "size_bytes": repo.size_on_disk,
                "downloaded_at": (
                    float(latest_revision.last_modified.timestamp())
                    if latest_revision and hasattr(latest_revision.last_modified, "timestamp")
                    else float(latest_revision.last_modified)
                    if latest_revision and isinstance(latest_revision.last_modified, (float, int))
                    else 0.0
                ),
            })

        self._available_cache = list(models)
        self._available_cache_at = time.monotonic()
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
            cache_info = await asyncio.to_thread(
                scan_cache_dir,
                cache_dir=self._cache_dir(),
            )
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
        self._invalidate_available_cache()

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
        active_tasks: list[asyncio.Task[None]] = []
        for download_id, task in self._downloads.items():
            if task.task and not task.task.done():
                task.task.cancel()
                if task.status == "downloading":
                    task.status = "failed"
                    task.error = "cancelled"
                    task.completed_at = time.time()
                logger.info("download_cancelled", extra={"download_id": download_id})
                active_tasks.append(task.task)
        if active_tasks:
            await asyncio.gather(*active_tasks, return_exceptions=True)
        self._prune_downloads()

    def _invalidate_available_cache(self) -> None:
        """Invalidate short-lived model inventory cache."""
        self._available_cache = None
        self._available_cache_at = 0.0

    @staticmethod
    def _revision_file_count(revision: Any) -> int:
        files = getattr(revision, "files", None)
        if files is None:
            return 0
        try:
            return len(files)
        except TypeError:
            return 0

    @classmethod
    def _latest_complete_revision(cls, repo: Any) -> Any | None:
        latest_revision: Any | None = None
        for rev in getattr(repo, "revisions", []):
            if cls._revision_file_count(rev) <= 0:
                continue
            if latest_revision is None or rev.last_modified > latest_revision.last_modified:
                latest_revision = rev
        return latest_revision

    @staticmethod
    def _revision_snapshot_path(revision: Any) -> Path | None:
        raw_path = getattr(revision, "snapshot_path", None)
        if raw_path is None:
            return None
        try:
            path = Path(raw_path)
        except Exception:
            return None
        if not path.exists():
            return None
        return path

    @classmethod
    def _resolve_repo_local_path(cls, repo: Any, revision: Any) -> str:
        snapshot = cls._revision_snapshot_path(revision)
        if snapshot is not None:
            return str(snapshot)
        return str(getattr(repo, "repo_path", ""))

    @staticmethod
    def _validate_snapshot_files(snapshot_path: Path) -> tuple[bool, str | None]:
        """Validate that snapshot files required by the safetensors index exist."""
        if not snapshot_path.exists():
            return False, "snapshot_path_missing"

        index_path = snapshot_path / "model.safetensors.index.json"
        if not index_path.exists():
            return True, None

        try:
            payload = json.loads(index_path.read_text())
        except Exception as e:
            return False, f"index_parse_failed:{e}"

        weight_map = payload.get("weight_map")
        if not isinstance(weight_map, dict):
            return True, None

        missing_files = sorted({
            filename
            for filename in weight_map.values()
            if isinstance(filename, str) and not (snapshot_path / filename).exists()
        })
        if missing_files:
            preview = ",".join(missing_files[:5])
            return False, f"missing_weight_files:{len(missing_files)}:{preview}"
        return True, None

    @staticmethod
    def _download_key(
        *,
        repo_id: str,
        revision: str | None,
        allow_patterns: list[str] | None,
        ignore_patterns: list[str] | None,
    ) -> _DownloadKey:
        allow = tuple(sorted(allow_patterns or []))
        ignore = tuple(sorted(ignore_patterns or []))
        return (repo_id, revision, allow, ignore)

    def _on_download_task_done(
        self,
        *,
        download_id: str,
        download_key: _DownloadKey,
    ) -> None:
        tracked_id = self._download_keys.get(download_key)
        if tracked_id == download_id:
            self._download_keys.pop(download_key, None)
        self._prune_downloads()

    def _prune_downloads(self) -> None:
        now = time.time()
        stale_ids: list[str] = []
        for download_id, download_task in self._downloads.items():
            if download_task.status == "downloading":
                continue
            completed_at = download_task.completed_at or download_task.started_at
            if completed_at and (now - completed_at) > _DOWNLOAD_RETENTION_SEC:
                stale_ids.append(download_id)

        for download_id in stale_ids:
            self._downloads.pop(download_id, None)

        for key, download_id in list(self._download_keys.items()):
            tracked_task = self._downloads.get(download_id)
            if (
                tracked_task is None
                or tracked_task.status != "downloading"
                or tracked_task.task is None
                or tracked_task.task.done()
            ):
                self._download_keys.pop(key, None)
