"""Tests for skill manifest loading and registry behavior."""

from __future__ import annotations

import time
from pathlib import Path

from opta_lmx.skills.registry import SkillsRegistry


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def test_registry_load_ignores_invalid_docs_and_collects_errors(tmp_path: Path) -> None:
    manifests = tmp_path / "manifests"
    _write(manifests / "skills.yaml", """
---
schema: opta.skills.manifest/v1
name: summarize
kind: prompt
description: Summarize text
prompt_template: "Summarize: {text}"
permission_tags: [read-files]
risk_tags: [low]
---
name: invalid_missing_fields
kind: prompt
""")

    registry = SkillsRegistry()
    result = registry.load([manifests])

    assert result.loaded_count == 1
    assert len(result.errors) == 1
    assert "skills.yaml" in result.errors[0].path
    assert "doc 2" in result.errors[0].message

    listed = registry.list()
    assert len(listed) == 1
    assert listed[0].name == "summarize"
    assert registry.get("summarize") is not None


def test_registry_register_and_list_changed_timestamp() -> None:
    registry = SkillsRegistry()
    before = registry.list_changed_at

    registry.register_from_data({
        "schema": "opta.skills.manifest/v1",
        "name": "alpha",
        "kind": "prompt",
        "description": "A",
        "prompt_template": "A",
    })
    first_change = registry.list_changed_at

    time.sleep(0.01)
    registry.register_from_data({
        "schema": "opta.skills.manifest/v1",
        "name": "beta",
        "kind": "prompt",
        "description": "B",
        "prompt_template": "B",
    })
    second_change = registry.list_changed_at

    assert first_change >= before
    assert second_change > first_change

    names = [item.name for item in registry.list()]
    assert names == ["alpha", "beta"]
    assert registry.get("missing") is None


def test_registry_resolves_namespace_and_latest_version() -> None:
    registry = SkillsRegistry()
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "namespace": "default",
            "name": "planner",
            "version": "1.0.0",
            "kind": "prompt",
            "description": "Planner v1",
            "prompt_template": "v1 {goal}",
        }
    )
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "namespace": "default",
            "name": "planner",
            "version": "1.2.0",
            "kind": "prompt",
            "description": "Planner v2",
            "prompt_template": "v2 {goal}",
        }
    )
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "namespace": "openclaw",
            "name": "planner",
            "version": "2.0.0",
            "kind": "prompt",
            "description": "Planner oc",
            "prompt_template": "oc {goal}",
        }
    )

    latest = registry.get("planner")
    assert latest is not None
    assert latest.version == "1.2.0"
    assert latest.namespace == "default"

    default_explicit = registry.get("default/planner")
    assert default_explicit is not None
    assert default_explicit.version == "1.2.0"

    pinned = registry.get("planner@1.0.0")
    assert pinned is not None
    assert pinned.version == "1.0.0"

    openclaw = registry.get("openclaw/planner@2.0.0")
    assert openclaw is not None
    assert openclaw.namespace == "openclaw"

    latest_only_refs = [item.reference for item in registry.list_latest()]
    assert "default/planner@1.2.0" in latest_only_refs
    assert "openclaw/planner@2.0.0" in latest_only_refs
