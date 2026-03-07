"""
subscription_proxy.py — Forward OpenAI-compatible requests to subscription providers.

GitHub Copilot: OpenAI-compatible endpoint, needs special headers + auth.
Gemini CLI: Translates to Google's generateContent API and back to OpenAI format.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx

from opta_lmx.proxy.keychain_reader import get_subscription_token, invalidate_token
from opta_lmx.proxy.subscription_providers import SubscriptionRoute

logger = logging.getLogger(__name__)

PROXY_TIMEOUT = httpx.Timeout(connect=5.0, read=120.0, write=10.0, pool=5.0)


def build_auth_headers(route: SubscriptionRoute, token: str) -> dict[str, str]:
    """Build provider-specific auth headers from the route config and token."""
    if route.auth_scheme == "github_copilot":
        return {
            "Authorization": f"Bearer {token}",
            **route.extra_headers,
        }
    # Default: standard Bearer (covers "bearer" scheme and future additions)
    return {"Authorization": f"Bearer {token}"}


async def proxy_chat_completion(
    route: SubscriptionRoute,
    token: str,
    request_body: dict[str, Any],
    stream: bool = False,
) -> tuple[int, dict[str, Any] | None, AsyncIterator[bytes] | None]:
    """Forward a chat completion request to the subscription provider.

    Returns:
        (status_code, response_dict, stream_iterator)
        - Non-stream: (200, response_dict, None)
        - Stream:     (200, None, stream_iterator)
        - Error:      (status_code, error_dict, None)
    """
    if route.provider_id == "gemini-cli":
        return await _proxy_gemini(route, token, request_body, stream)
    # GitHub Copilot and other OpenAI-compatible providers
    return await _proxy_openai_compatible(route, token, request_body, stream)


async def _proxy_openai_compatible(
    route: SubscriptionRoute,
    token: str,
    request_body: dict[str, Any],
    stream: bool,
) -> tuple[int, dict[str, Any] | None, AsyncIterator[bytes] | None]:
    """Forward to an OpenAI-compatible upstream (e.g. GitHub Copilot)."""
    url = f"{route.base_url}/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        **build_auth_headers(route, token),
    }
    # Ensure model is set; use route default if client omitted it
    body = dict(request_body)
    if not body.get("model"):
        body["model"] = route.default_model

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        if stream:
            async def _stream_iter() -> AsyncIterator[bytes]:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        logger.warning(
                            "subscription_proxy_stream_error",
                            extra={
                                "provider_id": route.provider_id,
                                "status": resp.status_code,
                                "body_prefix": error_body[:200].decode("utf-8", errors="replace"),
                            },
                        )
                        error_payload = json.dumps(
                            {"error": f"upstream {resp.status_code}"}
                        ).encode()
                        yield b"data: " + error_payload + b"\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        yield chunk

            return 200, None, _stream_iter()

        else:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 401:
                # Token may be stale — evict cache so next call re-reads keychain
                invalidate_token(route.provider_id)
            if resp.status_code != 200:
                logger.warning(
                    "subscription_proxy_error",
                    extra={
                        "provider_id": route.provider_id,
                        "status": resp.status_code,
                    },
                )
                return resp.status_code, {"error": resp.text[:500]}, None
            return 200, resp.json(), None


async def _proxy_gemini(
    route: SubscriptionRoute,
    token: str,
    request_body: dict[str, Any],
    stream: bool,
) -> tuple[int, dict[str, Any] | None, AsyncIterator[bytes] | None]:
    """Translate OpenAI chat completions request → Gemini generateContent format."""
    model = request_body.get("model") or route.default_model
    # Strip any "gemini-cli/" prefix that may have survived into the body
    model = model.removeprefix("gemini-cli/")

    endpoint = "streamGenerateContent" if stream else "generateContent"
    url = f"{route.base_url}/v1beta/models/{model}:{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if stream:
        url += "?alt=sse"

    # --- Convert OpenAI messages → Gemini contents ---
    contents: list[dict[str, Any]] = []
    system_instruction: dict[str, Any] | None = None

    for msg in request_body.get("messages", []):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        # Collapse multipart content to plain text if needed
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )

        if role == "system":
            system_instruction = {"parts": [{"text": content}]}
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})

    gemini_body: dict[str, Any] = {"contents": contents}
    if system_instruction is not None:
        gemini_body["system_instruction"] = system_instruction

    max_tokens = request_body.get("max_tokens")
    if max_tokens:
        gemini_body["generationConfig"] = {"maxOutputTokens": max_tokens}

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        if stream:
            async def _gemini_stream() -> AsyncIterator[bytes]:
                async with client.stream(
                    "POST", url, headers=headers, json=gemini_body
                ) as resp:
                    if resp.status_code != 200:
                        err = await resp.aread()
                        logger.warning(
                            "gemini_stream_error",
                            extra={
                                "status": resp.status_code,
                                "body_prefix": err[:200].decode("utf-8", errors="replace"),
                            },
                        )
                        yield b"data: [DONE]\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        # Gemini SSE passthrough — caller handles format differences
                        yield chunk

            return 200, None, _gemini_stream()

        else:
            resp = await client.post(url, headers=headers, json=gemini_body)
            if resp.status_code == 401:
                invalidate_token(route.provider_id)
            if resp.status_code != 200:
                logger.warning(
                    "gemini_error",
                    extra={"status": resp.status_code},
                )
                return resp.status_code, {"error": resp.text[:500]}, None

            # --- Convert Gemini response → OpenAI chat completion format ---
            g = resp.json()
            candidates = g.get("candidates", [{}])
            text = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts)

            openai_resp: dict[str, Any] = {
                "id": f"chatcmpl-gemini-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": text},
                        "finish_reason": "stop",
                    }
                ],
                "usage": g.get("usageMetadata", {}),
            }
            return 200, openai_resp, None
