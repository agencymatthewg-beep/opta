# Plan 19-04 Summary: Privileged Helper Tool

**Status:** Complete
**Duration:** ~12 min
**Wave:** 2 (parallel with 19-02, 19-03)

## What Was Built

1. **HelperTool.swift** - XPC daemon for privileged operations
   - NSXPCListener setup for inter-process communication
   - Process termination via SIGKILL with authorization checks
   - Runs as root via launchd

2. **HelperProtocol.swift** - Shared protocol for IPC
   - `HelperProtocol` defining `terminateProcess(pid:reply:)`
   - Placed in `OptaNative/Shared/` for access by both app and helper

3. **HelperManager.swift** - Client-side helper communication
   - `SMAppService.mainApp.register()` for helper registration
   - NSXPCConnection management
   - Error handling for connection failures

4. **Configuration Files**
   - Info.plist for helper bundle
   - launchd.plist for daemon configuration

## Files Created

- `OptaNative/Helper/HelperTool.swift`
- `OptaNative/Shared/HelperProtocol.swift`
- `OptaNative/OptaNative/Services/HelperManager.swift`
- `OptaNative/Helper/Info.plist`
- `OptaNative/Helper/launchd.plist`

## Architecture

```
┌─────────────────┐         XPC         ┌─────────────────┐
│  OptaNative App │ ◄─────────────────► │  Helper Daemon  │
│  (user context) │   HelperProtocol    │  (root context) │
└─────────────────┘                     └─────────────────┘
        │                                       │
        ▼                                       ▼
   HelperManager                          HelperTool
   (NSXPCConnection)                      (NSXPCListener)
```

## Decisions

| Decision | Rationale |
|----------|-----------|
| SMAppService over ServiceManagement | Modern API (macOS 13+), better UX |
| SIGKILL not SIGTERM | Stealth Mode requires force-quit for stubborn processes |
| Shared protocol folder | Single source of truth for IPC contract |

## Security Notes

- Helper runs as root - limited to process termination only
- XPC provides sandboxing between app and helper
- Must distribute outside App Store (helper can't be sandboxed)

## Ready For

- Plan 19-05: ProcessService uses HelperManager for termination
- Plan 19-07: Dashboard Stealth Mode UI
