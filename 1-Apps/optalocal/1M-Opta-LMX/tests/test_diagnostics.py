"""Tests for diagnostics endpoint and event classification."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from opta_lmx.api.admin_diagnostics import _compute_health_verdict
from opta_lmx.monitoring.event_schema import (
    EventCategory,
    StandardizedEvent,
    classify_event,
)

# ─── Event classification tests ────────────────────────────────────────


class TestClassifyEvent:
    """Tests for classify_event() prefix-to-category and severity mapping."""

    def test_inference_prefix(self) -> None:
        category, severity = classify_event("inference_started")
        assert category == EventCategory.INFERENCE
        assert severity == "info"

    def test_model_lifecycle_prefix(self) -> None:
        category, severity = classify_event("model_loaded")
        assert category == EventCategory.MODEL_LIFECYCLE
        assert severity == "info"

    def test_model_unloaded_is_warning(self) -> None:
        category, severity = classify_event("model_unloaded")
        assert category == EventCategory.MODEL_LIFECYCLE
        assert severity == "warning"

    def test_model_load_failed_is_error(self) -> None:
        category, severity = classify_event("model_load_failed")
        assert category == EventCategory.MODEL_LIFECYCLE
        assert severity == "error"

    def test_agent_prefix(self) -> None:
        category, severity = classify_event("agent_step_completed")
        assert category == EventCategory.AGENT
        assert severity == "info"

    def test_skill_prefix(self) -> None:
        category, severity = classify_event("skill_invoked")
        assert category == EventCategory.SKILL
        assert severity == "info"

    def test_auth_prefix_maps_to_security(self) -> None:
        category, severity = classify_event("auth_denied")
        assert category == EventCategory.SECURITY
        assert severity == "error"

    def test_server_prefix_maps_to_system(self) -> None:
        category, severity = classify_event("server_starting")
        assert category == EventCategory.SYSTEM
        assert severity == "info"

    def test_crash_loop_is_critical(self) -> None:
        category, severity = classify_event("crash_loop_detected")
        assert category == EventCategory.SYSTEM
        assert severity == "critical"

    def test_unknown_prefix_defaults_to_system(self) -> None:
        category, severity = classify_event("custom_event_xyz")
        assert category == EventCategory.SYSTEM
        assert severity == "info"

    def test_error_substring_raises_severity(self) -> None:
        category, severity = classify_event("inference_timeout")
        assert category == EventCategory.INFERENCE
        assert severity == "error"

    def test_download_prefix_maps_to_model_lifecycle(self) -> None:
        category, severity = classify_event("download_progress")
        assert category == EventCategory.MODEL_LIFECYCLE
        assert severity == "info"

    def test_rate_limit_maps_to_security(self) -> None:
        category, severity = classify_event("rate_limit_exceeded")
        assert category == EventCategory.SECURITY
        assert severity == "error"

    def test_memory_pressure_is_warning(self) -> None:
        category, severity = classify_event("memory_pressure")
        assert category == EventCategory.SYSTEM
        assert severity == "warning"

    def test_admin_prefix(self) -> None:
        category, severity = classify_event("admin_reload")
        assert category == EventCategory.ADMIN
        assert severity == "info"

    def test_mcp_prefix_maps_to_skill(self) -> None:
        category, severity = classify_event("mcp_bridge_connected")
        assert category == EventCategory.SKILL
        assert severity == "info"

    def test_completion_prefix_maps_to_inference(self) -> None:
        category, severity = classify_event("completion_finished")
        assert category == EventCategory.INFERENCE
        assert severity == "info"


class TestStandardizedEvent:
    """Validate the Pydantic model construction."""

    def test_create_minimal(self) -> None:
        event = StandardizedEvent(
            event_type="model_loaded",
            category=EventCategory.MODEL_LIFECYCLE,
            severity="info",
        )
        assert event.event_type == "model_loaded"
        assert event.category == EventCategory.MODEL_LIFECYCLE
        assert event.severity == "info"
        assert event.correlation_id is None
        assert event.model_id is None

    def test_create_full(self) -> None:
        event = StandardizedEvent(
            event_type="inference_failed",
            data={"error": "oom"},
            category=EventCategory.INFERENCE,
            severity="error",
            correlation_id="req-123",
            model_id="test/model",
            client_id="cli-456",
        )
        assert event.correlation_id == "req-123"
        assert event.model_id == "test/model"
        assert event.client_id == "cli-456"


# ─── Health verdict tests ──────────────────────────────────────────────


class TestHealthVerdict:
    """Tests for _compute_health_verdict logic."""

    def test_healthy_baseline(self) -> None:
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=0.0,
            crash_loop=False,
        )
        assert verdict == "healthy"

    def test_high_memory_is_degraded(self) -> None:
        verdict = _compute_health_verdict(
            memory_percent=91.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=0.0,
            crash_loop=False,
        )
        assert verdict == "degraded"

    def test_quarantined_models_is_degraded(self) -> None:
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=2,
            error_rate_pct=0.0,
            crash_loop=False,
        )
        assert verdict == "degraded"

    def test_high_error_rate_is_critical(self) -> None:
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=6.0,
            crash_loop=False,
        )
        assert verdict == "critical"

    def test_crash_loop_is_critical(self) -> None:
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=0.0,
            crash_loop=True,
        )
        assert verdict == "critical"

    def test_crash_loop_overrides_degraded(self) -> None:
        """Crash loop is critical even if memory is fine."""
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=1,
            error_rate_pct=0.0,
            crash_loop=True,
        )
        assert verdict == "critical"

    def test_threshold_exact_boundary(self) -> None:
        """Memory exactly at threshold triggers degraded."""
        verdict = _compute_health_verdict(
            memory_percent=90.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=0.0,
            crash_loop=False,
        )
        assert verdict == "degraded"

    def test_error_rate_exactly_five_is_not_critical(self) -> None:
        """Error rate must exceed 5% (not equal) for critical."""
        verdict = _compute_health_verdict(
            memory_percent=50.0,
            memory_threshold=90,
            quarantined_count=0,
            error_rate_pct=5.0,
            crash_loop=False,
        )
        assert verdict == "healthy"


# ─── Endpoint integration tests ────────────────────────────────────────


def _mock_loaded_model(
    model_id: str = "test/model",
    loaded_at: float = 1000.0,
    request_count: int = 42,
    estimated_memory_gb: float = 4.0,
    backend_type: str = "vllm-mlx",
) -> MagicMock:
    """Create a mock LoadedModel for testing."""
    mock = MagicMock()
    mock.model_id = model_id
    mock.loaded_at = loaded_at
    mock.request_count = request_count
    mock.estimated_memory_gb = estimated_memory_gb
    mock.backend_type = backend_type
    return mock


class TestDiagnosticsEndpoint:
    """Integration tests for GET /admin/diagnostics."""

    @pytest.mark.asyncio
    async def test_returns_all_required_fields(self, client: AsyncClient) -> None:
        """Response includes all top-level sections."""
        response = await client.get("/admin/diagnostics")
        assert response.status_code == 200
        body = response.json()

        assert "timestamp" in body
        assert "system" in body
        assert "models" in body
        assert "inference" in body
        assert "agents" in body
        assert "recent_errors" in body
        assert "health_verdict" in body

    @pytest.mark.asyncio
    async def test_system_section_fields(self, client: AsyncClient) -> None:
        """System section includes memory, uptime, python version."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        system = body["system"]

        assert "memory_percent" in system
        assert "memory_gb_used" in system
        assert "memory_gb_total" in system
        assert "uptime_seconds" in system
        assert "python_version" in system
        assert "crash_loop_detected" in system
        assert isinstance(system["crash_loop_detected"], bool)

    @pytest.mark.asyncio
    async def test_models_section_fields(self, client: AsyncClient) -> None:
        """Models section includes loaded/quarantined counts and model list."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        models = body["models"]

        assert "loaded_count" in models
        assert "quarantined_count" in models
        assert "models" in models
        assert isinstance(models["models"], list)

    @pytest.mark.asyncio
    async def test_inference_section_fields(self, client: AsyncClient) -> None:
        """Inference section includes request stats and latency."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        inference = body["inference"]

        assert "total_requests" in inference
        assert "active_requests" in inference
        assert "avg_latency_ms" in inference
        assert "error_rate_pct" in inference
        assert "tokens_generated" in inference

    @pytest.mark.asyncio
    async def test_agents_section_fields(self, client: AsyncClient) -> None:
        """Agents section includes run counts."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        agents = body["agents"]

        assert "active_runs" in agents
        assert "completed_runs" in agents
        assert "failed_runs" in agents

    @pytest.mark.asyncio
    async def test_healthy_verdict_baseline(self, client: AsyncClient) -> None:
        """Baseline mock state should return healthy verdict."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        assert body["health_verdict"] == "healthy"

    @pytest.mark.asyncio
    async def test_admin_auth_required(self, client_with_auth: AsyncClient) -> None:
        """Endpoint requires admin key when configured."""
        response = await client_with_auth.get("/admin/diagnostics")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_auth_passes_with_key(self, client_with_auth: AsyncClient) -> None:
        """Endpoint succeeds with correct admin key."""
        response = await client_with_auth.get(
            "/admin/diagnostics",
            headers={"x-admin-key": "test-secret-key"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "health_verdict" in body

    @pytest.mark.asyncio
    async def test_recent_errors_is_list(self, client: AsyncClient) -> None:
        """Recent errors is always a list (empty if no journaling)."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        assert isinstance(body["recent_errors"], list)

    @pytest.mark.asyncio
    async def test_uptime_is_positive(self, client: AsyncClient) -> None:
        """Uptime should be a positive number."""
        response = await client.get("/admin/diagnostics")
        body = response.json()
        # start_time is set to 0.0 in test fixtures, so uptime = now - 0 = large
        assert body["system"]["uptime_seconds"] > 0


# ─── EventCategory enum tests ──────────────────────────────────────────


class TestEventCategory:
    """Verify EventCategory enum values."""

    def test_all_values(self) -> None:
        values = {e.value for e in EventCategory}
        expected = {
            "inference", "model_lifecycle", "admin",
            "agent", "skill", "security", "system",
        }
        assert values == expected

    def test_str_enum_usage(self) -> None:
        """EventCategory members are usable as plain strings."""
        assert EventCategory.INFERENCE == "inference"
        assert f"category={EventCategory.ADMIN}" == "category=admin"
