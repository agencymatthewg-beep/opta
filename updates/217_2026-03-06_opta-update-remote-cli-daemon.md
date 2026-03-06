---
id: 217
date: 2026-03-06
time: 14:46
author: matthewbyrden
version_before: 0.1.0
version_after: 0.1.0
commit: 159f276a
promoted: true
category: sync
---

## Summary
- opta update (remote) — cli, daemon
- Steps: total=6, ok=2, skip=2, fail=2

## Command Inputs
- `components`: `["cli","daemon"]`
- `dryRun`: `false`
- `explicitRolloutHosts`: `[]`
- `json`: `false`
- `localAppsRoot`: `/Users/matthewbyrden/Synced/Opta/1-Apps`
- `mode`: `remote`
- `noBuild`: `false`
- `noPull`: `false`
- `remoteAppsRoot`: `/Users/Shared/312/Opta/1-Apps`
- `remoteHost`: `localhost`
- `remoteHostUsed`: `192.168.188.11`
- `rolloutAllReachable`: `false`
- `targets`: `["remote"]`

## Step Results
| Target | Component | Step | Status | Message |
| --- | --- | --- | --- | --- |
| remote | cli | network | ok | [192.168.188.11] LAN guard ok (en0=192.168.188.11, en1=none, wifi=Off) |
| remote | cli | git | skip | [192.168.188.11] not a git repository (skipped pull) |
| remote | cli | build | fail | [192.168.188.11] npm error code EEXIST npm error path /opt/homebrew/bin/opta npm error EEXIST: file already exists npm error File exists: /opt/homebrew/bin/opta npm error Remove the existing file and try again, or run npm npm error with --force to overwrite files recklessly. npm error A complete log of this run can be found in: /Users/opta/.npm/_logs/2026-03-06T03_46_35_731Z-debug-0.log |
| remote | cli | verify | fail | [192.168.188.11] missing command entries in remote opta --help: settings |
| remote | daemon | git | skip | [192.168.188.11] not a git repository (skipped pull) |
| remote | daemon | build | ok | [192.168.188.11] daemon restart + health check complete |
