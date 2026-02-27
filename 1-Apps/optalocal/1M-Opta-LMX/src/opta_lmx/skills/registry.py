"""In-memory skill registry backed by YAML manifests."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

from opta_lmx.skills.loader import ManifestLoadError, ManifestLoadResult, SkillsManifestLoader
from opta_lmx.skills.manifest import SkillManifest

_VersionKey = tuple[int, int, int, int, tuple[tuple[int, int | str], ...]]


def _split_reference(reference: str) -> tuple[str | None, str, str | None]:
    """Parse a skill reference into (namespace, name, version)."""
    token = reference.strip()
    if not token:
        return None, "", None

    core = token
    version: str | None = None
    if "@" in token:
        maybe_core, maybe_version = token.rsplit("@", maxsplit=1)
        if maybe_core and maybe_version:
            core = maybe_core
            version = maybe_version

    namespace: str | None = None
    name = core
    if "/" in core:
        maybe_ns, maybe_name = core.split("/", maxsplit=1)
        if maybe_ns and maybe_name:
            namespace = maybe_ns
            name = maybe_name
    return namespace, name, version


def _prerelease_key(prerelease: str) -> tuple[tuple[int, int | str], ...]:
    parts: list[tuple[int, int | str]] = []
    for piece in prerelease.split("."):
        if piece.isdigit():
            parts.append((0, int(piece)))
        else:
            parts.append((1, piece))
    return tuple(parts)


def _version_key(version: str) -> _VersionKey:
    base_and_pre = version.split("+", maxsplit=1)[0]
    if "-" in base_and_pre:
        base, prerelease = base_and_pre.split("-", maxsplit=1)
    else:
        base = base_and_pre
        prerelease = ""
    major_str, minor_str, patch_str = base.split(".")
    major = int(major_str)
    minor = int(minor_str)
    patch = int(patch_str)
    prerelease_flag = 1 if not prerelease else 0
    return (
        major,
        minor,
        patch,
        prerelease_flag,
        _prerelease_key(prerelease),
    )


def _sort_key(manifest: SkillManifest) -> tuple[str, str, _VersionKey]:
    return (manifest.namespace, manifest.name, _version_key(manifest.version))


class SkillsRegistry:
    """Registry for validated skill manifests."""

    def __init__(self) -> None:
        self._manifests: dict[str, SkillManifest] = {}
        self._list_changed_at = datetime.now(tz=UTC)
        self._load_errors: tuple[ManifestLoadError, ...] = ()

    @property
    def list_changed_at(self) -> datetime:
        """UTC timestamp for the most recent list mutation."""
        return self._list_changed_at

    @property
    def load_errors(self) -> tuple[ManifestLoadError, ...]:
        """Most recent loader errors."""
        return self._load_errors

    def load(self, directories: Sequence[Path]) -> ManifestLoadResult:
        """Load manifests from directories, replacing current registry content."""
        result = SkillsManifestLoader(directories=list(directories)).load()
        self._load_errors = result.errors

        new_manifests = {manifest.reference: manifest for manifest in result.manifests}
        if new_manifests != self._manifests:
            self._manifests = new_manifests
            self._touch()

        return result

    def register(self, manifest: SkillManifest) -> None:
        """Register or replace a single manifest by namespaced reference."""
        existing = self._manifests.get(manifest.reference)
        if existing == manifest:
            return

        self._manifests[manifest.reference] = manifest
        self._touch()

    def register_from_data(self, manifest_data: Mapping[str, object]) -> SkillManifest:
        """Validate and register raw manifest data."""
        manifest = SkillManifest.model_validate(manifest_data)
        self.register(manifest)
        return manifest

    def list(self) -> list[SkillManifest]:
        """List all registered manifest versions sorted deterministically."""
        manifests = list(self._manifests.values())
        manifests.sort(key=_sort_key)
        return manifests

    def list_latest(self) -> Sequence[SkillManifest]:
        """List only the latest version per namespace/name pair."""
        latest: dict[str, SkillManifest] = {}
        for manifest in self._manifests.values():
            key = manifest.qualified_name
            existing = latest.get(key)
            if existing is None or _version_key(manifest.version) > _version_key(existing.version):
                latest[key] = manifest
        manifests = list(latest.values())
        manifests.sort(key=lambda item: (item.namespace, item.name))
        return manifests

    def get(self, name: str) -> SkillManifest | None:
        """Resolve one skill reference with namespace/version compatibility rules."""
        token = name.strip()
        if not token:
            return None
        exact = self._manifests.get(token)
        if exact is not None:
            return exact

        namespace, manifest_name, version = _split_reference(token)
        if not manifest_name:
            return None

        candidates = [
            manifest
            for manifest in self._manifests.values()
            if manifest.name == manifest_name
        ]
        if namespace is not None:
            candidates = [manifest for manifest in candidates if manifest.namespace == namespace]
        if version is not None:
            candidates = [manifest for manifest in candidates if manifest.version == version]

        if not candidates:
            return None
        if len(candidates) == 1:
            return candidates[0]

        if namespace is None:
            default_candidates = [m for m in candidates if m.namespace == "default"]
            if default_candidates:
                candidates = default_candidates

        return max(candidates, key=lambda manifest: _version_key(manifest.version))

    def _touch(self) -> None:
        self._list_changed_at = datetime.now(tz=UTC)
