"""Preset manager — load and resolve YAML model presets."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

from opta_lmx.inference.schema import ChatCompletionRequest

logger = logging.getLogger(__name__)

PRESET_PREFIX = "preset:"


@dataclass
class Preset:
    """A named model preset with default inference parameters."""

    name: str
    description: str = ""
    model: str = ""
    parameters: dict[str, Any] = field(default_factory=dict)
    system_prompt: str | None = None
    routing_alias: str | None = None
    auto_load: bool = False
    performance: dict[str, Any] = field(default_factory=dict)
    chat_template: str | None = None  # F4: Optional Jinja2 chat template override


class PresetManager:
    """Manages YAML preset files — load, resolve, and apply presets.

    Presets are YAML files in a directory. Each defines a model ID plus
    default inference parameters (temperature, top_p, max_tokens, stop)
    and an optional system prompt.

    Presets are referenced in API requests via ``model: "preset:name"``.
    """

    def __init__(self, presets_dir: Path) -> None:
        self._dir = presets_dir
        self._presets: dict[str, Preset] = {}

    # ── Loading ──────────────────────────────────────────────────────────

    def load_presets(self) -> int:
        """Scan the presets directory and parse all YAML files.

        Returns:
            Number of presets loaded.
        """
        self._presets.clear()

        if not self._dir.exists():
            logger.info("presets_dir_missing", extra={"path": str(self._dir)})
            return 0

        count = 0
        for path in sorted(self._dir.glob("*.yaml")):
            try:
                preset = self._parse_file(path)
                self._presets[preset.name] = preset
                count += 1
                logger.debug(
                    "preset_loaded",
                    extra={"preset_name": preset.name, "model": preset.model},
                )
            except Exception as e:
                logger.warning("preset_parse_error", extra={"path": str(path), "error": str(e)})

        logger.info("presets_loaded", extra={"count": count, "dir": str(self._dir)})
        return count

    def reload(self) -> int:
        """Re-read presets from disk (hot-reload)."""
        return self.load_presets()

    # ── Lookup ───────────────────────────────────────────────────────────

    def get(self, name: str) -> Preset | None:
        """Get a preset by name, or None if not found."""
        return self._presets.get(name)

    def list_all(self) -> list[Preset]:
        """Return all loaded presets, sorted by name."""
        return sorted(self._presets.values(), key=lambda p: p.name)

    # ── Application ──────────────────────────────────────────────────────

    def apply(self, preset: Preset, request: ChatCompletionRequest) -> ChatCompletionRequest:
        """Apply preset defaults to a request.

        Preset values are used as defaults — explicit request values take
        priority. The model field is always replaced with the preset's model.

        If the preset has a system_prompt and no system message exists in
        the request, one is prepended.

        Returns a new ChatCompletionRequest (the original is not mutated).
        """
        from opta_lmx.inference.schema import ChatMessage

        # Start with preset parameters, override with request values
        params = dict(preset.parameters)

        # Build updated fields — request values override preset defaults
        updates: dict[str, Any] = {"model": preset.model}

        # F4: Extended parameter list — covers all tunable inference fields
        for param_key in (
            "temperature", "top_p", "max_tokens", "stop",
            "frequency_penalty", "presence_penalty", "response_format", "num_ctx",
        ):
            request_val = getattr(request, param_key, None)
            preset_val = params.get(param_key)
            # Use request value if it was explicitly set (differs from Pydantic default)
            # Otherwise use preset value if available
            if preset_val is not None:
                field_info = ChatCompletionRequest.model_fields.get(param_key)
                field_default = field_info.default if field_info else None
                if request_val == field_default:
                    updates[param_key] = preset_val

        # Handle system prompt — prepend if preset has one and request doesn't
        messages = list(request.messages)
        if preset.system_prompt and not any(m.role == "system" for m in messages):
            messages.insert(0, ChatMessage(role="system", content=preset.system_prompt))
            updates["messages"] = messages

        # Create new request with merged values
        data = request.model_dump()
        data.update(updates)
        if "messages" in updates:
            data["messages"] = [m.model_dump() for m in updates["messages"]]
        return ChatCompletionRequest.model_validate(data)

    # ── Helpers ──────────────────────────────────────────────────────────

    def get_auto_load_models(self) -> list[str]:
        """Return model IDs from presets with auto_load=True."""
        return [p.model for p in self._presets.values() if p.auto_load and p.model]

    def find_performance_for_model(self, model_id: str) -> dict[str, Any] | None:
        """Find performance overrides from a preset that maps to this model_id.

        Returns the preset's performance dict if a matching preset with a non-empty
        performance section is found, otherwise None.
        """
        for preset in self._presets.values():
            if preset.model == model_id and preset.performance:
                return preset.performance
        return None

    @staticmethod
    def _deep_merge_dicts(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
        """Recursively merge two dicts where overlay values win."""
        merged: dict[str, Any] = dict(base)
        for key, value in overlay.items():
            existing = merged.get(key)
            if isinstance(existing, dict) and isinstance(value, dict):
                merged[key] = PresetManager._deep_merge_dicts(existing, value)
            else:
                merged[key] = value
        return merged

    def compose_performance_for_load(
        self,
        model_id: str,
        *,
        tuned: dict[str, Any] | None = None,
        explicit: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Compose effective load performance profile.

        Precedence (highest last): preset < tuned < explicit
        """
        merged: dict[str, Any] = dict(self.find_performance_for_model(model_id) or {})
        if tuned:
            merged = self._deep_merge_dicts(merged, tuned)
        if explicit:
            merged = self._deep_merge_dicts(merged, explicit)
        return merged

    def get_routing_aliases(self) -> dict[str, list[str]]:
        """Return {alias: [model_id]} mappings from presets with routing_alias set."""
        aliases: dict[str, list[str]] = {}
        for preset in self._presets.values():
            if preset.routing_alias and preset.model:
                aliases.setdefault(preset.routing_alias, []).append(preset.model)
        return aliases

    @staticmethod
    def _parse_file(path: Path) -> Preset:
        """Parse a single YAML preset file into a Preset."""
        with open(path) as f:
            raw = yaml.safe_load(f)

        if not isinstance(raw, dict):
            msg = f"Preset file must be a YAML mapping, got {type(raw).__name__}"
            raise ValueError(msg)

        name = raw.get("name")
        if not name:
            msg = f"Preset file {path.name} is missing required 'name' field"
            raise ValueError(msg)

        return Preset(
            name=name,
            description=raw.get("description", ""),
            model=raw.get("model", ""),
            parameters=raw.get("parameters", {}),
            system_prompt=raw.get("system_prompt"),
            routing_alias=raw.get("routing_alias"),
            auto_load=raw.get("auto_load", False),
            performance=raw.get("performance", {}),
            chat_template=raw.get("chat_template"),
        )
