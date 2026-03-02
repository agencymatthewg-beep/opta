# Quantize Hard-Cancel And Storage Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement true hard-cancel for running quantization jobs via process isolation, while hardening model-cache directory behavior so install/startup always provisions required paths used by download/delete flows.

**Architecture:** Keep the existing queued quantize state machine, but move execution from threadpool to an isolated child worker process controlled by a parent supervisor that supports terminate-then-kill cancellation. Extend persisted quantize job metadata with cancellation/failure process details and migrate registry data forward-compatible. Align `ModelManager` cache path resolution with configured `models_directory` and startup directory provisioning to eliminate cache-path drift.

**Tech Stack:** Python 3.11+, `asyncio` subprocess APIs, `mlx_lm.convert`, Hugging Face Hub (`snapshot_download`, `scan_cache_dir`), FastAPI admin routes, pytest.

---

## Research Inputs (2026-03-02)

- MLX quantization mode constraints are documented in `mlx.core.quantize` (supported modes/bits/group sizes), matching current API validation logic.
  - Source: https://ml-explore.github.io/mlx/build/html/python/_autosummary/mlx.core.quantize.html
- `Future.cancel()` cannot cancel already-running callables in executor threads, which explains why current `run_in_executor` quantization cannot be hard-cancelled once running.
  - Source: https://docs.python.org/3/library/concurrent.futures.html#concurrent.futures.Future.cancel
- `asyncio` subprocess control (`create_subprocess_exec`, `terminate`, `kill`, `wait_for`) supports deterministic hard-cancel semantics with timeout escalation.
  - Source: https://docs.python.org/3/library/asyncio-subprocess.html

## Current Optimization Assessment

1. Strength: Quantization validation and queueing are already strict (`bits/group_size/mode`, persisted queue status).
2. Strength: Runtime bootstrap already creates `.opta-lmx/quantized` and related operational directories.
3. Gap: Running quantize jobs are not truly cancellable due to executor-thread execution.
4. Gap: Running quantize jobs may leave partial output directories if process is interrupted.
5. Gap: `ModelManager` cache operations currently drift from configured `models_directory`; download/delete/list paths are not fully aligned with bootstrap provisioning.

## Implementation Tasks

### Task 1: Add Quantize IPC Protocol Types

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Files:**
- Modify: `src/opta_lmx/runtime/loader_protocol.py`
- Create: `tests/test_quantize_protocol.py`

**Step 1: Write the failing test**

```python
from opta_lmx.runtime.loader_protocol import QuantizeSpec, QuantizeResult, LoaderFailure


def test_quantize_spec_round_trip() -> None:
    spec = QuantizeSpec(
        job_id="job-1",
        source_model="mlx-community/model",
        output_path="/tmp/out",
        bits=4,
        group_size=64,
        mode="affine",
    )
    assert QuantizeSpec.from_dict(spec.to_dict()) == spec


def test_quantize_result_round_trip() -> None:
    result = QuantizeResult(
        ok=True,
        output_path="/tmp/out",
        output_size_bytes=1234,
    )
    assert QuantizeResult.from_dict(result.to_dict()) == result


def test_loader_failure_allows_exit_and_signal_fields() -> None:
    failure = LoaderFailure.from_dict({"code": "worker_crashed", "signal": 6, "exit_code": None})
    assert failure.code == "worker_crashed"
    assert failure.signal == 6
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_quantize_protocol.py`
Expected: FAIL with import/attribute errors for missing `QuantizeSpec`/`QuantizeResult`.

**Step 3: Write minimal implementation**

```python
@dataclass(slots=True)
class QuantizeSpec:
    job_id: str
    source_model: str
    output_path: str
    bits: int
    group_size: int
    mode: str
    timeout_sec: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {...}

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "QuantizeSpec":
        return cls(...)


@dataclass(slots=True)
class QuantizeResult:
    ok: bool
    output_path: str
    output_size_bytes: int

    def to_dict(self) -> dict[str, Any]:
        return {...}

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "QuantizeResult":
        return cls(...)
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_quantize_protocol.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/runtime/loader_protocol.py tests/test_quantize_protocol.py
git commit -m "feat: add quantize ipc protocol types"
```

