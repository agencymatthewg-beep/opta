#!/usr/bin/env python3
"""Run baseline vs speculative benchmark scenarios through LMX admin APIs.

This script compares two load/benchmark scenarios for the same model:
1) baseline (no extra speculative override unless explicitly provided)
2) speculative (optional draft-model override)

It emits a structured JSON report with benchmark metrics, speculative
counter deltas from /admin/metrics/json, and pass/fail threshold checks.
"""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request

DEFAULT_PROMPT = "Explain speculative decoding in one concise paragraph."


class ApiError(RuntimeError):
    """Raised for non-2xx API responses."""

    def __init__(self, method: str, path: str, status_code: int, body: str) -> None:
        super().__init__(f"{method} {path} failed with HTTP {status_code}: {body}")
        self.method = method
        self.path = path
        self.status_code = status_code
        self.body = body


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _optional_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_headers(admin_key: str | None) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if admin_key:
        # /admin/* requires X-Admin-Key; Authorization is included for compatibility.
        headers["X-Admin-Key"] = admin_key
        headers["Authorization"] = f"Bearer {admin_key}"
    return headers


def _api_json(
    *,
    base_url: str,
    path: str,
    headers: dict[str, str],
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout_sec: float = 120.0,
) -> Any:
    url = base_url.rstrip("/") + path
    req_headers = dict(headers)
    body_bytes: bytes | None = None
    if payload is not None:
        body_bytes = json.dumps(payload).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = request.Request(url, data=body_bytes, method=method, headers=req_headers)
    try:
        with request.urlopen(req, timeout=timeout_sec) as response:
            data = response.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ApiError(method, path, exc.code, body) from exc
    except error.URLError as exc:
        raise RuntimeError(f"{method} {path} request failed: {exc}") from exc

    if not data.strip():
        return {}
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{method} {path} returned non-JSON response: {data}") from exc


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in overlay.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _parse_json_dict(raw: str | None, arg_name: str) -> dict[str, Any]:
    if raw is None:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{arg_name} must be valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise SystemExit(f"{arg_name} must decode to a JSON object")
    return parsed


def _spec_metrics_snapshot(
    *,
    base_url: str,
    headers: dict[str, str],
    timeout_sec: float,
) -> dict[str, Any]:
    try:
        payload = _api_json(
            base_url=base_url,
            path="/admin/metrics/json",
            headers=headers,
            method="GET",
            timeout_sec=timeout_sec,
        )
    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "ignored_tokens": 0,
            "acceptance_ratio": None,
        }

    if not isinstance(payload, dict):
        return {
            "available": False,
            "error": "unexpected metrics payload shape",
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "ignored_tokens": 0,
            "acceptance_ratio": None,
        }

    speculative = payload.get("speculative")
    if not isinstance(speculative, dict):
        speculative = {}

    accepted = _coerce_int(speculative.get("accepted_tokens"), 0)
    rejected = _coerce_int(speculative.get("rejected_tokens"), 0)
    ignored = _coerce_int(speculative.get("ignored_tokens"), 0)
    ratio = _optional_float(speculative.get("acceptance_ratio"))

    if ratio is None:
        denominator = accepted + rejected
        if denominator > 0:
            ratio = accepted / denominator

    return {
        "available": True,
        "accepted_tokens": accepted,
        "rejected_tokens": rejected,
        "ignored_tokens": ignored,
        "acceptance_ratio": ratio,
    }


