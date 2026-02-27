"""Pydantic models for versioned skills manifests."""

from __future__ import annotations

import re
import uuid
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MANIFEST_SCHEMA_V1: Literal["opta.skills.manifest/v1"] = "opta.skills.manifest/v1"
_ENTRYPOINT_PATTERN = re.compile(r"^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*:[A-Za-z_]\w*$")
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)
_JSON_TYPES = {"string", "number", "integer", "boolean", "object", "array"}


def _validate_schema_node(schema: dict[str, Any], *, path: str) -> None:
    schema_type = schema.get("type")
    if schema_type is not None and schema_type not in _JSON_TYPES:
        raise ValueError(f"{path}.type must be one of {sorted(_JSON_TYPES)}")

    required = schema.get("required")
    if required is not None and (
        not isinstance(required, list) or not all(isinstance(x, str) for x in required)
    ):
        raise ValueError(f"{path}.required must be a list of strings")

    if schema_type == "object" or "properties" in schema:
        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            raise ValueError(f"{path}.properties must be an object")
        for key, child in properties.items():
            if not isinstance(key, str) or not key:
                raise ValueError(f"{path}.properties keys must be non-empty strings")
            if not isinstance(child, dict):
                raise ValueError(f"{path}.properties.{key} must be an object schema")
            _validate_schema_node(child, path=f"{path}.properties.{key}")

        additional = schema.get("additionalProperties", True)
        if not isinstance(additional, bool):
            raise ValueError(f"{path}.additionalProperties must be boolean")

    if schema_type == "array" and "items" in schema:
        items = schema.get("items")
        if not isinstance(items, dict):
            raise ValueError(f"{path}.items must be an object schema")
        _validate_schema_node(items, path=f"{path}.items")


def _matches_json_type(value: object, schema_type: str) -> bool:
    if schema_type == "string":
        return isinstance(value, str)
    if schema_type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if schema_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if schema_type == "boolean":
        return isinstance(value, bool)
    if schema_type == "object":
        return isinstance(value, dict)
    if schema_type == "array":
        return isinstance(value, list)
    return True


def _validate_payload(
    payload: object,
    schema: dict[str, Any],
    *,
    path: str,
) -> str | None:
    schema_type = schema.get("type")
    if isinstance(schema_type, str) and not _matches_json_type(payload, schema_type):
        return f"{path} must be {schema_type}"

    if schema_type == "object" or "properties" in schema:
        if not isinstance(payload, dict):
            return f"{path} must be object"
        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            return f"{path} schema has invalid properties definition"

        required = schema.get("required", [])
        if isinstance(required, list):
            for key in required:
                if isinstance(key, str) and key not in payload:
                    return f"{path}.{key} is required"

        additional = schema.get("additionalProperties", True)
        if additional is False:
            unknown = sorted(set(payload.keys()) - set(properties.keys()))
            if unknown:
                return f"{path}.{unknown[0]} is not allowed"

        for key, child_schema in properties.items():
            if key not in payload:
                continue
            if not isinstance(child_schema, dict):
                continue
            child_error = _validate_payload(
                payload[key],
                child_schema,
                path=f"{path}.{key}",
            )
            if child_error is not None:
                return child_error

    if schema_type == "array":
        if not isinstance(payload, list):
            return f"{path} must be array"
        items_schema = schema.get("items")
        if isinstance(items_schema, dict):
            for index, item in enumerate(payload):
                child_error = _validate_payload(
                    item,
                    items_schema,
                    path=f"{path}[{index}]",
                )
                if child_error is not None:
                    return child_error

    return None


def validate_skill_arguments(arguments: dict[str, object], schema: dict[str, Any]) -> str | None:
    """Validate skill arguments against manifest input schema."""
    return _validate_payload(arguments, schema, path="arguments")


class SkillKind(StrEnum):
    """Runtime behavior supported by the skills executor."""

    PROMPT = "prompt"
    ENTRYPOINT = "entrypoint"


class PermissionTag(StrEnum):
    """Capability tags used by policy checks."""

    READ_FILES = "read-files"
    WRITE_FILES = "write-files"
    NETWORK_ACCESS = "network-access"
    SHELL_EXEC = "shell-exec"


