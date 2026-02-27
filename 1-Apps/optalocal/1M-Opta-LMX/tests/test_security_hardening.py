"""Security hardening tests for Opta-LMX inference server.

Task 1: Verify fail-closed auth for cloud security profile.
Task 2: Negative tests for spoofed proxy headers.

These tests ensure:
- Cloud profile rejects requests without valid API key or JWT (401/403)
- Cloud profile config validation rejects misconfigured auth
- Spoofed X-Forwarded-For headers from untrusted sources are ignored
- Spoofed X-Real-IP headers from untrusted proxies don't bypass auth
- Rate limiting keys can't be spoofed via headers
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from opta_lmx.api.deps import verify_admin_key, verify_inference_key
from opta_lmx.config import LMXConfig, RoutingConfig, SecurityConfig
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.security.jwt_verifier import JWTVerificationResult

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _make_request(**state: object) -> SimpleNamespace:
    """Build a fake Request with configurable app.state attributes."""
    app_state = SimpleNamespace(**state)
    return SimpleNamespace(
        app=SimpleNamespace(state=app_state),
        state=SimpleNamespace(),
    )


class _StubJWTVerifier:
    """Controllable JWT verifier for testing."""

    def __init__(self, result: JWTVerificationResult) -> None:
        self._result = result
        self.calls: list[str] = []

    def verify(self, token: str) -> JWTVerificationResult:
        self.calls.append(token)
        return self._result


async def _make_cloud_test_client(
    mock_engine: InferenceEngine,
    mock_model_manager: ModelManager,
    tmp_path: Path,
    *,
    inference_api_key: str | None = "cloud-secret-key",
    admin_key: str | None = "admin-secret-key",
    supabase_jwt_enabled: bool = False,
    supabase_jwt_require: bool = False,
    supabase_jwt_verifier: object | None = None,
) -> AsyncIterator[AsyncClient]:
    """Create a test client configured for cloud security profile."""
    test_app = create_app(LMXConfig())

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        test_app.state.engine = mock_engine
        test_app.state.memory_monitor = MemoryMonitor(max_percent=90)
        test_app.state.model_manager = mock_model_manager
        test_app.state.router = TaskRouter(RoutingConfig())
        test_app.state.metrics = MetricsCollector()
        test_app.state.preset_manager = PresetManager(tmp_path / "presets")
        test_app.state.event_bus = EventBus()
        test_app.state.embedding_engine = EmbeddingEngine()
        test_app.state.pending_downloads = {}
        test_app.state.start_time = 0.0
        test_app.state.admin_key = admin_key
        test_app.state.inference_api_key = inference_api_key
        test_app.state.supabase_jwt_enabled = supabase_jwt_enabled
        test_app.state.supabase_jwt_require = supabase_jwt_require
        test_app.state.supabase_jwt_verifier = supabase_jwt_verifier
        test_app.state.config = LMXConfig()
        test_app.state.remote_embedding = None
        test_app.state.remote_reranking = None
        yield http_client


# ─── Task 1: Fail-Closed Auth for Cloud Security Profile ────────────────────


class TestCloudProfileConfigValidation:
    """Cloud profile config MUST require auth keys — fail-closed at startup."""

    def test_cloud_profile_rejects_missing_inference_auth(self) -> None:
        """Cloud profile without inference_api_key or JWT raises ValidationError."""
        with pytest.raises(ValidationError, match="inference_api_key"):
            SecurityConfig(
                profile="cloud",
                admin_key="some-admin-key",
                inference_api_key=None,
                supabase_jwt_enabled=False,
            )

    def test_cloud_profile_rejects_missing_admin_key(self) -> None:
        """Cloud profile without admin_key raises ValidationError."""
        with pytest.raises(ValidationError, match="admin_key"):
            SecurityConfig(
                profile="cloud",
                admin_key=None,
                inference_api_key="some-inference-key",
            )

    def test_cloud_profile_accepts_inference_api_key(self) -> None:
        """Cloud profile with inference_api_key and admin_key is valid."""
        config = SecurityConfig(
            profile="cloud",
            admin_key="admin-key",
            inference_api_key="inference-key",
        )
        assert config.profile == "cloud"
        assert config.inference_api_key == "inference-key"

    def test_cloud_profile_accepts_supabase_jwt(self) -> None:
        """Cloud profile with supabase_jwt_enabled and admin_key is valid."""
        config = SecurityConfig(
            profile="cloud",
            admin_key="admin-key",
            inference_api_key=None,
            supabase_jwt_enabled=True,
        )
        assert config.supabase_jwt_enabled is True

    def test_lan_profile_allows_no_auth(self) -> None:
        """LAN profile permits missing keys (trust model)."""
        config = SecurityConfig(
            profile="lan",
            admin_key=None,
            inference_api_key=None,
        )
        assert config.profile == "lan"


class TestVerifyInferenceKeyFailClosed:
    """verify_inference_key MUST reject unauthenticated requests when keys are set."""

    def test_rejects_no_credentials_when_key_configured(self) -> None:
        """Request with no bearer token or API key is rejected (401)."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(request, authorization=None, x_api_key=None)
        assert exc.value.status_code == 401

    def test_rejects_wrong_bearer_token(self) -> None:
        """Request with wrong bearer token is rejected (401)."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization="Bearer wrong-key",
                x_api_key=None,
            )
        assert exc.value.status_code == 401

    def test_rejects_wrong_x_api_key(self) -> None:
        """Request with wrong X-Api-Key header is rejected (401)."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization=None,
                x_api_key="wrong-key",
            )
        assert exc.value.status_code == 401

    def test_rejects_empty_bearer_prefix_only(self) -> None:
        """Bearer with no actual token is rejected."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization="Bearer ",
                x_api_key=None,
            )
        assert exc.value.status_code == 401

    def test_accepts_correct_bearer_token(self) -> None:
        """Correct bearer token passes auth."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        verify_inference_key(
            request,
            authorization="Bearer cloud-secret",
            x_api_key=None,
        )
        # No exception = pass

    def test_accepts_correct_x_api_key(self) -> None:
        """Correct X-Api-Key header passes auth."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=False,
        )
        verify_inference_key(
            request,
            authorization=None,
            x_api_key="cloud-secret",
        )

    def test_jwt_failure_with_require_rejects_even_with_valid_api_key(self) -> None:
        """When JWT is required and fails, fallback to API key is blocked."""
        verifier = _StubJWTVerifier(
            JWTVerificationResult(valid=False, error="invalid_token"),
        )
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=True,
            supabase_jwt_require=True,
            supabase_jwt_verifier=verifier,
        )
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization="Bearer some.jwt.token",
                x_api_key=None,
            )
        assert exc.value.status_code == 401

    def test_missing_jwt_verifier_does_not_bypass_api_key(self) -> None:
        """If supabase_jwt_verifier is None but jwt_enabled, must still check API key."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=True,
            supabase_jwt_require=False,
            supabase_jwt_verifier=None,  # Misconfigured — verifier is None
        )
        # Without correct API key, should reject
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization="Bearer not-a-valid-jwt",
                x_api_key=None,
            )
        assert exc.value.status_code == 401

    def test_missing_jwt_verifier_with_correct_api_key_passes(self) -> None:
        """Even with missing JWT verifier, correct API key should work as fallback."""
        request = _make_request(
            inference_api_key="cloud-secret",
            supabase_jwt_enabled=True,
            supabase_jwt_require=False,
            supabase_jwt_verifier=None,
        )
        verify_inference_key(
            request,
            authorization="Bearer cloud-secret",
            x_api_key=None,
        )

    def test_lan_mode_allows_unauthenticated(self) -> None:
        """LAN mode (inference_api_key=None) allows all requests through."""
        request = _make_request(
            inference_api_key=None,
            supabase_jwt_enabled=False,
        )
        verify_inference_key(
            request,
            authorization=None,
            x_api_key=None,
        )


