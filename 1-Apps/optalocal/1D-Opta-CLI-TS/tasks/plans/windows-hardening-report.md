# Windows Hardening Report (Opta Code CLI + Opta Daemon)

Date: 2026-03-06
Repo: `1D-Opta-CLI-TS`

## Scope Completed

### 1) Codebase inspection focus
- Reviewed Windows profile docs and runbooks: `platforms/windows/*`
- Audited platform + daemon + app management paths:
  - `src/platform/*`
  - `src/daemon/{installer,lifecycle,session-store,telemetry}.ts`
  - `src/core/tools/executors.ts`
  - `src/commands/{daemon,apps}.ts`
  - app integration via `src/daemon/operations/registry.ts`

### 2) Windows failure points found
- POSIX-only path containment checks (`cwd + '/'`) caused false path-traversal failures on Windows.
- Daemon session-store containment check also hardcoded `'/'`, rejecting valid Windows session directories.
- Windows daemon install relied on direct task action generation that could break npm `.cmd` shim invocation in scheduled tasks.
- Windows uninstall flow was not idempotent when task was absent.
- Windows service status detection depended on task output text parsing; brittle and locale-dependent.
- `apps` install/uninstall paths reported fake success for unsupported app IDs (`opta-lmx`, `opta-code-universal`) instead of truthful capability reporting.

### 3) Implemented hardening fixes
- Added cross-platform path containment utility:
  - `src/platform/path-safety.ts`
- Replaced POSIX-only containment logic in:
  - `src/core/tools/executors.ts`
  - `src/daemon/session-store.ts`
- Hardened daemon installer for Windows and improved invocation resolution:
  - `src/daemon/installer.ts`
  - Added robust command resolution order: `where/which opta` -> `node + argv[1]` -> `process.execPath` fallback.
  - Added Windows task action builder with `.cmd/.bat` handling via `cmd.exe /d /s /c` wrapper.
  - Made uninstall idempotent when task is missing.
  - Made status use task existence + live daemon state (`readDaemonState` + `isDaemonRunning`) for stable running/stopped results.
  - Added best-effort immediate task run after registration.
- Hardened daemon lifecycle behavior:
  - `src/daemon/lifecycle.ts`
  - Added `windowsHide: true` for detached daemon spawn.
  - Made stop flow resilient to kill races/errors and safer Windows fallback signal behavior.
- Normalized daemon log parsing for CRLF:
  - `src/commands/daemon.ts`
  - `src/daemon/session-store.ts` event log reads
- Improved app manageability truthfulness:
  - `src/commands/apps.ts`
  - `apps list` now reflects real daemon installation status.
  - install/uninstall now explicitly support only `opta-daemon` and return clear errors for unimplemented app IDs.

### 4) Tests added/adjusted
- Added:
  - `tests/platform/path-safety.test.ts`
  - `tests/daemon/installer.windows.test.ts`
  - `tests/commands/apps.test.ts`
- Updated for separator-safe assertions:
  - `tests/platform/paths.test.ts`

### 5) Local validation run

#### Passed
- `npm run typecheck`
- `npm run build`
- `npm run check-dist`
- `npm run test:run -- tests/platform/path-safety.test.ts tests/platform/paths.test.ts tests/core/path-guard.test.ts tests/core/path-safety.test.ts tests/daemon/session-store.test.ts tests/daemon/installer.test.ts tests/daemon/installer.windows.test.ts tests/commands/apps.test.ts tests/daemon/lifecycle.test.ts`
- `npm run guard:learning-kinds`
- `npm run lint:budget`

#### Initial failure encountered and fixed
- `tests/daemon/installer.windows.test.ts` had one assertion coupled to host-OS path resolution semantics.
- Adjusted fixture to be host-portable while preserving fallback behavior intent.
- Re-ran affected tests successfully.

#### Current full-pipeline failure (non-Windows-specific)
- `npm run test:ci` fails in `tests/integration/chat-session-full-flow.test.ts` on:
  - `Error: 404 model: mlx-community/MiniMax-M2.5-4bit`
- This is a live model/integration dependency issue, not a Windows hardening regression in this patch set.

## Current Windows Readiness Status
- Core CLI + daemon Windows compatibility is materially stronger for:
  - path safety checks,
  - daemon startup/install/uninstall/status behavior,
  - scheduled-task robustness,
  - app-management truthfulness.

## Remaining Gaps / Next Steps
1. Implement real installers/uninstallers for `opta-lmx` and `opta-code-universal` (currently intentionally unsupported in CLI app manager).
2. Add a Windows CI lane (GitHub Actions `windows-latest`) for this repo’s core test matrix.
3. Consider a native Windows Service mode (NSSM/sc.exe or packaged service wrapper) as an optional alternative to `ONLOGON` scheduled task mode.
4. Add integration tests for Windows daemon lifecycle under mocked `win32` process behavior in broader daemon suites.
