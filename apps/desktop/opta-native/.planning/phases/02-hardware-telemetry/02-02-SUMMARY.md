---
phase: 02-hardware-telemetry
plan: 02
subsystem: telemetry
tags: [tauri, rust, typescript, sidecar, ipc, hooks]

# Dependency graph
requires:
  - phase: 02-01
    provides: Python MCP server with telemetry functions
provides:
  - Tauri sidecar configuration for Python MCP server
  - Rust command (get_system_telemetry) to invoke Python backend
  - TypeScript types matching Rust/Python telemetry structs
  - useTelemetry React hook with polling and error handling
affects: [02-03, all-ui-components-using-telemetry]

# Tech tracking
tech-stack:
  added: [tauri-plugin-shell@2.3.4]
  patterns: [subprocess-ipc-pattern, nullable-field-handling, polling-hook-pattern]

key-files:
  created: [src-tauri/src/telemetry.rs, src/types/telemetry.ts, src-tauri/binaries/opta-mcp-*]
  modified: [src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src/hooks/useTelemetry.ts, src/pages/Dashboard.tsx]

key-decisions:
  - "Used subprocess per-request instead of persistent MCP connection for MVP simplicity"
  - "Platform-specific sidecar scripts handle both dev (local venv) and production modes"
  - "All telemetry fields are nullable to gracefully handle partial data"

patterns-established:
  - "Tauri command pattern: async fn with Result<T, String> return type"
  - "Python invocation via Command::new with inline script"
  - "React hook with polling interval and mounted ref for cleanup"

issues-created: []

# Metrics
duration: 44min
completed: 2026-01-15
---

# Phase 02 Plan 02: Tauri Integration with MCP Server Summary

**Tauri sidecar configuration and Rust commands bridging Python telemetry backend to React frontend via typed IPC**

## Performance

- **Duration:** 44 min
- **Started:** 2026-01-15T02:43:11Z
- **Completed:** 2026-01-15T03:27:28Z
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- Configured Tauri externalBin for Python MCP server sidecar with platform-specific scripts
- Created Rust telemetry module with typed structs (CpuInfo, MemoryInfo, DiskInfo, GpuInfo, SystemSnapshot)
- Implemented get_system_telemetry Tauri command using Python subprocess
- Created TypeScript types matching Rust/Python telemetry output
- Updated useTelemetry hook to invoke real Tauri command instead of mock data
- Wired Dashboard to use real telemetry with nullable field handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Tauri sidecar for Python MCP server** - `54cc47e` (feat)
2. **Task 2: Create Rust commands to invoke MCP tools** - `5feb9aa` (feat)
3. **Task 3: Wire up frontend to receive telemetry data** - `7e8237f` (feat)

## Files Created/Modified

- `src-tauri/tauri.conf.json` - Added externalBin config for opta-mcp sidecar
- `src-tauri/Cargo.toml` - Added tauri-plugin-shell dependency
- `src-tauri/binaries/opta-mcp-*` - Platform-specific sidecar scripts (macOS ARM/Intel, Linux, Windows)
- `src-tauri/src/telemetry.rs` - Rust telemetry module with typed structs and Tauri command
- `src-tauri/src/lib.rs` - Registered shell plugin and telemetry command
- `src/types/telemetry.ts` - TypeScript interfaces for telemetry data
- `src/hooks/useTelemetry.ts` - React hook using real Tauri invoke
- `src/pages/Dashboard.tsx` - Updated to handle nullable telemetry fields

## Decisions Made

1. **Subprocess per-request over persistent MCP** - Full MCP stdio transport adds complexity. Subprocess approach is simpler for MVP and can be optimized in Phase 10.
2. **Platform-specific shell scripts** - Scripts detect dev vs prod mode and handle venv activation automatically.
3. **Nullable telemetry fields** - All telemetry values use Option<T>/T|null to handle partial data gracefully when hardware detection fails.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial cargo check took ~14 minutes due to first-time compilation of Tauri dependencies
- A disk I/O timeout occurred during first compilation attempt, requiring retry

## Next Phase Readiness

- Tauri integration complete - frontend can now fetch real hardware telemetry
- Dashboard displays real CPU, memory, disk, GPU data from Python backend
- Ready for Plan 02-03: Real-time telemetry dashboard UI enhancements

---
*Phase: 02-hardware-telemetry*
*Completed: 2026-01-15*
