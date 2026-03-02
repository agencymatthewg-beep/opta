"""Contract tests for discovery document v2 additive fields."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_discovery_contract_v2_fields(client: AsyncClient) -> None:
    """Discovery contract includes additive schema and continuity metadata."""
    response = await client.get("/.well-known/opta-lmx")
    assert response.status_code == 200
    data = response.json()
    assert data["schema_version"] == "2026-03-02"
    assert "instance_id" in data
    assert "continuity" in data
    assert data["continuity"]["event_resume_supported"] is True
