"""Opta-LMX — FastAPI application factory and CLI entry point."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import ipaddress
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from opta_lmx import __version__
from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.agents.scheduler import RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.agents.tracing import OpenTelemetryTracer
from opta_lmx.api.admin import router as admin_router
from opta_lmx.api.agents import router as agents_router
from opta_lmx.api.anthropic import router as anthropic_router
from opta_lmx.api.benchmark import router as benchmark_router
from opta_lmx.api.embeddings import router as embeddings_router
from opta_lmx.api.health import router as health_router
from opta_lmx.api.inference import router as inference_router
from opta_lmx.api.middleware import (
    MTLSMiddleware,
    OpenTelemetryMiddleware,
    RequestIDMiddleware,
    RequestLoggingMiddleware,
)
from opta_lmx.api.rag import router as rag_router
from opta_lmx.api.rerank import router as rerank_router
from opta_lmx.api.sessions import router as sessions_router
from opta_lmx.api.skills import router as skills_router
from opta_lmx.api.websocket import router as websocket_router
from opta_lmx.config import LMXConfig, load_config
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus, ServerEvent
from opta_lmx.monitoring.journal import RuntimeJournalManager
from opta_lmx.monitoring.logging import setup_logging
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.runtime_state import RuntimeState
from opta_lmx.security.jwt_verifier import SupabaseJWTVerifier
from opta_lmx.sessions.store import SessionStore
from opta_lmx.skills.builtins import selected_builtin_manifests
from opta_lmx.skills.dispatch import LocalSkillDispatcher, QueuedSkillDispatcher, SkillDispatcher
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.mcp_bridge import RemoteMCPBridge
from opta_lmx.skills.policy import SkillsPolicy
from opta_lmx.skills.registry import SkillsRegistry

logger = logging.getLogger(__name__)
_RUNTIME_STATE_SNAPSHOT_INTERVAL_SEC = 10.0


def _expand_skill_directories(paths: list[Path | str]) -> list[Path]:
    """Normalize configured skill directories to expanded paths."""
    return [Path(path).expanduser() for path in paths]


def _resolve_agents_state_store_path(path: Path | str | None) -> Path:
    """Resolve persisted agents state store path."""
    fallback = Path.home() / ".opta-lmx" / "agents-runs.json"
    return Path(path or fallback).expanduser()


def _resolve_path(path: Path | str | None, fallback: Path) -> Path:
    """Resolve configured filesystem path with fallback and ~ expansion."""
    return Path(path or fallback).expanduser()


def _build_supabase_jwt_verifier(config: LMXConfig) -> SupabaseJWTVerifier | None:
    """Build a Supabase JWT verifier instance from config, if enabled."""
    if not config.security.supabase_jwt_enabled:
        return None
    return SupabaseJWTVerifier(
        issuer=config.security.supabase_jwt_issuer,
        audience=config.security.supabase_jwt_audience,
        jwks_url=config.security.supabase_jwt_jwks_url,
        user_id_claim=config.security.supabase_jwt_claim_user_id,
    )


def _parse_trusted_proxy_networks(
    entries: list[str],
) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """Parse configured trusted proxy CIDRs/IPs into ipaddress network objects."""
    trusted: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for raw in entries:
        value = raw.strip()
        if not value:
            continue
        try:
            trusted.append(ipaddress.ip_network(value, strict=False))
        except ValueError:
            logger.warning("invalid_trusted_proxy_entry", extra={"value": value})
    return trusted


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialize engine, auto-load models, cleanup."""
    config: LMXConfig = app.state.config

    # Crash loop detection — record startup and check for rapid restarts
    runtime_state = RuntimeState()
    previous_runtime = runtime_state.load() or {}
    runtime_state.record_startup()

    safe_mode = runtime_state.is_crash_loop()
    if safe_mode:
        logger.warning("crash_loop_detected", extra={"reason": "skipping auto-load"})

    restore_model_ids: list[str] = []
    if not safe_mode and not bool(previous_runtime.get("last_clean_shutdown", True)):
        raw_models = previous_runtime.get("loaded_models", [])
        if isinstance(raw_models, list):
            restore_model_ids = [
                str(model_id) for model_id in raw_models if isinstance(model_id, str) and model_id
            ]

    # Initialize core services
    memory_monitor = MemoryMonitor(max_percent=config.memory.max_memory_percent)
    event_bus = EventBus()
    journal_manager: RuntimeJournalManager | None = None
    journal_event_queue: asyncio.Queue[ServerEvent] | None = None
    journal_event_task: asyncio.Task[None] | None = None

    # E1: Set MLX Metal memory limits to prevent fatal SIGABRT under pressure.
    # Derives hard limit from the configured memory threshold percentage.
    try:
        import mlx.core as mx

        total_bytes = int(memory_monitor.total_memory_gb() * (1024**3))
        metal_limit = int(total_bytes * config.memory.max_memory_percent / 100)
        mx.metal.set_memory_limit(metal_limit, relaxed=True)  # type: ignore[call-arg]

        if config.models.metal_cache_limit_gb is not None:
            cache_bytes = int(config.models.metal_cache_limit_gb * (1024 ** 3))
            mx.metal.set_cache_limit(cache_bytes)

        logger.info("metal_limits_set")
    except Exception:
        logger.warning("metal_limits_failed", exc_info=True)

    engine = InferenceEngine(
        memory_monitor=memory_monitor,
        use_batching=config.models.use_batching,
        auto_evict_lru=config.memory.auto_evict_lru,
        gguf_context_length=config.models.gguf_context_length,
        gguf_gpu_layers=config.models.gguf_gpu_layers,
        event_bus=event_bus,
        speculative_model=config.models.speculative_model,
        speculative_num_tokens=config.models.speculative_num_tokens,
        speculative_require_supported=config.models.speculative_require_supported,
        kv_bits=config.models.kv_bits,
        kv_group_size=config.models.kv_group_size,
        prefix_cache_enabled=config.models.prefix_cache_enabled,
        max_concurrent_requests=config.models.max_concurrent_requests,
        inference_timeout_sec=config.models.inference_timeout_sec,
        loader_isolation_enabled=config.models.loader_isolation_enabled,
        loader_timeout_sec=config.models.loader_timeout_sec,
        backend_preference_order=config.models.backend_preference_order,
        gguf_fallback_enabled=config.models.gguf_fallback_enabled,
        warmup_on_load=config.models.warmup_on_load,
        stream_interval=config.models.stream_interval,
        scheduler_max_num_seqs=config.models.scheduler_max_num_seqs,
        scheduler_prefill_batch_size=config.models.scheduler_prefill_batch_size,
        scheduler_completion_batch_size=config.models.scheduler_completion_batch_size,
        scheduler_cache_memory_percent=config.models.scheduler_cache_memory_percent,
        semaphore_timeout_sec=config.models.semaphore_timeout_sec,
        per_client_default_concurrency=config.models.per_client_default_concurrency,
        per_client_concurrency_overrides=config.models.per_client_concurrency_overrides,
        per_model_concurrency_limits=config.models.per_model_concurrency_limits,
        adaptive_concurrency_enabled=config.models.adaptive_concurrency_enabled,
        adaptive_latency_target_ms=config.models.adaptive_latency_target_ms,
        adaptive_latency_window=config.models.adaptive_latency_window,
        adaptive_min_concurrent_requests=config.models.adaptive_min_concurrent_requests,
    )

    model_manager = ModelManager(
        models_directory=config.models.models_directory,
        event_bus=event_bus,
    )

    task_router = TaskRouter(config.routing)
    metrics = MetricsCollector()

    if config.journaling.enabled:
        try:
            journal_manager = RuntimeJournalManager(config=config.journaling)
            journal_manager.start_runtime_session(
                model=config.models.default_model or f"opta-lmx/{__version__}",
                metadata={
                    "security_profile": config.security.profile,
                    "host": config.server.host,
                    "port": config.server.port,
                    "safe_mode": safe_mode,
                },
            )
            journal_event_queue = event_bus.subscribe()

            async def _journal_event_bridge_loop(
                queue: asyncio.Queue[ServerEvent],
                manager: RuntimeJournalManager,
            ) -> None:
                while True:
                    event = await queue.get()
                    try:
                        manager.record_event(event)
                    except Exception:
                        logger.warning("journaling_event_record_failed")

            journal_event_task = asyncio.create_task(
                _journal_event_bridge_loop(journal_event_queue, journal_manager),
                name="journal-event-bridge",
            )
            logger.info("journaling_started")
        except Exception:
            logger.warning("journaling_init_failed")
            journal_manager = None
            journal_event_queue = None
            journal_event_task = None

    preset_manager = PresetManager(config.presets.directory)
    if config.presets.enabled:
        preset_manager.load_presets()

        # Merge preset routing aliases into the task router.
        # Config aliases take priority; preset models are appended as fallbacks.
        preset_aliases = preset_manager.get_routing_aliases()
        if preset_aliases:
            for alias, preset_models in preset_aliases.items():
                existing = config.routing.aliases.get(alias, [])
                merged = list(dict.fromkeys(existing + preset_models))
                config.routing.aliases[alias] = merged
            task_router.update_config(config.routing)
            logger.info("preset_routing_aliases_merged")

    # Initialize embedding engine (lazy-load — only loads model on first request)
    from opta_lmx.inference.embedding_engine import EmbeddingEngine

    embedding_engine = EmbeddingEngine()
    skill_registry = SkillsRegistry()

    raw_skill_dirs = list(getattr(config.skills, "directories", []))
    skill_directories = _expand_skill_directories(raw_skill_dirs)
    if skill_directories:
        load_result = skill_registry.load(skill_directories)
        if load_result.errors:
            if getattr(config.skills, "strict_validation", False):
                raise RuntimeError(
                    "Skill manifest validation failed: "
                    + "; ".join(load_result.error_messages())
                )
            for error in load_result.errors:
                logger.warning("skills_manifest_invalid", extra={"path": error.path})

    for manifest in selected_builtin_manifests(config.skills.enabled_skills):
        if skill_registry.get(manifest.name) is None:
            skill_registry.register(manifest)

    skills_policy = SkillsPolicy(
        approval_required_tags=set(getattr(config.skills, "require_approval_tags", [])),
        allow_shell_exec=bool(getattr(config.skills, "allow_shell", True)),
    )
    skill_executor = SkillExecutor(
        policy=skills_policy,
        default_timeout_sec=config.agents.default_timeout_sec,
        max_concurrent_calls=config.workers.max_concurrent_skill_calls,
        module_search_paths=skill_directories,
        sandbox_profile=config.skills.sandbox_profile,
        sandbox_allowed_entrypoint_modules=config.skills.sandbox_allowed_entrypoint_modules,
        otel_enabled=config.observability.opentelemetry_enabled,
        otel_service_name=config.observability.service_name,
    )
    skill_dispatcher: SkillDispatcher
    if config.workers.enabled:
        skills_queue_path = _resolve_path(
            config.workers.skill_queue_persist_path,
            Path.home() / ".opta-lmx" / "skills-queue.db",
        )
        queued_dispatcher = QueuedSkillDispatcher(
            executor=skill_executor,
            worker_count=config.workers.max_concurrent_skill_calls,
            max_queue_size=config.workers.skill_queue_max_size,
            backend=config.workers.skill_queue_backend,
            persist_path=skills_queue_path,
        )
        await queued_dispatcher.start()
        skill_dispatcher = queued_dispatcher
    else:
        skill_dispatcher = LocalSkillDispatcher(skill_executor)

    state_store_path = _resolve_agents_state_store_path(config.agents.state_store_path)
    runtime_tracer = (
        OpenTelemetryTracer(service_name=config.observability.service_name)
        if config.observability.opentelemetry_enabled
        else None
    )
    scheduler = RunScheduler(
        max_queue_size=config.agents.queue_max_size,
        worker_count=config.agents.max_parallel_agents,
        backend=config.agents.queue_backend,
        persist_path=_resolve_path(
            config.agents.queue_persist_path,
            Path.home() / ".opta-lmx" / "agents-queue.db",
        ),
    )
    agent_runtime = AgentsRuntime(
        engine=engine,
        router=task_router,
        state_store=AgentsStateStore(path=state_store_path),
        scheduler=scheduler,
        tracer=runtime_tracer,
        metrics_collector=metrics,
        max_steps_per_run=config.agents.max_steps_per_run,
        retain_completed_runs=config.agents.retain_completed_runs,
        step_retry_attempts=config.agents.step_retry_attempts,
        step_retry_backoff_sec=config.agents.step_retry_backoff_sec,
    )
    await agent_runtime.start()

    from opta_lmx.monitoring.benchmark import BenchmarkResultStore
    app.state.benchmark_store = BenchmarkResultStore()

    app.state.engine = engine
    app.state.embedding_engine = embedding_engine
    app.state.skill_registry = skill_registry
    app.state.skill_executor = skill_executor
    app.state.skill_dispatcher = skill_dispatcher
    app.state.skills_policy = skills_policy
    app.state.agent_runtime = agent_runtime
    app.state.memory_monitor = memory_monitor
    app.state.model_manager = model_manager
    app.state.router = task_router
    app.state.metrics = metrics
    app.state.preset_manager = preset_manager
    app.state.event_bus = event_bus
    app.state.journal_manager = journal_manager
    app.state.pending_downloads: dict[str, dict[str, Any]] = {}
    app.state.start_time = time.time()
    app.state.admin_key = config.security.admin_key
    app.state.inference_api_key = config.security.inference_api_key
    app.state.supabase_jwt_enabled = config.security.supabase_jwt_enabled
    app.state.supabase_jwt_require = config.security.supabase_jwt_require
    app.state.supabase_jwt_verifier = _build_supabase_jwt_verifier(config)
    app.state.honor_x_forwarded_for = config.security.honor_x_forwarded_for
    app.state.trusted_proxy_networks = _parse_trusted_proxy_networks(
        config.security.trusted_proxies
    )
    app.state.runtime_state = runtime_state
    remote_mcp_bridge: RemoteMCPBridge | None = None
    if config.skills.remote_mcp_enabled and config.skills.remote_mcp_url:
        remote_mcp_bridge = RemoteMCPBridge(
            base_url=config.skills.remote_mcp_url,
            timeout_sec=config.skills.remote_mcp_timeout_sec,
            api_key=config.skills.remote_mcp_api_key,
        )
    app.state.remote_mcp_bridge = remote_mcp_bridge

    metrics_event_queue = event_bus.subscribe()
    metrics_event_task: asyncio.Task[None] | None = None

    async def _metrics_event_bridge_loop() -> None:
        while True:
            event = await metrics_event_queue.get()
            if event.event_type == "model_loaded":
                model_id = event.data.get("model_id")
                duration = event.data.get("duration_sec")
                if isinstance(model_id, str) and model_id and isinstance(
                    duration, (int, float)
                ):
                    with contextlib.suppress(TypeError, ValueError):
                        metrics.record_model_load(model_id, float(duration))
            elif event.event_type == "model_unloaded":
                model_id = event.data.get("model_id")
                reason = event.data.get("reason")
                if (
                    isinstance(model_id, str)
                    and model_id
                    and isinstance(reason, str)
                    and reason in {"lru", "ttl"}
                ):
                    metrics.record_model_eviction(model_id)

    metrics_event_task = asyncio.create_task(
        _metrics_event_bridge_loop(),
        name="metrics-event-bridge",
    )

    # Initialize session store for CLI session file access
    session_store = SessionStore()
    app.state.session_store = session_store
    logger.info("session_store_initialized")

    # Initialize helper node clients (embedding/reranking on LAN devices)
    from opta_lmx.helpers.client import HelperNodeClient

    remote_embedding: HelperNodeClient | None = None
    remote_reranking: HelperNodeClient | None = None

    if config.helper_nodes.embedding:
        remote_embedding = HelperNodeClient(config.helper_nodes.embedding)
        logger.info("helper_node_embedding_configured")
    if config.helper_nodes.reranking:
        remote_reranking = HelperNodeClient(config.helper_nodes.reranking)
        logger.info("helper_node_reranking_configured")

    app.state.remote_embedding = remote_embedding
    app.state.remote_reranking = remote_reranking

    # Start background health check loop for helper nodes
    from opta_lmx.helpers.health import health_check_loop

    health_clients: list[HelperNodeClient] = []
    if remote_embedding:
        health_clients.append(remote_embedding)
    if remote_reranking:
        health_clients.append(remote_reranking)

    health_task: asyncio.Task[None] | None = None
    if health_clients:
        health_task = asyncio.create_task(health_check_loop(health_clients, interval_sec=30.0))
        logger.info("health_check_loop_started")

    logger.info("server_starting")

    # Auto-load configured models + preset auto_load models (deduplicated)
    # If previous shutdown was unclean, restore previously loaded models first.
    # Skipped in safe mode (crash loop detected) to prevent repeated OOM/crash cycles.
    if safe_mode:
        logger.warning("auto_load_skipped_safe_mode")
    else:
        auto_load_ids = list(dict.fromkeys(
            restore_model_ids + config.models.auto_load + preset_manager.get_auto_load_models()
        ))
        for model_id in auto_load_ids:
            try:
                perf = preset_manager.find_performance_for_model(model_id)
                await engine.load_model(model_id, performance_overrides=perf)
                logger.info("auto_load_success")
            except Exception:
                logger.error("auto_load_failed")

    # Initialize RAG vector store (accessed via app.state by RagStore dependency)
    if config.rag.enabled:
        from opta_lmx.rag.store import VectorStore

        rag_store = VectorStore(persist_path=config.rag.persist_path)
        loaded_docs = rag_store.load()
        app.state.rag_store = rag_store
        if loaded_docs > 0:
            logger.info("rag_store_loaded")

    # Initialize reranker engine (lazy-load — only loads model on first rerank request)
    from opta_lmx.rag.reranker import RerankerEngine

    reranker_engine = RerankerEngine(model_id=config.rag.reranker_model)
    app.state.reranker_engine = reranker_engine

    # Pre-load embedding model if configured
    if config.models.embedding_model:
        try:
            await embedding_engine.load_model(config.models.embedding_model)
            logger.info("embedding_auto_load_success")
        except Exception:
            logger.error("embedding_auto_load_failed")

    # Persist runtime model inventory so unclean shutdowns can restore state.
    runtime_state_task: asyncio.Task[None] | None = None

    async def _runtime_state_snapshot_loop() -> None:
        while True:
            await asyncio.sleep(_RUNTIME_STATE_SNAPSHOT_INTERVAL_SEC)
            runtime_state.save(loaded_models=engine.get_loaded_model_ids(), clean=False)

    runtime_state.save(loaded_models=engine.get_loaded_model_ids(), clean=False)
    runtime_state_task = asyncio.create_task(
        _runtime_state_snapshot_loop(),
        name="runtime-state-snapshot-loop",
    )

    prefetch_task: asyncio.Task[None] | None = None
    if config.models.warm_pool_enabled:
        async def _prefetch_loop() -> None:
            while True:
                await asyncio.sleep(config.models.prefetch_interval_sec)
                try:
                    candidates = engine.suggest_prefetch_models(config.models.warm_pool_size)
                    for candidate in candidates:
                        if memory_monitor.usage_percent() >= config.memory.max_memory_percent:
                            logger.debug("model_prefetch_skipped_memory_pressure")
                            break
                        if engine.is_model_loaded(candidate):
                            continue
                        perf = preset_manager.find_performance_for_model(candidate)
                        try:
                            await engine.load_model(candidate, performance_overrides=perf)
                            logger.info("model_prefetched", extra={"model_id": candidate})
                        except Exception:
                            logger.debug("model_prefetch_failed", extra={"model_id": candidate})
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.warning("model_prefetch_loop_error")

        prefetch_task = asyncio.create_task(_prefetch_loop(), name="model-prefetch-loop")
        logger.info("model_prefetch_loop_started")

    # Start Metal cache maintenance background task
    metal_task: asyncio.Task[None] | None = None
    if config.memory.metal_cache_maintenance and config.models.metal_cache_limit_gb is not None:
        from opta_lmx.maintenance.metal import metal_cache_maintenance_loop

        metal_task = asyncio.create_task(metal_cache_maintenance_loop(
            cache_limit_gb=config.models.metal_cache_limit_gb,
            interval_sec=config.memory.metal_cache_check_interval_sec,
        ))
        logger.info("metal_cache_maintenance_started")

    # Start TTL eviction background task if enabled
    ttl_task: asyncio.Task[None] | None = None
    if config.memory.ttl_enabled:
        async def _ttl_loop() -> None:
            while True:
                await asyncio.sleep(config.memory.ttl_check_interval_sec)
                try:
                    evicted = await engine.evict_idle_models(config.memory.ttl_seconds)
                    if evicted:
                        logger.info("ttl_eviction_cycle")
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.warning("ttl_eviction_loop_error")

        ttl_task = asyncio.create_task(_ttl_loop())
        logger.info("ttl_enabled")

    yield

    # Cleanup: cancel Metal cache maintenance task
    if metal_task is not None:
        metal_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await metal_task

    # Cleanup: cancel TTL task
    if ttl_task is not None:
        ttl_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await ttl_task

    if runtime_state_task is not None:
        runtime_state_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await runtime_state_task

    if prefetch_task is not None:
        prefetch_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await prefetch_task

    if metrics_event_task is not None:
        metrics_event_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await metrics_event_task
    event_bus.unsubscribe(metrics_event_queue)

    # Cleanup: cancel health check loop
    if health_task is not None:
        health_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await health_task

    # Cleanup: stop agents runtime
    await agent_runtime.stop()
    await skill_dispatcher.close()
    if remote_mcp_bridge is not None:
        await remote_mcp_bridge.close()

    # Cleanup: close helper node clients
    if remote_embedding:
        await remote_embedding.close()
    if remote_reranking:
        await remote_reranking.close()

    # Cleanup: persist RAG store
    rag_store_ref = getattr(app.state, "rag_store", None)
    if rag_store_ref is not None:
        rag_store_ref.save()
        logger.info("rag_store_persisted")

    # Cleanup: unload reranker
    reranker_ref = getattr(app.state, "reranker_engine", None)
    if reranker_ref is not None and reranker_ref.is_loaded:
        reranker_ref.unload()

    # Cleanup: unload embedding model
    if embedding_engine.is_loaded:
        await embedding_engine.unload()

    # Cleanup: drain in-flight requests before unloading
    await engine.drain(timeout_sec=30.0)

    # Cleanup: cancel active downloads
    await model_manager.cancel_active_downloads()

    # Cleanup: unload all models
    for model_id in engine.get_loaded_model_ids():
        with contextlib.suppress(Exception):
            await engine.unload_model(model_id)

    # Record clean shutdown so crash loop detector resets on next startup
    runtime_state.save(loaded_models=[], clean=True)

    if journal_event_queue is not None:
        for _ in range(20):
            if journal_event_queue.empty():
                break
            await asyncio.sleep(0.01)

    if journal_event_task is not None:
        journal_event_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await journal_event_task

    if journal_event_queue is not None:
        event_bus.unsubscribe(journal_event_queue)

    if journal_manager is not None:
        try:
            journal_manager.finalize_runtime_session(summary="runtime-session")
        except Exception:
            logger.warning("journaling_finalize_failed")

    logger.info("server_shutdown")