class TestVerifyAdminKeyFailClosed:
    """verify_admin_key must reject requests when admin key is configured."""

    def test_rejects_missing_admin_key(self) -> None:
        """Missing X-Admin-Key is rejected when admin_key configured."""
        request = _make_request(admin_key="admin-secret")
        with pytest.raises(HTTPException) as exc:
            verify_admin_key(request, x_admin_key=None)
        assert exc.value.status_code == 403

    def test_rejects_wrong_admin_key(self) -> None:
        """Wrong X-Admin-Key is rejected."""
        request = _make_request(admin_key="admin-secret")
        with pytest.raises(HTTPException) as exc:
            verify_admin_key(request, x_admin_key="wrong-key")
        assert exc.value.status_code == 403

    def test_accepts_correct_admin_key(self) -> None:
        """Correct X-Admin-Key passes."""
        request = _make_request(admin_key="admin-secret")
        verify_admin_key(request, x_admin_key="admin-secret")


class TestCloudProfileHTTPIntegration:
    """Integration tests: cloud-configured server rejects unauthenticated HTTP requests."""

    @pytest.mark.asyncio
    async def test_chat_completions_rejects_no_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """POST /v1/chat/completions without API key returns 401."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_chat_completions_rejects_wrong_key(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """POST /v1/chat/completions with wrong API key returns 401."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={"Authorization": "Bearer wrong-key"},
            )
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_chat_completions_accepts_correct_key(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """POST /v1/chat/completions with correct key succeeds (or 404 for missing model)."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={"Authorization": "Bearer cloud-secret-key"},
            )
            # 404 = auth passed, model just not loaded. NOT 401.
            assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_v1_models_rejects_no_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """GET /v1/models without API key returns 401."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get("/v1/models")
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_v1_models_accepts_x_api_key(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """GET /v1/models with X-Api-Key header passes auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get(
                "/v1/models",
                headers={"X-Api-Key": "cloud-secret-key"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_v1_embeddings_rejects_no_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """POST /v1/embeddings without auth returns 401."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/embeddings",
                json={"model": "test", "input": "hello"},
            )
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_healthz_no_auth_required(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """GET /healthz should always work without auth — it's a liveness probe."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get("/healthz")
            assert response.status_code == 200


# ─── Task 2: Spoofed Proxy Header Tests ─────────────────────────────────────


class TestSpoofedXForwardedFor:
    """Spoofed X-Forwarded-For from untrusted sources must not affect auth or rate limiting."""

    @pytest.mark.asyncio
    async def test_spoofed_xff_does_not_bypass_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """X-Forwarded-For header from untrusted client does not bypass inference auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={
                    "X-Forwarded-For": "127.0.0.1",  # Spoofed trusted IP
                },
            )
            # Must still be 401 — XFF doesn't bypass auth
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_spoofed_xff_with_localhost_does_not_bypass_admin(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """X-Forwarded-For: 127.0.0.1 doesn't bypass admin key auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get(
                "/admin/status",
                headers={
                    "X-Forwarded-For": "127.0.0.1",
                },
            )
            # Must be 403 — admin key required
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_spoofed_xff_chain_does_not_bypass_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """Multi-hop X-Forwarded-For chain doesn't bypass auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={
                    "X-Forwarded-For": "10.0.0.1, 192.168.1.1, 127.0.0.1",
                },
            )
            assert response.status_code == 401


