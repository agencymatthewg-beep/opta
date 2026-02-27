"""Tests for concurrent request limiting, timeout, warmup, and graceful drain."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from opta_lmx.config import ModelsConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.manager.memory import MemoryMonitor

# Force vllm-mlx backend so tests use the mocked _create_engine path
_VLLM_BACKEND_PATCH = patch(
    "opta_lmx.inference.engine_lifecycle.backend_candidates",
    return_value=["vllm-mlx"],
)


@pytest.fixture(autouse=True)
def _force_vllm_backend():
    """Force vllm-mlx backend so tests use the mocked _create_engine path."""
    with _VLLM_BACKEND_PATCH:
        yield


@pytest.fixture
def engine() -> InferenceEngine:
    """Engine with concurrency controls and warmup disabled."""
    monitor = MemoryMonitor(max_percent=90)
    eng = InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        max_concurrent_requests=2,
        inference_timeout_sec=5,
        warmup_on_load=False,
    )

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test response")
        return mock

    async def mock_create_tuple(
        model_id: str, use_batching: bool, **_kw: object,
    ) -> tuple[MagicMock, dict[str, object]]:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test response")
        return mock, {}

    eng._create_engine = mock_create  # type: ignore[assignment]
    eng._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
    eng._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]
    return eng


class TestConcurrentRequestLimiting:
    """Semaphore limits parallel inference."""

    async def test_semaphore_limits_concurrency(self, engine: InferenceEngine) -> None:
        """Only max_concurrent_requests run simultaneously."""
        await engine.load_model("test/model-a")

        # Track concurrent count
        peak_concurrent = 0
        current_concurrent = 0
        lock = asyncio.Lock()


        async def slow_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            nonlocal peak_concurrent, current_concurrent
            async with lock:
                current_concurrent += 1
                peak_concurrent = max(peak_concurrent, current_concurrent)
            await asyncio.sleep(0.1)
            async with lock:
                current_concurrent -= 1
            return "response", 5, 3, {}

        engine._generator._do_generate = slow_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]

        # Launch 4 concurrent requests with semaphore limit of 2
        tasks = [
            asyncio.create_task(engine.generate("test/model-a", messages))
            for _ in range(4)
        ]
        await asyncio.gather(*tasks)

        assert peak_concurrent <= 2, f"Peak concurrency {peak_concurrent} exceeded limit 2"

    async def test_in_flight_tracking(self, engine: InferenceEngine) -> None:
        """in_flight_count tracks active requests."""
        await engine.load_model("test/model-a")
        assert engine.in_flight_count == 0

        started = asyncio.Event()
        release = asyncio.Event()


        async def blocking_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            started.set()
            await release.wait()
            return "response", 5, 3, {}

        engine._generator._do_generate = blocking_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]
        task = asyncio.create_task(engine.generate("test/model-a", messages))

        await started.wait()
        assert engine.in_flight_count == 1

        release.set()
        await task
        assert engine.in_flight_count == 0


class TestSemaphoreTimeout:
    """Semaphore acquire times out and raises when queue is full."""

    async def test_returns_error_when_semaphore_timeout(self, engine: InferenceEngine) -> None:
        """Requests that can't acquire semaphore within timeout raise RuntimeError."""
        engine._inference_timeout = 5
        engine._concurrency._semaphore_timeout = 0.2  # 200ms timeout
        await engine.load_model("test/model-a")

        release = asyncio.Event()

        async def blocking_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            await release.wait()
            return "response", 5, 3, {}

        engine._generator._do_generate = blocking_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]

        # Fill up the semaphore (limit=2)
        tasks = [
            asyncio.create_task(engine.generate("test/model-a", messages))
            for _ in range(2)
        ]
        await asyncio.sleep(0.05)  # Let them acquire the semaphore

        # This 3rd request should timeout waiting for semaphore
        with pytest.raises(RuntimeError, match="Server is busy"):
            await engine.generate("test/model-a", messages)

        # Cleanup
        release.set()
        await asyncio.gather(*tasks)


class TestInferenceTimeout:
    """Inference requests time out if they take too long."""

    async def test_timeout_raises_runtime_error(self, engine: InferenceEngine) -> None:
        """Slow inference triggers timeout."""
        # Set a very short timeout for testing
        engine._inference_timeout = 0.2

        await engine.load_model("test/model-a")

        async def slow_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            await asyncio.sleep(10)
            return "response", 5, 3, {}

        engine._generator._do_generate = slow_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]
        with pytest.raises(RuntimeError, match="timed out"):
            await engine.generate("test/model-a", messages)

    async def test_no_timeout_on_fast_request(self, engine: InferenceEngine) -> None:
        """Fast requests complete normally."""
        await engine.load_model("test/model-a")

        messages = [ChatMessage(role="user", content="Hi")]
        result = await engine.generate("test/model-a", messages)
        assert result.choices[0].message.content == "test response"


