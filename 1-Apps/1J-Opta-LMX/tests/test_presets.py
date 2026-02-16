"""Tests for the PresetManager and admin preset endpoints."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from opta_lmx.inference.schema import ChatCompletionRequest, ChatMessage
from opta_lmx.presets.manager import PresetManager


# ─── PresetManager Unit Tests ────────────────────────────────────────────────


def _write_preset(directory: Path, name: str, data: dict) -> Path:
    """Helper to write a YAML preset file."""
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{name}.yaml"
    path.write_text(yaml.dump(data))
    return path


class TestPresetManagerLoading:
    """Test preset loading from YAML files."""

    def test_load_empty_dir(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        presets_dir.mkdir()
        mgr = PresetManager(presets_dir)
        assert mgr.load_presets() == 0
        assert mgr.list_all() == []

    def test_load_missing_dir(self, tmp_path: Path) -> None:
        mgr = PresetManager(tmp_path / "nonexistent")
        assert mgr.load_presets() == 0

    def test_load_single_preset(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test",
            "description": "A test preset",
            "model": "mlx-community/Qwen2.5-7B-4bit",
            "parameters": {"temperature": 0.3, "max_tokens": 2048},
            "system_prompt": "You are a helpful assistant.",
        })
        mgr = PresetManager(presets_dir)
        count = mgr.load_presets()
        assert count == 1

        preset = mgr.get("test")
        assert preset is not None
        assert preset.name == "test"
        assert preset.model == "mlx-community/Qwen2.5-7B-4bit"
        assert preset.parameters["temperature"] == 0.3
        assert preset.system_prompt == "You are a helpful assistant."

    def test_load_multiple_presets(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "alpha", {"name": "alpha", "model": "model-a"})
        _write_preset(presets_dir, "beta", {"name": "beta", "model": "model-b"})
        _write_preset(presets_dir, "gamma", {"name": "gamma", "model": "model-c"})

        mgr = PresetManager(presets_dir)
        assert mgr.load_presets() == 3
        assert len(mgr.list_all()) == 3
        # Sorted by name
        names = [p.name for p in mgr.list_all()]
        assert names == ["alpha", "beta", "gamma"]

    def test_load_skips_invalid_yaml(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        presets_dir.mkdir()
        # Valid preset
        _write_preset(presets_dir, "good", {"name": "good", "model": "m1"})
        # Invalid — missing name
        _write_preset(presets_dir, "bad", {"model": "m2"})

        mgr = PresetManager(presets_dir)
        assert mgr.load_presets() == 1
        assert mgr.get("good") is not None
        assert mgr.get("bad") is None

    def test_reload_clears_old_presets(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "first", {"name": "first", "model": "m1"})

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        assert mgr.get("first") is not None

        # Remove old, add new
        (presets_dir / "first.yaml").unlink()
        _write_preset(presets_dir, "second", {"name": "second", "model": "m2"})

        mgr.reload()
        assert mgr.get("first") is None
        assert mgr.get("second") is not None


class TestPresetManagerLookup:
    """Test preset get and helper methods."""

    def test_get_nonexistent(self, tmp_path: Path) -> None:
        mgr = PresetManager(tmp_path / "presets")
        mgr.load_presets()
        assert mgr.get("nope") is None

    def test_auto_load_models(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "a", {"name": "a", "model": "m1", "auto_load": True})
        _write_preset(presets_dir, "b", {"name": "b", "model": "m2", "auto_load": False})
        _write_preset(presets_dir, "c", {"name": "c", "model": "m3", "auto_load": True})

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        auto = mgr.get_auto_load_models()
        assert sorted(auto) == ["m1", "m3"]

    def test_routing_aliases(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "a", {"name": "a", "model": "m1", "routing_alias": "code"})
        _write_preset(presets_dir, "b", {"name": "b", "model": "m2", "routing_alias": "code"})
        _write_preset(presets_dir, "c", {"name": "c", "model": "m3"})

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        aliases = mgr.get_routing_aliases()
        assert aliases == {"code": ["m1", "m2"]}


class TestPresetApply:
    """Test applying presets to requests."""

    def _make_request(self, **kwargs) -> ChatCompletionRequest:
        defaults = {
            "model": "preset:test",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        defaults.update(kwargs)
        return ChatCompletionRequest.model_validate(defaults)

    def test_apply_replaces_model(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {"name": "test", "model": "real-model-id"})

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        request = self._make_request()
        result = mgr.apply(preset, request)
        assert result.model == "real-model-id"

    def test_apply_sets_default_temperature(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test", "model": "m1",
            "parameters": {"temperature": 0.2},
        })

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        # Request uses Pydantic default (0.7) → preset's 0.2 wins
        request = self._make_request()
        result = mgr.apply(preset, request)
        assert result.temperature == 0.2

    def test_apply_explicit_request_overrides_preset(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test", "model": "m1",
            "parameters": {"temperature": 0.2},
        })

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        # Request explicitly sets temperature=1.5 → overrides preset
        request = self._make_request(temperature=1.5)
        result = mgr.apply(preset, request)
        assert result.temperature == 1.5

    def test_apply_prepends_system_prompt(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test", "model": "m1",
            "system_prompt": "Be concise.",
        })

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        request = self._make_request()
        result = mgr.apply(preset, request)
        assert len(result.messages) == 2
        assert result.messages[0].role == "system"
        assert result.messages[0].content == "Be concise."

    def test_apply_skips_system_if_already_present(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test", "model": "m1",
            "system_prompt": "Preset system prompt.",
        })

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        request = self._make_request(messages=[
            {"role": "system", "content": "User's system prompt."},
            {"role": "user", "content": "Hello"},
        ])
        result = mgr.apply(preset, request)
        assert len(result.messages) == 2
        assert result.messages[0].content == "User's system prompt."

    def test_apply_does_not_mutate_original(self, tmp_path: Path) -> None:
        presets_dir = tmp_path / "presets"
        _write_preset(presets_dir, "test", {
            "name": "test", "model": "m1",
            "parameters": {"temperature": 0.1},
        })

        mgr = PresetManager(presets_dir)
        mgr.load_presets()
        preset = mgr.get("test")
        assert preset is not None

        request = self._make_request()
        original_model = request.model
        mgr.apply(preset, request)
        assert request.model == original_model  # unchanged


# ─── Admin API Endpoint Tests ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_list_presets_empty(client) -> None:
    """GET /admin/presets returns empty list when no presets loaded."""
    resp = await client.get("/admin/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert data["presets"] == []


@pytest.mark.anyio
async def test_list_presets_with_data(client, tmp_path: Path) -> None:
    """GET /admin/presets lists loaded presets."""
    # Write a preset and reload
    presets_dir = tmp_path / "presets"
    _write_preset(presets_dir, "test-preset", {
        "name": "test-preset",
        "description": "For testing",
        "model": "test-model",
        "parameters": {"temperature": 0.5},
    })

    # Swap the preset manager to use our test dir
    mgr = PresetManager(presets_dir)
    mgr.load_presets()
    client._transport.app.state.preset_manager = mgr  # type: ignore[union-attr]

    resp = await client.get("/admin/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["presets"][0]["name"] == "test-preset"
    assert data["presets"][0]["model"] == "test-model"


@pytest.mark.anyio
async def test_get_preset_found(client, tmp_path: Path) -> None:
    """GET /admin/presets/{name} returns preset details."""
    presets_dir = tmp_path / "presets"
    _write_preset(presets_dir, "my-preset", {
        "name": "my-preset",
        "description": "Desc",
        "model": "some-model",
        "system_prompt": "Be brief.",
    })

    mgr = PresetManager(presets_dir)
    mgr.load_presets()
    client._transport.app.state.preset_manager = mgr  # type: ignore[union-attr]

    resp = await client.get("/admin/presets/my-preset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "my-preset"
    assert data["system_prompt"] == "Be brief."


@pytest.mark.anyio
async def test_get_preset_not_found(client) -> None:
    """GET /admin/presets/{name} returns 404 for unknown presets."""
    resp = await client.get("/admin/presets/nonexistent")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_reload_presets(client, tmp_path: Path) -> None:
    """POST /admin/presets/reload re-reads from disk."""
    presets_dir = tmp_path / "presets"
    mgr = PresetManager(presets_dir)
    client._transport.app.state.preset_manager = mgr  # type: ignore[union-attr]

    # Initially no presets
    resp = await client.get("/admin/presets")
    assert resp.json()["count"] == 0

    # Write a preset
    _write_preset(presets_dir, "new", {"name": "new", "model": "m1"})

    # Reload
    resp = await client.post("/admin/presets/reload")
    assert resp.status_code == 200
    assert resp.json()["presets_loaded"] == 1

    # Now the preset is visible
    resp = await client.get("/admin/presets")
    assert resp.json()["count"] == 1


@pytest.mark.anyio
async def test_preset_auth_required(client_with_auth) -> None:
    """Preset endpoints require admin key when auth is configured."""
    resp = await client_with_auth.get("/admin/presets")
    assert resp.status_code == 403

    resp = await client_with_auth.get(
        "/admin/presets",
        headers={"X-Admin-Key": "test-secret-key"},
    )
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_preset_model_resolution(client, tmp_path: Path) -> None:
    """model: 'preset:name' resolves to the preset's model ID."""
    presets_dir = tmp_path / "presets"
    _write_preset(presets_dir, "fast", {
        "name": "fast",
        "model": "test-model",
        "parameters": {"temperature": 0.1},
    })

    mgr = PresetManager(presets_dir)
    mgr.load_presets()
    app = client._transport.app  # type: ignore[union-attr]
    app.state.preset_manager = mgr

    # Load mock model with the preset's target model ID
    await app.state.engine.load_model("test-model")

    resp = await client.post("/v1/chat/completions", json={
        "model": "preset:fast",
        "messages": [{"role": "user", "content": "Hello"}],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["model"] == "test-model"


@pytest.mark.anyio
async def test_preset_not_found_in_inference(client) -> None:
    """model: 'preset:unknown' returns 404."""
    resp = await client.post("/v1/chat/completions", json={
        "model": "preset:nonexistent",
        "messages": [{"role": "user", "content": "Hello"}],
    })
    assert resp.status_code == 404
