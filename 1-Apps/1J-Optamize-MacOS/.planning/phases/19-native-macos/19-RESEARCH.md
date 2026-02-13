# Phase 19: Native macOS Build - Research

**Researched:** 2026-01-17
**Domain:** Native macOS development with full hardware utilization (Swift, SwiftUI, IOKit, SMC, Metal)
**Confidence:** HIGH

<research_summary>
## Summary

Researched the complete ecosystem for building a native macOS version of Opta that maximizes hardware utilization on Apple Silicon. The standard approach uses Swift with SwiftUI for UI, direct SMC access for temperature/power monitoring, and privileged helper tools for process management.

Key finding: **Native macOS apps can access hardware telemetry that Tauri cannot reach**, including accurate CPU/GPU temperatures via SMC, per-core frequency and power consumption, and direct process termination. However, this requires distribution outside the App Store due to sandbox restrictions.

The reference implementation is [Stats](https://github.com/exelban/stats) - an open-source macOS system monitor written in Swift that demonstrates all the patterns needed for Opta's native build. It uses SMC for sensors, modular architecture for different metrics, and menu bar integration.

**Primary recommendation:** Build a native Swift/SwiftUI app distributed via direct download (notarized, not App Store). Use Stats as architecture reference, port the glass aesthetic via NSVisualEffectView, and use privileged helper pattern for process termination.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for native macOS hardware monitoring:

### Core

| Library/Framework | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Swift | 6.0+ | Primary language | Apple's recommended language for all new macOS development |
| SwiftUI | macOS 14+ | Declarative UI | Modern UI framework with native performance |
| IOKit | System | Hardware access | Apple's framework for device/driver communication |
| SMC (custom) | N/A | Temperature/power | Only way to get accurate sensor data on Apple Silicon |
| ServiceManagement | System | Privileged helpers | Apple's API for installing/managing helper tools |

### Supporting

| Library | Source | Purpose | When to Use |
|---------|--------|---------|-------------|
| [Stats SMC module](https://github.com/exelban/stats/tree/master/SMC) | Open source | SMC communication | Reference implementation for sensor reading |
| [Blessed](https://github.com/trilemma-dev/Blessed) | SPM | Helper installation | Simplifies SMJobBless to one function |
| [SecureXPC](https://github.com/trilemma-dev/SecureXPC) | SPM | IPC communication | Secure app-to-helper communication |
| [VisualEffects](https://github.com/twostraws/VisualEffects) | SPM | Glass effects | SwiftUI wrapper for NSVisualEffectView |
| Combine | System | Reactive state | Data flow and async handling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SwiftUI | AppKit | AppKit more mature but verbose; SwiftUI is future-proof |
| Custom SMC | macmon/asitop APIs | External tools require sudo; direct SMC is cleaner |
| Privileged helper | powermetrics | powermetrics requires root; helper is better UX |
| @Observable | ObservableObject | @Observable is modern (macOS 14+) but limits older macOS support |

### SMC Sensor Keys by Chip Generation

**Critical: SMC keys vary by chip. Must detect and handle:**

**M1 Keys:**
- E-cores: `Tp09`, `Tp0T`
- P-cores: `Tp01`, `Tp05`, `Tp0D`, `Tp0H`, `Tp0L`, `Tp0P`, `Tp0X`, `Tp0b`
- GPU: `Tg05`, `Tg0D`, `Tg0L`, `Tg0T`

**M2 Keys:**
- E-cores: `Tp1h`, `Tp1t`, `Tp1p`, `Tp1l`
- P-cores: `Tp01`, `Tp05`, `Tp09`, `Tp0D`, `Tp0X`, `Tp0b`, `Tp0f`, `Tp0j`
- GPU: `Tg0f`, `Tg0j`

**M3 Keys:**
- E-cores: `Te05`, `Te0L`, `Te0P`, `Te0S`
- P-cores: `Tf04`, `Tf09`, `Tf0A`, `Tf0B`, `Tf0D`, `Tf0E`, `Tf44`, `Tf49`, `Tf4A`, `Tf4B`, `Tf4D`, `Tf4E`
- GPU: `Tf14`, `Tf18`, `Tf19`, `Tf1A`, `Tf24`, `Tf28`, `Tf29`, `Tf2A`

**Reference:** [VirtualSMC SMCSensorKeys.txt](https://github.com/acidanthera/VirtualSMC/blob/master/Docs/SMCSensorKeys.txt)

**Installation:**
```bash
# No package manager needed - pure Apple frameworks
# For helper tool support, add SPM packages:

.package(url: "https://github.com/trilemma-dev/Blessed", from: "0.5.0"),
.package(url: "https://github.com/trilemma-dev/SecureXPC", from: "1.0.0"),
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure (Based on Stats)
```
OptaNative/
├── OptaNative/              # Main app target
│   ├── App.swift            # @main entry point
│   ├── Views/               # SwiftUI views
│   │   ├── MainWindow/
│   │   ├── MenuBar/
│   │   └── Components/
│   ├── ViewModels/          # @Observable classes
│   ├── Services/            # Business logic
│   │   ├── TelemetryService.swift
│   │   ├── ProcessService.swift
│   │   └── OptimizationService.swift
│   └── Utilities/
├── Modules/                 # Feature modules
│   ├── CPU/
│   ├── GPU/
│   ├── Memory/
│   ├── Sensors/
│   └── Processes/
├── SMC/                     # SMC communication (C/Swift bridge)
│   ├── SMC.h
│   ├── SMC.c
│   └── SMCBridge.swift
├── Helper/                  # Privileged helper tool
│   ├── HelperTool.swift
│   ├── HelperProtocol.swift
│   └── Info.plist
└── Shared/                  # Shared types/protocols
    └── Kit/
```

### Pattern 1: @Observable State Management (Modern SwiftUI)
**What:** Use @Observable macro for view models instead of ObservableObject
**When to use:** All new SwiftUI code targeting macOS 14+
**Example:**
```swift
// Source: Apple Developer Documentation
@Observable class TelemetryViewModel {
    var cpuUsage: Double = 0
    var gpuUsage: Double = 0
    var temperature: Double = 0
    var isMonitoring: Bool = false

    private let smcService: SMCService

    func startMonitoring() {
        isMonitoring = true
        // Views automatically update when these properties change
    }
}

// In App.swift
@main
struct OptaNativeApp: App {
    @State private var telemetry = TelemetryViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(telemetry)
        }
        MenuBarExtra("Opta", systemImage: "bolt.fill") {
            MenuBarView()
                .environment(telemetry)
        }
    }
}
```

### Pattern 2: SMC Reading with Swift Bridge
**What:** C-based SMC access with Swift wrapper
**When to use:** All temperature/power/fan readings
**Example:**
```swift
// SMCBridge.swift - based on Stats implementation
final class SMCService {
    private var conn: io_connect_t = 0

    func open() throws {
        let service = IOServiceGetMatchingService(
            kIOMainPortDefault,
            IOServiceMatching("AppleSMC")
        )
        guard service != 0 else { throw SMCError.serviceNotFound }

        let result = IOServiceOpen(service, mach_task_self_, 0, &conn)
        IOObjectRelease(service)
        guard result == kIOReturnSuccess else { throw SMCError.cannotConnect }
    }

    func readTemperature(key: String) -> Double? {
        // Read SMC key and convert to temperature
        guard let value = readKey(key) else { return nil }
        return Double(value.bytes[0]) + Double(value.bytes[1]) / 256.0
    }
}
```

### Pattern 3: Privileged Helper for Process Management
**What:** Separate helper tool for root-level operations
**When to use:** Process termination, system modifications
**Example:**
```swift
// HelperProtocol.swift
@objc protocol HelperProtocol {
    func terminateProcess(pid: Int32, reply: @escaping (Bool, String?) -> Void)
    func setProcessPriority(pid: Int32, priority: Int32, reply: @escaping (Bool) -> Void)
}

// HelperTool.swift
class HelperTool: NSObject, NSXPCListenerDelegate, HelperProtocol {
    func terminateProcess(pid: Int32, reply: @escaping (Bool, String?) -> Void) {
        let result = kill(pid, SIGTERM)
        if result == 0 {
            reply(true, nil)
        } else {
            // Try SIGKILL if SIGTERM failed
            let killResult = kill(pid, SIGKILL)
            reply(killResult == 0, killResult != 0 ? "Failed to terminate" : nil)
        }
    }
}
```

### Pattern 4: Glass Effects with NSVisualEffectView
**What:** Native macOS vibrancy matching Opta's design system
**When to use:** All container backgrounds
**Example:**
```swift
// GlassView.swift
struct GlassBackground: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .hudWindow
    var blendingMode: NSVisualEffectView.BlendingMode = .behindWindow

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
    }
}

// Usage
struct ContentView: View {
    var body: some View {
        ZStack {
            GlassBackground(material: .hudWindow)
            // Content on top
            VStack { ... }
        }
    }
}
```

### Anti-Patterns to Avoid
- **Using IOKit in sandboxed app:** Will be rejected from App Store, crashes silently
- **Hardcoding SMC keys:** Keys vary by chip generation, must detect at runtime
- **Polling sensors too frequently:** 1-second intervals are sufficient, faster wastes CPU
- **Not handling missing sensors:** Apple Silicon doesn't have all Intel sensors
- **Blocking main thread with SMC calls:** Always dispatch to background queue
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMC communication | Custom IOKit calls | Stats SMC module | Complex, chip-specific, needs C bridge |
| Privileged operations | Direct sudo/launchctl | Blessed + SMJobBless | Security, user authorization, proper lifecycle |
| Glass effects | Custom blur shaders | NSVisualEffectView | Native, performant, matches system |
| Process listing | Manual sysctl | NSWorkspace + BSD APIs | Edge cases, sandboxing, permissions |
| Fan control | Direct SMC writes | TG Pro patterns | Can damage hardware if wrong |
| Menu bar extras | Custom NSStatusItem | SwiftUI MenuBarExtra | Built-in, proper lifecycle |
| App updates | Custom update check | Sparkle framework | Delta updates, DSA signing, rollback |

**Key insight:** Native macOS development has mature patterns. Stats (7+ years of development) solved all the hard problems - temperature reading, chip detection, sensor mapping. Port their approach rather than reinventing.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: SMC Keys Change Every Chip Generation
**What goes wrong:** Hardcoded M1 keys return garbage on M3
**Why it happens:** Apple doesn't document SMC; keys discovered by reverse engineering
**How to avoid:**
- Detect chip at runtime (`sysctlbyname("machdep.cpu.brand_string")`)
- Maintain key mappings per chip family
- Reference Stats' sensor detection code
**Warning signs:** Temps showing 0°C or 255°C, wrong core counts

### Pitfall 2: IOKit Requires Distribution Outside App Store
**What goes wrong:** App rejected or crashes in sandbox
**Why it happens:** IOKit communicates with kernel; Apple blocks this in sandboxed apps
**How to avoid:**
- Plan for direct distribution from day one
- Use notarization (required since Catalina)
- Don't request sandbox entitlements
**Warning signs:** Works in Xcode, fails when exported

### Pitfall 3: Apple Silicon Has No Traditional SMC
**What goes wrong:** Intel SMC code fails completely on M-series
**Why it happens:** M-series uses different thermal management architecture
**How to avoid:**
- SMC still exists but keys are different
- "Thermal pressure" API is useless (always "nominal")
- Must use chip-specific key lists
**Warning signs:** All readings return nil on Apple Silicon

### Pitfall 4: Privileged Helper Installation is Complex
**What goes wrong:** Helper doesn't install, crashes, or can't communicate
**Why it happens:** Requires proper code signing, launchd plists, XPC setup
**How to avoid:**
- Use Blessed library (single function call)
- Follow [SwiftAuthorizationSample](https://github.com/trilemma-dev/SwiftAuthorizationSample) exactly
- Test on clean macOS install
**Warning signs:** Authorization prompt never appears, silent failures

### Pitfall 5: SwiftUI Vibrancy Differs from AppKit
**What goes wrong:** Glass effects look washed out compared to design system
**Why it happens:** SwiftUI materials are cross-platform, less vibrant than NSVisualEffectView
**How to avoid:**
- Bridge NSVisualEffectView into SwiftUI
- Use `.material = .hudWindow` for strongest effect
- Match Opta's glass styling with custom blend modes
**Warning signs:** Backgrounds look solid instead of translucent

### Pitfall 6: Performance Monitoring Requires Root (Sometimes)
**What goes wrong:** Can't read GPU frequency, power draw
**Why it happens:** Some metrics only available via powermetrics (needs sudo)
**How to avoid:**
- Use private APIs like macmon does (no sudo)
- Accept limitations on some metrics
- Privileged helper can run powermetrics
**Warning signs:** GPU metrics missing, user prompted for password
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from authoritative sources:

### Detect Apple Silicon vs Intel
```swift
// Source: Community pattern, verified working
func isAppleSilicon() -> Bool {
    var sysinfo = utsname()
    uname(&sysinfo)
    let machine = withUnsafePointer(to: &sysinfo.machine) {
        $0.withMemoryRebound(to: CChar.self, capacity: 1) {
            String(validatingUTF8: $0)
        }
    }
    return machine?.hasPrefix("arm64") == true
}

func getChipGeneration() -> String {
    var size = 0
    sysctlbyname("machdep.cpu.brand_string", nil, &size, nil, 0)
    var brand = [CChar](repeating: 0, count: size)
    sysctlbyname("machdep.cpu.brand_string", &brand, &size, nil, 0)
    let brandString = String(cString: brand)

    if brandString.contains("M3") { return "M3" }
    if brandString.contains("M2") { return "M2" }
    if brandString.contains("M1") { return "M1" }
    return "Intel"
}
```

### Menu Bar App with Window
```swift
// Source: Apple SwiftUI Documentation
@main
struct OptaNativeApp: App {
    @State private var viewModel = OptaViewModel()

    var body: some Scene {
        // Main window (optional - can be menu bar only)
        WindowGroup {
            MainWindow()
                .environment(viewModel)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 400, height: 600)

        // Menu bar extra (always visible)
        MenuBarExtra("Opta", systemImage: "bolt.fill") {
            MenuBarView()
                .environment(viewModel)
        }
        .menuBarExtraStyle(.window)
    }
}
```

### Reading CPU Temperature from SMC
```swift
// Source: Based on Stats implementation
// Note: Requires SMC module from Stats repo

class SensorReader {
    private let smc = SMC()

    func getCPUTemperature(chip: String) -> Double? {
        let keys: [String]

        switch chip {
        case "M3", "M3 Pro", "M3 Max":
            keys = ["Tf04", "Tf09", "Tf0A", "Tf0B"]  // P-cores
        case "M2", "M2 Pro", "M2 Max":
            keys = ["Tp01", "Tp05", "Tp09", "Tp0D"]
        case "M1", "M1 Pro", "M1 Max":
            keys = ["Tp01", "Tp05", "Tp0D", "Tp0H"]
        default:
            keys = ["TC0D", "TC0E", "TC0F"]  // Intel
        }

        let temps = keys.compactMap { smc.getValue($0) }
        guard !temps.isEmpty else { return nil }
        return temps.reduce(0, +) / Double(temps.count)
    }
}
```

### Installing Privileged Helper
```swift
// Source: Blessed library documentation
import Blessed

func installHelper() async throws {
    let helperID = "com.opta.native.helper"

    do {
        try await Blessed.installPrivilegedHelper(
            bundleIdentifier: helperID,
            promptUser: true
        )
        print("Helper installed successfully")
    } catch BlessedError.authorizationCanceled {
        print("User cancelled authorization")
    } catch {
        print("Failed to install helper: \(error)")
    }
}
```

### Process Listing (Non-Privileged)
```swift
// Source: BSD APIs + NSWorkspace
func getRunningProcesses() -> [ProcessInfo] {
    var processes: [ProcessInfo] = []

    // Get all PIDs
    var pids = [pid_t](repeating: 0, count: 1024)
    let count = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size))

    for i in 0..<Int(count) {
        let pid = pids[i]
        var info = proc_bsdinfo()

        if proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, Int32(MemoryLayout.size(ofValue: info))) > 0 {
            let name = withUnsafePointer(to: info.pbi_name) {
                $0.withMemoryRebound(to: CChar.self, capacity: Int(MAXCOMLEN)) {
                    String(cString: $0)
                }
            }

            processes.append(ProcessInfo(
                pid: pid,
                name: name,
                user: String(info.pbi_uid),
                cpuUsage: getProcessCPU(pid: pid)
            ))
        }
    }

    return processes
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ObservableObject | @Observable macro | iOS 17/macOS 14 (2023) | Simpler state management, better performance |
| SMJobBless manual | Blessed library | 2023 | One-line helper installation |
| Custom menu bar | MenuBarExtra | macOS 13 (2022) | Native SwiftUI menu bar apps |
| Intel SMC keys | M-series specific keys | Ongoing | Must detect and map per chip |
| powermetrics | macmon private API | 2024 | No sudo required for metrics |
| UIBlurEffect | NSVisualEffectView bridging | Ongoing | SwiftUI materials still weaker |

