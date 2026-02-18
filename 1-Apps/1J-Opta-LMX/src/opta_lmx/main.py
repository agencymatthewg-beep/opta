"""Opta-LMX — FastAPI application factory and CLI entry point."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from opta_lmx import __version__
from opta_lmx.api.admin import router as admin_router
from opta_lmx.api.anthropic import router as anthropic_router
from opta_lmx.api.embeddings import router as embeddings_router
from opta_lmx.api.health import router as health_router
from opta_lmx.api.inference import router as inference_router
from opta_lmx.api.middleware import RequestIDMiddleware, RequestLoggingMiddleware
from opta_lmx.api.rag import router as rag_router
from opta_lmx.api.rerank import router as rerank_router
from opta_lmx.api.sessions import router as sessions_router
from opta_lmx.api.websocket import router as websocket_router
from opta_lmx.config import LMXConfig, load_config
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.logging import setup_logging
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.sessions.store import SessionStore

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialize engine, auto-load models, cleanup."""
    config: LMXConfig = app.state.config

    # Initialize core services
    memory_monitor = MemoryMonitor(max_percent=config.memory.max_memory_percent)
    event_bus = EventBus()

    # E1: Set MLX Metal memory limits to prevent fatal SIGABRT under pressure.
    # Derives hard limit from the configured memory threshold percentage.
    try:
        import mlx.core as mx

        total_bytes = int(memory_monitor.total_memory_gb() * (1024 ** 3))
        metal_limit = int(total_bytes * config.memory.max_memory_percent / 100)
        mx.metal.set_memory_limit(metal_limit, relaxed=True)

        if config.models.metal_cache_limit_gb is not None:
            cache_bytes = int(config.models.metal_cache_limit_gb * (1024 ** 3))
            mx.metal.set_cache_limit(cache_bytes)

        logger.info("metal_limits_set", extra={
            "memory_limit_gb": round(metal_limit / (1024 ** 3), 1),
            "cache_limit_gb": config.models.metal_cache_limit_gb,
            "relaxed": True,
        })
    except Exception as e:
        logger.warning("metal_limits_failed", extra={"error": str(e)})

    engine = InferenceEngine(
        memory_monitor=memory_monitor,
        use_batching=config.models.use_batching,
        auto_evict_lru=config.memory.auto_evict_lru,
        gguf_context_length=config.models.gguf_context_length,
        gguf_gpu_layers=config.models.gguf_gpu_layers,
        event_bus=event_bus,
        speculative_model=config.models.speculative_model,
        speculative_num_tokens=config.models.speculative_num_tokens,
        kv_bits=config.models.kv_bits,
        kv_group_size=config.models.kv_group_size,
        prefix_cache_enabled=config.models.prefix_cache_enabled,
        max_concurrent_requests=config.models.max_concurrent_requests,
        inference_timeout_sec=config.models.inference_timeout_sec,
        warmup_on_load=config.models.warmup_on_load,
        stream_interval=config.models.stream_interval,
    )

    model_manager = ModelManager(
        models_directory=config.models.models_directory,
        event_bus=event_bus,
    )

    task_router = TaskRouter(config.routing)
    metrics = MetricsCollector()

    preset_manager = PresetManager(config.presets.directory)
    if config.presets.enabled:
        preset_manager.load_presets()

        # Merge preset routing aliases into the task router
        preset_aliases = preset_manager.get_routing_aliases()
        if preset_aliases:
            for alias, models in preset_aliases.items():
                existing = config.routing.aliases.get(alias, [])
                # Preset models are appended (config takes priority)
                merged = list(dict.fromkeys(existing + models))
                config.routing.aliases[alias] = merged
            task_router.update_config(config.routing)
            logger.info("preset_routing_aliases_merged", extra={
                "aliases": list(preset_aliases.keys()),
            })

    # Initialize embedding engine (lazy-load — only loads model on first request)
    from opta_lmx.inference.embedding_engine import EmbeddingEngine

    embedding_engine = EmbeddingEngine()

    app.state.engine = engine
    app.state.embedding_engine = embedding_engine
    app.state.memory_monitor = memory_monitor
    app.state.model_manager = model_manager
    app.state.router = task_router
    app.state.metrics = metrics
    app.state.preset_manager = preset_manager
    app.state.event_bus = event_bus
    app.state.pending_downloads = {}  # dict[str, dict[str, Any]]
    app.state.start_time = time.time()
    app.state.admin_key = config.security.admin_key

    # Initialize session store for CLI session file access
    session_store = SessionStore()
    app.state.session_store = session_store
    logger.info("session_store_initialized", extra={
        "sessions_dir": str(session_store.sessions_dir),
    })

    # Initialize helper node clients (embedding/reranking on LAN devices)
    from opta_lmx.helpers.client import HelperNodeClient

    remote_embedding: HelperNodeClient | None = None
    remote_reranking: HelperNodeClient | None = None

    if config.helper_nodes.embedding:
        remote_embedding = HelperNodeClient(config.helper_nodes.embedding)
        logger.info("helper_node_embedding_configured", extra={
            "url": config.helper_nodes.embedding.url,
            "model": config.helper_nodes.embedding.model,
        })
    if config.helper_nodes.reranking:
        remote_reranking = HelperNodeClient(config.helper_nodes.reranking)
        logger.info("helper_node_reranking_configured", extra={
            "url": config.helper_nodes.reranking.url,
            "model": config.helper_nodes.reranking.model,
        })

    app.state.remote_embedding = remote_embedding
    app.state.remote_reranking = remote_reranking

    logger.info(
        "server_starting",
        extra={
            "host": config.server.host,
            "port": config.server.port,
            "memory_total_gb": round(memory_monitor.total_memory_gb(), 1),
            "memory_threshold": config.memory.max_memory_percent,
        },
    )

    # Auto-load configured models + preset auto_load models (deduplicated)
    auto_load_ids = list(dict.fromkeys(
        config.models.auto_load + preset_manager.get_auto_load_models()
    ))
    for model_id in auto_load_ids:
        try:
            perf = preset_manager.find_performance_for_model(model_id)
            await engine.load_model(model_id, performance_overrides=perf)
            logger.info("auto_load_success", extra={
                "model_id": model_id,
                "has_performance_profile": perf is not None,
            })
        except Exception as e:
            logger.error("auto_load_failed", extra={"model_id": model_id, "error": str(e)})

    # Initialize RAG vector store (accessed via app.state by RagStore dependency)
    if config.rag.enabled:
        from opta_lmx.rag.store import VectorStore

        rag_store = VectorStore(persist_path=config.rag.persist_path)
        loaded_docs = rag_store.load()
        app.state.rag_store = rag_store
        if loaded_docs > 0:
            logger.info("rag_store_loaded", extra={
                "documents": loaded_docs,
                "path": str(config.rag.persist_path),
            })

    # Pre-load embedding model if configured
    if config.models.embedding_model:
        try:
            await embedding_engine.load_model(config.models.embedding_model)
            logger.info("embedding_auto_load_success", extra={
                "model_id": config.models.embedding_model,
            })
        except Exception as e:
            logger.error("embedding_auto_load_failed", extra={
                "model_id": config.models.embedding_model, "error": str(e),
            })

    # Start TTL eviction background task if enabled
    ttl_task: asyncio.Task[None] | None = None
    if config.memory.ttl_enabled:
        async def _ttl_loop() -> None:
            while True:
                await asyncio.sleep(config.memory.ttl_check_interval_sec)
                evicted = await engine.evict_idle_models(config.memory.ttl_seconds)
                if evicted:
                    logger.info("ttl_eviction_cycle", extra={"evicted": evicted})

        ttl_task = asyncio.create_task(_ttl_loop())
        logger.info("ttl_enabled", extra={
            "ttl_seconds": config.memory.ttl_seconds,
            "check_interval_sec": config.memory.ttl_check_interval_sec,
        })

    yield

    # Cleanup: cancel TTL task
    if ttl_task is not None:
        ttl_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await ttl_task

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

    # Cleanup: unload embedding model
    if embedding_engine.is_loaded:
        await embedding_engine.unload()

    # Cleanup: drain in-flight requests before unloading
    await engine.drain(timeout_sec=30.0)

    # Cleanup: cancel active downloads
    await model_manager.cancel_active_downloads()

    # Cleanup: unload all models
    for model_id in [m.model_id for m in engine.get_loaded_models()]:
        with contextlib.suppress(Exception):
            await engine.unload_model(model_id)

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

    # Request logging — method, path, status, latency for all HTTP requests
    app.add_middleware(RequestLoggingMiddleware)

    # Request ID middleware — adds X-Request-ID to all responses and logs
    app.add_middleware(RequestIDMiddleware)

    # CORS — permissive for LAN-only use; tighten origins for public deployments
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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
    app.include_router(sessions_router, prefix="/admin")
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
