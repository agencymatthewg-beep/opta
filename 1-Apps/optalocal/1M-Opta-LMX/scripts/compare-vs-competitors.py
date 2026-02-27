#!/usr/bin/env python3
"""Generate a comparative benchmark report: Opta-LMX vs competitors.

Reads LMX benchmark results from JSON files and competitor baselines from
benchmarks/reference/published.yaml, then produces a comparison table with
deltas and a summary verdict.

Usage:
    python scripts/compare-vs-competitors.py
    python scripts/compare-vs-competitors.py --results-dir benchmarks/
    python scripts/compare-vs-competitors.py --format html --output /tmp/compare.html
    python scripts/compare-vs-competitors.py --format markdown
    python scripts/compare-vs-competitors.py --format json --output comparison.json

Output formats:
    terminal  - Colored table in terminal (default)
    markdown  - Markdown table (for docs/READMEs)
    html      - Full HTML report with Opta glass aesthetic
    json      - Machine-readable JSON
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
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

# Terminal colors
_BOLD = "\033[1m"
_GREEN = "\033[92m"
_RED = "\033[91m"
_YELLOW = "\033[93m"
_BLUE = "\033[94m"
_PURPLE = "\033[95m"
_RESET = "\033[0m"
_DIM = "\033[2m"


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


class ModelComparison:
    """Holds LMX results + competitor baselines for one model."""

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self.short_name = model_id.split("/")[-1]
        self.lmx_tps: float | None = None
        self.lmx_ttft_sec: float | None = None
        self.lmx_backend: str = ""
        self.lmx_hardware: str = ""
        self.lmx_runs: int = 0
        self.lmx_status: str = ""
        self.competitors: dict[str, dict[str, Any]] = {}  # name -> {toks_per_sec, ttft_sec, ...}

    def delta_tps(self, competitor: str) -> float | None:
        """Percentage difference in tok/s. Positive = LMX faster."""
        comp = self.competitors.get(competitor, {})
        comp_tps = _safe_float(comp.get("toks_per_sec"))
        if self.lmx_tps is None or comp_tps is None or comp_tps == 0:
            return None
        return (self.lmx_tps - comp_tps) / comp_tps * 100

    def delta_ttft(self, competitor: str) -> float | None:
        """Percentage difference in TTFT. Negative = LMX faster."""
        comp = self.competitors.get(competitor, {})
        comp_ttft = _safe_float(comp.get("ttft_sec"))
        if self.lmx_ttft_sec is None or comp_ttft is None or comp_ttft == 0:
            return None
        return (self.lmx_ttft_sec - comp_ttft) / comp_ttft * 100

    def verdict(self) -> str:
        """Simple verdict: faster / slower / mixed / no data."""
        deltas = [self.delta_tps(c) for c in self.competitors if self.delta_tps(c) is not None]
        if not deltas:
            return "no competitor data"
        avg = sum(deltas) / len(deltas)
        if avg > 5:
            return "LMX faster"
        elif avg < -5:
            return "LMX slower"
        return "comparable"


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def _safe_float(val: Any) -> float | None:
    """Safely convert to float, returning None for non-numeric."""
    if val is None or val == "N/A":
        return None
    try:
        result = float(val)
        return result if result == result else None  # NaN check
    except (ValueError, TypeError):
        return None


def _normalize_result(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize a benchmark result to have stats.toks_per_sec_mean etc."""
    if "stats" in raw:
        return raw
    # Legacy format
    summary = raw.get("summary")
    if summary:
        return {
            "model_id": raw.get("model_id", "unknown"),
            "backend": raw.get("backend", "unknown"),
            "hardware": raw.get("hardware", ""),
            "status": raw.get("status", "ok"),
            "stats": {
                "toks_per_sec_mean": summary.get("warm_avg_toks_per_sec", 0.0),
                "ttft_mean_sec": (summary.get("warm_avg_ttft_ms", 0.0) or 0.0) / 1000,
                "runs_completed": raw.get("runs", 0),
            },
        }
    return None


def _load_lmx_results(directories: list[Path]) -> dict[str, dict[str, Any]]:
    """Load LMX results from JSON files, returning latest result per model."""
    latest: dict[str, dict[str, Any]] = {}
    for directory in directories:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                normalized = _normalize_result(raw)
                if normalized is None:
                    continue
                mid = normalized["model_id"]
                # Keep latest (last in sorted order)
                latest[mid] = normalized
            except Exception:
                continue
    return latest