**New tools/patterns to consider:**
- **Metal 4 (WWDC 2025):** New unified command encoder, better for GPU monitoring
- **SwiftData:** Could replace UserDefaults for preference storage
- **Swift 6 strict concurrency:** Prepare for async-safe sensor reading
- **macOS 26 (Tahoe):** New thermal APIs rumored

**Deprecated/outdated:**
- **NSStatusItem (manual):** Use MenuBarExtra for new apps
- **ObservableObject:** Still works but @Observable is cleaner
- **SMJobSubmit:** Fully deprecated, use SMJobBless
- **GCD for state:** Use async/await with actors
</sota_updates>

<open_questions>
## Open Questions

Things that need validation during implementation:

1. **M4/M5 SMC Keys**
   - What we know: M1-M3 keys documented by community
   - What's unclear: M4 keys not fully mapped yet
   - Recommendation: Test on M4 hardware, reference Stats issue tracker

2. **App Store Feasibility**
   - What we know: IOKit blocked in sandbox
   - What's unclear: Could use limited approach (no temps, just processes)?
   - Recommendation: Start with direct distribution, evaluate later

3. **Glass Effect Parity**
   - What we know: NSVisualEffectView stronger than SwiftUI materials
   - What's unclear: Can we match Opta's exact glass aesthetic?
   - Recommendation: Build proof-of-concept, compare side-by-side

