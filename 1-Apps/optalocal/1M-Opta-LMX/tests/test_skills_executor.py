"""Tests for skills policy and executor behavior."""

from __future__ import annotations

from pathlib import Path

from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.manifest import SkillManifest
from opta_lmx.skills.policy import SkillsPolicy


def _manifest(data: dict[str, object]) -> SkillManifest:
    return SkillManifest.model_validate(data)


def test_prompt_execution_renders_template() -> None:
    executor = SkillExecutor()
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "render_prompt",
        "kind": "prompt",
        "description": "Render prompt",
        "prompt_template": "Hello {name}",
    })

    result = executor.execute(manifest, arguments={"name": "Matthew"})
    assert result.ok is True
    assert result.output == "Hello Matthew"
    assert result.kind == "prompt"


def test_entrypoint_execution_calls_module_function(tmp_path: Path) -> None:
    module_path = tmp_path / "skill_funcs.py"
    module_path.write_text(
        "def greet(name: str) -> str:\n"
        "    return f'Hi {name}'\n"
    )

    executor = SkillExecutor(module_search_paths=[tmp_path])
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "call_func",
        "kind": "entrypoint",
        "description": "Call function",
        "entrypoint": "skill_funcs:greet",
    })

    result = executor.execute(manifest, arguments={"name": "Matt"})
    assert result.ok is True
    assert result.output == "Hi Matt"
    assert result.kind == "entrypoint"


def test_entrypoint_execution_respects_timeout(tmp_path: Path) -> None:
    module_path = tmp_path / "skill_timeout.py"
    module_path.write_text(
        "import time\n"
        "def slow(delay: float) -> str:\n"
        "    time.sleep(delay)\n"
        "    return 'done'\n"
    )

    executor = SkillExecutor(module_search_paths=[tmp_path])
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "slow_call",
        "kind": "entrypoint",
        "description": "Slow function",
        "entrypoint": "skill_timeout:slow",
        "timeout_sec": 0.05,
    })

    result = executor.execute(manifest, arguments={"delay": 0.2})
    assert result.ok is False
    assert result.timed_out is True
    assert result.error is not None


def test_policy_denies_shell_exec_when_disallowed() -> None:
    policy = SkillsPolicy(allow_shell_exec=False)
    executor = SkillExecutor(policy=policy)
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "dangerous",
        "kind": "prompt",
        "description": "Shell call",
        "prompt_template": "run",
        "permission_tags": ["shell-exec"],
    })

    result = executor.execute(manifest)
    assert result.ok is False
    assert result.denied is True
    assert "shell-exec" in (result.error or "")


def test_policy_requires_approval_for_tag() -> None:
    policy = SkillsPolicy(approval_required_tags={"high"})
    executor = SkillExecutor(policy=policy)
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "approval_skill",
        "kind": "prompt",
        "description": "Needs approval",
        "prompt_template": "ok",
        "risk_tags": ["high"],
    })

    blocked = executor.execute(manifest, approved=False)
    assert blocked.ok is False
    assert blocked.denied is True
    assert blocked.requires_approval is True

    allowed = executor.execute(manifest, approved=True)
    assert allowed.ok is True
    assert allowed.output == "ok"


def test_executor_validates_arguments_against_schema() -> None:
    executor = SkillExecutor()
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "schema_skill",
        "kind": "prompt",
        "description": "Schema enforced",
        "prompt_template": "Hi {name}",
        "input_schema": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
            "additionalProperties": False,
        },
    })

    missing = executor.execute(manifest, arguments={})
    assert missing.ok is False
    assert "required" in (missing.error or "")

    valid = executor.execute(manifest, arguments={"name": "Matthew"})
    assert valid.ok is True


def test_restricted_sandbox_blocks_network_permission() -> None:
    executor = SkillExecutor(sandbox_profile="restricted")
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "network_prompt",
        "kind": "prompt",
        "description": "Network call",
        "prompt_template": "net",
        "permission_tags": ["network-access"],
    })

    result = executor.execute(manifest)
    assert result.ok is False
    assert result.denied is True
    assert "sandbox profile" in (result.error or "")


def test_strict_sandbox_blocks_entrypoint_skills(tmp_path: Path) -> None:
    module_path = tmp_path / "strict_skill.py"
    module_path.write_text(
        "def run() -> str:\n"
        "    return 'ok'\n"
    )
    executor = SkillExecutor(
        module_search_paths=[tmp_path],
        sandbox_profile="strict",
    )
    manifest = _manifest({
        "schema": "opta.skills.manifest/v1",
        "name": "strict_entrypoint",
        "kind": "entrypoint",
        "description": "Entrypoint blocked",
        "entrypoint": "strict_skill:run",
    })

    result = executor.execute(manifest)
    assert result.ok is False
    assert result.denied is True
    assert "entrypoint skills are disabled" in (result.error or "")
