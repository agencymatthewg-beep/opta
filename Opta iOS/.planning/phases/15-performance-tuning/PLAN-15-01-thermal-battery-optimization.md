# Plan 15-01: Thermal & Battery Optimization

## Overview

**Phase**: 15 - Performance Tuning
**Plan**: 01 of 02
**Goal**: Comprehensive thermal monitoring, battery optimization, and adaptive performance system

## Research Compliance

This plan is directly informed by Gemini Deep Research documents:
- `iOS/Distribution/iOS-App-Store-Compliance-wgpu.md` - Thermal state management, power efficiency
- `iOS/AI-ML/AI Optimization for iOS Apps.md` - Battery impact assessment, A19 Pro optimization

### Critical Requirements Addressed

1. **Thermal Monitoring**: Real-time `ProcessInfo.thermalState` subscription with quality degradation
2. **Battery Optimization**: Reduce GPU load during charging, low power mode detection
3. **Adaptive Rendering**: Quality tiers (high/medium/minimal) based on device conditions
4. **Device Detection**: Optimize for A19 Pro capabilities on iPhone 17 Pro

## Context

The app uses Metal shaders, animations, and AI processing that impact battery life. This plan creates a unified performance management system that:
- Monitors thermal state in real-time
- Detects low power mode and battery level
- Adapts rendering quality automatically
- Profiles and optimizes bottlenecks

**Current state**: Basic ThermalMonitor from Phase 10 (shader-focused)
**Target state**: Comprehensive PerformanceManager for all app systems

## Dependencies

- Phase 10 complete (Metal shaders with thermal-aware rendering)
- Phase 14 complete (all animations implemented)
- `ThermalMonitor.swift` exists (from Plan 10-01)

## Tasks

### Task 1: Create Unified PerformanceManager

**Purpose**: Single source of truth for all performance-related state.

Create `Opta Scan/Core/PerformanceManager.swift`:

```swift
//
//  PerformanceManager.swift
//  Opta Scan
//
//  Unified performance monitoring and adaptive quality management
//  Part of Phase 15: Performance Tuning - Research Compliance
//
//  Reference: iOS/Distribution/iOS-App-Store-Compliance-wgpu.md
//  Reference: iOS/AI-ML/AI Optimization for iOS Apps.md
//

import SwiftUI
import Combine

/// Performance quality tier for adaptive rendering
enum PerformanceQuality: Int, Comparable, CaseIterable {
    case ultra = 4     // Maximum quality (A19 Pro, cool, plugged in)
    case high = 3      // Full quality (60fps, all effects)
    case medium = 2    // Reduced quality (30fps, simplified effects)
    case low = 1       // Minimal quality (static, essential only)

    static func < (lhs: PerformanceQuality, rhs: PerformanceQuality) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var targetFrameRate: Double {
        switch self {
        case .ultra: return 120  // ProMotion
        case .high: return 60
        case .medium: return 30
        case .low: return 15
        }
    }

    var enableShaders: Bool {
        self >= .medium
    }

    var enableAnimations: Bool {
        self >= .low
    }

    var enableParticles: Bool {
        self >= .high
    }
}

/// Centralized performance state and quality management
@MainActor
final class PerformanceManager: ObservableObject {
    static let shared = PerformanceManager()

    // MARK: - Published State

    /// Current recommended quality tier
    @Published private(set) var quality: PerformanceQuality = .high

    /// Current thermal state
    @Published private(set) var thermalState: ProcessInfo.ThermalState = .nominal

    /// Whether device is in Low Power Mode
    @Published private(set) var isLowPowerMode: Bool = false

    /// Current battery level (0-1)
    @Published private(set) var batteryLevel: Float = 1.0

    /// Whether device is charging
    @Published private(set) var isCharging: Bool = false

    /// Whether device supports ProMotion (120Hz)
    let supportsProMotion: Bool

    /// Whether device has A-series Pro chip (A15 Pro, A16 Pro, A17 Pro, A18 Pro, A19 Pro)
    let hasProChip: Bool

    // MARK: - Private State

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        // Detect device capabilities
        self.supportsProMotion = Self.detectProMotion()
        self.hasProChip = Self.detectProChip()

        // Initial battery state
        UIDevice.current.isBatteryMonitoringEnabled = true
        updateBatteryState()

        // Subscribe to system notifications
        setupNotifications()

        // Calculate initial quality
        updateQuality()
    }

    // MARK: - Notification Setup

    private func setupNotifications() {
        // Thermal state changes
        NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.thermalState = ProcessInfo.processInfo.thermalState
                self?.updateQuality()
            }
            .store(in: &cancellables)

        // Low Power Mode changes
        NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
                self?.updateQuality()
            }
            .store(in: &cancellables)

        // Battery state changes
        NotificationCenter.default.publisher(for: UIDevice.batteryStateDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updateBatteryState()
                self?.updateQuality()
            }
            .store(in: &cancellables)

        // Battery level changes
        NotificationCenter.default.publisher(for: UIDevice.batteryLevelDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updateBatteryState()
                self?.updateQuality()
            }
            .store(in: &cancellables)

        // Initial thermal state
        thermalState = ProcessInfo.processInfo.thermalState
        isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
    }

    private func updateBatteryState() {
        batteryLevel = UIDevice.current.batteryLevel
        isCharging = UIDevice.current.batteryState == .charging ||
                     UIDevice.current.batteryState == .full
    }

    // MARK: - Quality Calculation

    private func updateQuality() {
        let newQuality = calculateQuality()
        if newQuality != quality {
            quality = newQuality
        }
    }

    private func calculateQuality() -> PerformanceQuality {
        // Critical thermal: Always minimal
        if thermalState == .critical {
            return .low
        }

        // Low Power Mode: Cap at medium
        if isLowPowerMode {
            return thermalState == .serious ? .low : .medium
        }

        // Serious thermal: Medium
        if thermalState == .serious {
            return .medium
        }

        // Low battery (< 20%): Cap at high
        if batteryLevel < 0.2 && !isCharging {
            return .high
        }

        // Optimal conditions: Ultra if supported
        if thermalState == .nominal && isCharging && hasProChip && supportsProMotion {
            return .ultra
        }

        // Default: High
        return .high
    }

    // MARK: - Device Detection

    private static func detectProMotion() -> Bool {
        // Check if device supports adaptive refresh rate
        // iPhone 13 Pro+, iPad Pro (2017+)
        return UIScreen.main.maximumFramesPerSecond >= 120
    }

    private static func detectProChip() -> Bool {
        // Detect Pro-series iPhone (has ProMotion + advanced Neural Engine)
        // This is a proxy: Pro iPhones have 120Hz displays
        return UIScreen.main.maximumFramesPerSecond >= 120
    }
}

// MARK: - SwiftUI Environment Integration

private struct PerformanceQualityKey: EnvironmentKey {
    static let defaultValue: PerformanceQuality = .high
}

extension EnvironmentValues {
    var performanceQuality: PerformanceQuality {
        get { self[PerformanceQualityKey.self] }
        set { self[PerformanceQualityKey.self] = newValue }
    }
}

// MARK: - View Modifier

struct PerformanceAwareModifier: ViewModifier {
    @ObservedObject var manager = PerformanceManager.shared

    func body(content: Content) -> some View {
        content
            .environment(\.performanceQuality, manager.quality)
    }
}

extension View {
    /// Inject performance quality into environment
    func performanceAware() -> some View {
        modifier(PerformanceAwareModifier())
    }
}
```

**Integration in App**:

```swift
// In Opta_ScanApp.swift
@main
struct Opta_ScanApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .performanceAware()      // Inject performance state
                .precompileShaders()     // Async shader compilation
        }
    }
}
```

**Verification**:
- PerformanceManager correctly detects all device states
- Quality updates automatically when conditions change
- Environment value propagates to all views

### Task 2: Create Performance Dashboard View

**Purpose**: Debug view for monitoring performance state during development.

Create `Opta Scan/Views/Debug/PerformanceDashboard.swift`:

```swift
//
//  PerformanceDashboard.swift
//  Opta Scan
//
//  Debug dashboard for monitoring performance metrics
//  Part of Phase 15: Performance Tuning
//

import SwiftUI

struct PerformanceDashboard: View {
    @ObservedObject var performanceManager = PerformanceManager.shared
    @State private var frameRate: Double = 0
    @State private var cpuUsage: Double = 0

    var body: some View {
        NavigationStack {
            List {
                Section("Current Quality") {
                    qualityBadge
                    targetFrameRateRow
                }

                Section("Device State") {
                    thermalStateRow
                    batteryRow
                    powerModeRow
                }

                Section("Device Capabilities") {
                    proMotionRow
                    proChipRow
                }

                Section("Feature Availability") {
                    featureRow("Shaders", enabled: performanceManager.quality.enableShaders)
                    featureRow("Animations", enabled: performanceManager.quality.enableAnimations)
                    featureRow("Particles", enabled: performanceManager.quality.enableParticles)
                }
            }
            .navigationTitle("Performance")
        }
    }

    private var qualityBadge: some View {
        HStack {
            Text("Quality Tier")
            Spacer()
            Text(qualityLabel)
                .font(.headline)
                .foregroundStyle(qualityColor)
        }
    }

    private var qualityLabel: String {
        switch performanceManager.quality {
        case .ultra: return "Ultra"
        case .high: return "High"
        case .medium: return "Medium"
        case .low: return "Low"
        }
    }

    private var qualityColor: Color {
        switch performanceManager.quality {
        case .ultra: return .purple
        case .high: return .green
        case .medium: return .orange
        case .low: return .red
        }
    }

    private var targetFrameRateRow: some View {
        HStack {
            Text("Target Frame Rate")
            Spacer()
            Text("\(Int(performanceManager.quality.targetFrameRate)) fps")
                .foregroundStyle(.secondary)
        }
    }

    private var thermalStateRow: some View {
        HStack {
            Text("Thermal State")
            Spacer()
            HStack(spacing: 4) {
                Circle()
                    .fill(thermalColor)
                    .frame(width: 8, height: 8)
                Text(thermalLabel)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var thermalLabel: String {
        switch performanceManager.thermalState {
        case .nominal: return "Nominal"
        case .fair: return "Fair"
        case .serious: return "Serious"
        case .critical: return "Critical"
        @unknown default: return "Unknown"
        }
    }

    private var thermalColor: Color {
        switch performanceManager.thermalState {
        case .nominal: return .green
        case .fair: return .yellow
        case .serious: return .orange
        case .critical: return .red
        @unknown default: return .gray
        }
    }

    private var batteryRow: some View {
        HStack {
            Text("Battery")
            Spacer()
            HStack(spacing: 8) {
                Text("\(Int(performanceManager.batteryLevel * 100))%")
                    .foregroundStyle(.secondary)
                if performanceManager.isCharging {
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(.green)
                }
            }
        }
    }

    private var powerModeRow: some View {
        HStack {
            Text("Low Power Mode")
            Spacer()
            Text(performanceManager.isLowPowerMode ? "On" : "Off")
                .foregroundStyle(performanceManager.isLowPowerMode ? .orange : .secondary)
        }
    }

    private var proMotionRow: some View {
        HStack {
            Text("ProMotion (120Hz)")
            Spacer()
            Image(systemName: performanceManager.supportsProMotion ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(performanceManager.supportsProMotion ? .green : .secondary)
        }
    }

    private var proChipRow: some View {
        HStack {
            Text("Pro Chip (A15+)")
            Spacer()
            Image(systemName: performanceManager.hasProChip ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(performanceManager.hasProChip ? .green : .secondary)
        }
    }

    private func featureRow(_ name: String, enabled: Bool) -> some View {
        HStack {
            Text(name)
            Spacer()
            Text(enabled ? "Enabled" : "Disabled")
                .foregroundStyle(enabled ? .green : .red)
        }
    }
}

#Preview {
    PerformanceDashboard()
}
```