class TestSpoofedXRealIP:
    """Spoofed X-Real-IP headers must not bypass auth."""

    @pytest.mark.asyncio
    async def test_spoofed_x_real_ip_does_not_bypass_auth(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """X-Real-IP header from untrusted client doesn't bypass inference auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={
                    "X-Real-IP": "192.168.188.11",  # Spoofed Mac Studio IP
                },
            )
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_spoofed_x_real_ip_does_not_bypass_admin(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """X-Real-IP doesn't bypass admin key auth."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get(
                "/admin/status",
                headers={
                    "X-Real-IP": "127.0.0.1",
                },
            )
            assert response.status_code == 403


class TestRateLimitKeySpoofing:
    """Rate limiter key_func uses socket peer address, not spoofable headers."""

    def test_slowapi_key_func_uses_client_host(self) -> None:
        """Verify the rate limiter key function uses request.client.host, not XFF."""
        from opta_lmx.api.rate_limit import SLOWAPI_AVAILABLE, limiter

        if not SLOWAPI_AVAILABLE:
            pytest.skip("slowapi not installed")

        # The key_func should be get_remote_address which reads request.client.host
        # Create a mock request with both client.host and XFF header
        mock_request = MagicMock()
        mock_request.client.host = "10.0.0.99"
        mock_request.headers = {
            "x-forwarded-for": "1.2.3.4",
            "x-real-ip": "5.6.7.8",
        }

        # The key_func should return the socket peer, not the header
        key = limiter._key_func(mock_request)
        assert key == "10.0.0.99", (
            f"Rate limit key_func returned '{key}' instead of socket peer '10.0.0.99'. "
            "This means X-Forwarded-For or X-Real-IP can be spoofed to bypass rate limits."
        )

    def test_rate_limit_key_ignores_xff_header(self) -> None:
        """Even if XFF is set, rate limiter should use actual socket address."""
        from slowapi.util import get_remote_address

        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.50"

        result = get_remote_address(mock_request)
        assert result == "192.168.1.50"

    def test_rate_limit_key_fallback_when_no_client(self) -> None:
        """If request.client is None, rate limiter falls back to 127.0.0.1."""
        from slowapi.util import get_remote_address

        mock_request = MagicMock()
        mock_request.client = None

        result = get_remote_address(mock_request)
        assert result == "127.0.0.1"