def _load_reference(path: Path) -> dict[str, Any]:
    """Load competitor reference data from YAML."""
    if not path.exists() or not _YAML_AVAILABLE:
        return {}
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _build_comparisons(
    lmx_results: dict[str, dict[str, Any]],
    reference: dict[str, Any],
) -> list[ModelComparison]:
    """Merge LMX results with competitor baselines into ModelComparison objects."""
    # All model IDs from both sources
    all_ids = set(lmx_results.keys()) | set(reference.keys())
    comparisons: list[ModelComparison] = []

    for model_id in sorted(all_ids):
        comp = ModelComparison(model_id)

        # LMX data
        lmx = lmx_results.get(model_id)
        if lmx:
            stats = lmx.get("stats", {})
            comp.lmx_tps = _safe_float(stats.get("toks_per_sec_mean"))
            comp.lmx_ttft_sec = _safe_float(stats.get("ttft_mean_sec"))
            comp.lmx_backend = lmx.get("backend", "")
            comp.lmx_hardware = lmx.get("hardware", "")
            comp.lmx_runs = stats.get("runs_completed", 0)
            comp.lmx_status = lmx.get("status", "")

        # Competitor data
        ref = reference.get(model_id, {})
        for key, data in ref.items():
            if key == "opta_lmx":
                continue  # Skip our own reference entry
            if isinstance(data, dict) and ("toks_per_sec" in data or "ttft_sec" in data):
                comp.competitors[key] = data

        comparisons.append(comp)

    return comparisons


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------


def _format_delta(delta: float | None, higher_is_better: bool = True) -> str:
    """Format a percentage delta with color for terminal output."""
    if delta is None:
        return f"{_DIM}---{_RESET}"
    sign = "+" if delta >= 0 else ""
    # For tok/s: positive = good (green). For TTFT: negative = good (green).
    if higher_is_better:
        color = _GREEN if delta > 0 else (_RED if delta < -5 else _YELLOW)
    else:
        color = _GREEN if delta < 0 else (_RED if delta > 5 else _YELLOW)
    return f"{color}{sign}{delta:.0f}%{_RESET}"


def _render_terminal(comparisons: list[ModelComparison]) -> str:
    """Render comparison as a colored terminal table."""
    lines: list[str] = []
    lines.append(f"\n{_PURPLE}{_BOLD}=== Opta-LMX vs Competitors ==={_RESET}")
    lines.append(f"{_DIM}Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}{_RESET}\n")

    # Collect all competitor names
    all_competitors: list[str] = []
    for comp in comparisons:
        for c in comp.competitors:
            if c not in all_competitors:
                all_competitors.append(c)

    # Header
    header = f"{'Model':<35} {'LMX tok/s':>10} {'LMX TTFT':>10}"
    for c in all_competitors:
        header += f" {'vs ' + c:>16}"
    lines.append(f"{_BOLD}{header}{_RESET}")
    lines.append("-" * len(header.replace("\033[0m", "").replace("\033[1m", "")))

    # Rows
    for comp in comparisons:
        tps_str = f"{comp.lmx_tps:.1f}" if comp.lmx_tps is not None else "---"
        ttft_str = f"{comp.lmx_ttft_sec * 1000:.0f}ms" if comp.lmx_ttft_sec is not None else "---"
        row = f"{comp.short_name:<35} {tps_str:>10} {ttft_str:>10}"

        for c in all_competitors:
            delta = comp.delta_tps(c)
            row += f" {_format_delta(delta, higher_is_better=True):>25}"

        lines.append(row)

    # Summary
    lines.append("")
    lines.append(f"{_BOLD}Summary:{_RESET}")
    for comp in comparisons:
        verdict = comp.verdict()
        if verdict == "LMX faster":
            color = _GREEN
        elif verdict == "LMX slower":
            color = _RED
        else:
            color = _YELLOW
        lines.append(f"  {comp.short_name}: {color}{verdict}{_RESET}")

    return "\n".join(lines) + "\n"


