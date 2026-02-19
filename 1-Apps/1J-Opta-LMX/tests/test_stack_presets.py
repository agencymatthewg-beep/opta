"""Tests for stack presets in config."""

from __future__ import annotations

import pytest

from opta_lmx.config import LMXConfig, StackPresetConfig


class TestStackPresetConfig:
    """Stack presets map preset names to role->model configurations."""

    def test_default_no_stack_presets(self) -> None:
        config = LMXConfig()
        assert config.stack_presets == {}

    def test_parse_stack_preset(self) -> None:
        config = LMXConfig(
            stack_presets={
                "standard": StackPresetConfig(
                    description="Standard 4-model stack",
                    roles={
                        "coding": "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit",
                        "reasoning": "mlx-community/QwQ-32B-4bit",
                        "chat": "mlx-community/Qwen3-30B-A3B-4bit",
                        "vision": "mlx-community/Qwen2.5-VL-32B-Instruct-4bit",
                    },
                ),
            },
        )
        assert "standard" in config.stack_presets
        preset = config.stack_presets["standard"]
        assert preset.roles["coding"] == "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
        assert preset.description == "Standard 4-model stack"

    def test_stack_preset_from_yaml_dict(self) -> None:
        """Validates that YAML-style nested dict is parsed correctly."""
        raw = {
            "stack_presets": {
                "minimax": {
                    "description": "MiniMax single-model stack",
                    "roles": {
                        "coding": "mlx-community/MiniMax-M2.5-5bit",
                        "chat": "mlx-community/MiniMax-M2.5-4bit",
                    },
                },
            },
        }
        config = LMXConfig.model_validate(raw)
        assert "minimax" in config.stack_presets
        assert config.stack_presets["minimax"].roles["chat"] == "mlx-community/MiniMax-M2.5-4bit"
