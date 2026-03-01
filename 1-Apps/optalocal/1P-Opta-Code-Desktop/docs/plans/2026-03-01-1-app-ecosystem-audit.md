# 1-App Ecosystem Audit (2026-03-01)

## Scope
- Root scanned: `/Users/matthewbyrden/Synced/Opta/1-Apps`
- Primary product cluster scanned: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal`
- Goal: identify overlapping app clients and validate the Golden Repo for the unified Tauri + React/Vite architecture.

## Inventory: Active App Repositories (optalocal)

| Repo | Framework | Tauri Shell | Notes |
|---|---|---|---|
| `1P-Opta-Code-Desktop` | React + Vite | Yes (`src-tauri`) | Only active universal-capable app shell |
| `1L-Opta-Local/web` | Next.js | No | Legacy web app with overlapping daemon UX surface |
| `1O-Opta-Init` | Next.js | No | Init web property |
| `1R-Opta-Accounts` | Next.js | No | Accounts web property |
| `1S-Opta-Status` | Next.js | No | Status web property |
| `1T-Opta-Home` | Next.js | No | Home/marketing web property |
| `1U-Opta-Help` | Next.js | No | Docs/help web property |
| `1V-Opta-Learn` | Next.js | No | Learn web property |

## Overlap / Redundancy Findings

### Direct app-client overlap
- `1P-Opta-Code-Desktop` and `1L-Opta-Local/web` both implement operator-facing daemon/session UX concerns.
- `1L` includes a broader historical surface (`chat`, `sessions`, `operations`, `stack`, `metrics`, `rag`, etc.) but is web-only and does not provide a native shell.

### Non-overlapping supporting products
- `1O`, `1R`, `1S`, `1T`, `1U`, `1V` are standalone web properties (init/accounts/status/home/help/learn), not direct desktop-client replacements.

### Legacy codex app status
- A direct `1D-Opta-Codex-App` active directory was not found in current live paths.
- Legacy codex artifacts exist in archive trees (for example `_archived/2026-02-28-opta-codex-legacy/...`).

## Golden Repo Validation

`1P-Opta-Code-Desktop` is validated as the Golden Repo because:
1. It is the only active repo with both `src/` (React/Vite frontend) and `src-tauri/` (native shell).
2. It already includes native command bridges (`daemon_action`, `read_daemon_logs`, `pick_folder`, `check_first_run`, etc.).
3. It already includes browser-compatible daemon transport (`HTTP + WebSocket`) in frontend hooks/libraries.
4. It includes active tests and build scripts, and passes end-to-end local validation.

## Migration Work Completed In This Session

### Runtime unification
- Added shared runtime bridge in `src/lib/runtime.ts`.
- Refactored duplicated Tauri detection/invoke logic across app modules to use shared helpers.
- Introduced explicit `isNativeDesktop` behavior gates for UI and IPC paths.

### Web/native behavior adaptation
- `LiveBrowserView` now hides macOS-style traffic-light controls when not running in native desktop mode.
- `DaemonPanel` now:
  - uses native IPC controls only when Tauri is available,
  - falls back to web probe diagnostics in browser runtime,
  - keeps HTTP/WS daemon mode active in web runtime.
- `SetupWizard` now uses native folder dialog in desktop mode and browser folder input fallback in web mode.

### Legacy logic extracted from `1L-Opta-Local`
- Ported connection probing strategy (LAN/WAN/offline diagnostics) from `1L` connection logic into `1P` as `src/lib/connectionProbe.ts`.
- Integrated probe flow into unified settings/daemon UX path for web runtime diagnostics.

### Naming/build metadata alignment
- Updated package and build metadata toward unified naming: **Opta Code Desktop (Universal)**.