class TestModelWarmup:
    """Model warmup primes JIT/KV cache on load."""

    async def test_warmup_runs_on_load(self) -> None:
        """When warmup_on_load=True, a minimal inference runs after model load."""
        monitor = MemoryMonitor(max_percent=90)
        eng = InferenceEngine(
            memory_monitor=monitor, use_batching=False, warmup_on_load=True,
        )

        warmup_called = False

        async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
            mock = MagicMock()

            async def track_warmup(**kwargs: object) -> str:
                nonlocal warmup_called
                warmup_called = True
                return "warmup"

            mock.chat = track_warmup
            return mock

        async def mock_create_tuple(
            model_id: str, use_batching: bool, **_kw: object,
        ) -> tuple[MagicMock, dict[str, object]]:
            mock = MagicMock()

            async def track_warmup(**kwargs: object) -> str:
                nonlocal warmup_called
                warmup_called = True
                return "warmup"

            mock.chat = track_warmup
            return mock, {}

        eng._create_engine = mock_create  # type: ignore[assignment]
        eng._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
        eng._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]
        await eng.load_model("test/model-warmup")
        assert warmup_called, "Warmup inference should have been called"

    async def test_warmup_disabled(self) -> None:
        """When warmup_on_load=False, no warmup inference runs."""
        monitor = MemoryMonitor(max_percent=90)
        eng = InferenceEngine(
            memory_monitor=monitor, use_batching=False, warmup_on_load=False,
        )

        warmup_called = False

        async def mock_create_tuple(
            model_id: str, use_batching: bool, **_kw: object,
        ) -> tuple[MagicMock, dict[str, object]]:
            mock = MagicMock()

            async def track_warmup(**kwargs: object) -> str:
                nonlocal warmup_called
                warmup_called = True
                return "warmup"

            mock.chat = track_warmup
            return mock, {}

        eng._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
        eng._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]
        await eng.load_model("test/model-no-warmup")
        assert not warmup_called, "Warmup should NOT have been called"

    async def test_warmup_failure_non_fatal(self) -> None:
        """Warmup failure is logged but doesn't prevent model use."""
        monitor = MemoryMonitor(max_percent=90)
        eng = InferenceEngine(
            memory_monitor=monitor, use_batching=False, warmup_on_load=True,
        )

        async def mock_create_tuple(
            model_id: str, use_batching: bool, **_kw: object,
        ) -> tuple[MagicMock, dict[str, object]]:
            mock = MagicMock()

            async def fail_warmup(**kwargs: object) -> str:
                raise RuntimeError("warmup kaboom")

            mock.chat = fail_warmup
            return mock, {}

        eng._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
        eng._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]

        # Should NOT raise — warmup failure is non-fatal
        info = await eng.load_model("test/model-warmup-fail")
        assert info.loaded is True


class TestGracefulDrain:
    """drain() waits for in-flight requests to complete."""

    async def test_drain_immediate_when_idle(self, engine: InferenceEngine) -> None:
        """drain() returns True immediately when no requests are in flight."""
        result = await engine.drain(timeout_sec=1.0)
        assert result is True

    async def test_drain_waits_for_inflight(self, engine: InferenceEngine) -> None:
        """drain() waits for in-flight request to complete."""
        await engine.load_model("test/model-a")

        release = asyncio.Event()

        async def blocking_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            await release.wait()
            return "response", 5, 3, {}

        engine._generator._do_generate = blocking_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]
        task = asyncio.create_task(engine.generate("test/model-a", messages))

        # Give the task time to start
        await asyncio.sleep(0.05)
        assert engine.in_flight_count == 1

        # Release the blocked request after a brief delay
        async def delayed_release() -> None:
            await asyncio.sleep(0.1)
            release.set()

        _release_task = asyncio.create_task(delayed_release())  # noqa: RUF006

        result = await engine.drain(timeout_sec=5.0)
        assert result is True
        assert engine.in_flight_count == 0
        await task

    async def test_drain_timeout(self, engine: InferenceEngine) -> None:
        """drain() returns False if timeout expires before requests complete."""
        await engine.load_model("test/model-a")

        async def forever_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
            await asyncio.sleep(100)
            return "response", 5, 3, {}

        engine._generator._do_generate = forever_generate  # type: ignore[assignment]

        messages = [ChatMessage(role="user", content="Hi")]
        task = asyncio.create_task(engine.generate("test/model-a", messages))

        await asyncio.sleep(0.05)

        result = await engine.drain(timeout_sec=0.2)
        assert result is False

        # Cancel the stuck task to clean up
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task


class TestConfigDefaults:
    """Config defaults for concurrency settings."""

    def test_defaults(self) -> None:
        """ModelsConfig has correct defaults."""
        config = ModelsConfig()
        assert config.max_concurrent_requests == 4
        assert config.inference_timeout_sec == 300
        assert config.warmup_on_load is True

    def test_custom_values(self) -> None:
        """ModelsConfig accepts custom values."""
        config = ModelsConfig(
            max_concurrent_requests=8,
            inference_timeout_sec=60,
            warmup_on_load=False,
        )
        assert config.max_concurrent_requests == 8
        assert config.inference_timeout_sec == 60
        assert config.warmup_on_load is False

    def test_concurrent_request_bounds(self) -> None:
        """max_concurrent_requests has valid bounds."""
        config = ModelsConfig(max_concurrent_requests=1)
        assert config.max_concurrent_requests == 1

        config = ModelsConfig(max_concurrent_requests=64)
        assert config.max_concurrent_requests == 64

        with pytest.raises(ValidationError):
            ModelsConfig(max_concurrent_requests=0)

        with pytest.raises(ValidationError):
            ModelsConfig(max_concurrent_requests=65)

    def test_timeout_bounds(self) -> None:
        """inference_timeout_sec has valid bounds."""
        with pytest.raises(ValidationError):
            ModelsConfig(inference_timeout_sec=5)  # Below min 10

        config = ModelsConfig(inference_timeout_sec=3600)
        assert config.inference_timeout_sec == 3600