def create_app(config: LMXConfig | None = None) -> FastAPI:
    """Create the FastAPI application with all routes mounted.

    Args:
        config: Server configuration. If None, loads from default paths.

    Returns:
        Configured FastAPI application.
    """
    if config is None:
        config = load_config()

    app = FastAPI(
        title="Opta-LMX",
        description="Private AI inference engine for Apple Silicon",
        version=__version__,
        lifespan=lifespan,
    )

    # Store config in app state for route handlers
    app.state.config = config

    # Load shedding — reject non-health requests when memory is critically high
    from opta_lmx.api.load_shedding import LoadSheddingMiddleware

    app.add_middleware(
        LoadSheddingMiddleware, threshold_percent=config.memory.load_shedding_percent,
    )

    # Rate limiting on inference endpoints (opt-in via config)
    if config.security.rate_limit.enabled:
        from opta_lmx.api.rate_limit import SLOWAPI_AVAILABLE, limiter

        if SLOWAPI_AVAILABLE:
            from slowapi import _rate_limit_exceeded_handler
            from slowapi.errors import RateLimitExceeded

            limiter.enabled = True
            app.state.limiter = limiter
            app.add_exception_handler(
                RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler),
            )
        else:
            logger.warning(
                "rate_limit_enabled_but_slowapi_missing",
            )

    # OpenTelemetry spans — wraps each request in a trace span (opt-in)
    app.add_middleware(
        OpenTelemetryMiddleware,
        enabled=config.observability.opentelemetry_enabled,
        service_name=config.observability.service_name,
    )

    # Request logging — method, path, status, latency for all HTTP requests
    app.add_middleware(RequestLoggingMiddleware)

    # Request ID middleware — adds X-Request-ID to all responses and logs
    app.add_middleware(RequestIDMiddleware)

    # CORS — permissive for LAN-only use; tighten origins for public deployments
    cors_origins = list(config.security.cors_allowed_origins)
    if config.security.profile == "lan" and not cors_origins:
        cors_origins = ["*"]
    app.add_middleware(
        MTLSMiddleware,
        mode=config.security.mtls_mode,
        client_subject_header=config.security.mtls_client_subject_header,
        allowed_subjects=config.security.mtls_allowed_subjects,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount route groups
    app.include_router(inference_router)
    app.include_router(embeddings_router)
    app.include_router(rerank_router)
    if config.rag.enabled:
        app.include_router(rag_router)
    app.include_router(anthropic_router)
    app.include_router(admin_router)
    app.include_router(benchmark_router)
    app.include_router(sessions_router, prefix="/admin")
    if config.skills.enabled:
        app.include_router(skills_router)
    if config.agents.enabled:
        app.include_router(agents_router)
    app.include_router(health_router)
    if config.server.websocket_enabled:
        app.include_router(websocket_router)

    return app


def cli() -> None:
    """CLI entry point: parse args, load config, start uvicorn."""
    parser = argparse.ArgumentParser(
        prog="opta-lmx",
        description="Opta-LMX — Private AI inference engine for Apple Silicon",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to config.yaml (default: ~/.opta-lmx/config.yaml)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Override server host",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Override server port (default: 1234)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Override log level",
    )
    args = parser.parse_args()

    # Load config
    config = load_config(args.config)

    # Apply CLI overrides
    if args.host:
        config.server.host = args.host
    if args.port:
        config.server.port = args.port

    # Setup logging
    log_level = args.log_level or config.logging.level
    structured = config.logging.format == "structured"
    setup_logging(
        level=log_level,
        structured=structured,
        log_file=config.logging.file,
        max_bytes=config.logging.max_file_bytes,
        backup_count=config.logging.backup_count,
    )

    # Create and run app
    app = create_app(config)
    uvicorn.run(
        app,
        host=config.server.host,
        port=config.server.port,
        timeout_keep_alive=config.server.timeout_sec,
        log_level=log_level.lower(),
        ws_max_size=1_048_576,  # 1MB WebSocket message size limit
    )


# Support `python -m opta_lmx`
if __name__ == "__main__":
    cli()
