"""Unit tests for inference auth dependency behavior."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from opta_lmx.api.deps import verify_inference_key
from opta_lmx.security.jwt_verifier import JWTVerificationResult


class _StubJWTVerifier:
    def __init__(self, result: JWTVerificationResult) -> None:
        self._result = result
        self.calls: list[str] = []

    def verify(self, token: str) -> JWTVerificationResult:
        self.calls.append(token)
        return self._result


def _make_request(**state: object) -> SimpleNamespace:
    app_state = SimpleNamespace(**state)
    return SimpleNamespace(
        app=SimpleNamespace(state=app_state),
        state=SimpleNamespace(),
    )


def test_legacy_inference_api_key_still_works() -> None:
    request = _make_request(
        inference_api_key="infer-secret-key",
        supabase_jwt_enabled=False,
    )

    verify_inference_key(
        request,
        authorization="Bearer infer-secret-key",
        x_api_key=None,
    )

    assert getattr(request.state, "supabase_user_id", None) is None


def test_bearer_jwt_sets_request_state_user_id() -> None:
    verifier = _StubJWTVerifier(
        JWTVerificationResult(valid=True, user_id="user-123"),
    )
    request = _make_request(
        inference_api_key="infer-secret-key",
        supabase_jwt_enabled=True,
        supabase_jwt_require=False,
        supabase_jwt_verifier=verifier,
    )

    verify_inference_key(
        request,
        authorization="Bearer valid.jwt.token",
        x_api_key=None,
    )

    assert verifier.calls == ["valid.jwt.token"]
    assert request.state.supabase_user_id == "user-123"


def test_invalid_jwt_falls_back_to_inference_api_key() -> None:
    verifier = _StubJWTVerifier(JWTVerificationResult(valid=False, error="invalid_token"))
    request = _make_request(
        inference_api_key="infer-secret-key",
        supabase_jwt_enabled=True,
        supabase_jwt_require=False,
        supabase_jwt_verifier=verifier,
    )

    verify_inference_key(
        request,
        authorization="Bearer infer-secret-key",
        x_api_key=None,
    )

    assert verifier.calls == ["infer-secret-key"]
    assert getattr(request.state, "supabase_user_id", None) is None


def test_invalid_jwt_rejected_when_required() -> None:
    verifier = _StubJWTVerifier(JWTVerificationResult(valid=False, error="invalid_token"))
    request = _make_request(
        inference_api_key="infer-secret-key",
        supabase_jwt_enabled=True,
        supabase_jwt_require=True,
        supabase_jwt_verifier=verifier,
    )

    with pytest.raises(HTTPException) as exc:
        verify_inference_key(
            request,
            authorization="Bearer infer-secret-key",
            x_api_key=None,
        )

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid or missing Supabase JWT"
