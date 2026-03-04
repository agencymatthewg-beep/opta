#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../" && pwd)"
OUT_DIR="$ROOT_DIR/12-Session-Logs/ram-audit"
mkdir -p "$OUT_DIR"
TS="$(date +%s)"
OUT="$OUT_DIR/ram-hotspot-${TS}.json"

export EXCLUDE_TERMS="codex|gemini|claude|google chrome|chromium|safari|firefox|brave|arc|electron|browser"
TOTAL_RAM_BYTES=0
if command -v sysctl >/dev/null 2>&1; then
  TOTAL_RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
elif command -v free >/dev/null 2>&1; then
  TOTAL_RAM_BYTES="$(free | awk '/^Mem:/{print $2*1024*1024}')"
fi
export TOTAL_RAM_BYTES

python3 - <<'PY' > /tmp/ram_hotspot_py.out
import os, json, subprocess
from datetime import datetime

exclude = os.environ['EXCLUDE_TERMS'].split('|')
exclude = [t.strip().lower() for t in exclude if t.strip()]
rows=[]
all_used=0
included_sum=0

p = subprocess.Popen(['ps','-A','-o','pid,ppid,%cpu,%mem,rss,command'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
for line in p.stdout:
    if not line.strip() or line.startswith('  PID') or line.startswith('PID'):
        continue
    parts=line.strip().split(None, 5)
    if len(parts) < 6:
        continue
    try:
        pid=int(parts[0]); ppid=int(parts[1]); cpu=float(parts[2]); mem=float(parts[3]); rss=int(float(parts[4])); cmd=parts[5]
    except Exception:
        continue
    all_used += rss
    cmd_low = cmd.lower()
    if any(term in cmd_low for term in exclude):
        continue
    included_sum += rss
    rows.append({"pid": pid, "ppid": ppid, "cpu_pct": cpu, "mem_pct": mem, "rss_kb": rss, "command": cmd})

rows = sorted(rows, key=lambda x: x['rss_kb'], reverse=True)[:40]

summary={
    'timestamp': datetime.now().isoformat(),
    'sampled_top_processes_excluding_codex_gemini_claude_browser': rows,
    'top_sampled_total_rss_kb': included_sum,
    'all_processes_total_rss_kb': all_used,
    'total_ram_bytes': int(os.environ.get('TOTAL_RAM_BYTES','0') or 0),
}
if summary['total_ram_bytes']:
    summary['total_ram_gb']=round(summary['total_ram_bytes']/1024/1024/1024, 2)

print(json.dumps(summary, indent=2))
PY

cat /tmp/ram_hotspot_py.out > "$OUT"
cat "$OUT"

echo "Wrote: $OUT"
