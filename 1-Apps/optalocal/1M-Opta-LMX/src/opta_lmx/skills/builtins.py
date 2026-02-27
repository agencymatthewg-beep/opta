"""Builtin skills shipped with Opta-LMX."""

from __future__ import annotations

from collections.abc import Sequence

from opta_lmx.skills.manifest import SkillKind, SkillManifest


def echo(**kwargs: object) -> dict[str, object]:
    """Return all provided arguments."""
    return {"echo": kwargs}


def add(**kwargs: object) -> dict[str, float]:
    """Add numeric ``left`` and ``right`` arguments."""
    left_raw = kwargs.get("left", 0)
    right_raw = kwargs.get("right", 0)

    left = left_raw if isinstance(left_raw, (int, float)) else 0
    right = right_raw if isinstance(right_raw, (int, float)) else 0
    return {"sum": float(left + right)}


def selected_builtin_manifests(enabled_skills: Sequence[str] | None) -> list[SkillManifest]:
    """Return builtin manifests filtered by configured names."""
    available: dict[str, SkillManifest] = {
        "echo": SkillManifest(
            name="echo",
            description="Echo back all provided arguments.",
            kind=SkillKind.ENTRYPOINT,
            entrypoint="opta_lmx.skills.builtins:echo",
            timeout_sec=10.0,
        ),
        "add": SkillManifest(
            name="add",
            description="Add two numeric values.",
            kind=SkillKind.ENTRYPOINT,
            entrypoint="opta_lmx.skills.builtins:add",
            timeout_sec=10.0,
        ),
    }

    names = list(enabled_skills) if enabled_skills is not None else list(available)
    return [manifest for name, manifest in available.items() if name in names]