def _render_markdown(comparisons: list[ModelComparison]) -> str:
    """Render comparison as a Markdown table."""
    lines: list[str] = []
    lines.append("# Opta-LMX vs Competitors")
    lines.append(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

    all_competitors: list[str] = []
    for comp in comparisons:
        for c in comp.competitors:
            if c not in all_competitors:
                all_competitors.append(c)

    # Table header
    header_cols = ["Model", "LMX tok/s", "LMX TTFT"]
    for c in all_competitors:
        header_cols.append(f"vs {c} (tok/s)")
    lines.append("| " + " | ".join(header_cols) + " |")
    lines.append("| " + " | ".join("---" for _ in header_cols) + " |")

    # Rows
    for comp in comparisons:
        tps = f"{comp.lmx_tps:.1f}" if comp.lmx_tps is not None else "---"
        ttft = f"{comp.lmx_ttft_sec * 1000:.0f}ms" if comp.lmx_ttft_sec is not None else "---"
        cols = [comp.short_name, tps, ttft]
        for c in all_competitors:
            delta = comp.delta_tps(c)
            if delta is not None:
                sign = "+" if delta >= 0 else ""
                cols.append(f"{sign}{delta:.0f}%")
            else:
                cols.append("---")
        lines.append("| " + " | ".join(cols) + " |")

    # Summary
    lines.append("\n## Verdict\n")
    for comp in comparisons:
        verdict = comp.verdict()
        if verdict == "LMX faster":
            icon = "**Faster**"
        elif verdict == "LMX slower":
            icon = "Slower"
        else:
            icon = "~comparable"
        lines.append(f"- **{comp.short_name}**: {icon}")

    return "\n".join(lines) + "\n"


def _render_json(comparisons: list[ModelComparison]) -> str:
    """Render comparison as structured JSON."""
    data: list[dict[str, Any]] = []
    for comp in comparisons:
        entry: dict[str, Any] = {
            "model_id": comp.model_id,
            "short_name": comp.short_name,
            "lmx": {
                "toks_per_sec": comp.lmx_tps,
                "ttft_sec": comp.lmx_ttft_sec,
                "backend": comp.lmx_backend,
                "hardware": comp.lmx_hardware,
                "runs": comp.lmx_runs,
            },
            "competitors": {},
            "deltas": {},
            "verdict": comp.verdict(),
        }
        for c, cdata in comp.competitors.items():
            entry["competitors"][c] = {
                "toks_per_sec": _safe_float(cdata.get("toks_per_sec")),
                "ttft_sec": _safe_float(cdata.get("ttft_sec")),
                "source": cdata.get("source", ""),
                "hardware": cdata.get("hardware", ""),
            }
            entry["deltas"][c] = {
                "tps_pct": comp.delta_tps(c),
                "ttft_pct": comp.delta_ttft(c),
            }
        data.append(entry)

    output = {
        "generated": datetime.now().isoformat(),
        "models_compared": len(data),
        "comparisons": data,
    }
    return json.dumps(output, indent=2, default=str) + "\n"


def _render_html(comparisons: list[ModelComparison]) -> str:
    """Render comparison as an HTML report with Opta glass aesthetic."""
    import html as html_mod

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    all_competitors: list[str] = []
    for comp in comparisons:
        for c in comp.competitors:
            if c not in all_competitors:
                all_competitors.append(c)

    # Build table rows
    rows = ""
    for comp in comparisons:
        tps = f"{comp.lmx_tps:.1f}" if comp.lmx_tps is not None else "&mdash;"
        ttft = f"{comp.lmx_ttft_sec * 1000:.0f}ms" if comp.lmx_ttft_sec is not None else "&mdash;"
        verdict = comp.verdict()
        if verdict == "LMX faster":
            v_cls = "verdict-faster"
        elif verdict == "LMX slower":
            v_cls = "verdict-slower"
        else:
            v_cls = "verdict-mixed"

        comp_cells = ""
        for c in all_competitors:
            delta = comp.delta_tps(c)
            comp_data = comp.competitors.get(c, {})
            comp_tps = _safe_float(comp_data.get("toks_per_sec"))
            if delta is not None:
                sign = "+" if delta >= 0 else ""
                cls = "delta-pos" if delta > 0 else ("delta-neg" if delta < -5 else "delta-neutral")
                comp_cells += (
                    f'<td>{comp_tps:.1f} '
                    f'<span class="{cls}">'
                    f'{sign}{delta:.0f}%</span></td>'
                )
            else:
                comp_cells += "<td>&mdash;</td>"

        rows += f"""<tr>
          <td title="{html_mod.escape(comp.model_id)}">{html_mod.escape(comp.short_name)}</td>
          <td><strong>{tps}</strong></td>
          <td>{ttft}</td>
          {comp_cells}
          <td class="{v_cls}">{verdict}</td>
        </tr>"""

    # Competitor column headers
    comp_headers = "".join(
        f"<th>{html_mod.escape(c)}<br>"
        f"<small>tok/s (delta)</small></th>"
        for c in all_competitors
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Opta-LMX vs Competitors</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');
  * {{ box-sizing: border-box; }}
  body {{
    background: #09090b; color: #f4f4f5;
    font-family: 'Sora', system-ui, sans-serif;
    margin: 0; padding: 32px 40px;
  }}
  h1 {{ color: #a78bfa; margin-bottom: 4px; font-weight: 700; }}
  .meta {{ color: #71717a; font-size: 13px; margin-bottom: 28px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    background: rgba(39, 39, 42, 0.8); padding: 10px 14px;
    text-align: left; font-size: 11px; color: #a1a1aa;
    text-transform: uppercase; letter-spacing: 0.06em;
  }}
  td {{ padding: 10px 14px; border-bottom: 1px solid rgba(39, 39, 42, 0.5); font-size: 13px; }}
  tr:hover td {{ background: rgba(24, 24, 27, 0.5); }}
  td strong {{ color: #e4e4e7; }}
  .delta-pos {{ color: #4ade80; font-weight: 600; margin-left: 6px; }}
  .delta-neg {{ color: #f87171; font-weight: 600; margin-left: 6px; }}
  .delta-neutral {{ color: #a1a1aa; margin-left: 6px; }}
  .verdict-faster {{ color: #4ade80; font-weight: 600; }}
  .verdict-slower {{ color: #f87171; font-weight: 600; }}
  .verdict-mixed {{ color: #facc15; }}
  small {{ color: #52525b; }}
</style>
</head>
<body>
<h1>Opta-LMX vs Competitors</h1>
<div class="meta">Generated {now} | {len(comparisons)} model(s) compared</div>

<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>LMX tok/s</th>
      <th>LMX TTFT</th>
      {comp_headers}
      <th>Verdict</th>
    </tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare Opta-LMX benchmark results against competitor baselines",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
examples:
  python scripts/compare-vs-competitors.py                          # Terminal table
  python scripts/compare-vs-competitors.py --format markdown        # Markdown table
  python scripts/compare-vs-competitors.py --format html -o /tmp/compare.html
  python scripts/compare-vs-competitors.py --format json -o comparison.json
""",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=_DEFAULT_RESULTS_DIR,
        help=f"Directory with LMX benchmark JSONs (default: {_DEFAULT_RESULTS_DIR})",
    )
    parser.add_argument(
        "--reference",
        type=Path,
        default=_DEFAULT_REFERENCE,
        help=f"Competitor baselines YAML (default: {_DEFAULT_REFERENCE})",
    )
    parser.add_argument(
        "--format",
        choices=["terminal", "markdown", "html", "json"],
        default="terminal",
        help="Output format (default: terminal)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output file (default: stdout for terminal/markdown/json, /tmp/ for html)",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Don't auto-open HTML output in browser",
    )
    args = parser.parse_args()

    # Load data
    dirs = [args.results_dir]
    if args.results_dir == _DEFAULT_RESULTS_DIR and _PROJECT_BENCHMARKS_DIR.exists():
        dirs.append(_PROJECT_BENCHMARKS_DIR)

    lmx_results = _load_lmx_results(dirs)
    if not _YAML_AVAILABLE:
        print("Warning: pyyaml not installed -- pip install pyyaml", file=sys.stderr)
    reference = _load_reference(args.reference)

    if not lmx_results and not reference:
        print("No benchmark results or reference data found.", file=sys.stderr)
        sys.exit(1)

    comparisons = _build_comparisons(lmx_results, reference)

    # Render
    if args.format == "terminal":
        output = _render_terminal(comparisons)
    elif args.format == "markdown":
        output = _render_markdown(comparisons)
    elif args.format == "json":
        output = _render_json(comparisons)
    elif args.format == "html":
        output = _render_html(comparisons)
    else:
        output = _render_terminal(comparisons)

    # Write output
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
        print(f"Written to {args.output}", file=sys.stderr)
        if args.format == "html" and not args.no_open:
            subprocess.run(["open", str(args.output)], check=False)
    elif args.format == "html":
        # Default HTML output path
        html_path = Path("/tmp/opta-lmx-comparison.html")
        html_path.write_text(output, encoding="utf-8")
        print(f"Written to {html_path}", file=sys.stderr)
        if not args.no_open:
            subprocess.run(["open", str(html_path)], check=False)
    else:
        print(output)


if __name__ == "__main__":
    main()