### Task 2: Implement Child Quantize Worker

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:systematic-debugging`

**Files:**
- Create: `src/opta_lmx/runtime/child_quantize_worker.py`
- Create: `tests/test_child_quantize_worker.py`

**Step 1: Write the failing test**

```python
import pytest
from opta_lmx.runtime.child_quantize_worker import execute_quantize_spec
from opta_lmx.runtime.loader_protocol import QuantizeSpec


@pytest.mark.asyncio
async def test_worker_success_returns_size(tmp_path):
    out = tmp_path / "model"
    spec = QuantizeSpec("job-1", "org/model", str(out), 4, 64, "affine")

    async def fake_convert(_spec: QuantizeSpec) -> int:
        out.mkdir(parents=True)
        (out / "weights.bin").write_bytes(b"x" * 10)
        return 10

    result = await execute_quantize_spec(spec, quantize_impl=fake_convert)
    assert result.ok is True
    assert result.output_size_bytes == 10
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_child_quantize_worker.py`
Expected: FAIL with missing module/function.

**Step 3: Write minimal implementation**

```python
async def execute_quantize_spec(
    spec: QuantizeSpec,
    *,
    quantize_impl: Callable[[QuantizeSpec], Awaitable[int]] | None = None,
) -> QuantizeResult:
    impl = quantize_impl or _default_quantize_impl
    size = await impl(spec)
    return QuantizeResult(ok=True, output_path=spec.output_path, output_size_bytes=size)


def main() -> int:
    # read JSON from stdin -> QuantizeSpec
    # run execute_quantize_spec
    # write one JSON line to stdout on success
    # write LoaderFailure JSON to stderr on failure
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_child_quantize_worker.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/runtime/child_quantize_worker.py tests/test_child_quantize_worker.py
git commit -m "feat: add child quantize worker"
```

### Task 3: Implement Quantize Supervisor With Terminate/Kill

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:systematic-debugging`

**Files:**
- Create: `src/opta_lmx/runtime/child_quantize_supervisor.py`
- Create: `tests/test_child_quantize_supervisor.py`

**Step 1: Write the failing test**

```python
import pytest
from opta_lmx.runtime.child_quantize_supervisor import QuantizeProcessHandle


@pytest.mark.asyncio
async def test_cancel_escalates_terminate_then_kill(monkeypatch):
    handle = QuantizeProcessHandle(proc=fake_proc_that_hangs_on_terminate())
    await handle.cancel(grace_sec=0.01)
    assert handle.proc.terminated is True
    assert handle.proc.killed is True
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_child_quantize_supervisor.py`
Expected: FAIL with missing module/class.

**Step 3: Write minimal implementation**

```python
@dataclass(slots=True)
class QuantizeProcessHandle:
    proc: asyncio.subprocess.Process
    job_id: str

    @property
    def pid(self) -> int | None:
        return self.proc.pid

    async def cancel(self, grace_sec: float) -> None:
        with contextlib.suppress(ProcessLookupError):
            self.proc.terminate()
        try:
            await asyncio.wait_for(self.proc.wait(), timeout=grace_sec)
        except TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                self.proc.kill()
            await self.proc.wait()
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_child_quantize_supervisor.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/runtime/child_quantize_supervisor.py tests/test_child_quantize_supervisor.py
git commit -m "feat: add quantize subprocess supervisor with kill escalation"
```

### Task 4: Refactor Quantize Manager To Subprocess Execution

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Files:**
- Modify: `src/opta_lmx/manager/quantize.py`
- Modify: `tests/test_quantize.py`

**Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_cancel_running_job_enters_cancelling_and_requests_process_stop():
    job = QuantizeJob(job_id="job-1", source_model="org/model", output_path="/tmp/out", status="running")
    _jobs[job.job_id] = job
    _process_handles[job.job_id] = fake_handle()
    cancelled, reason, _ = await cancel_quantize(job.job_id)
    assert cancelled is False
    assert reason == "cancelling"
    assert job.status == "cancelling"
    assert _process_handles[job.job_id].cancel_called is True
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_quantize.py::test_cancel_running_job_enters_cancelling_and_requests_process_stop`
Expected: FAIL because current implementation returns `running_cannot_cancel` and has no process handle registry.

**Step 3: Write minimal implementation**

```python
# new transient state + process registry
_ACTIVE_STATES = frozenset({"pending", "queued", "running", "cancelling"})
_process_handles: dict[str, QuantizeProcessHandle] = {}


async def cancel_quantize(...):
    ...
    if job.status in {"running", "cancelling"}:
        job.cancel_requested = True
        job.status = "cancelling"
        job.cancel_requested_at = time.time()
        _touch(job)
        _persist_jobs()
        handle = _process_handles.get(job_id)
        if handle is not None:
            asyncio.create_task(handle.cancel(grace_sec=5.0))
        return False, "cancelling", job
```

Also add:
- registry version bump and migration defaults for new fields
- job metadata fields: `failure_code`, `exit_code`, `signal`, `worker_pid`, `cancel_requested_at`
- `_run_quantize` launches child worker via supervisor instead of `run_in_executor`.

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_quantize.py`
Expected: PASS after updating all affected assertions.

**Step 5: Commit**

```bash
git add src/opta_lmx/manager/quantize.py tests/test_quantize.py
git commit -m "feat: switch quantize manager to subprocess execution and hard-cancel states"
```

### Task 5: Update Admin Quantize Cancel Semantics

**Skill refs:** `@superpowers:test-driven-development`

**Files:**
- Modify: `src/opta_lmx/api/admin.py`
- Modify: `tests/test_quantize_admin.py`

**Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_cancel_running_returns_202_cancelling(client):
    with patch("opta_lmx.manager.quantize.cancel_quantize", return_value=(False, "cancelling", running_job())):
        resp = await client.post("/admin/quantize/job-2/cancel")
    assert resp.status_code == 202
    assert resp.json()["reason"] == "cancelling"
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_quantize_admin.py::test_cancel_running_returns_202_cancelling`
Expected: FAIL because route currently maps running cancel to `409`.

**Step 3: Write minimal implementation**

```python
status_code = 200
if reason == "cancelling":
    status_code = 202
```

And include new fields in detail/list responses:

```python
"failure_code": job.failure_code,
"exit_code": job.exit_code,
"signal": job.signal,
"worker_pid": job.worker_pid,
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_quantize_admin.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/api/admin.py tests/test_quantize_admin.py
git commit -m "feat: expose quantize cancelling semantics and process failure metadata"
```

### Task 6: Align ModelManager Cache Path With Configured Models Directory

**Skill refs:** `@superpowers:test-driven-development` `@superpowers:verification-before-completion`

**Files:**
- Modify: `src/opta_lmx/manager/model.py`
- Modify: `tests/test_model_manager.py`

**Step 1: Write the failing test**

```python
async def test_list_available_scans_configured_cache_dir(tmp_path):
    manager = ModelManager(models_directory=tmp_path / "hf-cache")
    with patch("opta_lmx.manager.model.scan_cache_dir") as scan:
        scan.return_value = MagicMock(repos=[])
        await manager.list_available()
    assert scan.call_args.kwargs["cache_dir"] == manager._cache_dir
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_model_manager.py::test_list_available_scans_configured_cache_dir`
Expected: FAIL because current code calls `scan_cache_dir()` without `cache_dir`.

**Step 3: Write minimal implementation**

```python
self._cache_dir = models_directory.expanduser() if models_directory else None

def _resolved_cache_dir(self) -> Path:
    return self._cache_dir or (Path.home() / ".cache" / "huggingface" / "hub")

