# tests/test_benchmark_report.py
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


def _make_fixture_result(model_id: str, tmp_path: Path) -> Path:
    """Write a fixture benchmark JSON for the report script to consume."""
    result = {
        "model_id": model_id,
        "backend": "mlx-lm",
        "timestamp": "2026-02-26T00:00:00+00:00",
        "status": "ok",
        "hardware": "M3 Ultra 512GB",
        "lmx_version": "0.1.0",
        "prompt_preview": "Write a detailed explanation of how transformer...",
        "stats": {
            "ttft_p50_sec": 1.71, "ttft_p95_sec": 1.84, "ttft_mean_sec": 1.74,
            "toks_per_sec_p50": 23.4, "toks_per_sec_p95": 22.9, "toks_per_sec_mean": 23.1,
            "prompt_tokens": 30, "output_tokens": 200, "runs_completed": 5,
            "warmup_runs_discarded": 1,
            "output_text": "Transformers are a type of neural network architecture...",
            "output_token_count": 200, "completed_naturally": True,
            "repetition_ratio": 0.02, "coherence_flag": "ok",
            "tool_call": None, "skills": [],
        },
    }
    slugged = model_id.replace("/", "_")
    path = tmp_path / f"{slugged}_2026-02-26T00-00-00.json"
    path.write_text(json.dumps(result), encoding="utf-8")
    return path


def test_report_generates_valid_html(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("mlx-community/Qwen2.5-72B-4bit", results_dir)

    output_path = tmp_path / "report.html"
    result = subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
        cwd="/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX",
    )
    assert result.returncode == 0, result.stderr
    assert output_path.exists()
    content = output_path.read_text(encoding="utf-8")
    assert "<html" in content
    assert "Qwen2.5" in content
    assert "23.1" in content  # tok/s mean


def test_report_shows_reference_data(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("mlx-community/Qwen2.5-72B-4bit", results_dir)

    ref_path = tmp_path / "published.yaml"
    ref_path.write_text("""
mlx-community/Qwen2.5-72B-4bit:
  lm_studio:
    toks_per_sec: 18.2
    ttft_sec: 2.1
    source: "community-benchmark"
    hardware: "M3 Ultra 512GB"
  ollama:
    toks_per_sec: 16.4
    ttft_sec: 2.3
    source: "ollama-benchmarks"
    hardware: "M3 Ultra 512GB"
""", encoding="utf-8")

    output_path = tmp_path / "report.html"
    subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--reference", str(ref_path),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
        cwd="/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX",
    )
    content = output_path.read_text(encoding="utf-8")
    assert "18.2" in content  # LM Studio reference number
    assert "16.4" in content  # Ollama reference number


def test_report_handles_missing_reference_gracefully(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("unknown/model", results_dir)

    output_path = tmp_path / "report.html"
    result = subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
        cwd="/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX",
    )
    assert result.returncode == 0
    content = output_path.read_text(encoding="utf-8")
    assert "—" in content  # dash shown for missing reference
