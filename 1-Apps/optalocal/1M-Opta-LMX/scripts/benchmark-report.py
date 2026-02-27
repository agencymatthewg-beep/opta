#!/usr/bin/env python3
"""Generate an HTML benchmark comparison report from stored LMX results.

Usage:
    # Pull directly from a running LMX server (recommended):
    python scripts/benchmark-report.py --api http://192.168.188.11:1234 --api-key <key>

    # Or from local JSON files (supports both BenchmarkResult and legacy formats):
    python scripts/benchmark-report.py [--results-dir DIR] [--reference FILE]
                                       [--output FILE] [--no-open]

    # Scan project benchmarks/ directory:
    python scripts/benchmark-report.py --results-dir benchmarks/

Outputs an HTML report with the Opta obsidian glass aesthetic including:
  - Summary table: TTFT, tok/s, concurrency, quality, tool/skill capability
  - Per-model detail cards with percentile breakdowns
  - Competitor comparison deltas (vs LM Studio, vs Ollama)
  - Output quality coherence flags
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import yaml

    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False


_DEFAULT_RESULTS_DIR = Path.home() / ".opta-lmx" / "benchmarks"
_PROJECT_BENCHMARKS_DIR = Path(__file__).parent.parent / "benchmarks"
_DEFAULT_REFERENCE = Path(__file__).parent.parent / "benchmarks" / "reference" / "published.yaml"
_COHERENCE_ICONS = {
    "ok": "&#10003;",
    "truncated": "&#9888;",
    "repetitive": "&#9888;",
    "garbled": "&#10007;",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def _load_results_from_api(base_url: str, api_key: str) -> list[dict[str, Any]]:
    """Pull benchmark results directly from a running LMX server."""
    url = base_url.rstrip("/") + "/admin/benchmark/results"
    req = urllib.request.Request(url, headers={"X-Admin-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            results: list[dict[str, Any]] = json.loads(resp.read().decode())
            print(f"  Fetched {len(results)} result(s) from {url}")
            return results
    except Exception as exc:
        print(f"Error: could not fetch from {url}: {exc}", file=sys.stderr)
        sys.exit(1)


def _normalize_legacy_result(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Convert legacy benchmark JSON (minimax-style) to the BenchmarkResult shape.

    Legacy format has top-level ``results`` dict with run keys and a ``summary`` dict.
    The normalized format has a ``stats`` dict matching BenchmarkRunStats fields.
    Returns None if the data is already in the modern format or unrecognizable.
    """
    if "stats" in raw:
        return raw  # Already modern format

    summary = raw.get("summary")
    run_results = raw.get("results")
    if not summary or not run_results:
        return None  # Unrecognizable

    # Extract warm runs (keys without 'cold')
    warm_runs = {k: v for k, v in run_results.items() if "cold" not in k}
    all_tps = [v["toks_per_sec"] for v in warm_runs.values() if v.get("toks_per_sec")]
    all_ttft = [v["ttft_ms"] / 1000 for v in warm_runs.values() if v.get("ttft_ms")]

    tps_mean = summary.get("warm_avg_toks_per_sec", 0.0)
    ttft_mean = summary.get("warm_avg_ttft_ms", 0.0) / 1000

    sorted_tps = sorted(all_tps) if all_tps else [0.0]
    sorted_ttft = sorted(all_ttft) if all_ttft else [0.0]
    n = len(sorted_tps)

    return {
        "model_id": raw.get("model_id", "unknown"),
        "backend": raw.get("backend", "unknown"),
        "timestamp": raw.get("timestamp", ""),
        "status": raw.get("status", "ok"),
        "hardware": raw.get("hardware", ""),
        "lmx_version": raw.get("lmx_version", ""),
        "prompt_preview": raw.get("prompt", "")[:100],
        "stats": {
            "ttft_p50_sec": sorted_ttft[n // 2] if n else 0.0,
            "ttft_p95_sec": sorted_ttft[min(int(n * 0.95), n - 1)] if n else 0.0,
            "ttft_mean_sec": ttft_mean,
            "toks_per_sec_p50": sorted_tps[n // 2] if n else 0.0,
            "toks_per_sec_p95": sorted_tps[min(int(n * 0.95), n - 1)] if n else 0.0,
            "toks_per_sec_mean": tps_mean,
            "prompt_tokens": 0,
            "output_tokens": 0,
            "runs_completed": len(warm_runs),
            "warmup_runs_discarded": len(run_results) - len(warm_runs),
            "output_text": "",
            "output_token_count": 0,
            "completed_naturally": True,
            "repetition_ratio": 0.0,
            "coherence_flag": "ok",
            "tool_call": None,
            "skills": [],
        },
    }


def _load_results(directory: Path) -> list[dict[str, Any]]:
    """Load benchmark results from JSON files, normalizing legacy formats."""
    results: list[dict[str, Any]] = []
    if not directory.exists():
        return results
    for path in sorted(directory.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            normalized = _normalize_legacy_result(raw)
            if normalized is not None:
                results.append(normalized)
                print(f"  Loaded {path.name}")
            else:
                print(f"  Skipped {path.name} (unrecognized format)", file=sys.stderr)
        except Exception as exc:
            print(f"  Warning: could not load {path.name}: {exc}", file=sys.stderr)
    return results


def _load_reference(path: Path) -> dict[str, Any]:
    """Load reference/competitor performance data from YAML."""
    if not path.exists():
        return {}
    if not _YAML_AVAILABLE:
        print("Warning: pyyaml not installed, reference data unavailable", file=sys.stderr)
        return {}
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        print(f"Warning: could not load reference data: {exc}", file=sys.stderr)
        return {}


# ---------------------------------------------------------------------------
# Computation helpers
# ---------------------------------------------------------------------------


def _pct_diff(lmx: float, competitor: float) -> str:
    """Compute percentage difference; positive means LMX is faster/better."""
    if competitor == 0:
        return "&mdash;"
    diff = (lmx - competitor) / competitor * 100
    sign = "+" if diff >= 0 else ""
    return f"{sign}{diff:.0f}%"


def _pct_diff_ttft(lmx: float, competitor: float) -> str:
    """For TTFT, lower is better: negative % means LMX is faster."""
    if competitor == 0:
        return "&mdash;"
    diff = (lmx - competitor) / competitor * 100
    sign = "+" if diff >= 0 else ""
    return f"{sign}{diff:.0f}%"


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Safely convert to float, handling None and non-numeric values."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

_CSS = """\
  @import url(
    'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap'
  );
  * { box-sizing: border-box; }
  body {
    background: #09090b; color: #f4f4f5;
    font-family: 'Sora', system-ui, -apple-system, sans-serif;
    margin: 0; padding: 32px 40px;
  }
  h1 {
    color: #a78bfa; margin-bottom: 4px;
    font-weight: 700; letter-spacing: -0.02em;
  }
  .meta { color: #71717a; font-size: 13px; margin-bottom: 28px; }
  .meta span { color: #a1a1aa; }
  .glass {
    background: rgba(24, 24, 27, 0.65);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    border: 1px solid rgba(63, 63, 70, 0.4);
    border-radius: 12px;
  }
  .summary-table {
    width: 100%; border-collapse: collapse; margin-bottom: 36px;
  }
  .summary-table thead th {
    background: rgba(39, 39, 42, 0.8); padding: 10px 14px;
    text-align: left; font-size: 11px; color: #a1a1aa;
    text-transform: uppercase; letter-spacing: 0.06em;
    font-weight: 600;
  }
  .summary-table thead th:first-child { border-radius: 8px 0 0 0; }
  .summary-table thead th:last-child { border-radius: 0 8px 0 0; }
  .summary-table td {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
    font-size: 13px;
  }
  .summary-table tr:hover td { background: rgba(24, 24, 27, 0.5); }
  .summary-table td strong { color: #e4e4e7; }
  .delta-pos { color: #4ade80; font-weight: 600; }
  .delta-neg { color: #f87171; font-weight: 600; }
  .delta-neutral { color: #a1a1aa; }
  .card { padding: 24px; margin-bottom: 20px; }
  .card-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 18px; flex-wrap: wrap;
  }
  .model-id { font-weight: 600; font-size: 15px; color: #e4e4e7; }
  .badge {
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: white; padding: 3px 10px; border-radius: 6px;
    font-size: 11px; font-weight: 500;
  }
  .badge-status { font-size: 10px; padding: 2px 8px; border-radius: 4px; }
  .badge-ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
  .badge-warn { background: rgba(250, 204, 21, 0.15); color: #facc15; }
  .ts { color: #52525b; font-size: 12px; margin-left: auto; }
  .section { margin-bottom: 16px; }
  .section-title {
    color: #a1a1aa; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 8px; font-weight: 600;
  }
  .inner-table { font-size: 13px; border-collapse: collapse; }
  .inner-table td { padding: 4px 14px 4px 0; }
  .inner-table td:first-child { color: #71717a; min-width: 80px; }
  .deltas {
    font-size: 13px; color: #a1a1aa; margin-top: 10px;
    padding: 8px 12px; background: rgba(9, 9, 11, 0.5);
    border-radius: 8px;
  }
  .capability-list {
    margin: 0; padding-left: 18px; font-size: 13px; line-height: 2;
  }
  .output-section summary {
    cursor: pointer; color: #71717a; font-size: 13px;
    margin-top: 10px; padding: 6px 0;
  }
  .output-section summary:hover { color: #a1a1aa; }
  .output-text {
    background: #09090b; padding: 14px; border-radius: 8px;
    font-size: 12px; white-space: pre-wrap; color: #d4d4d8;
    max-height: 300px; overflow-y: auto; border: 1px solid #27272a;
  }
  .conc-bar {
    display: inline-block; height: 6px; border-radius: 3px;
    background: linear-gradient(90deg, #3b82f6, #a78bfa);
    min-width: 4px; vertical-align: middle; margin-right: 6px;
  }
"""


def _delta_span(value_str: str) -> str:
    """Wrap a delta string in a colored span based on sign."""
    if value_str.startswith("+"):
        return f'<span class="delta-pos">{value_str}</span>'
    elif value_str.startswith("-"):
        return f'<span class="delta-neg">{value_str}</span>'
    return f'<span class="delta-neutral">{value_str}</span>'


def _render_report(results: list[dict[str, Any]], reference: dict[str, Any]) -> str:
    """Render the full HTML benchmark report."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    model_ids: list[str] = list(dict.fromkeys(r["model_id"] for r in results))

    # ---- Summary table rows ----
    summary_rows = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        latest = model_results[-1]
        s = latest.get("stats", {})
        ref = reference.get(model_id, {})
        lms = ref.get("lm_studio", {})
        oll = ref.get("ollama", {})
        tps = _safe_float(s.get("toks_per_sec_mean"))
        ttft = _safe_float(s.get("ttft_mean_sec"))
        runs = s.get("runs_completed", 0)

        vs_lms_tps = (
            _delta_span(_pct_diff(tps, _safe_float(lms.get("toks_per_sec"))))
            if lms else "&mdash;"
        )
        vs_oll_tps = (
            _delta_span(_pct_diff(tps, _safe_float(oll.get("toks_per_sec"))))
            if oll else "&mdash;"
        )

        has_tools = s.get("tool_call") and s["tool_call"].get("call_produced")
        tools = "&#10003;" if has_tools else "&mdash;"
        skills_ok = sum(
            1 for sk in s.get("skills", [])
            if sk.get("skill_invoked_successfully")
        )
        skills_total = len(s.get("skills", []))
        skills = f"{skills_ok}/{skills_total}" if skills_total > 0 else "&mdash;"

        coherence = s.get("coherence_flag", "ok")
        quality_icon = _COHERENCE_ICONS.get(coherence, "?")
        quality_cls = "badge-ok" if coherence == "ok" else "badge-warn"

        short_name = model_id.split("/")[-1]

        # Concurrency: number of benchmark runs as a proxy bar
        conc_width = min(runs * 10, 80)

        summary_rows += f"""
        <tr>
          <td title="{html_mod.escape(model_id)}">{html_mod.escape(short_name)}</td>
          <td>{html_mod.escape(latest.get('backend', ''))}</td>
          <td><strong>{tps:.1f}</strong></td>
          <td>{ttft * 1000:.0f}ms</td>
          <td>{vs_lms_tps}</td>
          <td>{vs_oll_tps}</td>
          <td><span class="conc-bar" style="width:{conc_width}px"></span>{runs}</td>
          <td>{tools}</td>
          <td>{skills}</td>
          <td><span class="badge-status {quality_cls}">{quality_icon} {coherence}</span></td>
        </tr>"""

    # ---- Per-model detail cards ----
    cards = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        for result in model_results:
            s = result.get("stats", {})
            ref = reference.get(model_id, {})
            lms = ref.get("lm_studio", {})
            oll = ref.get("ollama", {})
            tps = _safe_float(s.get("toks_per_sec_mean"))
            ttft = _safe_float(s.get("ttft_mean_sec"))

            hyp_lms = (
                f"~{lms['toks_per_sec']} tok/s, TTFT ~{lms['ttft_sec']}s"
                if lms and lms.get("toks_per_sec")
                else "&mdash;"
            )
            hyp_oll = (
                f"~{oll['toks_per_sec']} tok/s, TTFT ~{oll['ttft_sec']}s"
                if oll and oll.get("toks_per_sec")
                else "&mdash;"
            )

            vs_lms_tps = (
                _delta_span(_pct_diff(tps, _safe_float(lms.get("toks_per_sec"))))
                if lms else "&mdash;"
            )
            vs_lms_ttft = (
                _delta_span(_pct_diff_ttft(ttft, _safe_float(lms.get("ttft_sec"))))
                if lms else "&mdash;"
            )
            vs_oll_tps = (
                _delta_span(_pct_diff(tps, _safe_float(oll.get("toks_per_sec"))))
                if oll else "&mdash;"
            )
            vs_oll_ttft = (
                _delta_span(_pct_diff_ttft(ttft, _safe_float(oll.get("ttft_sec"))))
                if oll else "&mdash;"
            )

            # Percentiles
            tps_p50 = _safe_float(s.get("toks_per_sec_p50"))
            tps_p95 = _safe_float(s.get("toks_per_sec_p95"))
            ttft_p50 = _safe_float(s.get("ttft_p50_sec"))
            ttft_p95 = _safe_float(s.get("ttft_p95_sec"))
            runs_completed = s.get("runs_completed", 0)
            output_tokens = s.get("output_tokens", 0)

            # Tool calling
            tc = s.get("tool_call")
            tool_row = ""
            if tc:
                tc_ok = tc.get("call_produced") and tc.get("tool_name_correct")
                tc_icon = "&#10003;" if tc_ok else "&#10007;"
                tc_latency = _safe_float(tc.get("latency_sec"))
                tool_row = f"<li>Tool calling: {tc_icon} {tc_latency:.2f}s</li>"

            # Skills
            skills_rows = ""
            for sk in s.get("skills", []):
                sk_ok = sk.get("skill_invoked_successfully")
                sk_icon = "&#10003;" if sk_ok else "&#10007;"
                err = f" &mdash; {html_mod.escape(str(sk['error']))}" if sk.get("error") else ""
                sk_name = html_mod.escape(str(sk.get('skill_name', '')))
                skills_rows += (
                    f"<li>Skill ({sk_name}): {sk_icon}{err}</li>"
                )

            coherence = s.get("coherence_flag", "ok")
            coherence_icon = _COHERENCE_ICONS.get(coherence, "?")
            completed_str = "completed naturally" if s.get("completed_naturally") else "truncated"
            status = result.get("status", "ok")
            status_cls = "badge-ok" if status == "ok" else "badge-warn"

            output_preview = html_mod.escape(s.get("output_text", "")[:2000])
            ts_display = str(result.get("timestamp", ""))[:19]
            hw = html_mod.escape(str(result.get("hardware", "")))

            cards += f"""
      <div class="card glass">
        <div class="card-header">
          <span class="model-id">{html_mod.escape(model_id)}</span>
          <span class="badge">{html_mod.escape(result.get('backend', ''))}</span>
          <span class="badge-status {status_cls}">{status}</span>
          <span class="ts">{ts_display} &nbsp;|&nbsp; {hw}</span>
        </div>

        <div class="section">
          <div class="section-title">Competitor Baselines</div>
          <table class="inner-table">
            <tr><td>LM Studio</td><td>{hyp_lms}</td></tr>
            <tr><td>Ollama</td><td>{hyp_oll}</td></tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Performance
            ({runs_completed} runs, {output_tokens} tokens, temp=0)</div>
          <table class="inner-table">
            <tr><td>tok/s</td><td>p50: {tps_p50:.1f} | p95: {tps_p95:.1f} |
              mean: <strong>{tps:.1f}</strong></td></tr>
            <tr><td>TTFT</td><td>p50: {ttft_p50*1000:.0f}ms |
              p95: {ttft_p95*1000:.0f}ms |
              mean: <strong>{ttft*1000:.0f}ms</strong></td></tr>
          </table>
          <div class="deltas">
            vs LM Studio: {vs_lms_tps} tok/s / {vs_lms_ttft} TTFT &nbsp;|&nbsp;
            vs Ollama: {vs_oll_tps} tok/s / {vs_oll_ttft} TTFT
          </div>
        </div>

        <div class="section">
          <div class="section-title">Capability Matrix</div>
          <ul class="capability-list">
            <li>Text generation: {coherence_icon} {coherence} ({completed_str})</li>
            {tool_row}
            {skills_rows}
          </ul>
        </div>

        {"<details class='output-section'>"
         "<summary>Output preview</summary>"
         "<pre class='output-text'>"
         + output_preview +
         "</pre></details>" if output_preview else ""}
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Opta-LMX Benchmark Report</title>
<style>
{_CSS}
</style>
</head>
<body>
<h1>Opta-LMX Benchmark Report</h1>
<div class="meta">Generated <span>{now}</span>
  | <span>{len(model_ids)}</span> model(s)
  | <span>{len(results)}</span> result(s)</div>

<table class="summary-table">
  <thead>
    <tr>
      <th>Model</th><th>Backend</th><th>tok/s</th><th>TTFT</th>
      <th>vs LM Studio</th><th>vs Ollama</th><th>Runs</th>
      <th>Tools</th><th>Skills</th><th>Quality</th>
    </tr>
  </thead>
  <tbody>{summary_rows}</tbody>
</table>

{cards}
</body>
</html>"""


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate an HTML benchmark report for Opta-LMX",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
examples:
  # From running LMX server (Mono512):
  python scripts/benchmark-report.py --api http://192.168.188.11:1234 --api-key "$LMX_ADMIN_KEY"

  # From project benchmarks/ directory:
  python scripts/benchmark-report.py --results-dir benchmarks/

  # From default ~/.opta-lmx/benchmarks/ directory:
  python scripts/benchmark-report.py
""",
    )
    parser.add_argument(
        "--api",
        metavar="URL",
        help="Pull results from a running LMX server (e.g. http://192.168.188.11:1234)",
    )
    parser.add_argument(
        "--api-key",
        metavar="KEY",
        default=os.environ.get("LMX_ADMIN_KEY", ""),
        help="Admin key for the LMX server (or set LMX_ADMIN_KEY env var)",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=_DEFAULT_RESULTS_DIR,
        help=f"Directory containing benchmark JSON files (default: {_DEFAULT_RESULTS_DIR})",
    )
    parser.add_argument(
        "--reference",
        type=Path,
        default=_DEFAULT_REFERENCE,
        help=f"Reference competitor YAML file (default: {_DEFAULT_REFERENCE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/opta-lmx-benchmark.html"),
        help="Output HTML file path",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Don't auto-open in browser",
    )
    args = parser.parse_args()

    # Load results from API or files
    if args.api:
        if not args.api_key:
            print("Error: --api requires --api-key or LMX_ADMIN_KEY env var", file=sys.stderr)
            sys.exit(1)
        print(f"Fetching results from {args.api}...")
        results = _load_results_from_api(args.api, args.api_key)
    else:
        print(f"Loading results from {args.results_dir}...")
        results = _load_results(args.results_dir)

        # Also scan project benchmarks/ if using default dir and it differs
        if args.results_dir == _DEFAULT_RESULTS_DIR and _PROJECT_BENCHMARKS_DIR.exists():
            proj_results = _load_results(_PROJECT_BENCHMARKS_DIR)
            # Deduplicate by (model_id, timestamp)
            seen = {(r["model_id"], r.get("timestamp", "")) for r in results}
            for pr in proj_results:
                key = (pr["model_id"], pr.get("timestamp", ""))
                if key not in seen:
                    results.append(pr)
                    seen.add(key)

    if not results:
        print("No benchmark results found.")
        sys.exit(0)

    print(f"Loading reference data from {args.reference}...")
    reference = _load_reference(args.reference)

    print(f"Generating report for {len(results)} result(s)...")
    report_html = _render_report(results, reference)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report_html, encoding="utf-8")
    print(f"Report saved to {args.output}")

    if not args.no_open:
        subprocess.run(["open", str(args.output)], check=False)


if __name__ == "__main__":
    main()
