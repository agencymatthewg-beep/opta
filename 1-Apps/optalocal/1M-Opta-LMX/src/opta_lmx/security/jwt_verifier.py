"""Supabase JWT verification helpers with conservative dependency handling."""

from __future__ import annotations

import importlib
import json
import threading
import time
import urllib.request
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class JWTVerificationResult:
    """Outcome from verifying a bearer JWT token."""

    valid: bool
    user_id: str | None = None
    error: str | None = None


class JWTVerifier(Protocol):
    """Protocol for pluggable JWT verifiers used by request auth dependencies."""

    def verify(self, token: str) -> JWTVerificationResult:
        """Verify a token and return validity and optional user id."""


class SupabaseJWTVerifier:
    """Verify Supabase JWTs against a JWKS endpoint, with in-memory key caching."""

    def __init__(
        self,
        *,
        issuer: str | None,
        audience: str | None,
        jwks_url: str | None,
        user_id_claim: str = "sub",
        cache_ttl_sec: float = 300.0,
        request_timeout_sec: float = 5.0,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.jwks_url = jwks_url
        self.user_id_claim = user_id_claim
        self.cache_ttl_sec = cache_ttl_sec
        self.request_timeout_sec = request_timeout_sec
        self._jwks_by_kid: dict[str, dict[str, Any]] = {}
        self._jwks_cached_at = 0.0
        self._cache_lock = threading.Lock()

    def verify(self, token: str) -> JWTVerificationResult:
        """Verify JWT signature/claims and return resolved user id claim."""
        token_value = token.strip()
        if not token_value:
            return JWTVerificationResult(valid=False, error="missing_token")
        if not self.jwks_url:
            return JWTVerificationResult(valid=False, error="missing_jwks_url")

        jwt_module = self._load_pyjwt()
        if jwt_module is None:
            # Conservative fallback: do not accept unverifiable tokens.
            return JWTVerificationResult(valid=False, error="pyjwt_unavailable")

        try:
            header = jwt_module.get_unverified_header(token_value)
        except Exception:
            return JWTVerificationResult(valid=False, error="invalid_header")

        kid = header.get("kid")
        if not isinstance(kid, str) or not kid:
            return JWTVerificationResult(valid=False, error="missing_kid")

        jwk = self._get_jwk_for_kid(kid)
        if jwk is None:
            jwk = self._get_jwk_for_kid(kid, force_refresh=True)
        if jwk is None:
            return JWTVerificationResult(valid=False, error="unknown_kid")

        try:
            public_key = jwt_module.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
        except Exception:
            return JWTVerificationResult(valid=False, error="invalid_jwk")

        decode_kwargs: dict[str, Any] = {
            "key": public_key,
            "algorithms": ["RS256", "ES256"],
            "options": {
                "verify_signature": True,
                "verify_aud": self.audience is not None,
                "verify_iss": self.issuer is not None,
            },
        }
        if self.issuer is not None:
            decode_kwargs["issuer"] = self.issuer
        if self.audience is not None:
            decode_kwargs["audience"] = self.audience

        try:
            claims = jwt_module.decode(token_value, **decode_kwargs)
        except Exception:
            return JWTVerificationResult(valid=False, error="invalid_token")

        raw_user_id = claims.get(self.user_id_claim)
        if raw_user_id is None:
            return JWTVerificationResult(valid=False, error="missing_user_id_claim")

        user_id = str(raw_user_id).strip()
        if not user_id:
            return JWTVerificationResult(valid=False, error="empty_user_id_claim")

        return JWTVerificationResult(valid=True, user_id=user_id)

    def _load_pyjwt(self) -> Any | None:
        """Load PyJWT lazily so the project can run without hard dependency."""
        try:
            return importlib.import_module("jwt")
        except Exception:
            return None

    def _get_jwk_for_kid(
        self,
        kid: str,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any] | None:
        jwks_by_kid = self._get_cached_jwks(force_refresh=force_refresh)
        return jwks_by_kid.get(kid)

    def _get_cached_jwks(self, *, force_refresh: bool = False) -> dict[str, dict[str, Any]]:
        now = time.time()
        with self._cache_lock:
            has_fresh_cache = (
                self._jwks_by_kid
                and not force_refresh
                and (now - self._jwks_cached_at) < self.cache_ttl_sec
            )
            if has_fresh_cache:
                return dict(self._jwks_by_kid)

            fetched = self._fetch_jwks()
            if fetched:
                self._jwks_by_kid = fetched
                self._jwks_cached_at = now

            return dict(self._jwks_by_kid)

    def _fetch_jwks(self) -> dict[str, dict[str, Any]]:
        if not self.jwks_url:
            return {}

        request = urllib.request.Request(
            self.jwks_url,
            headers={"Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.request_timeout_sec) as response:
                payload = response.read()
        except Exception:
            return {}

        try:
            parsed = json.loads(payload.decode("utf-8"))
        except Exception:
            return {}
        if not isinstance(parsed, dict):
            return {}

        raw_keys = parsed.get("keys")
        if not isinstance(raw_keys, list):
            return {}

        keys_by_kid: dict[str, dict[str, Any]] = {}
        for item in raw_keys:
            if not isinstance(item, dict):
                continue
            kid = item.get("kid")
            if isinstance(kid, str) and kid:
                keys_by_kid[kid] = item
        return keys_by_kid