def _spec_metrics_delta(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    accepted_delta = _coerce_int(after.get("accepted_tokens"), 0) - _coerce_int(
        before.get("accepted_tokens"), 0,
    )
    rejected_delta = _coerce_int(after.get("rejected_tokens"), 0) - _coerce_int(
        before.get("rejected_tokens"), 0,
    )
    ignored_delta = _coerce_int(after.get("ignored_tokens"), 0) - _coerce_int(
        before.get("ignored_tokens"), 0,
    )
    denominator = accepted_delta + rejected_delta
    acceptance_ratio_delta: float | None = None
    if denominator > 0:
        acceptance_ratio_delta = accepted_delta / denominator
    return {
        "accepted_tokens": accepted_delta,
        "rejected_tokens": rejected_delta,
        "ignored_tokens": ignored_delta,
        "acceptance_ratio": acceptance_ratio_delta,
    }


def _unload_model(
    *,
    base_url: str,
    headers: dict[str, str],
    model_id: str,
    timeout_sec: float,
) -> dict[str, Any]:
    try:
        payload = _api_json(
            base_url=base_url,
            path="/admin/models/unload",
            headers=headers,
            method="POST",
            payload={"model_id": model_id},
            timeout_sec=timeout_sec,
        )
    except ApiError as exc:
        if exc.status_code == 404:
            return {"success": True, "status": "not_loaded"}
        raise
    return payload if isinstance(payload, dict) else {"success": True}


def _load_model(
    *,
    base_url: str,
    headers: dict[str, str],
    model_id: str,
    backend: str | None,
    performance_overrides: dict[str, Any],
    timeout_sec: float,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"model_id": model_id}
    if backend:
        payload["backend"] = backend
    if performance_overrides:
        payload["performance_overrides"] = performance_overrides

    loaded = _api_json(
        base_url=base_url,
        path="/admin/models/load",
        headers=headers,
        method="POST",
        payload=payload,
        timeout_sec=timeout_sec,
    )
    if not isinstance(loaded, dict):
        return {"raw": loaded}

    status = str(loaded.get("status", ""))
    if status in {"download_required", "downloading"}:
        raise RuntimeError(
            "Model is not ready locally (download required/in-progress). "
            "Pre-download the model, then rerun the matrix.",
        )
    return loaded


def _get_model_performance(
    *,
    base_url: str,
    headers: dict[str, str],
    model_id: str,
    timeout_sec: float,
) -> dict[str, Any] | None:
    model_path = parse.quote(model_id, safe="")
    try:
        payload = _api_json(
            base_url=base_url,
            path=f"/admin/models/{model_path}/performance",
            headers=headers,
            method="GET",
            timeout_sec=timeout_sec,
        )
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _run_benchmark(
    *,
    base_url: str,
    headers: dict[str, str],
    model_id: str,
    prompt: str,
    runs: int,
    max_tokens: int,
    temperature: float,
    timeout_sec: float,
) -> dict[str, Any]:
    payload = {
        "model_id": model_id,
        "prompt": prompt,
        "runs": runs,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    response = _api_json(
        base_url=base_url,
        path="/admin/benchmark",
        headers=headers,
        method="POST",
        payload=payload,
        timeout_sec=timeout_sec,
    )
    if not isinstance(response, dict):
        raise RuntimeError("Benchmark returned non-object JSON payload")
    return response


def _run_scenario(
    *,
    name: str,
    base_url: str,
    headers: dict[str, str],
    model_id: str,
    backend: str | None,
    performance_overrides: dict[str, Any],
    prompt: str,
    runs: int,
    max_tokens: int,
    temperature: float,
    timeout_sec: float,
) -> dict[str, Any]:
    unload_result = _unload_model(
        base_url=base_url,
        headers=headers,
        model_id=model_id,
        timeout_sec=timeout_sec,
    )
    load_result = _load_model(
        base_url=base_url,
        headers=headers,
        model_id=model_id,
        backend=backend,
        performance_overrides=performance_overrides,
        timeout_sec=timeout_sec,
    )
    model_perf = _get_model_performance(
        base_url=base_url,
        headers=headers,
        model_id=model_id,
        timeout_sec=timeout_sec,
    )

    metrics_before = _spec_metrics_snapshot(
        base_url=base_url,
        headers=headers,
        timeout_sec=timeout_sec,
    )
    benchmark = _run_benchmark(
        base_url=base_url,
        headers=headers,
        model_id=model_id,
        prompt=prompt,
        runs=runs,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout_sec=timeout_sec,
    )
    metrics_after = _spec_metrics_snapshot(
        base_url=base_url,
        headers=headers,
        timeout_sec=timeout_sec,
    )
    metrics_delta = _spec_metrics_delta(metrics_before, metrics_after)

    backend_type = benchmark.get("backend_type")
    if model_perf and model_perf.get("backend_type"):
        backend_type = model_perf.get("backend_type")
    use_batching = bool(model_perf.get("use_batching")) if model_perf else None
    serving_lane = None
    if use_batching is True:
        serving_lane = "throughput"
    elif use_batching is False:
        serving_lane = "interactive"

    return {
        "scenario": name,
        "unload_result": unload_result,
        "load_result": load_result,
        "performance_overrides": performance_overrides,
        "benchmark": benchmark,
        "model_performance": model_perf,
        "metrics_before": metrics_before,
        "metrics_after": metrics_after,
        "metrics_delta": metrics_delta,
        "backend_type": backend_type,
        "serving_lane": serving_lane,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Run a two-scenario admin benchmark matrix (baseline vs speculative) "
            "and emit a structured JSON report."
        ),
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:1234", help="LMX base URL")
    parser.add_argument(
        "--admin-key",
        default=None,
        help="Admin API key (X-Admin-Key). If omitted, requests are unauthenticated.",
    )
    parser.add_argument("--model-id", required=True, help="Loaded model ID to benchmark")
    parser.add_argument(
        "--backend",
        default=None,
        help="Optional backend preference for both scenarios (e.g. mlx, gguf, vllm-mlx).",
    )
    parser.add_argument("--prompt", default=DEFAULT_PROMPT, help="Benchmark prompt")
    parser.add_argument("--runs", type=int, default=3, help="Benchmark runs per scenario")
    parser.add_argument("--max-tokens", type=int, default=128, help="Max tokens per run")
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.2,
        help="Generation temperature for benchmark runs",
    )
    parser.add_argument(
        "--timeout-sec",
        type=float,
        default=180.0,
        help="Per-request timeout in seconds",
    )
    parser.add_argument(
        "--common-overrides-json",
        default=None,
        help="JSON object merged into performance_overrides for both scenarios",
    )
    parser.add_argument(
        "--baseline-overrides-json",
        default=None,
        help="JSON object merged into baseline performance_overrides",
    )
    parser.add_argument(
        "--spec-overrides-json",
        default=None,
        help="JSON object merged into speculative performance_overrides",
    )
    parser.add_argument(
        "--speculative-draft-model",
        default=None,
        help="Draft model ID for speculative scenario convenience override",
    )
    parser.add_argument(
        "--speculative-num-tokens",
        type=int,
        default=5,
        help="num_tokens for speculative scenario convenience override",
    )
    parser.add_argument(
        "--min-tps-ratio",
        type=float,
        default=1.0,
        help=(
            "Required minimum ratio: "
            "speculative.avg_tokens_per_second / baseline.avg_tokens_per_second"
        ),
    )
    parser.add_argument(
        "--max-ttft-ratio",
        type=float,
        default=None,
        help=(
            "Optional upper bound on speculative TTFT ratio "
            "(speculative.avg_ttft_ms / baseline.avg_ttft_ms)."
        ),
    )
    parser.add_argument(
        "--min-acceptance-ratio",
        type=float,
        default=None,
        help="Optional minimum speculative acceptance ratio (0..1).",
    )
    parser.add_argument(
        "--require-spec-active",
        action="store_true",
        help="Require speculative scenario to report speculative.active=true.",
    )
    parser.add_argument(
        "--no-fail-exit",
        action="store_true",
        help="Always exit 0 even when threshold checks fail.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to also write the JSON report",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.runs < 1:
        raise SystemExit("--runs must be >= 1")
    if args.max_tokens < 1:
        raise SystemExit("--max-tokens must be >= 1")
    if args.min_tps_ratio <= 0:
        raise SystemExit("--min-tps-ratio must be > 0")
    if args.min_acceptance_ratio is not None and not (0.0 <= args.min_acceptance_ratio <= 1.0):
        raise SystemExit("--min-acceptance-ratio must be in [0, 1]")

    common_overrides = _parse_json_dict(args.common_overrides_json, "--common-overrides-json")
    baseline_overrides = _deep_merge(
        common_overrides,
        _parse_json_dict(args.baseline_overrides_json, "--baseline-overrides-json"),
    )
    speculative_overrides = _deep_merge(
        common_overrides,
        _parse_json_dict(args.spec_overrides_json, "--spec-overrides-json"),
    )
    if args.speculative_draft_model:
        speculative_overrides = _deep_merge(speculative_overrides, {
            "speculative": {
                "draft_model": args.speculative_draft_model,
                "num_tokens": args.speculative_num_tokens,
            },
        })

    base_url = args.base_url.rstrip("/")
    headers = _build_headers(args.admin_key)

    try:
        baseline = _run_scenario(
            name="baseline",
            base_url=base_url,
            headers=headers,
            model_id=args.model_id,
            backend=args.backend,
            performance_overrides=baseline_overrides,
            prompt=args.prompt,
            runs=args.runs,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            timeout_sec=args.timeout_sec,
        )
        speculative = _run_scenario(
            name="speculative",
            base_url=base_url,
            headers=headers,
            model_id=args.model_id,
            backend=args.backend,
            performance_overrides=speculative_overrides,
            prompt=args.prompt,
            runs=args.runs,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            timeout_sec=args.timeout_sec,
        )
    except Exception as exc:
        error_report = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
            "base_url": base_url,
            "model_id": args.model_id,
            "pass": False,
            "error": str(exc),
        }
        output_json = json.dumps(error_report, indent=2, sort_keys=True)
        sys.stdout.write(output_json + "\n")
        if args.output:
            args.output.write_text(output_json + "\n", encoding="utf-8")
        return 1

    baseline_bench = baseline.get("benchmark", {})
    speculative_bench = speculative.get("benchmark", {})
    baseline_tps = _coerce_float(baseline_bench.get("avg_tokens_per_second"), 0.0)
    speculative_tps = _coerce_float(speculative_bench.get("avg_tokens_per_second"), 0.0)
    baseline_ttft = _coerce_float(baseline_bench.get("avg_time_to_first_token_ms"), 0.0)
    speculative_ttft = _coerce_float(speculative_bench.get("avg_time_to_first_token_ms"), 0.0)

    tps_ratio: float | None = None
    if baseline_tps > 0:
        tps_ratio = speculative_tps / baseline_tps

    ttft_ratio: float | None = None
    if baseline_ttft > 0:
        ttft_ratio = speculative_ttft / baseline_ttft

    speculative_summary = speculative_bench.get("speculative")
    if not isinstance(speculative_summary, dict):
        speculative_summary = {}
    acceptance_ratio = _optional_float(speculative_summary.get("acceptance_ratio"))
    if acceptance_ratio is None:
        acceptance_ratio = _optional_float(
            speculative.get("metrics_delta", {}).get("acceptance_ratio"),
        )
    speculative_active = bool(speculative_summary.get("active"))

    checks: list[dict[str, Any]] = []
    checks.append({
        "name": "baseline_tps_available",
        "passed": baseline_tps > 0,
        "actual": baseline_tps,
        "required": "> 0",
    })
    checks.append({
        "name": "min_tps_ratio",
        "passed": tps_ratio is not None and tps_ratio >= args.min_tps_ratio,
        "actual": tps_ratio,
        "required": f">= {args.min_tps_ratio}",
    })
    if args.max_ttft_ratio is not None:
        checks.append({
            "name": "max_ttft_ratio",
            "passed": ttft_ratio is not None and ttft_ratio <= args.max_ttft_ratio,
            "actual": ttft_ratio,
            "required": f"<= {args.max_ttft_ratio}",
        })
    if args.min_acceptance_ratio is not None:
        checks.append({
            "name": "min_acceptance_ratio",
            "passed": (
                acceptance_ratio is not None
                and acceptance_ratio >= args.min_acceptance_ratio
            ),
            "actual": acceptance_ratio,
            "required": f">= {args.min_acceptance_ratio}",
        })
    if args.require_spec_active:
        checks.append({
            "name": "speculative_active",
            "passed": speculative_active,
            "actual": speculative_active,
            "required": True,
        })

    overall_pass = all(bool(check["passed"]) for check in checks)

    report = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        "base_url": base_url,
        "model_id": args.model_id,
        "backend": args.backend,
        "prompt": args.prompt,
        "runs": args.runs,
        "max_tokens": args.max_tokens,
        "thresholds": {
            "min_tps_ratio": args.min_tps_ratio,
            "max_ttft_ratio": args.max_ttft_ratio,
            "min_acceptance_ratio": args.min_acceptance_ratio,
            "require_spec_active": args.require_spec_active,
        },
        "scenarios": {
            "baseline": baseline,
            "speculative": speculative,
        },
        "comparison": {
            "baseline_avg_tokens_per_second": baseline_tps,
            "speculative_avg_tokens_per_second": speculative_tps,
            "tps_ratio_spec_over_base": tps_ratio,
            "baseline_avg_ttft_ms": baseline_ttft,
            "speculative_avg_ttft_ms": speculative_ttft,
            "ttft_ratio_spec_over_base": ttft_ratio,
            "speculative_acceptance_ratio": acceptance_ratio,
            "speculative_active": speculative_active,
        },
        "checks": checks,
        "pass": overall_pass,
    }

    output_json = json.dumps(report, indent=2, sort_keys=True)
    sys.stdout.write(output_json + "\n")
    if args.output:
        args.output.write_text(output_json + "\n", encoding="utf-8")

    if overall_pass or args.no_fail_exit:
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