**Verification**:
- Dashboard displays all performance metrics
- Values update in real-time when state changes
- Accessible via debug menu

### Task 3: Integrate PerformanceManager with Shaders

**Purpose**: Replace Phase 10's ThermalMonitor with unified PerformanceManager.

Update shader and animation code to use `PerformanceManager.shared.quality`:

```swift
// Example: Update ThermalAwareAnimatedView to use PerformanceManager
@available(iOS 17.0, *)
struct PerformanceAwareAnimatedView<Content: View>: View {
    @ObservedObject var manager = PerformanceManager.shared
    @Environment(\.accessibilityReduceMotion) var reduceMotion

    let baseFrameRate: Double
    @ViewBuilder let content: (Double) -> Content

    var body: some View {
        if reduceMotion || manager.quality == .low {
            content(0)
        } else {
            TimelineView(.animation(minimumInterval: adaptedInterval, paused: false)) { timeline in
                content(timeline.date.timeIntervalSinceReferenceDate)
            }
        }
    }

    private var adaptedInterval: TimeInterval {
        1.0 / manager.quality.targetFrameRate
    }
}

// Example: Update obsidianGlass conditional rendering
extension View {
    @ViewBuilder
    func performanceAwareGlass(depth: GlassDepth) -> some View {
        let quality = PerformanceManager.shared.quality

        switch quality {
        case .ultra, .high:
            self.obsidianGlass(depth: depth.depth, noiseAmount: 0.5)
        case .medium:
            self.obsidianGlass(depth: depth.depth, noiseAmount: 0.0) // Skip noise
        case .low:
            self // Skip shader entirely, use standard background
                .background(Color.optaBackground.opacity(depth.depth))
        }
    }
}
```

**Verification**:
- Shaders use PerformanceManager quality level
- Animations adapt frame rate from PerformanceManager
- All features respect quality tier

### Task 4: Battery Impact Profiling

**Purpose**: Measure and document power consumption of app features.

Create profiling protocol and documentation:

```swift
//
//  BatteryProfiler.swift
//  Opta Scan
//
//  Battery impact measurement utilities
//  Part of Phase 15: Performance Tuning
//

import Foundation

/// Battery impact measurement for profiling sessions
struct BatteryProfileResult {
    let featureName: String
    let duration: TimeInterval
    let batteryDelta: Float
    let avgThermalState: String
    let timestamp: Date

    var estimatedHourlyDrain: Float {
        guard duration > 0 else { return 0 }
        return batteryDelta * (3600 / Float(duration))
    }
}

/// Simple battery profiler for development testing
final class BatteryProfiler {
    private var startBattery: Float = 0
    private var startTime: Date = Date()
    private var featureName: String = ""
    private var thermalReadings: [ProcessInfo.ThermalState] = []

    func startProfiling(feature: String) {
        UIDevice.current.isBatteryMonitoringEnabled = true
        featureName = feature
        startBattery = UIDevice.current.batteryLevel
        startTime = Date()
        thermalReadings = [ProcessInfo.processInfo.thermalState]
    }

    func recordThermalState() {
        thermalReadings.append(ProcessInfo.processinfo.thermalState)
    }

    func stopProfiling() -> BatteryProfileResult {
        let endBattery = UIDevice.current.batteryLevel
        let endTime = Date()

        // Calculate most common thermal state
        let avgThermal = thermalReadings
            .map { $0.rawValue }
            .reduce(0, +) / thermalReadings.count

        let thermalLabel: String = {
            switch avgThermal {
            case 0: return "Nominal"
            case 1: return "Fair"
            case 2: return "Serious"
            default: return "Critical"
            }
        }()

        return BatteryProfileResult(
            featureName: featureName,
            duration: endTime.timeIntervalSince(startTime),
            batteryDelta: startBattery - endBattery,
            avgThermalState: thermalLabel,
            timestamp: startTime
        )
    }
}
```

**Profiling Protocol**:

1. **Baseline Measurement**: App idle for 10 minutes
2. **Feature Isolation**: Test each feature independently
3. **Realistic Usage**: Simulate typical user session
4. **Record Results**: Document in performance benchmark file

