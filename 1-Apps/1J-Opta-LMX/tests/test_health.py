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
    async def test_requires_auth(self, client_with_auth: AsyncClient) -> None:
        """Admin health requires admin key when configured."""
        response = await client_with_auth.get("/admin/health")
        assert response.status_code == 403

        response = await client_with_auth.get(
            "/admin/health", headers={"x-admin-key": "test-secret-key"},
        )
        assert response.status_code == 200