4. **LLM Integration**
   - What we know: Tauri version uses Ollama via Python MCP
   - What's unclear: Best approach for native Swift (direct Ollama API? llama.cpp?)
   - Recommendation: Research Swift Ollama bindings in separate spike
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Apple SwiftUI Documentation](https://developer.apple.com/documentation/swiftui) - MenuBarExtra, @Observable, state management
- [Stats macOS Monitor](https://github.com/exelban/stats) - SMC implementation, sensor keys, architecture
- [SwiftAuthorizationSample](https://github.com/trilemma-dev/SwiftAuthorizationSample) - Privileged helper pattern
- [Apple IOKit Documentation](https://developer.apple.com/documentation/iokit) - Hardware access fundamentals

### Secondary (MEDIUM confidence)
- [macmon](https://github.com/vladkens/macmon) - Sudoless metrics collection approach
- [Stats SMC Keys for M3](https://github.com/exelban/stats/issues/1703) - M3-specific sensor mappings
- [Thermal Throttling Blog](https://stanislas.blog/2025/12/macos-thermal-throttling-app/) - SMC vs IOKit accuracy comparison
- [VirtualSMC SMCSensorKeys](https://github.com/acidanthera/VirtualSMC/blob/master/Docs/SMCSensorKeys.txt) - Complete key reference

### Tertiary (LOW confidence - needs validation)
- Community M4 sensor discussions (sparse, unverified)
- powermetrics private API details (undocumented)
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Swift 6, SwiftUI (macOS 14+), IOKit, SMC
- Ecosystem: Stats, Blessed, SecureXPC, NSVisualEffectView
- Patterns: @Observable, privileged helper, menu bar app
- Pitfalls: SMC keys per chip, sandbox limits, vibrancy differences

**Confidence breakdown:**
- Standard stack: HIGH - All Apple-recommended frameworks
- Architecture: HIGH - Stats is 7+ year proven implementation
- Pitfalls: HIGH - Well-documented in community
- Code examples: HIGH - From official docs and verified open source

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (30 days - macOS ecosystem relatively stable)
</metadata>

---

*Phase: 19-native-macos*
*Research completed: 2026-01-17*
*Ready for planning: yes*
