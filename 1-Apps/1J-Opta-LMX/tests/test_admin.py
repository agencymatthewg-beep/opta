"""Tests for admin API endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from opta_lmx import __version__
from opta_lmx.inference.engine import LoadedModel


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
        assert "remote_helpers" in data
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
    async def test_remote_helpers_empty_by_default(self, client: AsyncClient) -> None:
        """Remote helpers are empty when not configured."""
        response = await client.get("/admin/stack")
        data = response.json()
        assert data["remote_helpers"] == {}

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
        from unittest.mock import patch

        from opta_lmx.config import LMXConfig, MemoryConfig

        test_config = LMXConfig(memory=MemoryConfig(max_memory_percent=85))
        with patch("opta_lmx.api.admin.load_config", return_value=test_config):
            response = await client.post("/admin/config/reload")
            assert response.status_code == 200

        # Threshold should match the loaded config
        assert app.state.memory_monitor.threshold_percent == 85


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
        assert "global_defaults" in data
        assert "kv_bits" in data["global_defaults"]
        assert "prefix_cache_enabled" in data["global_defaults"]

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
