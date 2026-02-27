"""Load skill manifests from YAML files."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from pydantic import ValidationError

from opta_lmx.skills.manifest import SkillManifest


@dataclass(frozen=True)
class ManifestLoadError:
    """Structured manifest loading error."""

    path: str
    message: str
    document_index: int | None = None


@dataclass(frozen=True)
class ManifestLoadResult:
    """Result payload for manifest loading."""

    manifests: tuple[SkillManifest, ...]
    errors: tuple[ManifestLoadError, ...]

    @property
    def loaded_count(self) -> int:
        """Number of valid manifests loaded."""
        return len(self.manifests)

    def error_messages(self) -> list[str]:
        """Render human-readable errors for logs/diagnostics."""
        return [error.message for error in self.errors]


class SkillsManifestLoader:
    """Read and validate YAML skill manifests from configured directories."""

    def __init__(self, directories: tuple[Path, ...] | list[Path]) -> None:
        self._directories = tuple(Path(path).expanduser() for path in directories)

    def load(self) -> ManifestLoadResult:
        """Load manifests from configured directories.

        Invalid YAML documents are skipped and captured in ``errors``.
        """
        manifests: list[SkillManifest] = []
        errors: list[ManifestLoadError] = []

        for path in self._iter_manifest_files():
            file_manifests, file_errors = self._load_file(path)
            manifests.extend(file_manifests)
            errors.extend(file_errors)

        return ManifestLoadResult(manifests=tuple(manifests), errors=tuple(errors))

    def _iter_manifest_files(self) -> list[Path]:
        files: list[Path] = []

        for directory in sorted(self._directories, key=lambda item: item.as_posix()):
            if directory.is_file() and directory.suffix in {".yaml", ".yml"}:
                files.append(directory)
                continue

            if not directory.exists() or not directory.is_dir():
                continue

            files.extend(
                sorted(
                    (
                        item
                        for item in directory.rglob("*")
                        if item.is_file() and item.suffix in {".yaml", ".yml"}
                    ),
                    key=lambda item: item.as_posix(),
                )
            )

        return files

    def _load_file(self, path: Path) -> tuple[list[SkillManifest], list[ManifestLoadError]]:
        manifests: list[SkillManifest] = []
        errors: list[ManifestLoadError] = []

        try:
            content = path.read_text()
        except OSError as exc:
            errors.append(
                ManifestLoadError(
                    path=str(path),
                    message=f"{path}: failed to read file: {exc}",
                )
            )
            return manifests, errors

        try:
            raw_docs = list(yaml.safe_load_all(content))
        except yaml.YAMLError as exc:
            errors.append(
                ManifestLoadError(
                    path=str(path),
                    message=f"{path}: invalid YAML: {exc}",
                )
            )
            return manifests, errors

        for index, raw_doc in enumerate(raw_docs, start=1):
            if raw_doc is None:
                continue

            manifest, error = self._parse_document(path=path, document_index=index, raw_doc=raw_doc)
            if manifest is not None:
                manifests.append(manifest)
            if error is not None:
                errors.append(error)

        return manifests, errors

    def _parse_document(
        self,
        *,
        path: Path,
        document_index: int,
        raw_doc: Any,
    ) -> tuple[SkillManifest | None, ManifestLoadError | None]:
        if not isinstance(raw_doc, dict):
            doc_type = type(raw_doc).__name__
            return None, ManifestLoadError(
                path=str(path),
                document_index=document_index,
                message=f"{path}: doc {document_index}: expected mapping but got {doc_type}",
            )

        try:
            manifest = SkillManifest.model_validate(raw_doc)
        except ValidationError as exc:
            return None, ManifestLoadError(
                path=str(path),
                document_index=document_index,
                message=f"{path}: doc {document_index}: {self._format_validation_error(exc)}",
            )

        return manifest, None

    @staticmethod
    def _format_validation_error(error: ValidationError) -> str:
        details: list[str] = []
        for issue in error.errors():
            location = ".".join(str(part) for part in issue["loc"])
            details.append(f"{location}: {issue['msg']}")
        return "; ".join(details)


def load_skill_manifests(directories: tuple[Path, ...] | list[Path]) -> ManifestLoadResult:
    """Convenience API for one-off manifest loading."""
    return SkillsManifestLoader(directories=directories).load()
