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
from opta_lmx.api.health import router as health_router
from opta_lmx.api.inference import router as inference_router
from opta_lmx.api.middleware import RequestIDMiddleware
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

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialize engine, auto-load models, cleanup."""
    config: LMXConfig = app.state.config

    # Initialize core services
    memory_monitor = MemoryMonitor(max_percent=config.memory.max_memory_percent)
    event_bus = EventBus()

    engine = InferenceEngine(
        memory_monitor=memory_monitor,
        use_batching=config.models.use_batching,
        auto_evict_lru=config.memory.auto_evict_lru,
        gguf_context_length=config.models.gguf_context_length,
        gguf_gpu_layers=config.models.gguf_gpu_layers,
        event_bus=event_bus,
        speculative_model=config.models.speculative_model,
        speculative_num_tokens=config.models.speculative_num_tokens,
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

    app.state.engine = engine
    app.state.memory_monitor = memory_monitor
    app.state.model_manager = model_manager
    app.state.router = task_router
    app.state.metrics = metrics
    app.state.preset_manager = preset_manager
    app.state.event_bus = event_bus
    app.state.pending_downloads = {}  # dict[str, dict[str, Any]]
    app.state.start_time = time.time()
    app.state.admin_key = config.security.admin_key

    logger.info(
        "server_starting",
        extra={
            "host": config.server.host,
            "port": config.server.port,
            "memory_total_gb": round(memory_monitor.total_memory_gb(), 1),
            "memory_threshold": config.memory.max_memory_percent,
        },
    )

    # Auto-load configured models
    for model_id in config.models.auto_load:
        try:
            await engine.load_model(model_id)
            logger.info("auto_load_success", extra={"model_id": model_id})
        except Exception as e:
            logger.error("auto_load_failed", extra={"model_id": model_id, "error": str(e)})

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
    app.include_router(admin_router)
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
