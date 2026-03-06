---
id: 212
date: 2026-03-06
time: 14:38
author: matthewbyrden
version_before: 0.1.0
version_after: 0.1.0
commit: 159f276a
promoted: true
category: sync
---

## Summary
- opta update (local) — cli, daemon
- Steps: total=5, ok=2, skip=2, fail=1

## Command Inputs
- `components`: `["cli","daemon"]`
- `dryRun`: `false`
- `explicitRolloutHosts`: `[]`
- `json`: `false`
- `localAppsRoot`: `/Users/matthewbyrden/Synced/Opta/1-Apps`
- `mode`: `local`
- `noBuild`: `false`
- `noPull`: `false`
- `remoteAppsRoot`: `/Users/Shared/312/Opta/1-Apps`
- `remoteHost`: `localhost`
- `remoteHostUsed`: `(none)`
- `rolloutAllReachable`: `false`
- `targets`: `["local"]`

## Step Results
| Target | Component | Step | Status | Message |
| --- | --- | --- | --- | --- |
| local | cli | git | skip | dirty working tree (skipped pull) |
| local | cli | build | ok | npm typecheck + build complete |
| local | cli | verify | fail | bash: -c: line 0: syntax error near unexpected token `;' bash: -c: line 0: `if ! command -v node >/dev/null 2>&1; then echo "__ERR__:missing-node"; exit 40; fi; if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi; help="$(opta --help 2>&1)" \|\| {; echo "__ERR__:help-failed";; echo "$help";; exit 42;; }; missing=""; for c in chat tui do benchmark status models config sessions mcp serve server daemon health settings update doctor completions; do echo "$help" \| grep -Eq "(^\|[[:space:]])$c([[:space:]]\|$)" \|\| missing="$missing $c"; done; if [ -n "$missing" ]; then echo "__MISSING__:$missing"; exit 43; fi; version="$(opta --version 2>/dev/null \|\| true)"; echo "__VERSION__:$version"' |
| local | daemon | git | skip | dirty working tree (skipped pull) |
| local | daemon | build | ok | daemon restart + health check complete |
