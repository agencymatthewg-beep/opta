"""Tests for skill manifest validation models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from opta_lmx.skills.manifest import SkillKind, SkillManifest


def test_valid_prompt_manifest_parses() -> None:
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "summarize_notes",
        "description": "Summarize notes into concise bullets",
        "kind": "prompt",
        "prompt_template": "Summarize: {text}",
        "permission_tags": ["read-files"],
        "risk_tags": ["low"],
    })

    assert manifest.kind is SkillKind.PROMPT
    assert manifest.prompt_template == "Summarize: {text}"
    assert manifest.namespace == "default"
    assert manifest.version == "1.0.0"


def test_invalid_schema_rejected() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v9",
            "name": "bad_schema",
            "description": "x",
            "kind": "prompt",
            "prompt_template": "x",
        })


def test_prompt_kind_requires_prompt_template() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "missing_prompt",
            "description": "x",
            "kind": "prompt",
        })


def test_entrypoint_kind_requires_entrypoint() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "missing_entrypoint",
            "description": "x",
            "kind": "entrypoint",
        })


def test_invalid_entrypoint_format_rejected() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "bad_entry",
            "description": "x",
            "kind": "entrypoint",
            "entrypoint": "not-a-module-path",
        })


def test_unknown_permission_tag_rejected() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "bad_perm",
            "description": "x",
            "kind": "prompt",
            "prompt_template": "x",
            "permission_tags": ["root-access"],
        })


def test_input_schema_rejects_non_object_root() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "bad_schema_root",
            "description": "x",
            "kind": "prompt",
            "prompt_template": "x",
            "input_schema": {"type": "array"},
        })


def test_input_schema_accepts_required_properties() -> None:
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "with_args",
        "description": "x",
        "kind": "prompt",
        "prompt_template": "x",
        "input_schema": {
            "type": "object",
            "properties": {"topic": {"type": "string"}},
            "required": ["topic"],
            "additionalProperties": False,
        },
    })
    assert manifest.input_schema["required"] == ["topic"]


def test_namespaced_manifest_with_version_parses() -> None:
    manifest = SkillManifest.model_validate(
        {
            "schema": "opta.skills.manifest/v1",
            "namespace": "openclaw",
            "name": "planner",
            "version": "2.3.1",
            "description": "Planner tool",
            "kind": "prompt",
            "prompt_template": "Plan {goal}",
        }
    )
    assert manifest.reference == "openclaw/planner@2.3.1"


def test_invalid_semver_rejected() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate(
            {
                "schema": "opta.skills.manifest/v1",
                "namespace": "default",
                "name": "planner",
                "version": "v2",
                "description": "Planner tool",
                "kind": "prompt",
                "prompt_template": "Plan {goal}",
            }
        )


# --- skill_id ---


def test_manifest_with_skill_id_parses() -> None:
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "with_id",
        "description": "Has explicit id",
        "kind": "prompt",
        "prompt_template": "x",
        "skill_id": "custom-id-abc123",
    })
    assert manifest.skill_id == "custom-id-abc123"


def test_manifest_auto_generates_skill_id() -> None:
    m1 = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "auto_id",
        "description": "No explicit id",
        "kind": "prompt",
        "prompt_template": "x",
    })
    m2 = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "auto_id",
        "description": "No explicit id",
        "kind": "prompt",
        "prompt_template": "x",
    })
    assert isinstance(m1.skill_id, str)
    assert len(m1.skill_id) == 32  # uuid4().hex is 32 hex chars
    assert m1.skill_id != m2.skill_id  # each instance gets a unique id


# --- output_schema ---


def test_manifest_with_output_schema_parses() -> None:
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "with_output",
        "description": "Has output schema",
        "kind": "prompt",
        "prompt_template": "x",
        "output_schema": {
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
            "additionalProperties": False,
        },
    })
    assert manifest.output_schema["required"] == ["summary"]
    assert "summary" in manifest.output_schema["properties"]


def test_manifest_invalid_output_schema_rejected() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "bad_output",
            "description": "x",
            "kind": "prompt",
            "prompt_template": "x",
            "output_schema": {"type": "array"},
        })


# --- model_preferences ---


def test_manifest_with_model_preferences_parses() -> None:
    prefs = {
        "preferred_model": "mlx/mistral",
        "min_context_window": 8192,
        "capabilities": ["tool_use"],
    }
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "with_prefs",
        "description": "Has model preferences",
        "kind": "prompt",
        "prompt_template": "x",
        "model_preferences": prefs,
    })
    assert manifest.model_preferences == prefs
    assert manifest.model_preferences["min_context_window"] == 8192


# --- roots ---


def test_manifest_with_roots_parses() -> None:
    manifest = SkillManifest.model_validate({
        "schema": "opta.skills.manifest/v1",
        "name": "with_roots",
        "description": "Has filesystem roots",
        "kind": "prompt",
        "prompt_template": "x",
        "roots": ["/Users/opta/projects", "/tmp/workspace"],
    })
    assert manifest.roots == ["/Users/opta/projects", "/tmp/workspace"]


def test_manifest_rejects_relative_roots() -> None:
    with pytest.raises(ValidationError):
        SkillManifest.model_validate({
            "schema": "opta.skills.manifest/v1",
            "name": "bad_roots",
            "description": "x",
            "kind": "prompt",
            "prompt_template": "x",
            "roots": ["relative/path/not/allowed"],
        })
