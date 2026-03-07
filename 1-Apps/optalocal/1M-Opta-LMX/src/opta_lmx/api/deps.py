"""Shared dependencies for API route handlers.

Provides both raw dependency functions (get_engine, etc.) and
Annotated type aliases (Engine, Memory, etc.) for FastAPI's modern
Depends() injection pattern.
"""

from __future__ import annotations

import secrets
from typing import Annotated, cast

from fastapi import Depends, Header, HTTPException, Query, Request

from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.helpers.client import HelperNodeClient
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.rag.reranker import RerankerEngine
from opta_lmx.rag.store import VectorStore
from opta_lmx.rag.watcher import WorkspaceWatcher
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.security.policy_hooks import (
    enforce_sensitive_endpoint_policy,
    is_sensitive_admin_request,
)
from opta_lmx.sessions.store import SessionStore
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.registry import SkillsRegistry


def get_engine(request: Request) -> InferenceEngine:
    """Get the inference engine from app state."""
    return cast(InferenceEngine, request.app.state.engine)


def get_memory(request: Request) -> MemoryMonitor:
    """Get the memory monitor from app state."""
    return cast(MemoryMonitor, request.app.state.memory_monitor)


def get_start_time(request: Request) -> float:
    """Get the server start time from app state."""
    return cast(float, request.app.state.start_time)


def get_metrics(request: Request) -> MetricsCollector:
    """Get the metrics collector from app state."""
    return cast(MetricsCollector, request.app.state.metrics)


def get_router(request: Request) -> TaskRouter:
    """Get the task router from app state."""
    return cast(TaskRouter, request.app.state.router)


def get_model_manager(request: Request) -> ModelManager:
    """Get the model manager from app state."""
    return cast(ModelManager, request.app.state.model_manager)


def get_preset_manager(request: Request) -> PresetManager:
    """Get the preset manager from app state."""
    return cast(PresetManager, request.app.state.preset_manager)


def get_event_bus(request: Request) -> EventBus:
    """Get the event bus from app state."""
    return cast(EventBus, request.app.state.event_bus)


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
    return cast(SessionStore, request.app.state.session_store)


def get_rag_store(request: Request) -> VectorStore | None:
    """Get the RAG vector store from app state, or None if not configured."""
    return getattr(request.app.state, "rag_store", None)


def get_reranker_engine(request: Request) -> RerankerEngine | None:
    """Get the local reranker engine from app state, or None."""
    value = getattr(request.app.state, "reranker_engine", None)
    return cast(RerankerEngine | None, value)


def get_workspace_watcher(request: Request) -> WorkspaceWatcher | None:
    """Get the workspace file watcher from app state, or None if not started."""
    return getattr(request.app.state, "workspace_watcher", None)


def verify_admin_key(
    request: Request,
    x_admin_key: str | None = Header(None),
    sse_admin_key: str | None = Query(None, alias="admin_key"),
    sse_admin_key_legacy: str | None = Query(None, alias="x_admin_key"),
) -> None:
    """Verify X-Admin-Key header if admin_key is configured.

    If security.admin_key is null in config, authentication is disabled
    (LAN-only trust model). If set, the header must match exactly.

    Browser EventSource cannot send custom headers; for that single case we
    allow query-param fallbacks (`admin_key`, legacy `x_admin_key`) only on
    GET /admin/events.
    All other admin routes still require X-Admin-Key header auth.
    """
    path = getattr(getattr(request, "url", None), "path", "")
    method = str(getattr(request, "method", ""))
    if path and method and is_sensitive_admin_request(path, method):
        enforce_sensitive_endpoint_policy(request, surface="admin", action="admin_sensitive")

    config_key: str | None = getattr(request.app.state, "admin_key", None)
    if config_key is None:
        return  # No auth configured — trust LAN

    candidate_key = x_admin_key
    if candidate_key is None and method.upper() == "GET" and path == "/admin/events":
        candidate_key = sse_admin_key or sse_admin_key_legacy

    if candidate_key is None or not secrets.compare_digest(candidate_key, config_key):
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
        token = authorization[len("Bearer ") :]

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
    if candidate is not None and secrets.compare_digest(candidate, inference_api_key):
        return

    # Allow admin key to be used for inference routes
    admin_key: str | None = getattr(request.app.state, "admin_key", None)
    if admin_key is not None:
        if candidate is not None and secrets.compare_digest(candidate, admin_key):
            return
        x_admin_key = request.headers.get("x-admin-key")
        if x_admin_key is not None and secrets.compare_digest(x_admin_key, admin_key):
            return

    raise HTTPException(status_code=401, detail="Invalid or missing API key")


def verify_sensitive_skills_policy(request: Request) -> None:
    """Apply optional policy hooks to skills mutation endpoints."""
    enforce_sensitive_endpoint_policy(request, surface="skills", action="skills_execute")


def verify_sensitive_agents_policy(request: Request) -> None:
    """Apply optional policy hooks to agents mutation endpoints."""
    enforce_sensitive_endpoint_policy(request, surface="agents", action="agents_run")


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
RerankerDep = Annotated[RerankerEngine | None, Depends(get_reranker_engine)]
WatcherDep = Annotated[WorkspaceWatcher | None, Depends(get_workspace_watcher)]
AdminAuth = Annotated[None, Depends(verify_admin_key)]
SkillsPolicyGuard = Annotated[None, Depends(verify_sensitive_skills_policy)]
AgentsPolicyGuard = Annotated[None, Depends(verify_sensitive_agents_policy)]


def get_agent_runtime(request: Request) -> AgentsRuntime:
    return cast(AgentsRuntime, request.app.state.agent_runtime)


def get_skill_registry(request: Request) -> SkillsRegistry:
    return cast(SkillsRegistry, request.app.state.skill_registry)


def get_skill_executor(request: Request) -> SkillExecutor:
    return cast(SkillExecutor, request.app.state.skill_executor)


AgentRuntimeDep = Annotated[AgentsRuntime, Depends(get_agent_runtime)]
SkillRegistryDep = Annotated[SkillsRegistry, Depends(get_skill_registry)]
SkillExecutorDep = Annotated[SkillExecutor, Depends(get_skill_executor)]
