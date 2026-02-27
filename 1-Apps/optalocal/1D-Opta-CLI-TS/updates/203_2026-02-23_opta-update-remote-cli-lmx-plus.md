---
id: 203
date: 2026-02-23
time: 15:19
author: matthewbyrden
version_before: 0.5.0-alpha.1
version_after: 0.5.0-alpha.1
commit: dbd6aba
promoted: true
category: sync
---

## Summary
- opta update (remote) — cli, lmx, plus
- Steps: total=3, ok=0, skip=0, fail=3

## Command Inputs
- `components`: `["cli","lmx","plus"]`
- `dryRun`: `false`
- `json`: `false`
- `localAppsRoot`: `/Users/matthewbyrden/Synced/Opta/1-Apps`
- `mode`: `remote`
- `noBuild`: `false`
- `noPull`: `false`
- `remoteAppsRoot`: `/Users/Shared/312/Opta/1-Apps`
- `remoteHost`: `mono512`
- `remoteHostUsed`: `(none)`
- `targets`: `["remote"]`

## Step Results
| Target | Component | Step | Status | Message |
| --- | --- | --- | --- | --- |
| remote | cli | connect | fail | [mono512] ssh failed for hosts (mono512) — mono512: ssh: connect to host mono512 port 22: Operation timed out |
| remote | lmx | connect | fail | [mono512] ssh failed for hosts (mono512) — mono512: ssh: connect to host mono512 port 22: Operation timed out |
| remote | plus | connect | fail | [mono512] ssh failed for hosts (mono512) — mono512: ssh: connect to host mono512 port 22: Operation timed out |
