"""Skill execution primitives (prompt rendering + entrypoint invocation)."""

from __future__ import annotations

import asyncio
import importlib
import inspect
import sys
import threading
import time
from collections.abc import Awaitable, Callable, Coroutine, Iterator, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from contextlib import contextmanager
from pathlib import Path
from typing import Any, cast

from pydantic import BaseModel, ConfigDict, Field

from opta_lmx.skills.manifest import (
    PermissionTag,
    SkillKind,
    SkillManifest,
    validate_skill_arguments,
)
from opta_lmx.skills.policy import PolicyDecision, SkillsPolicy


class SkillExecutionResult(BaseModel):
    """Structured execution result for skills runtime and MCP bridge."""

    model_config = ConfigDict(extra="forbid")

    skill_name: str
    kind: str
    ok: bool
    output: Any | None = None
    error: str | None = None
    duration_ms: int = Field(ge=0)

    timed_out: bool = False
    denied: bool = False
    requires_approval: bool = False


class SkillExecutor:
    """Execute skills using either template rendering or Python entrypoints."""

    def __init__(
        self,
        *,
        policy: SkillsPolicy | None = None,
        default_timeout_sec: float = 10.0,
        max_concurrent_calls: int = 8,
        module_search_paths: Sequence[Path] | None = None,
        sandbox_profile: str = "trusted",
        sandbox_allowed_entrypoint_modules: Sequence[str] | None = None,
        otel_enabled: bool = False,
        otel_service_name: str = "opta-lmx",
    ) -> None:
        self._policy = policy or SkillsPolicy()
        self._default_timeout_sec = default_timeout_sec
        self._semaphore = threading.BoundedSemaphore(value=max(1, max_concurrent_calls))
        self._module_search_paths = tuple(
            Path(path).expanduser() for path in (module_search_paths or [])
        )
        profile = sandbox_profile.strip().lower()
        if profile not in {"trusted", "restricted", "strict"}:
            raise ValueError("sandbox_profile must be one of trusted|restricted|strict")
        self._sandbox_profile = profile
        self._sandbox_allowed_entrypoint_modules = tuple(
            module.strip()
            for module in (sandbox_allowed_entrypoint_modules or [])
            if isinstance(module, str) and module.strip()
        )
        self._otel_tracer: Any | None = None
        if otel_enabled:
            try:
                from opentelemetry import trace  # type: ignore[import-not-found]

                self._otel_tracer = trace.get_tracer(f"{otel_service_name}.skills")
            except Exception:
                self._otel_tracer = None

    def execute(
        self,
        manifest: SkillManifest,
        *,
        arguments: Mapping[str, object] | None = None,
        approved: bool = False,
        timeout_sec: float | None = None,
    ) -> SkillExecutionResult:
        """Execute a skill manifest and return structured status."""
        started = time.perf_counter()
        call_arguments = dict(arguments or {})
        with self._skill_span(manifest):
            decision = self._policy.evaluate(manifest, approved=approved)
            if not decision.allowed:
                return self._policy_blocked_result(manifest, decision, started)
            sandbox_reason = self._sandbox_block_reason(manifest)
            if sandbox_reason is not None:
                return self._result(
                    manifest=manifest,
                    started=started,
                    ok=False,
                    error=sandbox_reason,
                    denied=True,
                    requires_approval=decision.requires_approval,
                )

            validation_error = validate_skill_arguments(call_arguments, manifest.input_schema)
            if validation_error is not None:
                return self._result(
                    manifest=manifest,
                    started=started,
                    ok=False,
                    error=validation_error,
                    requires_approval=decision.requires_approval,
                )

            effective_timeout = timeout_sec if timeout_sec is not None else manifest.timeout_sec
            if effective_timeout <= 0:
                effective_timeout = self._default_timeout_sec

            with self._semaphore:
                try:
                    output: object
                    if manifest.kind == SkillKind.PROMPT:
                        output = self._render_prompt(manifest, call_arguments)
                    else:
                        output = self._run_entrypoint(
                            manifest,
                            call_arguments,
                            effective_timeout,
                        )
                except TimeoutError as exc:
                    return self._result(
                        manifest=manifest,
                        started=started,
                        ok=False,
                        error=str(exc),
                        timed_out=True,
                        requires_approval=decision.requires_approval,
                    )
                except Exception as exc:
                    return self._result(
                        manifest=manifest,
                        started=started,
                        ok=False,
                        error=str(exc),
                        requires_approval=decision.requires_approval,
                    )

            return self._result(
                manifest=manifest,
                started=started,
                ok=True,
                output=output,
                requires_approval=decision.requires_approval,
            )

    @contextmanager
    def _skill_span(self, manifest: SkillManifest) -> Iterator[None]:
        if self._otel_tracer is None:
            yield
            return

        with self._otel_tracer.start_as_current_span(f"skills.{manifest.name}") as span:
            span.set_attribute("skills.name", manifest.name)
            span.set_attribute("skills.kind", manifest.kind.value)
            yield

    def _policy_blocked_result(
        self,
        manifest: SkillManifest,
        decision: PolicyDecision,
        started: float,
    ) -> SkillExecutionResult:
        return self._result(
            manifest=manifest,
            started=started,
            ok=False,
            error=decision.reason or "blocked by policy",
            denied=True,
            requires_approval=decision.requires_approval,
        )

    def _sandbox_block_reason(self, manifest: SkillManifest) -> str | None:
        if self._sandbox_profile == "trusted":
            return None

        permissions = set(manifest.permission_tags)
        if PermissionTag.SHELL_EXEC in permissions:
            return "skill blocked by sandbox profile: shell-exec is disallowed"

        if self._sandbox_profile == "restricted":
            if PermissionTag.NETWORK_ACCESS in permissions:
                return "skill blocked by sandbox profile: network-access is disallowed"
            if manifest.kind == SkillKind.ENTRYPOINT and self._sandbox_allowed_entrypoint_modules:
                entrypoint = manifest.entrypoint or ""
                module_name = entrypoint.split(":", maxsplit=1)[0]
                if module_name and not any(
                    module_name == allowed or module_name.startswith(f"{allowed}.")
                    for allowed in self._sandbox_allowed_entrypoint_modules
                ):
                    return "skill blocked by sandbox profile: entrypoint module is not allowlisted"
            return None

        if manifest.kind == SkillKind.ENTRYPOINT:
            return "skill blocked by sandbox profile: entrypoint skills are disabled"

        forbidden = {
            PermissionTag.NETWORK_ACCESS,
            PermissionTag.WRITE_FILES,
            PermissionTag.SHELL_EXEC,
        }
        if permissions & forbidden:
            return "skill blocked by sandbox profile: permission tags exceed strict profile"
        return None

    def _render_prompt(self, manifest: SkillManifest, arguments: Mapping[str, object]) -> str:
        template = manifest.prompt_template
        if template is None:
            raise ValueError("prompt_template is required for prompt kind")

        try:
            rendered = template.format_map(arguments)
        except KeyError as exc:
            missing = exc.args[0]
            raise ValueError(f"missing prompt variable: {missing}") from exc

        return rendered

    def _run_entrypoint(
        self,
        manifest: SkillManifest,
        arguments: Mapping[str, object],
        timeout_sec: float,
    ) -> object:
        if manifest.entrypoint is None:
            raise ValueError("entrypoint is required for entrypoint kind")

        module_name, function_name = manifest.entrypoint.split(":", maxsplit=1)

        with self._temporary_module_paths():
            module = importlib.import_module(module_name)

        function_candidate = getattr(module, function_name, None)
        if function_candidate is None or not callable(function_candidate):
            raise ValueError(f"entrypoint function not found: {manifest.entrypoint}")

        function = cast(Callable[..., object], function_candidate)
        return self._call_with_timeout(
            function=function,
            arguments=arguments,
            timeout_sec=timeout_sec,
        )

    @contextmanager
    def _temporary_module_paths(self) -> Iterator[None]:
        if not self._module_search_paths:
            yield
            return

        original = list(sys.path)
        for path in reversed(self._module_search_paths):
            path_str = str(path)
            if path_str not in sys.path:
                sys.path.insert(0, path_str)

        try:
            yield
        finally:
            sys.path[:] = original

    def _call_with_timeout(
        self,
        *,
        function: Callable[..., object],
        arguments: Mapping[str, object],
        timeout_sec: float,
    ) -> object:
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(self._invoke_callable, function, arguments)

        try:
            return future.result(timeout=timeout_sec)
        except FuturesTimeoutError as exc:
            future.cancel()
            raise TimeoutError(f"skill execution exceeded timeout ({timeout_sec:.3f}s)") from exc
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

    @staticmethod
    def _invoke_callable(
        function: Callable[..., object],
        arguments: Mapping[str, object],
    ) -> object:
        if inspect.iscoroutinefunction(function):
            coroutine_result = cast(Coroutine[Any, Any, object], function(**arguments))
            return asyncio.run(coroutine_result)

        result = function(**arguments)
        if inspect.isawaitable(result):
            return asyncio.run(_await_result(cast(Awaitable[object], result)))

        return result

    @staticmethod
    def _result(
        *,
        manifest: SkillManifest,
        started: float,
        ok: bool,
        output: object | None = None,
        error: str | None = None,
        timed_out: bool = False,
        denied: bool = False,
        requires_approval: bool = False,
    ) -> SkillExecutionResult:
        duration_ms = int((time.perf_counter() - started) * 1000)
        return SkillExecutionResult(
            skill_name=manifest.name,
            kind=manifest.kind.value,
            ok=ok,
            output=output,
            error=error,
            duration_ms=duration_ms,
            timed_out=timed_out,
            denied=denied,
            requires_approval=requires_approval,
        )


async def _await_result(awaitable: Awaitable[object]) -> object:
    """Normalize generic awaitables into a coroutine for asyncio.run()."""
    return await awaitable
