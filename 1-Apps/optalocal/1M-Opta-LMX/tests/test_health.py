"""Tests for health check endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from opta_lmx import __version__


class TestHealthz:
    """Tests for unauthenticated /healthz endpoint."""

    @pytest.mark.asyncio
    async def test_returns_ok(self, client: AsyncClient) -> None:
        """Healthz returns 200 with status ok."""
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == __version__

    @pytest.mark.asyncio
    async def test_no_auth_required(self, client_with_auth: AsyncClient) -> None:
        """Healthz does not require admin key."""
        response = await client_with_auth.get("/healthz")
        assert response.status_code == 200


class TestReadyz:
    """Tests for unauthenticated /readyz endpoint."""

    @pytest.mark.asyncio
    async def test_returns_503_when_no_models_loaded(self, client: AsyncClient) -> None:
        """Readyz returns 503 when no models are loaded."""
        response = await client.get("/readyz")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unavailable"

    @pytest.mark.asyncio
    async def test_returns_200_when_model_loaded(self, client: AsyncClient) -> None:
        """Readyz returns 200 when at least one model is loaded."""
        app = client._transport.app  # type: ignore[union-attr]
        await app.state.engine.load_model("test/model-ready")
        response = await client.get("/readyz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"

    @pytest.mark.asyncio
    async def test_no_auth_required(self, client_with_auth: AsyncClient) -> None:
        """Readyz does not require admin key."""
        response = await client_with_auth.get("/readyz")
        # 503 is fine -- just prove it's not 403
        assert response.status_code != 403


class TestAdminHealth:
    """Tests for authenticated /admin/health endpoint."""

    @pytest.mark.asyncio
    async def test_returns_ok_normal_memory(self, client: AsyncClient) -> None:
        """Returns ok when memory is below threshold."""
        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == __version__

    @pytest.mark.asyncio
    async def test_returns_degraded_high_memory(self, client: AsyncClient) -> None:
        """Returns degraded when memory exceeds 95%."""
        app = client._transport.app  # type: ignore[union-attr]
        app.state.memory_monitor.usage_percent = MagicMock(return_value=96.0)

        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert "96.0%" in data["reason"]

    @pytest.mark.asyncio
    async def test_includes_metal_memory(self, client: AsyncClient) -> None:
        """Health check includes Metal GPU memory info when available."""
        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        # Metal memory fields present (may be null if MLX unavailable)
        assert "metal" in data

    @pytest.mark.asyncio
    async def test_includes_helper_node_status(self, client: AsyncClient) -> None:
        """Health check includes helper node health."""
        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        assert "helpers" in data

    @pytest.mark.asyncio
    async def test_includes_engine_status(self, client: AsyncClient) -> None:
        """Health check includes engine model count and in-flight requests."""
        response = await client.get("/admin/health")
        assert response.status_code == 200
        data = response.json()
        assert "models_loaded" in data
        assert "in_flight_requests" in data

    @pytest.mark.asyncio
    async def test_requires_auth(self, client_with_auth: AsyncClient) -> None:
        """Admin health requires admin key when configured."""
        response = await client_with_auth.get("/admin/health")
        assert response.status_code == 403

        response = await client_with_auth.get(
            "/admin/health", headers={"x-admin-key": "test-secret-key"},
        )
        assert response.status_code == 200


class TestDiscovery:
    """Tests for unauthenticated discovery metadata endpoints."""

    @pytest.mark.asyncio
    async def test_discovery_endpoint_returns_pairing_payload(self, client: AsyncClient) -> None:
        """Discovery endpoint exposes preferred URLs and auth requirements."""
        response = await client.get("/v1/discovery")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "opta-lmx"
        assert "preferred_base_url" in data["endpoints"]
        assert "openai_base_url" in data["endpoints"]
        assert "admin_key_required" in data["auth"]
        assert "loaded_model_count" in data
        assert isinstance(data["client_probe_order"], list)

    @pytest.mark.asyncio
    async def test_discovery_well_known_alias(self, client: AsyncClient) -> None:
        """Well-known discovery path returns the same discovery contract."""
        response = await client.get("/.well-known/opta-lmx")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "opta-lmx"

    @pytest.mark.asyncio
    async def test_discovery_no_auth_required(self, client_with_auth: AsyncClient) -> None:
        """Discovery remains available when admin auth is enabled."""
        response = await client_with_auth.get("/v1/discovery")
        assert response.status_code == 200
