"""Policy checks for skill execution."""

from __future__ import annotations

from dataclasses import dataclass

from opta_lmx.skills.manifest import PermissionTag, SkillManifest


@dataclass(frozen=True)
class PolicyDecision:
    """Outcome from evaluating a manifest against runtime policy."""

    allowed: bool
    requires_approval: bool
    reason: str | None = None


class SkillsPolicy:
    """Gate skill execution using permission/risk tags."""

    def __init__(
        self,
        *,
        approval_required_tags: set[str] | frozenset[str] | None = None,
        allow_shell_exec: bool = True,
    ) -> None:
        self._approval_required_tags = frozenset(approval_required_tags or set())
        self._allow_shell_exec = allow_shell_exec

    def evaluate(self, manifest: SkillManifest, *, approved: bool = False) -> PolicyDecision:
        """Evaluate whether a manifest can run under policy."""
        if not self._allow_shell_exec and PermissionTag.SHELL_EXEC in manifest.permission_tags:
            return PolicyDecision(
                allowed=False,
                requires_approval=False,
                reason="shell-exec permission is disallowed by policy",
            )

        matched_tags = sorted(manifest.all_tags() & self._approval_required_tags)
        if matched_tags and not approved:
            return PolicyDecision(
                allowed=False,
                requires_approval=True,
                reason=f"approval required for tags: {', '.join(matched_tags)}",
            )

        return PolicyDecision(
            allowed=True,
            requires_approval=bool(matched_tags),
            reason=None,
        )