class RiskTag(StrEnum):
    """Risk labels used for approval gates and risk filtering."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    APPROVAL_REQUIRED = "approval-required"


class SkillManifest(BaseModel):
    """Strict skill manifest schema.

    The ``schema`` field is versioned so future schema revisions can be added
    without ambiguous parsing behavior.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    schema_version: Literal["opta.skills.manifest/v1"] = Field(
        default=MANIFEST_SCHEMA_V1,
        alias="schema",
        serialization_alias="schema",
    )
    namespace: str = Field(default="default", min_length=1)
    name: str = Field(min_length=1)
    version: str = Field(default="1.0.0", min_length=1)
    description: str = Field(min_length=1)
    kind: SkillKind
    permission_tags: list[PermissionTag] = Field(default_factory=list)
    risk_tags: list[RiskTag] = Field(default_factory=list)

    prompt_template: str | None = None
    entrypoint: str | None = None
    input_schema: dict[str, Any] = Field(
        default_factory=lambda: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": True,
        }
    )
    timeout_sec: float = Field(10.0, gt=0.0, le=600.0)

    skill_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    output_schema: dict[str, Any] = Field(
        default_factory=lambda: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": True,
        }
    )
    model_preferences: dict[str, Any] | None = None
    roots: list[str] = Field(default_factory=list)

    @field_validator("skill_id")
    @classmethod
    def _validate_skill_id(cls, value: str) -> str:
        if not value:
            raise ValueError("skill_id must be a non-empty string")
        return value

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name must not be blank")
        if not _IDENTIFIER_PATTERN.fullmatch(normalized):
            raise ValueError("name must use [A-Za-z0-9._-] and start with alphanumeric")
        return normalized

    @field_validator("namespace")
    @classmethod
    def _normalize_namespace(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("namespace must not be blank")
        if not _IDENTIFIER_PATTERN.fullmatch(normalized):
            raise ValueError("namespace must use [A-Za-z0-9._-] and start with alphanumeric")
        return normalized

    @field_validator("version")
    @classmethod
    def _normalize_version(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("version must not be blank")
        if not _SEMVER_PATTERN.fullmatch(normalized):
            raise ValueError("version must be semantic version string (e.g. 1.2.3)")
        return normalized

    @field_validator("entrypoint")
    @classmethod
    def _validate_entrypoint(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _ENTRYPOINT_PATTERN.fullmatch(value):
            raise ValueError("entrypoint must use module:function format")
        return value

    @field_validator("input_schema")
    @classmethod
    def _validate_input_schema(cls, value: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(value)
        schema_type = normalized.get("type")
        if schema_type is None:
            normalized["type"] = "object"
        elif schema_type != "object":
            raise ValueError("input_schema root type must be 'object'")

        normalized.setdefault("properties", {})
        normalized.setdefault("required", [])
        normalized.setdefault("additionalProperties", True)
        _validate_schema_node(normalized, path="input_schema")
        return normalized

    @field_validator("output_schema")
    @classmethod
    def _validate_output_schema(cls, value: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(value)
        schema_type = normalized.get("type")
        if schema_type is None:
            normalized["type"] = "object"
        elif schema_type != "object":
            raise ValueError("output_schema root type must be 'object'")

        normalized.setdefault("properties", {})
        normalized.setdefault("required", [])
        normalized.setdefault("additionalProperties", True)
        _validate_schema_node(normalized, path="output_schema")
        return normalized

    @field_validator("roots")
    @classmethod
    def _validate_roots(cls, value: list[str]) -> list[str]:
        for idx, path in enumerate(value):
            if not path.startswith("/"):
                raise ValueError(
                    f"roots[{idx}] must be an absolute path (starts with '/')"
                )
        return value

    @model_validator(mode="after")
    def _validate_kind_payload(self) -> SkillManifest:
        if self.kind == SkillKind.PROMPT:
            if self.prompt_template is None:
                raise ValueError("prompt kind requires prompt_template")
            if self.entrypoint is not None:
                raise ValueError("prompt kind cannot define entrypoint")

        if self.kind == SkillKind.ENTRYPOINT:
            if self.entrypoint is None:
                raise ValueError("entrypoint kind requires entrypoint")
            if self.prompt_template is not None:
                raise ValueError("entrypoint kind cannot define prompt_template")

        return self

    def all_tags(self) -> set[str]:
        """Return union of permission/risk tags as plain values."""
        return {tag.value for tag in self.permission_tags} | {tag.value for tag in self.risk_tags}

    @property
    def qualified_name(self) -> str:
        """Namespace-qualified skill name."""
        return f"{self.namespace}/{self.name}"

    @property
    def reference(self) -> str:
        """Fully-qualified skill reference including semantic version."""
        return f"{self.qualified_name}@{self.version}"

    def aliases(self) -> tuple[str, ...]:
        """Lookup aliases accepted by the registry."""
        aliases: list[str] = [
            self.reference,
            self.qualified_name,
            f"{self.name}@{self.version}",
        ]
        if self.namespace == "default":
            aliases.append(self.name)

        deduped: list[str] = []
        seen: set[str] = set()
        for alias in aliases:
            if alias in seen:
                continue
            deduped.append(alias)
            seen.add(alias)
        return tuple(deduped)
