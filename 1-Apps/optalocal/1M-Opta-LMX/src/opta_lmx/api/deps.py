"""Shared dependencies for API route handlers.

Provides both raw dependency functions (get_engine, etc.) and
Annotated type aliases (Engine, Memory, etc.) for FastAPI's modern
Depends() injection pattern.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from opta_lmx.helpers.client import HelperNodeClient
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.rag.store import VectorStore
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.sessions.store import SessionStore


def get_engine(request: Request) -> InferenceEngine:
    """Get the inference engine from app state."""
    return request.app.state.engine  # type: ignore[no-any-return]


def get_memory(request: Request) -> MemoryMonitor:
    """Get the memory monitor from app state."""
    return request.app.state.memory_monitor  # type: ignore[no-any-return]


def get_start_time(request: Request) -> float:
    """Get the server start time from app state."""
    return request.app.state.start_time  # type: ignore[no-any-return]


def get_metrics(request: Request) -> MetricsCollector:
    """Get the metrics collector from app state."""
    return request.app.state.metrics  # type: ignore[no-any-return]


def get_router(request: Request) -> TaskRouter:
    """Get the task router from app state."""
    return request.app.state.router  # type: ignore[no-any-return]


def get_model_manager(request: Request) -> ModelManager:
    """Get the model manager from app state."""
    return request.app.state.model_manager  # type: ignore[no-any-return]


def get_preset_manager(request: Request) -> PresetManager:
    """Get the preset manager from app state."""
    return request.app.state.preset_manager  # type: ignore[no-any-return]


def get_event_bus(request: Request) -> EventBus:
    """Get the event bus from app state."""
    return request.app.state.event_bus  # type: ignore[no-any-return]


def get_embedding_engine(request: Request) -> EmbeddingEngine | None:
    """Get the embedding engine from app state, or None if not configured."""
    return getattr(request.app.state, "embedding_engine", None)


def get_remote_embedding(request: Request) -> HelperNodeClient | None:
    """Get the helper node embedding client, or None if not configured."""
    return getattr(request.app.state, "remote_embedding", None)


def get_remote_reranking(request: Request) -> HelperNodeClient | None:
    """Get the helper node reranking client, or None if not configured."""
    return getattr(request.app.state, "remote_reranking", None)


def get_session_store(request: Request) -> SessionStore:
    """Get the session store from app state."""
    return request.app.state.session_store  # type: ignore[no-any-return]


def get_rag_store(request: Request) -> VectorStore | None:
    """Get the RAG vector store from app state, or None if not configured."""
    return getattr(request.app.state, "rag_store", None)


def get_reranker_engine(request: Request) -> object | None:
    """Get the local reranker engine from app state, or None."""
    return getattr(request.app.state, "reranker_engine", None)


def verify_admin_key(request: Request, x_admin_key: str | None = Header(None)) -> None:
    """Verify X-Admin-Key header if admin_key is configured.

    If security.admin_key is null in config, authentication is disabled
    (LAN-only trust model). If set, the header must match exactly.
    """
    config_key: str | None = getattr(request.app.state, "admin_key", None)
    if config_key is None:
        return  # No auth configured — trust LAN
    if x_admin_key is None or not secrets.compare_digest(x_admin_key, config_key):
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")


def verify_inference_key(
    request: Request,
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """Verify inference API key or Supabase JWT for /v1/* endpoints.

    Auth flow:
    1. If supabase_jwt_enabled: try to verify bearer token as JWT.
       - On success: sets request.state.supabase_user_id and returns.
       - On failure: if supabase_jwt_require is True, raise 401.
         Otherwise fall through to API key check.
    2. Check bearer token / X-Api-Key against inference_api_key.
       If inference_api_key is None (LAN mode), allow through.
    """
    jwt_enabled: bool = getattr(request.app.state, "supabase_jwt_enabled", False)
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]

    if jwt_enabled and token:
        verifier = getattr(request.app.state, "supabase_jwt_verifier", None)
        if verifier is not None:
            result = verifier.verify(token)
            if result.valid:
                request.state.supabase_user_id = result.user_id
                return
            # JWT failed
            jwt_require: bool = getattr(request.app.state, "supabase_jwt_require", False)
            if jwt_require:
                raise HTTPException(status_code=401, detail="Invalid or missing Supabase JWT")
            # Fall through to API key check

    inference_api_key: str | None = getattr(request.app.state, "inference_api_key", None)
    if inference_api_key is None:
        return  # LAN mode — no auth

    candidate = token or x_api_key
    if candidate is None or not secrets.compare_digest(candidate, inference_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ─── Annotated type aliases for Depends() injection ────────────────────────

Engine = Annotated[InferenceEngine, Depends(get_engine)]
Memory = Annotated[MemoryMonitor, Depends(get_memory)]
StartTime = Annotated[float, Depends(get_start_time)]
Metrics = Annotated[MetricsCollector, Depends(get_metrics)]
Router = Annotated[TaskRouter, Depends(get_router)]
Manager = Annotated[ModelManager, Depends(get_model_manager)]
Presets = Annotated[PresetManager, Depends(get_preset_manager)]
Events = Annotated[EventBus, Depends(get_event_bus)]
Embeddings = Annotated[EmbeddingEngine | None, Depends(get_embedding_engine)]
RemoteEmbedding = Annotated[HelperNodeClient | None, Depends(get_remote_embedding)]
RemoteReranking = Annotated[HelperNodeClient | None, Depends(get_remote_reranking)]
SessionStoreDep = Annotated[SessionStore, Depends(get_session_store)]
RagStore = Annotated[VectorStore | None, Depends(get_rag_store)]
RerankerDep = Annotated[object | None, Depends(get_reranker_engine)]
AdminAuth = Annotated[None, Depends(verify_admin_key)]


def get_agent_runtime(request: Request) -> object:
    return request.app.state.agent_runtime  # type: ignore[return-value]


def get_skill_registry(request: Request) -> object:
    return request.app.state.skill_registry  # type: ignore[return-value]


def get_skill_executor(request: Request) -> object:
    return request.app.state.skill_executor  # type: ignore[return-value]


AgentRuntimeDep = Annotated[object, Depends(get_agent_runtime)]
SkillRegistryDep = Annotated[object, Depends(get_skill_registry)]
SkillExecutorDep = Annotated[object, Depends(get_skill_executor)]