**Verification**:
- Profiler captures accurate battery delta
- Results logged for analysis
- Identify features with highest battery impact

### Task 5: Instruments Profiling Workflow

**Purpose**: Document systematic approach to GPU/CPU profiling.

Create `.planning/phases/15-performance-tuning/PROFILING_GUIDE.md`:

```markdown
# Instruments Profiling Guide

## Setup

1. Connect physical device (simulator doesn't reflect real performance)
2. Disable Low Power Mode and Auto-Lock
3. Ensure battery > 80% and device is cool
4. Build for Release configuration (Debug has overhead)

## Core Instruments Templates

### 1. Time Profiler (CPU)
- Identify expensive functions
- Look for main thread blocking
- Target: < 5% CPU during idle, < 30% during active use

### 2. Core Animation (GPU)
- Measure frame rate and drops
- Identify off-screen rendering
- Target: 60fps sustained, no drops below 55fps

### 3. Metal System Trace (Shaders)
- Profile shader execution time
- Identify GPU bottlenecks
- Target: Shader execution < 8ms per frame

### 4. Energy Log (Battery)
- Measure power consumption by component
- Identify energy-intensive code paths
- Target: "Good" energy impact rating

## Profiling Sessions

### Session 1: Launch Performance
- Profile cold launch
- Target: < 2 seconds to interactive
- Watch for: Shader compilation, asset loading

### Session 2: Scroll Performance
- Profile history list scrolling
- Target: 60fps, no hitches
- Watch for: Image loading, cell recycling

### Session 3: Processing State
- Profile Claude API interaction
- Target: Smooth animation during wait
- Watch for: Main thread blocking

### Session 4: Shader Effects
- Profile glass effect rendering
- Target: < 8ms per frame
- Watch for: Overdraw, complex blend modes

## Recording Results

Document findings in:
`.planning/phases/15-performance-tuning/BENCHMARK_RESULTS.md`

Format:
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Launch time | < 2s | X.Xs | ✅/❌ |
| Scroll fps | 60 | XX | ✅/❌ |
```

**Verification**:
- Guide created and accessible
- Team can follow profiling workflow
- Results documented systematically

## Acceptance Criteria

### PerformanceManager
- [ ] Monitors thermal state, battery, low power mode
- [ ] Calculates quality tier based on all factors
- [ ] Environment integration for SwiftUI views
- [ ] Ultra tier enabled only with optimal conditions

### Integration
- [ ] All shaders use PerformanceManager quality
- [ ] All animations adapt frame rate from manager
- [ ] Particles disabled at medium quality and below
- [ ] Graceful degradation at each tier

### Profiling
- [ ] BatteryProfiler captures accurate measurements
- [ ] Instruments guide documented
- [ ] Benchmark results file created
- [ ] Key metrics meet targets:
  - Launch: < 2 seconds
  - Scroll: 60fps sustained
  - Idle CPU: < 5%
  - Active CPU: < 30%

### Battery Optimization
- [ ] Low Power Mode caps quality at medium
- [ ] Critical battery (< 10%) triggers low quality
- [ ] Charging + cool enables ultra quality

## Estimated Scope

- **Files created**: 3
  - `PerformanceManager.swift` - Unified performance state
  - `PerformanceDashboard.swift` - Debug monitoring view
  - `BatteryProfiler.swift` - Battery measurement utilities
- **Files modified**: 2-3 (shader/animation files to use PerformanceManager)
- **Documentation**: 2 (Profiling guide, benchmark results)
- **Complexity**: Medium (system integration, profiling workflow)
- **Risk**: Low (additive, existing code continues to work)

## Notes

### Research-Driven Design
- Thermal state monitoring from Apple's ProcessInfo API
- Battery optimization best practices from research docs
- Device capability detection for A-series Pro optimization

### Testing Recommendations
- Test on multiple devices (iPhone 13, 14, 15, 16, 17 series)
- Verify thermal degradation with extended use
- Confirm Low Power Mode behavior
- Profile on physical device, not simulator