...
cache_dir = self._resolved_cache_dir()
cache_dir.mkdir(parents=True, exist_ok=True)
cache_info = await asyncio.to_thread(scan_cache_dir, cache_dir=cache_dir)
...
await asyncio.to_thread(snapshot_download, ..., cache_dir=cache_dir)
```

Normalize missing cache behavior in delete flow:

```python
except Exception as e:
    raise KeyError(f"Model '{repo_id}' not found in HuggingFace cache: {e}") from e
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_model_manager.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/manager/model.py tests/test_model_manager.py
git commit -m "fix: align model cache operations with configured models directory"
```

### Task 7: Extend Startup Directory Provisioning For Effective Cache Path

**Skill refs:** `@superpowers:test-driven-development`

**Files:**
- Modify: `src/opta_lmx/main.py`
- Modify: `tests/test_main_directories.py`

**Step 1: Write the failing test**

```python
def test_ensure_runtime_directories_creates_model_cache_root(tmp_path, monkeypatch):
    ...
    _ensure_runtime_directories(config)
    assert (tmp_path / "models").exists()
```

If cache root differs from `models_directory`, assert that exact resolved cache parent path is also created.

**Step 2: Run test to verify it fails**

Run: `uv run pytest -q tests/test_main_directories.py`
Expected: FAIL if new cache-root assertion is not yet provisioned.

**Step 3: Write minimal implementation**

```python
required_dirs: set[Path] = {
    ...,
    config.models.models_directory.expanduser(),
    model_cache_dir_from_config(config).expanduser(),
}
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest -q tests/test_main_directories.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/opta_lmx/main.py tests/test_main_directories.py
git commit -m "fix: provision effective model cache directory at startup"
```

### Task 8: End-To-End Verification And Rollout

**Skill refs:** `@superpowers:verification-before-completion`

**Files:**
- Modify if needed: `docs/ROADMAP.md` or release notes location used by repo

**Step 1: Run targeted quantize/runtime/model tests**

Run:

```bash
uv run pytest -q \
  tests/test_quantize.py \
  tests/test_quantize_admin.py \
  tests/test_quantize_protocol.py \
  tests/test_child_quantize_worker.py \
  tests/test_child_quantize_supervisor.py \
  tests/test_model_manager.py \
  tests/test_main_directories.py
```

Expected: PASS.

**Step 2: Run static checks**

Run:

```bash
uv run ruff check src/opta_lmx/manager/quantize.py src/opta_lmx/runtime src/opta_lmx/manager/model.py src/opta_lmx/api/admin.py tests
uv run mypy src/opta_lmx/manager/quantize.py src/opta_lmx/runtime src/opta_lmx/manager/model.py
```

Expected: PASS.

**Step 3: Perform manual API smoke checks**

Run:

```bash
# start quantize
curl -X POST http://127.0.0.1:1234/admin/quantize -H "Content-Type: application/json" -d '{"source_model":"mlx-community/Qwen2.5-0.5B-Instruct-4bit"}'
# cancel while running (expect 202 + reason=cancelling)
curl -X POST http://127.0.0.1:1234/admin/quantize/<job_id>/cancel
# inspect status fields
curl http://127.0.0.1:1234/admin/quantize/<job_id>
```

Expected:
- cancel endpoint returns `202` when running.
- job eventually transitions to `cancelled`.
- `failure_code/exit_code/signal/worker_pid` are coherent.

**Step 4: Update docs/changelog**

Document:
- new quantize status `cancelling`
- hard-cancel semantics (`202` while cancel in progress)
- cache directory alignment behavior.

**Step 5: Commit**

```bash
git add docs src tests
git commit -m "feat: hard-cancel running quantize jobs via subprocess isolation"
```

## Rollout Notes

1. Backward-compatibility: keep loading v1 quantize registry; write v2 after first update.
2. API behavior change: clients currently expecting `409 running_cannot_cancel` must accept `202 cancelling`.
3. Operational safety: if child worker crashes via signal, parent API process remains alive and reports structured failure.

Plan complete and saved to `docs/plans/2026-03-02-quantize-hard-cancel-and-storage-hardening-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
