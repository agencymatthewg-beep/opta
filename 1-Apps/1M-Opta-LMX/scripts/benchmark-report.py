#!/usr/bin/env python3
"""Generate an HTML benchmark comparison report from stored LMX results.

Usage:
    # Pull directly from a running LMX server (recommended):
    python scripts/benchmark-report.py --api http://192.168.188.11:1234 --api-key <key>

    # Or from local JSON files:
    python scripts/benchmark-report.py [--results-dir DIR] [--reference FILE]
                                       [--output FILE] [--no-open]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

try:
    import yaml
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False


_DEFAULT_RESULTS_DIR = Path.home() / ".opta-lmx" / "benchmarks"
_DEFAULT_REFERENCE = Path(__file__).parent.parent / "benchmarks" / "reference" / "published.yaml"
_COHERENCE_EMOJI = {"ok": "✓", "truncated": "⚠", "repetitive": "⚠", "garbled": "✗"}


def _load_results_from_api(base_url: str, api_key: str) -> list[dict]:
    """Pull benchmark results directly from a running LMX server."""
    url = base_url.rstrip("/") + "/admin/benchmark/results"
    req = urllib.request.Request(url, headers={"X-Admin-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            results = json.loads(resp.read().decode())
            print(f"  Fetched {len(results)} result(s) from {url}")
            return results
    except Exception as e:
        print(f"Error: could not fetch from {url}: {e}", file=sys.stderr)
        sys.exit(1)


def _load_results(directory: Path) -> list[dict]:
    results = []
    if not directory.exists():
        return results
    for path in sorted(directory.glob("*.json")):
        try:
            results.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception as e:
            print(f"  Warning: could not load {path.name}: {e}", file=sys.stderr)
    return results


def _load_reference(path: Path) -> dict:
    if not path.exists():
        return {}
    if not _YAML_AVAILABLE:
        print("Warning: pyyaml not installed, reference data unavailable", file=sys.stderr)
        return {}
    try:
        import yaml
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as e:
        print(f"Warning: could not load reference data: {e}", file=sys.stderr)
        return {}


def _pct_diff(lmx: float, competitor: float) -> str:
    if competitor == 0:
        return "—"
    diff = (lmx - competitor) / competitor * 100
    sign = "+" if diff >= 0 else ""
    return f"{sign}{diff:.0f}%"


def _render_report(results: list[dict], reference: dict) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    model_ids = list(dict.fromkeys(r["model_id"] for r in results))

    # Summary table rows
    summary_rows = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        latest = model_results[-1]
        s = latest["stats"]
        ref = reference.get(model_id, {})
        lms = ref.get("lm_studio", {})
        oll = ref.get("ollama", {})
        tps = s["toks_per_sec_mean"]
        ttft = s["ttft_mean_sec"]
        vs_lms_tps = _pct_diff(tps, lms.get("toks_per_sec", 0)) if lms else "—"
        vs_oll_tps = _pct_diff(tps, oll.get("toks_per_sec", 0)) if oll else "—"
        tools = "✓" if s.get("tool_call") and s["tool_call"].get("call_produced") else "—"
        skills_ok = sum(1 for sk in s.get("skills", []) if sk.get("skill_invoked_successfully"))
        skills_total = len(s.get("skills", []))
        skills = f"{skills_ok}/{skills_total}" if skills_total > 0 else "—"
        quality = _COHERENCE_EMOJI.get(s.get("coherence_flag", "ok"), "?")
        short_name = model_id.split("/")[-1]
        summary_rows += f"""
        <tr>
          <td title="{model_id}">{short_name}</td>
          <td>{latest['backend']}</td>
          <td><strong>{tps:.1f}</strong></td>
          <td>{ttft * 1000:.0f}ms</td>
          <td>{vs_lms_tps}</td>
          <td>{vs_oll_tps}</td>
          <td>{tools}</td>
          <td>{skills}</td>
          <td>{quality} {s.get('coherence_flag','ok')}</td>
        </tr>"""

    # Per-model cards
    cards = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        for result in model_results:
            s = result["stats"]
            ref = reference.get(model_id, {})
            lms = ref.get("lm_studio", {})
            oll = ref.get("ollama", {})
            tps = s["toks_per_sec_mean"]
            ttft = s["ttft_mean_sec"]

            hypothesis_lms = f"~{lms['toks_per_sec']} tok/s, TTFT ~{lms['ttft_sec']}s" if lms else "—"
            hypothesis_oll = f"~{oll['toks_per_sec']} tok/s, TTFT ~{oll['ttft_sec']}s" if oll else "—"
            vs_lms_tps = _pct_diff(tps, lms.get("toks_per_sec", 0)) if lms else "—"
            vs_lms_ttft = _pct_diff(ttft, lms.get("ttft_sec", 0)) if lms else "—"
            vs_oll_tps = _pct_diff(tps, oll.get("toks_per_sec", 0)) if oll else "—"
            vs_oll_ttft = _pct_diff(ttft, oll.get("ttft_sec", 0)) if oll else "—"

            tc = s.get("tool_call")
            tool_row = ""
            if tc:
                tc_icon = "✓" if tc.get("call_produced") and tc.get("tool_name_correct") else "✗"
                tool_row = f"<li>Tool calling: {tc_icon} {tc.get('latency_sec', 0):.2f}s</li>"

            skills_rows = ""
            for sk in s.get("skills", []):
                sk_icon = "✓" if sk.get("skill_invoked_successfully") else "✗"
                err = f" — {sk['error']}" if sk.get("error") else ""
                skills_rows += f"<li>Skill ({sk['skill_name']}): {sk_icon}{err}</li>"

            cards += f"""
      <div class="card">
        <div class="card-header">
          <span class="model-id">{model_id}</span>
          <span class="badge">{result['backend']}</span>
          <span class="ts">{result['timestamp'][:19]}</span>
        </div>

        <div class="section">
          <div class="section-title">Hypothesis</div>
          <table class="inner-table">
            <tr><td>LM Studio</td><td>{hypothesis_lms}</td></tr>
            <tr><td>Ollama</td><td>{hypothesis_oll}</td></tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Results ({s['runs_completed']} runs, {s['output_tokens']} tokens, temp=0)</div>
          <table class="inner-table">
            <tr><td>tok/s</td><td>p50: {s['toks_per_sec_p50']:.1f} &nbsp; p95: {s['toks_per_sec_p95']:.1f} &nbsp; mean: <strong>{tps:.1f}</strong></td></tr>
            <tr><td>TTFT</td><td>p50: {s['ttft_p50_sec']*1000:.0f}ms &nbsp; p95: {s['ttft_p95_sec']*1000:.0f}ms &nbsp; mean: <strong>{ttft*1000:.0f}ms</strong></td></tr>
          </table>
          <div class="deltas">
            vs LM Studio: <span class="delta">{vs_lms_tps} tok/s</span> / <span class="delta">{vs_lms_ttft} TTFT</span> &nbsp;|&nbsp;
            vs Ollama: <span class="delta">{vs_oll_tps} tok/s</span> / <span class="delta">{vs_oll_ttft} TTFT</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Capability Matrix</div>
          <ul class="capability-list">
            <li>Text: {_COHERENCE_EMOJI.get(s.get('coherence_flag','ok'),'?')} {s.get('coherence_flag','ok')} ({"completed naturally" if s.get('completed_naturally') else "truncated"})</li>
            {tool_row}
            {skills_rows}
          </ul>
        </div>

        <details class="output-section">
          <summary>Output text</summary>
          <pre class="output-text">{s.get('output_text','')[:2000]}</pre>
        </details>
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Opta-LMX Benchmark Report</title>
<style>
  body {{ background: #09090b; color: #f4f4f5; font-family: 'Sora', system-ui, sans-serif; margin: 0; padding: 20px; }}
  h1 {{ color: #a78bfa; margin-bottom: 4px; }}
  .meta {{ color: #71717a; font-size: 13px; margin-bottom: 24px; }}
  .summary-table {{ width: 100%; border-collapse: collapse; margin-bottom: 32px; }}
  .summary-table th {{ background: #27272a; padding: 8px 12px; text-align: left; font-size: 12px; color: #a1a1aa; }}
  .summary-table td {{ padding: 8px 12px; border-bottom: 1px solid #27272a; font-size: 13px; }}
  .summary-table tr:hover td {{ background: #18181b; }}
  .card {{ background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
  .card-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }}
  .model-id {{ font-weight: 600; font-size: 15px; color: #e4e4e7; }}
  .badge {{ background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
  .ts {{ color: #52525b; font-size: 12px; margin-left: auto; }}
  .section {{ margin-bottom: 14px; }}
  .section-title {{ color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }}
  .inner-table {{ font-size: 13px; border-collapse: collapse; }}
  .inner-table td {{ padding: 3px 12px 3px 0; }}
  .deltas {{ font-size: 13px; color: #a1a1aa; margin-top: 8px; }}
  .delta {{ color: #4ade80; font-weight: 600; }}
  .capability-list {{ margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8; }}
  .output-section summary {{ cursor: pointer; color: #71717a; font-size: 13px; margin-top: 8px; }}
  .output-text {{ background: #09090b; padding: 12px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; color: #d4d4d8; max-height: 300px; overflow-y: auto; }}
</style>
</head>
<body>
<h1>Opta-LMX Benchmark Report</h1>
<div class="meta">Generated {now} &nbsp;|&nbsp; {len(model_ids)} model(s) tested</div>

<table class="summary-table">
  <thead>
    <tr>
      <th>Model</th><th>Backend</th><th>tok/s mean</th><th>TTFT mean</th>
      <th>vs LM Studio</th><th>vs Ollama</th><th>Tools</th><th>Skills</th><th>Quality</th>
    </tr>
  </thead>
  <tbody>{summary_rows}</tbody>
</table>

{cards}
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LMX benchmark HTML report")
    parser.add_argument("--api", metavar="URL", help="Pull results from a running LMX server (e.g. http://192.168.188.11:1234)")
    parser.add_argument("--api-key", metavar="KEY", default=os.environ.get("LMX_ADMIN_KEY", ""),
                        help="Admin key for the LMX server (or set LMX_ADMIN_KEY env var)")
    parser.add_argument("--results-dir", type=Path, default=_DEFAULT_RESULTS_DIR)
    parser.add_argument("--reference", type=Path, default=_DEFAULT_REFERENCE)
    parser.add_argument("--output", type=Path, default=Path("/tmp/opta-lmx-benchmark.html"))
    parser.add_argument("--no-open", action="store_true", help="Don't open in browser")
    args = parser.parse_args()

    if args.api:
        if not args.api_key:
            print("Error: --api requires --api-key or LMX_ADMIN_KEY env var", file=sys.stderr)
            sys.exit(1)
        print(f"Fetching results from {args.api}...")
        results = _load_results_from_api(args.api, args.api_key)
    else:
        print(f"Loading results from {args.results_dir}...")
        results = _load_results(args.results_dir)

    if not results:
        print("No benchmark results found.")
        sys.exit(0)

    print(f"Loading reference data from {args.reference}...")
    reference = _load_reference(args.reference)

    print(f"Generating report for {len(results)} result(s)...")
    html = _render_report(results, reference)
    args.output.write_text(html, encoding="utf-8")
    print(f"Report saved to {args.output}")

    if not args.no_open:
        subprocess.run(["open", str(args.output)], check=False)


if __name__ == "__main__":
    main()
