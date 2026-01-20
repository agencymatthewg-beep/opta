# Plan 19-05 Summary: Hardware Telemetry Services

**Status:** Complete
**Duration:** ~20 min
**Wave:** 3

## What Was Built

Created three core services for real-time hardware telemetry in the OptaNative macOS app:

### 1. TelemetryService.swift
**Location:** `OptaNative/OptaNative/Services/TelemetryService.swift`

Actor-based service providing thread-safe hardware monitoring:
- Uses existing `SensorReader` for SMC temperature readings
- Polls at configurable intervals (default 1 second) using async/await
- Collects CPU/GPU temperatures via SMC
- Uses `host_processor_info` for CPU usage calculation (delta-based for accuracy)
- Uses `host_statistics64` for memory statistics
- Provides `TelemetrySnapshot` struct with all metrics
- Callback-based update delivery for UI integration

Key features:
- Full Swift Concurrency support (actor isolation)
- `@Sendable` closure for thread-safe callbacks
- Automatic CPU usage delta calculation between samples
- Memory breakdown: active + wired + compressed pages

### 2. TelemetryViewModel.swift
**Location:** `OptaNative/OptaNative/ViewModels/TelemetryViewModel.swift`

`@Observable` view model bridging telemetry to SwiftUI:
- Uses `@Observable` macro (macOS 14+, NOT ObservableObject)
- `@MainActor` annotation for UI-safe property updates
- Exposes all telemetry properties with automatic observation
- Computed properties for alerts (hot CPU/GPU, high memory, high CPU usage)
- Pre-formatted strings for direct UI binding
- Preview support with mock data for SwiftUI development

Exposed properties:
- `cpuTemperature`, `gpuTemperature` (Celsius)
- `cpuUsage`, `memoryPercent` (0-100%)
- `memoryUsedGB`, `memoryTotalGB`, `memoryAvailableGB`
- `fanSpeeds` (array of RPM values)
- `pCoreTemperatures`, `eCoreTemperatures` (individual core temps)
- `chipName`, `isMonitoring`, `isSensorConnected`
- `lastUpdate` timestamp

### 3. ProcessService.swift
**Location:** `OptaNative/OptaNative/Services/ProcessService.swift`

BSD-based process enumeration for Stealth Mode:
- Uses `proc_listallpids`, `proc_pidinfo` (PROC_PIDTBSDINFO, PROC_PIDTASKINFO)
- Returns `ProcessInfo` structs with PID, name, user, CPU/memory usage
- Categorizes processes for Stealth Mode: `essential`, `user`, `background`, `bloatware`
- Pre-defined lists of essential and bloatware process names
- Sorted by CPU usage (descending) by default

Key methods:
- `getRunningProcesses()` - all processes sorted by CPU
- `getProcessInfo(pid:)` - single process details
- `getProcesses(category:)` - filtered by category
- `getStealthModeCandidates()` - bloatware + high-memory background
- `getTopProcessesByCPU(count:)`, `getTopProcessesByMemory(count:)`

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `TelemetryService.swift` | ~230 | Actor-based hardware telemetry collector |
| `TelemetryViewModel.swift` | ~190 | SwiftUI-observable view model |
| `ProcessService.swift` | ~320 | BSD process enumeration service |

## Xcode Project Updates

Added file references and build phase entries to `OptaNative.xcodeproj/project.pbxproj`:
- Services group: TelemetryService.swift, ProcessService.swift
- ViewModels group: TelemetryViewModel.swift

## Issues Encountered

1. **PROC_PIDPATHINFO_MAXSIZE unavailable** - The macro was marked unavailable in the macOS 26.2 SDK. Resolved by using `MAXPATHLEN * 4` directly (which is the macro's definition).

## Verification

- [x] `xcodebuild -scheme OptaNative build` succeeds
- [x] TelemetryService compiles with actor isolation
- [x] TelemetryViewModel uses @Observable correctly
- [x] ProcessService uses BSD proc_* APIs
- [x] All three files added to Xcode project and compile

## Architecture Notes

### Thread Safety
- `TelemetryService` is an actor - all access is isolated
- `TelemetryViewModel` is `@MainActor` - UI updates always on main thread
- `TelemetrySnapshot` is `Sendable` for safe cross-actor transfer
- `ProcessService` is `@unchecked Sendable` (read-only operations)

### Integration Points
- `TelemetryService` uses `SensorReader` from Plan 19-02
- `TelemetryViewModel` uses `ChipDetection` for chip name
- `ProcessService` works standalone, categories support Stealth Mode UI

### Performance Considerations
- 1-second polling interval (sufficient for monitoring per research)
- CPU usage delta calculation requires previous sample
- Process enumeration allocates 4096-PID buffer (typical systems have <500 processes)

## Ready For

- Plan 19-06: MenuBar View (uses TelemetryViewModel)
- Plan 19-07: Dashboard View (uses TelemetryViewModel, ProcessService)
- Plan 19-08: Stealth Mode (uses ProcessService for candidates)
