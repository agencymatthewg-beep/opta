"""Tests for admin API endpoints."""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from opta_lmx import __version__
from opta_lmx.inference.autotune_registry import AutotuneRegistry
from opta_lmx.inference.backend_policy import backend_candidates
from opta_lmx.inference.engine import LoadedModel, ModelRuntimeCompatibilityError
from opta_lmx.inference.schema import AdminLoadRequest
from opta_lmx.model_safety import CompatibilityRegistry, ErrorCodes, backend_version

# ─── Helper ──────────────────────────────────────────────────────────────


def _loaded_model(model_id: str = "test/model", **kwargs) -> LoadedModel:
    """Create a LoadedModel with sensible defaults."""
    defaults = {
        "model_id": model_id,
        "loaded": True,
        "memory_used_gb": 4.0,
        "loaded_at": 1000.0,
        "backend_type": "vllm-mlx",
        "use_batching": True,
        "request_count": 0,
        "last_used_at": 1000.0,
        "context_length": 4096,
        "estimated_memory_gb": 4.0,
    }
    defaults.update(kwargs)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


# ─── Auth Tests ──────────────────────────────────────────────────────────


class TestAdminAuth:
    """Admin endpoints require authentication when configured."""

    @pytest.mark.asyncio
    async def test_rejects_without_key(self, client_with_auth: AsyncClient) -> None:
        """Returns 403 when admin key is missing."""
        response = await client_with_auth.get("/admin/status")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_wrong_key(self, client_with_auth: AsyncClient) -> None:
        """Returns 403 when admin key is incorrect."""
        response = await client_with_auth.get(
            "/admin/status", headers={"x-admin-key": "wrong-key"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_accepts_correct_key(self, client_with_auth: AsyncClient) -> None:
        """Returns 200 when admin key matches."""
        response = await client_with_auth.get(
            "/admin/status", headers={"x-admin-key": "test-secret-key"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_no_auth_when_disabled(self, client: AsyncClient) -> None:
        """Returns 200 without key when auth is not configured."""
        response = await client.get("/admin/status")
        assert response.status_code == 200


# ─── Status ──────────────────────────────────────────────────────────────


class TestAdminStatus:
    """Tests for GET /admin/status."""

    @pytest.mark.asyncio
    async def test_returns_version(self, client: AsyncClient) -> None:
        """Status includes version."""
        response = await client.get("/admin/status")
        data = response.json()
        assert data["version"] == __version__

    @pytest.mark.asyncio
    async def test_returns_uptime(self, client: AsyncClient) -> None:
        """Status includes uptime in seconds."""
        response = await client.get("/admin/status")
        data = response.json()
        assert "uptime_seconds" in data
        assert data["uptime_seconds"] >= 0

    @pytest.mark.asyncio
    async def test_shows_loaded_models_count(self, client: AsyncClient) -> None:
        """Status includes loaded model count."""
        response = await client.get("/admin/status")
        data = response.json()
        assert data["loaded_models"] == 0
        assert data["models"] == []


# ─── Memory ──────────────────────────────────────────────────────────────


class TestAdminMemory:
    """Tests for GET /admin/memory."""

    @pytest.mark.asyncio
    async def test_returns_memory_breakdown(self, client: AsyncClient) -> None:
        """Memory endpoint returns total, used, available, threshold."""
        response = await client.get("/admin/memory")
        assert response.status_code == 200
        data = response.json()
        assert "total_unified_memory_gb" in data
        assert "used_gb" in data
        assert "available_gb" in data
        assert "threshold_percent" in data
        assert data["threshold_percent"] == 90


# ─── Load / Unload ───────────────────────────────────────────────────────


class TestAdminLoad:
    """Tests for POST /admin/models/load."""

    def test_admin_load_request_declares_allow_unsupported_runtime_once(self) -> None:
        """Schema class should not duplicate allow_unsupported_runtime declarations."""
        source = inspect.getsource(AdminLoadRequest)
        assert source.count("allow_unsupported_runtime") == 1

    def test_loader_error_codes_are_defined(self) -> None:
        """Loader timeout/crash/probe codes should be exposed for deterministic API mapping."""
        assert ErrorCodes.MODEL_LOAD_TIMEOUT == "model_load_timeout"
        assert ErrorCodes.MODEL_LOADER_CRASHED == "model_loader_crashed"
        assert ErrorCodes.MODEL_PROBE_FAILED == "model_probe_failed"

    @pytest.mark.asyncio
    async def test_load_model_on_disk(self, client: AsyncClient) -> None:
        """Loading a model that's on disk returns success."""
        response = await client.post(
            "/admin/models/load", json={"model_id": "test/model"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["model_id"] == "test/model"

    @pytest.mark.asyncio
    async def test_load_already_loaded(self, client: AsyncClient) -> None:
        """Loading an already-loaded model returns success immediately."""
        # Load first
        await client.post("/admin/models/load", json={"model_id": "test/model"})
        # Load again
        response = await client.post(
            "/admin/models/load", json={"model_id": "test/model"},
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    @pytest.mark.asyncio
    async def test_load_writes_update_journal(self, client: AsyncClient) -> None:
        """Successful model loads emit an update journal entry when enabled."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.journal_manager = MagicMock()
        app.state.journal_manager.write_update_log = MagicMock()

        response = await client.post("/admin/models/load", json={"model_id": "test/model"})
        assert response.status_code == 200
        app.state.journal_manager.write_update_log.assert_called_once()
        call = app.state.journal_manager.write_update_log.call_args.kwargs
        assert call["title"] == "Load test/model"
        assert call["category"] == "sync"

    @pytest.mark.asyncio
    async def test_load_not_on_disk_returns_202(self, client: AsyncClient) -> None:
        """Loading a model not on disk returns 202 with confirmation token."""
        app = client._transport.app  # type: ignore[union-attr]
        # Make is_model_available return False
        app.state.model_manager.is_model_available = AsyncMock(return_value=False)
        app.state.model_manager.estimate_size = AsyncMock(return_value=5_000_000_000)

        response = await client.post(
            "/admin/models/load", json={"model_id": "big/model"},
        )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "download_required"
        assert data["confirmation_token"] is not None
        assert data["confirm_url"] == "/admin/models/load/confirm"

    @pytest.mark.asyncio
    async def test_load_rejects_unsupported_max_context_length(self, client: AsyncClient) -> None:
        """max_context_length is rejected until backend-native support exists."""
        response = await client.post(
            "/admin/models/load",
            json={"model_id": "test/model", "max_context_length": 8192},
        )
        assert response.status_code == 400
        body = response.json()
        assert body["error"]["param"] == "max_context_length"
        assert body["error"]["code"] == "not_supported"

    @pytest.mark.asyncio
    async def test_load_incomplete_snapshot_returns_202_repair_prompt(
        self,
        client: AsyncClient,
    ) -> None:
        """Cached-but-incomplete models should require a repair download instead of 500."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.model_manager.is_model_available = AsyncMock(return_value=True)
        app.state.model_manager.is_local_snapshot_complete = AsyncMock(return_value=False)
        estimate = AsyncMock(return_value=1_000_000_000)
        app.state.model_manager.estimate_size = estimate

        response = await client.post("/admin/models/load", json={"model_id": "broken/model"})
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "download_required"
        assert "repair" in data["message"].lower()
        estimate.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_load_auto_download_returns_507_when_disk_is_insufficient(
        self,
        client: AsyncClient,
    ) -> None:
        """auto_download should surface disk-space failures with structured 507."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.model_manager.is_model_available = AsyncMock(return_value=False)
        app.state.model_manager.estimate_size = AsyncMock(return_value=2_000_000_000)
        app.state.model_manager.start_download = AsyncMock(
            side_effect=OSError("Insufficient disk space"),
        )

        response = await client.post(
            "/admin/models/load",
            json={"model_id": "broken/model", "auto_download": True},
        )
        assert response.status_code == 507
        body = response.json()
        assert body["error"]["code"] == "insufficient_disk"

    @pytest.mark.asyncio
    async def test_load_on_disk_returns_507_when_engine_raises_oserror(
        self,
        client: AsyncClient,
    ) -> None:
        """On-disk load should map OSError to structured insufficient_disk errors."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.load_model = AsyncMock(side_effect=OSError("No space left on device"))

        response = await client.post("/admin/models/load", json={"model_id": "test/model"})
        assert response.status_code == 507
        body = response.json()
        assert body["error"]["code"] == "insufficient_disk"

    @pytest.mark.asyncio
    async def test_load_runtime_incompatible_returns_422(
        self,
        client: AsyncClient,
    ) -> None:
        """Runtime compatibility guard errors should surface as explicit 422."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.load_model = AsyncMock(
            side_effect=ModelRuntimeCompatibilityError("blocked-test"),
        )

        response = await client.post("/admin/models/load", json={"model_id": "test/model"})
        assert response.status_code == 422
        body = response.json()
        assert body["error"]["code"] == "model_unsupported_backend"
        assert body["error"]["param"] == "model_id"

    @pytest.mark.asyncio
    async def test_load_passes_allow_unsupported_runtime_flag(
        self,
        client: AsyncClient,
    ) -> None:
        """Load API forwards allow_unsupported_runtime to engine for explicit override."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.load_model = AsyncMock(
            return_value=SimpleNamespace(memory_used_gb=11.1),
        )

        response = await client.post(
            "/admin/models/load",
            json={"model_id": "test/model", "allow_unsupported_runtime": True},
        )
        assert response.status_code == 200
        kwargs = app.state.engine.load_model.await_args.kwargs
        assert kwargs["allow_unsupported_runtime"] is True

    @pytest.mark.asyncio
    async def test_load_runtime_timeout_maps_to_deterministic_loader_code(
        self,
        client: AsyncClient,
    ) -> None:
        """Loader timeout errors should map to deterministic model_load_timeout API code."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.load_model = AsyncMock(
            side_effect=RuntimeError("model_load_timeout:Loader timed out after 120s"),
        )

        response = await client.post("/admin/models/load", json={"model_id": "test/model"})
        assert response.status_code == 409
        body = response.json()
        assert body["error"]["code"] == "model_load_timeout"
        assert body["error"]["param"] == "model_id"


class TestAdminProbe:
    @pytest.mark.asyncio
    async def test_admin_probe_returns_candidate_backends_and_outcomes(
        self,
        client: AsyncClient,
    ) -> None:
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.probe_model_backends = AsyncMock(
            return_value={
                "model_id": "test/model",
                "recommended_backend": "vllm-mlx",
                "candidates": [
                    {"backend": "vllm-mlx", "outcome": "pass", "reason": None},
                    {"backend": "mlx-lm", "outcome": "unknown", "reason": "not_probed"},
                ],
            },
        )

        response = await client.post("/admin/models/probe", json={"model_id": "test/model"})
        assert response.status_code == 200
        body = response.json()
        assert body["recommended_backend"] == "vllm-mlx"
        assert body["candidates"][0]["backend"] == "vllm-mlx"
        assert body["candidates"][0]["outcome"] == "pass"

    @pytest.mark.asyncio
    async def test_admin_probe_respects_allow_unsupported_runtime(
        self,
        client: AsyncClient,
    ) -> None:
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine.probe_model_backends = AsyncMock(
            return_value={
                "model_id": "test/model",
                "recommended_backend": "mlx-lm",
                "candidates": [
                    {"backend": "mlx-lm", "outcome": "unknown", "reason": "not_probed"},
                ],
            },
        )

        response = await client.post(
            "/admin/models/probe",
            json={"model_id": "test/model", "allow_unsupported_runtime": True},
        )
        assert response.status_code == 200
        kwargs = app.state.engine.probe_model_backends.await_args.kwargs
        assert kwargs["allow_unsupported_runtime"] is True


class TestAdminCompatibility:
    @pytest.mark.asyncio
    async def test_admin_models_compatibility_returns_filtered_rows(
        self,
        client: AsyncClient,
        tmp_path,
    ) -> None:
        app = client._transport.app  # type: ignore[union-attr]
        registry = CompatibilityRegistry(path=tmp_path / "compat-admin.json")
        registry.record(
            model_id="test/model",
            backend="vllm-mlx",
            backend_version_value="0.2.6",
            outcome="fail",
            reason="loader_crash",
        )
        registry.record(
            model_id="other/model",
            backend="vllm-mlx",
            backend_version_value="0.2.6",
            outcome="pass",
            reason="ok",
        )
        app.state.engine._compatibility = registry

        response = await client.get(
            "/admin/models/compatibility",
            params={"model_id": "test/model", "backend": "vllm-mlx", "outcome": "fail"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["rows"][0]["model_id"] == "test/model"
        assert body["rows"][0]["outcome"] == "fail"

    @pytest.mark.asyncio
    async def test_admin_models_compatibility_supports_since_and_limit(
        self,
        client: AsyncClient,
        tmp_path,
    ) -> None:
        app = client._transport.app  # type: ignore[union-attr]
        registry = CompatibilityRegistry(path=tmp_path / "compat-admin.json")
        registry.record(
            model_id="test/model",
            backend="vllm-mlx",
            backend_version_value="0.2.6",
            outcome="pass",
            reason="ok",
        )
        registry.record(
            model_id="test/model",
            backend="mlx-lm",
            backend_version_value="0.30.7",
            outcome="unknown",
            reason="not_probed",
        )
        app.state.engine._compatibility = registry

        response = await client.get(
            "/admin/models/compatibility",
            params={"model_id": "test/model", "since_ts": 0, "limit": 1},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert len(body["rows"]) == 1


class TestAdminAutotune:
    @pytest.mark.asyncio
    async def test_admin_autotune_post_and_get_roundtrip(
        self,
        client: AsyncClient,
        tmp_path,
    ) -> None:
        app = client._transport.app  # type: ignore[union-attr]
        app.state.engine._autotune = AutotuneRegistry(path=tmp_path / "autotune-admin.json")

        async def stream_tokens(**_kwargs):
            for token in ("A", "B", "C"):
                yield token

        app.state.engine.stream_generate = stream_tokens

        response = await client.post(
            "/admin/models/autotune",
            json={
                "model_id": "test/model",
                "runs": 1,
                "max_tokens": 16,
                "profiles": [
                    {"kv_bits": 4},
                    {"kv_bits": 8},
                ],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["model_id"] == "test/model"
        assert len(body["candidates"]) == 2
        assert body["best_profile"] in [{"kv_bits": 4}, {"kv_bits": 8}]

        get_resp = await client.get(
            "/admin/models/test/model/autotune",
            params={"backend": body["backend"], "backend_version": body["backend_version"]},
        )
        assert get_resp.status_code == 200
        saved = get_resp.json()
        assert saved["model_id"] == "test/model"
        assert saved["profile"] == body["best_profile"]

    @pytest.mark.asyncio
    async def test_load_applies_tuned_profile_when_explicit_override_missing(
        self,
        client: AsyncClient,
        tmp_path,
    ) -> None:
        from opta_lmx.presets.manager import Preset

        app = client._transport.app  # type: ignore[union-attr]
        preset_mgr = app.state.preset_manager
        preset_mgr._presets["p"] = Preset(
            name="p",
            model="test/model",
            performance={"kv_bits": 8, "prefix_cache": True},
        )

        registry = AutotuneRegistry(path=tmp_path / "autotune-load.json")
        registry.save_best(
            model_id="test/model",
            backend="vllm-mlx",
            backend_version=backend_version("mlx"),
            profile={"kv_bits": 4, "prefix_cache": False},
            metrics={
                "avg_tokens_per_second": 100.0,
                "avg_ttft_ms": 50.0,
                "avg_total_ms": 150.0,
                "error_rate": 0.0,
                "queue_wait_ms": 0.0,
            },
            score=99.25,
        )
        app.state.engine._autotune = registry
        app.state.engine.load_model = AsyncMock(return_value=SimpleNamespace(memory_used_gb=1.0))

        response = await client.post("/admin/models/load", json={"model_id": "test/model"})
        assert response.status_code == 200
        kwargs = app.state.engine.load_model.await_args.kwargs
        perf = kwargs["performance_overrides"]
        assert perf["kv_bits"] == 4
        assert perf["prefix_cache"] is False


class TestAdminUnload:
    """Tests for POST /admin/models/unload."""

    @pytest.mark.asyncio
    async def test_unload_loaded_model(self, client: AsyncClient) -> None:
        """Unloading a loaded model frees memory."""
        # Load first
        await client.post("/admin/models/load", json={"model_id": "test/model"})

        response = await client.post(
            "/admin/models/unload", json={"model_id": "test/model"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_unload_not_loaded_returns_404(self, client: AsyncClient) -> None:
        """Unloading a model that isn't loaded returns 404."""
        response = await client.post(
            "/admin/models/unload", json={"model_id": "nonexistent/model"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_unload_writes_update_journal(self, client: AsyncClient) -> None:
        """Successful unloads emit an update journal entry when enabled."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.journal_manager = MagicMock()
        app.state.journal_manager.write_update_log = MagicMock()

        await client.post("/admin/models/load", json={"model_id": "test/model"})
        app.state.journal_manager.write_update_log.reset_mock()

        response = await client.post("/admin/models/unload", json={"model_id": "test/model"})
        assert response.status_code == 200
        app.state.journal_manager.write_update_log.assert_called_once()
        call = app.state.journal_manager.write_update_log.call_args.kwargs
        assert call["title"] == "Unload test/model"
        assert call["category"] == "sync"
        assert call["promoted"] is False


# ─── Models List ─────────────────────────────────────────────────────────


class TestAdminModelsList:
    """Tests for GET /admin/models."""

    @pytest.mark.asyncio
    async def test_empty_when_none_loaded(self, client: AsyncClient) -> None:
        """Returns empty list when no models are loaded."""
        response = await client.get("/admin/models")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["loaded"] == []

    @pytest.mark.asyncio
    async def test_lists_loaded_models(self, client: AsyncClient) -> None:
        """Returns loaded models after loading one."""
        await client.post("/admin/models/load", json={"model_id": "test/model"})

        response = await client.get("/admin/models")
        data = response.json()
        assert data["count"] == 1
        assert data["loaded"][0]["id"] == "test/model"


# ─── Delete ──────────────────────────────────────────────────────────────


class TestAdminDelete:
    """Tests for DELETE /admin/models/{model_id}."""

    @pytest.mark.asyncio
    async def test_delete_loaded_model_returns_409(self, client: AsyncClient) -> None:
        """Cannot delete a model that is currently loaded."""
        await client.post("/admin/models/load", json={"model_id": "test/model"})

        response = await client.request(
            "DELETE", "/admin/models/test/model",
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_delete_path_traversal_returns_400(self, client: AsyncClient) -> None:
        """Path traversal in model_id is rejected."""
        # Use a model_id that embeds ".." — httpx normalizes pure ../ in URLs,
        # so we use a path segment containing ".." that doesn't get normalized.
        response = await client.request(
            "DELETE", "/admin/models/safe/../../etc/passwd",
        )
        # FastAPI routing may normalize this to /admin/models/../etc/passwd → /admin/etc/passwd
        # which won't match the route at all (404). Instead test via the other branch:
        # model_id starting with "/"
        response = await client.request(
            "DELETE", "/admin/models/%2Fetc%2Fpasswd",
        )
        assert response.status_code == 400


# ─── Metrics ─────────────────────────────────────────────────────────────


class TestAdminMetrics:
    """Tests for GET /admin/metrics and /admin/metrics/json."""

    @pytest.mark.asyncio
    async def test_prometheus_format(self, client: AsyncClient) -> None:
        """Prometheus endpoint returns text/plain."""
        response = await client.get("/admin/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]

    @pytest.mark.asyncio
    async def test_json_metrics(self, client: AsyncClient) -> None:
        """JSON metrics endpoint returns dict."""
        response = await client.get("/admin/metrics/json")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)


# ─── Presets ─────────────────────────────────────────────────────────────


class TestAdminPresets:
    """Tests for preset management endpoints."""

    @pytest.mark.asyncio
    async def test_list_presets_empty(self, client: AsyncClient) -> None:
        """Returns empty list when no presets are loaded."""
        response = await client.get("/admin/presets")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0

    @pytest.mark.asyncio
    async def test_get_preset_not_found(self, client: AsyncClient) -> None:
        """Returns 404 for nonexistent preset."""
        response = await client.get("/admin/presets/nonexistent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_reload_presets(self, client: AsyncClient) -> None:
        """Preset reload returns success."""
        response = await client.post("/admin/presets/reload")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


# ─── Stack ───────────────────────────────────────────────────────────────


class TestAdminStack:
    """Tests for GET /admin/stack."""

    @pytest.mark.asyncio
    async def test_returns_stack_overview(self, client: AsyncClient) -> None:
        """Stack endpoint returns roles, helpers, and loaded models."""
        response = await client.get("/admin/stack")
        assert response.status_code == 200
        data = response.json()
        assert "roles" in data
        assert "helper_nodes" in data
        assert "loaded_models" in data
        assert "default_model" in data

    @pytest.mark.asyncio
    async def test_roles_from_routing_config(self, client: AsyncClient) -> None:
        """Stack shows roles from routing aliases."""
        response = await client.get("/admin/stack")
        data = response.json()
        # Default routing config has code, reasoning, chat aliases
        assert "code" in data["roles"]
        assert "reasoning" in data["roles"]
        assert "chat" in data["roles"]

    @pytest.mark.asyncio
    async def test_helper_nodes_empty_by_default(self, client: AsyncClient) -> None:
        """Helper nodes are empty when not configured."""
        response = await client.get("/admin/stack")
        data = response.json()
        assert data["helper_nodes"] == {}

    @pytest.mark.asyncio
    async def test_stack_shows_loaded_model(self, client: AsyncClient) -> None:
        """Stack lists loaded models after loading one."""
        await client.post("/admin/models/load", json={"model_id": "test/model"})

        response = await client.get("/admin/stack")
        data = response.json()
        assert "test/model" in data["loaded_models"]


# ─── Config Reload ───────────────────────────────────────────────────────


class TestConfigReload:
    """Tests for POST /admin/config/reload."""

    @pytest.mark.asyncio
    async def test_reload_returns_success(self, client: AsyncClient) -> None:
        """Config reload returns updated sections list."""
        response = await client.post("/admin/config/reload")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "routing" in data["updated"]
        assert "memory" in data["updated"]

    @pytest.mark.asyncio
    async def test_reload_updates_memory_threshold(self, client: AsyncClient) -> None:
        """Config reload updates the memory threshold from loaded config."""
        app = client._transport.app  # type: ignore[union-attr]

        # Patch load_config to return a known config with threshold=85

        from opta_lmx.config import LMXConfig, MemoryConfig

        test_config = LMXConfig(memory=MemoryConfig(max_memory_percent=85))
        with patch("opta_lmx.api.admin.load_config", return_value=test_config):
            response = await client.post("/admin/config/reload")
            assert response.status_code == 200

        # Threshold should match the loaded config
        assert app.state.memory_monitor.threshold_percent == 85

    @pytest.mark.asyncio
    async def test_reload_writes_update_journal(self, client: AsyncClient) -> None:
        """Config reload emits an update journal entry when enabled."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.journal_manager = MagicMock()
        app.state.journal_manager.write_update_log = MagicMock()

        response = await client.post("/admin/config/reload")
        assert response.status_code == 200
        app.state.journal_manager.write_update_log.assert_called_once()
        call = app.state.journal_manager.write_update_log.call_args.kwargs
        assert call["title"] == "Reload LMX Config"
        assert call["category"] == "sync"


# ─── Benchmark ───────────────────────────────────────────────────────────


class TestBenchmark:
    """Tests for POST /admin/benchmark."""

    @pytest.mark.asyncio
    async def test_benchmark_model_not_loaded(self, client: AsyncClient) -> None:
        """Benchmark returns 404 when model is not loaded."""
        response = await client.post("/admin/benchmark", json={
            "model_id": "nonexistent/model",
            "prompt": "Hello",
        })
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_benchmark_returns_results(self, client: AsyncClient) -> None:
        """Benchmark returns timing results for loaded model."""
        app = client._transport.app  # type: ignore[union-attr]

        # Load model first
        await client.post("/admin/models/load", json={"model_id": "test/model"})

        # Patch stream_generate to yield tokens
        async def mock_stream(**kwargs):
            for token in ["Hello", " World", "!"]:
                yield token

        app.state.engine.stream_generate = mock_stream

        response = await client.post("/admin/benchmark", json={
            "model_id": "test/model",
            "prompt": "Say hello",
            "max_tokens": 100,
            "runs": 2,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "test/model"
        assert data["runs"] == 2
        assert len(data["results"]) == 2
        assert data["results"][0]["tokens_generated"] == 3
        assert data["avg_tokens_per_second"] > 0
        assert data["avg_time_to_first_token_ms"] >= 0
        assert "speculative" in data
        assert isinstance(data["speculative"]["active"], bool)
        assert isinstance(data["speculative"]["ignored_tokens"], int)
        assert "speculative" in data["results"][0]


# ─── Performance Override & Visibility ───────────────────────────────────


class TestPerformanceOverrides:
    """Tests for performance override wiring in load, models list, and perf endpoint."""

    @pytest.mark.asyncio
    async def test_load_stores_performance_overrides(self, client: AsyncClient) -> None:
        """Loading with performance_overrides stores them in the loaded model."""
        response = await client.post(
            "/admin/models/load",
            json={
                "model_id": "test/model",
                "performance_overrides": {"kv_bits": 4, "prefix_cache": False},
            },
        )
        assert response.status_code == 200

        # Verify via admin models list
        models_resp = await client.get("/admin/models")
        data = models_resp.json()
        assert data["count"] == 1
        model = data["loaded"][0]
        assert model["performance"]["kv_bits"] == 4
        assert model["performance"]["prefix_cache"] is False

    @pytest.mark.asyncio
    async def test_load_without_overrides_has_empty_performance(self, client: AsyncClient) -> None:
        """Loading without overrides gives empty performance dict."""
        await client.post("/admin/models/load", json={"model_id": "test/model"})
        models_resp = await client.get("/admin/models")
        model = models_resp.json()["loaded"][0]
        assert model["performance"] == {}

    @pytest.mark.asyncio
    async def test_performance_endpoint_returns_model_details(self, client: AsyncClient) -> None:
        """GET /admin/models/{id}/performance returns full model details."""
        await client.post(
            "/admin/models/load",
            json={
                "model_id": "test/model",
                "performance_overrides": {"prefix_cache": True},
            },
        )
        response = await client.get("/admin/models/test/model/performance")
        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "test/model"
        assert data["backend_type"] == "mlx"
        assert data["performance"] == {"prefix_cache": True}
        assert "speculative" in data
        assert isinstance(data["speculative"]["active"], bool)
        assert "global_defaults" in data
        assert "kv_bits" in data["global_defaults"]
        assert "prefix_cache_enabled" in data["global_defaults"]


class TestBackendPolicyFallback:
    def test_backend_policy_fallback_for_gguf_model_id(self, tmp_path) -> None:
        cfg = SimpleNamespace(
            backend_preference_order=["vllm-mlx", "mlx-lm"],
            gguf_fallback_enabled=False,
        )
        registry = CompatibilityRegistry(path=tmp_path / "compat-admin-policy.json")
        assert backend_candidates("models/local-model.gguf", cfg, registry) == ["gguf"]

    @pytest.mark.asyncio
    async def test_performance_endpoint_not_loaded_returns_404(self, client: AsyncClient) -> None:
        """GET /admin/models/{id}/performance returns 404 when model not loaded."""
        response = await client.get("/admin/models/nonexistent/model/performance")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_performance_endpoint_shows_global_defaults(self, client: AsyncClient) -> None:
        """Performance endpoint includes engine global defaults for comparison."""
        await client.post("/admin/models/load", json={"model_id": "test/model"})
        response = await client.get("/admin/models/test/model/performance")
        data = response.json()
        defaults = data["global_defaults"]
        assert "max_concurrent_requests" in defaults
        assert "speculative_model" in defaults
        assert "warmup_on_load" in defaults

    @pytest.mark.asyncio
    async def test_load_overrides_merge_with_preset(self, client: AsyncClient) -> None:
        """Manual overrides merge on top of preset defaults."""
        app = client._transport.app  # type: ignore[union-attr]
        preset_mgr = app.state.preset_manager

        # Simulate a preset with performance section
        from opta_lmx.presets.manager import Preset

        preset_mgr._presets["test-preset"] = Preset(
            name="test-preset",
            model="test/model",
            performance={"prefix_cache": True, "kv_bits": 8},
        )

        # Load with manual override that overrides kv_bits but keeps prefix_cache
        response = await client.post(
            "/admin/models/load",
            json={
                "model_id": "test/model",
                "performance_overrides": {"kv_bits": 4},
            },
        )
        assert response.status_code == 200

        # Check merged result
        perf_resp = await client.get("/admin/models/test/model/performance")
        perf = perf_resp.json()["performance"]
        assert perf["kv_bits"] == 4  # manual override wins
        assert perf["prefix_cache"] is True  # from preset