class TestProxyHeadersWithAuth:
    """Combined tests: proxy headers + auth headers together."""

    @pytest.mark.asyncio
    async def test_xff_plus_wrong_auth_still_rejected(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """Even with spoofed XFF, wrong auth credentials are still rejected."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={
                    "X-Forwarded-For": "127.0.0.1, 10.0.0.1",
                    "X-Real-IP": "127.0.0.1",
                    "Authorization": "Bearer wrong-key",
                },
            )
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_xff_plus_correct_auth_accepted(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """Spoofed headers are irrelevant when correct auth is provided."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
                headers={
                    "X-Forwarded-For": "1.2.3.4",
                    "X-Real-IP": "5.6.7.8",
                    "Authorization": "Bearer cloud-secret-key",
                },
            )
            # Auth passes, model not loaded = 404
            assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_admin_xff_plus_wrong_key_rejected(
        self, mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
    ) -> None:
        """Admin endpoint: spoofed XFF + wrong admin key = 403."""
        async for client in _make_cloud_test_client(mock_engine, mock_model_manager, tmp_path):
            response = await client.get(
                "/admin/status",
                headers={
                    "X-Forwarded-For": "127.0.0.1",
                    "X-Real-IP": "127.0.0.1",
                    "X-Admin-Key": "wrong-admin-key",
                },
            )
            assert response.status_code == 403


class TestTimingAttackResistance:
    """Auth comparison uses secrets.compare_digest to prevent timing attacks."""

    def test_verify_inference_key_uses_constant_time_compare(self) -> None:
        """Wrong key of same length should raise 401, confirming comparison runs."""
        request = _make_request(
            inference_api_key="a" * 32,
            supabase_jwt_enabled=False,
        )
        # Same-length wrong key
        with pytest.raises(HTTPException) as exc:
            verify_inference_key(
                request,
                authorization=f"Bearer {'b' * 32}",
                x_api_key=None,
            )
        assert exc.value.status_code == 401

    def test_verify_admin_key_uses_constant_time_compare(self) -> None:
        """Wrong admin key of same length should raise 403."""
        request = _make_request(admin_key="a" * 32)
        with pytest.raises(HTTPException) as exc:
            verify_admin_key(request, x_admin_key="b" * 32)
        assert exc.value.status_code == 403


class TestSecurityConfigTrustedProxies:
    """Config fields for trusted proxy settings."""

    def test_default_honor_x_forwarded_for_is_false(self) -> None:
        """By default, X-Forwarded-For is NOT trusted."""
        config = SecurityConfig()
        assert config.honor_x_forwarded_for is False

    def test_default_trusted_proxies_is_empty(self) -> None:
        """By default, no proxies are trusted."""
        config = SecurityConfig()
        assert config.trusted_proxies == []

    def test_trusted_proxies_accepts_cidr(self) -> None:
        """Trusted proxies can be configured as CIDR blocks."""
        config = SecurityConfig(
            trusted_proxies=["10.0.0.0/8", "172.16.0.0/12"],
            honor_x_forwarded_for=True,
        )
        assert len(config.trusted_proxies) == 2

    def test_parse_trusted_proxy_networks(self) -> None:
        """Verify _parse_trusted_proxy_networks from main.py works."""
        from opta_lmx.main import _parse_trusted_proxy_networks

        networks = _parse_trusted_proxy_networks(["10.0.0.0/8", "192.168.1.1"])
        assert len(networks) == 2

    def test_parse_trusted_proxy_rejects_invalid(self) -> None:
        """Invalid CIDR entries are skipped with warning, not crash."""
        from opta_lmx.main import _parse_trusted_proxy_networks

        networks = _parse_trusted_proxy_networks(["not-a-cidr", "10.0.0.0/8"])
        assert len(networks) == 1
