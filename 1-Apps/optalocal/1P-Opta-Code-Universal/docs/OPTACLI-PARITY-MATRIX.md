# Opta CLI -> Opta Code Parity Matrix

Date: 2026-03-01
Scope:
- CLI engine: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS`
- Universal UI: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal`

## Canonical Unified Architecture
- Frontend: `1P-Opta-Code-Universal/src` (React/Vite, deployable web + native shell UI)
- Native shell: `1P-Opta-Code-Universal/src-tauri` (desktop integration/permissions)
- Runtime engine: `1D-Opta-CLI-TS` (daemon, protocol, CLI command execution)

## Newest CLI Updates Verified (Local)
- Release baseline: `0.5.0-alpha.1` in `1D-Opta-CLI-TS/CHANGELOG.md`.
- Notable additions in this update window:
  - v3 daemon operations and protocol hardening
  - browser automation/live-view improvements
  - `completions` + `version.check`
  - account cloud key flows
  - daemon service install/uninstall paths
  - capability-evaluator runtime enforcement hooks

## Capability Coverage
Legend:
- `Dedicated` = purpose-built Opta Code page/UX
- `Console` = available through Operations Console (`/v3/operations`)
- `Native` = available through Tauri bridge only
- `Gap` = not represented yet

| CLI Capability Family | Coverage in Opta Code | Implementation Path |
|---|---|---|
| Session orchestration (`opta`, `do`, live turns, permissions, cancel) | Dedicated | Sessions cockpit (`WorkspaceRail`, `TimelineCards`, `Composer`, `useDaemonSessions`) |
| Model control (`status`, `models` core load/unload/download/delete/memory) | Dedicated | Models page + LMX daemon endpoints |
| Generic daemon operations catalog | Dedicated | Operations page (`useOperations`, schema-driven runner) |
| Config management (`config get/set/list/reset`, full flattened keys) | Dedicated | Config Studio page |
| Account auth (`account status/signup/login/logout`) | Dedicated + Console | Account Controls page + daemon operations |
| Account cloud keys (`account keys list/push/delete`) | Dedicated + Console | Account Controls page + daemon operations |
| Local inference keys (`key create/show/copy`) | Dedicated + Console | Account Controls shortcuts + operations |
| Daemon lifecycle (`daemon start/stop/status/logs/install/uninstall`) | Dedicated + Console | Daemon panel + operations |
| LMX service lifecycle (`serve status/start/stop/restart/logs`) | Console | Added typed operations (`serve.*`) |
| Project bootstrap (`init --yes/--force`) | Console | Added typed operation (`init.run`) |
| Update runner (`update ...`) | Console | Added typed operation (`update.run`) |
| MCP registry flows (`mcp list/add/add-playwright/remove/test`) | Console | Existing + typed operations |
| Retrieval tools (`embed`, `rerank`, `benchmark`) | Console | Existing typed operations |
| Shell completions (`completions`) | Console | Existing typed operation |
| Version checks (`version --check`) | Console | Existing typed operation |
| Keychain (`keychain status/set/delete`) | Console | Existing typed operations |
| CLI-only onboarding wizard (`onboard`, `setup`) | Gap | Interactive TTY wizard; no daemon op mapping yet |
| Raw CLI HTTP server command (`server`) | Gap | Daemon already provides server; no separate UI command surface |

## Settings Coverage Statement
`OptaConfigSchema` settings are centrally represented through daemon-backed config operations:
- `config.list` (resolved config tree)
- `config.get` (single key)
- `config.set` (single key, typed via JSON/string coercion)
- `config.reset` (single key or full reset)

This provides broad settings parity in Opta Code via Config Studio without creating per-setting bespoke UI.

## Runtime Adaptation Contract
- Native desktop detection is centralized via `isNativeDesktop()`.
- Native path:
  - uses Tauri invokes for OS-level actions (setup/lifecycle/log access/secure storage)
  - renders native-capable browser controls where applicable
- Web path:
  - hides native-only controls
  - uses HTTP/WebSocket daemon communication
  - uses browser-safe storage/input fallbacks

## Remaining Competitive Gaps (Next)
1. Dedicated MCP management page (currently Console only).
2. Dedicated Env Profiles page (currently Console only).
3. Dedicated Serve/Update workspace (currently Console only).
4. Optional API route/deep-link routing for page state sharing.
5. Optional onboarding op surface for non-interactive daemon clients.
