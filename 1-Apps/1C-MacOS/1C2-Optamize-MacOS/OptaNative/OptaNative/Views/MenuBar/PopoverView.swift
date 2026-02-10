//
//  PopoverView.swift
//  OptaNative
//
//  Enhanced menu bar popover with context-aware content,
//  holographic system visualization, and pin/transient behavior.
//  Created for Opta Native macOS - Plan 20-09
//

import SwiftUI

// MARK: - System State

/// Represents the current system load state for context-aware UI
enum SystemState {
    case idle
    case busy
    case critical

    /// Determine system state from metrics
    static func from(cpuUsage: Double, memoryPercent: Double) -> SystemState {
        if cpuUsage > 90 || memoryPercent > 90 { return .critical }
        if cpuUsage > 60 || memoryPercent > 70 { return .busy }
        return .idle
    }

    /// Primary action label based on state
    var actionTitle: String {
        switch self {
        case .idle: return "Deep Clean"
        case .busy: return "Quick Optimize"
        case .critical: return "Emergency Cleanup"
        }
    }

    /// Action subtitle describing the action
    var actionSubtitle: String {
        switch self {
        case .idle: return "Thorough system optimization"
        case .busy: return "Optimize for current workload"
        case .critical: return "Free up resources immediately"
        }
    }

    /// Action icon based on state
    var actionIcon: String {
        switch self {
        case .idle: return "sparkles"
        case .busy: return "bolt.fill"
        case .critical: return "exclamationmark.triangle.fill"
        }
    }

    /// Action color based on state
    var actionColor: Color {
        switch self {
        case .idle: return Color.optaAccent
        case .busy: return Color.optaWarning
        case .critical: return Color.optaDanger
        }
    }
}

// MARK: - Momentum State

/// Represents the visual momentum state for logo animation
enum MomentumColor {
    case idle
    case active
    case critical
}

struct MomentumState {
    let color: MomentumColor
    let rotationSpeed: Double

    static func from(cpuUsage: Double, memoryPercent: Double) -> MomentumState {
        let load = max(cpuUsage, memoryPercent)

        if load > 85 {
            return MomentumState(color: .critical, rotationSpeed: 3.0)
        } else if load > 50 {
            return MomentumState(color: .active, rotationSpeed: 2.0)
        } else {
            return MomentumState(color: .idle, rotationSpeed: 1.0)
        }
    }
}

// MARK: - Enhanced Popover View

/// Enhanced menu bar popover with holographic visualization and context-aware actions
struct PopoverView: View {
    @Environment(TelemetryViewModel.self) private var telemetry
    @AppStorage("popoverPinned") private var isPinned: Bool = false
    @State private var showingHolographic: Bool = true

    /// Current system state based on telemetry
    private var systemState: SystemState {
        SystemState.from(
            cpuUsage: telemetry.cpuUsage,
            memoryPercent: telemetry.memoryPercent
        )
    }

    /// Current momentum state for animations
    private var momentum: MomentumState {
        MomentumState.from(
            cpuUsage: telemetry.cpuUsage,
            memoryPercent: telemetry.memoryPercent
        )
    }

    var body: some View {
        ZStack {
            // Glass background for native macOS aesthetic
            GlassBackground(
                material: .hudWindow,
                blendingMode: .behindWindow,
                cornerRadius: 12
            )

            VStack(spacing: 0) {
                // Header with logo and pin button
                PopoverHeader(
                    isPinned: $isPinned,
                    momentum: momentum,
                    chipName: telemetry.chipName
                )

                Divider()
                    .background(Color.optaBorder.opacity(0.5))

                // Main content area
                ScrollView {
                    VStack(spacing: 16) {
                        // Holographic System View (toggleable)
                        if showingHolographic {
                            SystemOrbitalView(
                                cpuUsage: telemetry.cpuUsage,
                                memoryPercent: telemetry.memoryPercent,
                                processes: []
                            )
                            .frame(height: 200)
                            .transition(.opacity.combined(with: .scale(scale: 0.95)))
                        }

                        // Quick Stats
                        QuickStatsSection(telemetry: telemetry)

                        Divider()
                            .background(Color.optaBorder.opacity(0.3))

                        // Context-aware Actions
                        QuickActionsSection(systemState: systemState)
                    }
                    .padding()
                }
            }
        }
        .frame(width: 320, height: showingHolographic ? 620 : 480)
        .onAppear {
            NSLog("[PopoverView] Popover appeared")
            telemetry.startMonitoring()
        }
        .onDisappear {
            telemetry.stopMonitoring()
        }
        .animation(.spring(response: 0.3), value: showingHolographic)
    }
}

// MARK: - Popover Header

struct PopoverHeader: View {
    @Binding var isPinned: Bool
    let momentum: MomentumState
    let chipName: String

    var body: some View {
        HStack(spacing: 12) {
            // Animated Logo
            AnimatedLogoView(momentum: momentum)
                .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text("Opta")
                    .font(.optaH3)
                    .foregroundStyle(Color.optaForeground)

                Text(chipName)
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }

            Spacer()

            // Pin button
            Button(action: { isPinned.toggle() }) {
                Image(systemName: isPinned ? "pin.fill" : "pin")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(isPinned ? Color.optaPrimary : Color.optaMutedForeground)
                    .rotationEffect(.degrees(isPinned ? 0 : 45))
                    .animation(.spring(response: 0.3), value: isPinned)
            }
            .buttonStyle(.plain)
            .help(isPinned ? "Unpin popover" : "Pin popover")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// MARK: - Animated Logo View

/// Logo with state-based animation reflecting system momentum
struct AnimatedLogoView: View {
    let momentum: MomentumState
    @State private var rotationAngle: Double = 0
    @State private var glowOpacity: Double = 0.3

    private var logoColor: Color {
        switch momentum.color {
        case .idle: return Color.optaPrimary
        case .active: return Color.optaAccent
        case .critical: return Color.optaDanger
        }
    }

    var body: some View {
        ZStack {
            // Outer glow ring
            Circle()
                .stroke(logoColor.opacity(glowOpacity), lineWidth: 2)
                .blur(radius: 3)

            // Inner rotating ring
            Circle()
                .trim(from: 0, to: 0.7)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [logoColor.opacity(0.1), logoColor, logoColor.opacity(0.1)]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                )
                .rotationEffect(.degrees(rotationAngle))

            // Center icon
            Image(systemName: "bolt.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(
                    LinearGradient(
                        colors: [logoColor, logoColor.opacity(0.7)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        }
        .onAppear {
            startAnimations()
        }
        .onChange(of: momentum.rotationSpeed) { _, _ in
            startAnimations()
        }
    }

    private func startAnimations() {
        // Rotation animation based on momentum
        withAnimation(
            .linear(duration: 2.0 / momentum.rotationSpeed)
            .repeatForever(autoreverses: false)
        ) {
            rotationAngle = 360
        }

        // Pulsing glow
        withAnimation(
            .easeInOut(duration: 1.5 / momentum.rotationSpeed)
            .repeatForever(autoreverses: true)
        ) {
            glowOpacity = 0.6
        }
    }
}

// MARK: - Quick Stats Section

struct QuickStatsSection: View {
    let telemetry: TelemetryViewModel

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                CircularGauge(
                    value: telemetry.cpuUsage / 100,
                    label: "CPU",
                    valueText: String(format: "%.0f", telemetry.cpuUsage),
                    color: severityColor(for: telemetry.cpuUsage)
                )

                CircularGauge(
                    value: telemetry.memoryPercent / 100,
                    label: "MEM",
                    valueText: String(format: "%.0f", telemetry.memoryPercent),
                    color: severityColor(for: telemetry.memoryPercent)
                )

                if telemetry.cpuTemperature > 0 {
                    CircularGauge(
                        value: min(telemetry.cpuTemperature / 100, 1.0),
                        label: "TEMP",
                        valueText: String(format: "%.0f°", telemetry.cpuTemperature),
                        color: temperatureColor(for: telemetry.cpuTemperature)
                    )
                }
            }
        }
    }

    private func severityColor(for value: Double) -> Color {
        if value >= 85 { return Color.optaDanger }
        if value >= 60 { return Color.optaWarning }
        return Color.optaSuccess
    }

    private func temperatureColor(for temp: Double) -> Color {
        if temp >= 80 { return Color.optaDanger }
        if temp >= 60 { return Color.optaWarning }
        return Color.optaSuccess
    }
}

// MARK: - Circular Gauge

struct CircularGauge: View {
    let value: Double
    let label: String
    let valueText: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Background ring
                Circle()
                    .stroke(Color.optaMuted, lineWidth: 4)
                    .frame(width: 50, height: 50)

                // Progress ring
                Circle()
                    .trim(from: 0, to: min(value, 1.0))
                    .stroke(
                        color,
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .frame(width: 50, height: 50)
                    .rotationEffect(.degrees(-90))
                    .shadow(color: color.opacity(0.5), radius: 4)
                    .animation(.spring(response: 0.5), value: value)

                // Value text
                Text(valueText)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color.optaForeground)
            }

            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(Color.optaMutedForeground)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Quick Actions Section

struct QuickActionsSection: View {
    let systemState: SystemState
    @State private var isOptimizing: Bool = false
    @AppStorage("launchAtLogin") private var launchAtLogin: Bool = false

    var body: some View {
        VStack(spacing: 12) {
            // Primary context-aware action
            ContextActionButton(
                title: systemState.actionTitle,
                subtitle: systemState.actionSubtitle,
                icon: systemState.actionIcon,
                color: systemState.actionColor,
                isLoading: isOptimizing
            ) {
                performAction()
            }

            // Secondary actions
            HStack(spacing: 12) {
                SmallActionButton(icon: "macwindow", label: "Dashboard") {
                    openDashboard()
                }

                SmallActionButton(icon: "gear", label: "Settings") {
                    openSettings()
                }

                SmallActionButton(icon: "arrow.clockwise", label: "Restart") {
                    restartApp()
                }

                SmallActionButton(icon: "power", label: "Quit") {
                    quitApp()
                }
            }

            Divider()
                .background(Color.optaBorder.opacity(0.3))

            // Launch at Login toggle
            HStack {
                Image(systemName: launchAtLogin ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(launchAtLogin ? Color.optaSuccess : Color.optaMutedForeground)
                    .font(.system(size: 14))

                Text("Launch at Login")
                    .font(.system(size: 12))
                    .foregroundColor(Color.optaForeground)

                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.optaMuted.opacity(0.3))
            .cornerRadius(6)
            .onTapGesture {
                launchAtLogin.toggle()
                AppLaunchManager.shared.setLaunchAtLogin(launchAtLogin)
            }

            // Opta Hub - Launch companion apps
            OptaHubSection()
        }
    }

    private func performAction() {
        isOptimizing = true
        // Simulate action (replace with actual IPC call)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            isOptimizing = false
        }
    }

    private func openDashboard() {
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first(where: { !$0.title.isEmpty }) {
            window.makeKeyAndOrderFront(nil)
        }
    }

    private func openSettings() {
        // Open settings in main app
        openDashboard()
    }

    private func restartApp() {
        NSLog("[QuickActions] Restart button pressed")
        AppLaunchManager.shared.restartApp()
    }

    private func quitApp() {
        NSLog("[QuickActions] Quit button pressed")
        NSApp.terminate(nil)
    }
}

// MARK: - Opta Hub Section

struct OptaHubSection: View {
    @State private var lifeManagerStatus: AppStatus = .unknown

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "square.grid.2x2")
                    .font(.system(size: 12))
                    .foregroundColor(Color.optaPrimary)

                Text("Opta Hub")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color.optaMutedForeground)
                    .textCase(.uppercase)

                Spacer()
            }

            // Opta Life Manager
            CompanionAppRow(
                name: "Life Manager",
                icon: "calendar.badge.clock",
                status: lifeManagerStatus,
                onLaunch: { launchLifeManager() },
                onOpen: { openLifeManagerInBrowser() }
            )
        }
        .padding(10)
        .background(Color.optaMuted.opacity(0.2))
        .cornerRadius(8)
        .onAppear {
            checkLifeManagerStatus()
        }
    }

    private func checkLifeManagerStatus() {
        NSLog("[OptaHub] Checking Life Manager status...")
        Task {
            lifeManagerStatus = await AppLaunchManager.shared.checkLifeManagerStatus()
            NSLog("[OptaHub] Status check result: \(lifeManagerStatus)")
        }
    }

    private func launchLifeManager() {
        NSLog("[OptaHub] Launch Life Manager button pressed")
        Task {
            lifeManagerStatus = .launching
            let success = await AppLaunchManager.shared.launchLifeManager()
            NSLog("[OptaHub] Launch result: \(success)")
            lifeManagerStatus = success ? .running : .stopped
        }
    }

    private func openLifeManagerInBrowser() {
        NSLog("[OptaHub] Opening Life Manager in browser...")

        // Direct shell open is most reliable
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        task.arguments = ["http://localhost:3000"]

        do {
            try task.run()
            task.waitUntilExit()
            NSLog("[OptaHub] Open command executed")
        } catch {
            NSLog("[OptaHub] Open failed: \(error)")
        }
    }
}

// MARK: - Companion App Row

enum AppStatus {
    case unknown
    case running
    case stopped
    case launching
}

struct CompanionAppRow: View {
    let name: String
    let icon: String
    let status: AppStatus
    let onLaunch: () -> Void
    let onOpen: () -> Void

    @State private var isHovered = false

    private var statusColor: Color {
        switch status {
        case .running: return Color.optaSuccess
        case .stopped: return Color.optaDanger
        case .launching: return Color.optaWarning
        case .unknown: return Color.optaMutedForeground
        }
    }

    private var statusText: String {
        switch status {
        case .running: return "Running"
        case .stopped: return "Stopped"
        case .launching: return "Starting..."
        case .unknown: return "Checking..."
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(Color.optaPrimary)
                .frame(width: 24)

            // Name & Status
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.optaForeground)

                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 6, height: 6)

                    Text(statusText)
                        .font(.system(size: 10))
                        .foregroundColor(Color.optaMutedForeground)
                }
            }

            Spacer()

            // Actions
            if status == .running {
                Button {
                    NSLog("[CompanionAppRow] Open button clicked")
                    onOpen()
                } label: {
                    Image(systemName: "arrow.up.forward.square")
                        .font(.system(size: 14))
                        .foregroundColor(Color.optaPrimary)
                        .padding(8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .help("Open in browser")
            } else if status == .launching {
                ProgressView()
                    .scaleEffect(0.6)
            } else {
                Button {
                    NSLog("[CompanionAppRow] Launch button clicked for \(name)")
                    onLaunch()
                } label: {
                    Image(systemName: "play.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.white)
                        .padding(6)
                        .background(Color.optaPrimary)
                        .clipShape(Circle())
                }
                .buttonStyle(.borderless)
                .help("Launch \(name)")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(isHovered ? Color.optaMuted.opacity(0.5) : Color.clear)
        .cornerRadius(6)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - App Launch Manager

@MainActor
class AppLaunchManager {
    static let shared = AppLaunchManager()

    private init() {}

    /// Restart the Opta Mini app
    func restartApp() {
        let executablePath = Bundle.main.executablePath!
        let task = Process()
        task.launchPath = "/bin/bash"
        task.arguments = ["-c", "sleep 1 && open '\(Bundle.main.bundlePath)'"]

        do {
            try task.run()
        } catch {
            print("[AppLaunchManager] Failed to schedule restart: \(error)")
        }

        // Quit current instance
        NSApp.terminate(nil)
    }

    /// Set launch at login
    func setLaunchAtLogin(_ enabled: Bool) {
        // Use SMAppService for modern macOS login item management
        // This is a simplified version - production should use SMAppService
        let script: String
        if enabled {
            script = """
            tell application "System Events"
                make login item at end with properties {path:"\(Bundle.main.bundlePath)", hidden:false}
            end tell
            """
        } else {
            script = """
            tell application "System Events"
                delete login item "\(Bundle.main.bundleIdentifier ?? "OptaNative")"
            end tell
            """
        }

        if let appleScript = NSAppleScript(source: script) {
            var error: NSDictionary?
            appleScript.executeAndReturnError(&error)
            if let error = error {
                print("[AppLaunchManager] AppleScript error: \(error)")
            }
        }
    }

    /// Check if Opta Life Manager is running
    func checkLifeManagerStatus() async -> AppStatus {
        // Check if the Next.js dev server is running on port 3000
        guard let url = URL(string: "http://localhost:3000") else {
            return .stopped
        }

        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                return .running
            }
        } catch {
            // Not running or error
        }

        return .stopped
    }

    /// Launch Opta Life Manager
    func launchLifeManager() async -> Bool {
        // Path to the Life Manager project
        let lifeManagerPath = NSString(string: "~/Documents/Opta/opta-life-manager").expandingTildeInPath

        // Check if directory exists
        guard FileManager.default.fileExists(atPath: lifeManagerPath) else {
            print("[AppLaunchManager] Life Manager not found at \(lifeManagerPath)")
            return false
        }

        // Launch using npm run dev in background
        let task = Process()
        task.launchPath = "/bin/bash"
        task.arguments = ["-c", "cd '\(lifeManagerPath)' && /opt/homebrew/bin/npm run dev &"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            // Wait a bit for server to start
            try await Task.sleep(nanoseconds: 3_000_000_000)
            return await checkLifeManagerStatus() == .running
        } catch {
            print("[AppLaunchManager] Failed to launch Life Manager: \(error)")
            return false
        }
    }
}

// MARK: - Context Action Button

struct ContextActionButton: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let isLoading: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            ZStack {
                // Chromatic loading effect overlay
                if isLoading {
                    ChromaticLoadingEffect()
                }

                HStack(spacing: 12) {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                            .frame(width: 24, height: 24)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 18))
                            .foregroundColor(color)
                            .frame(width: 24, height: 24)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color.optaForeground)

                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundColor(Color.optaMutedForeground)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundColor(Color.optaMutedForeground)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(color.opacity(isHovered ? 0.2 : 0.1))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(color.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.15), value: isHovered)
    }
}

// MARK: - Small Action Button

struct SmallActionButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(isHovered ? Color.optaPrimary : Color.optaForeground)

                Text(label)
                    .font(.system(size: 10))
                    .foregroundColor(Color.optaMutedForeground)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.optaMuted.opacity(isHovered ? 0.8 : 0.5))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.15), value: isHovered)
    }
}

// MARK: - Preview

#Preview("PopoverView") {
    PopoverView()
        .environment(TelemetryViewModel.preview)
        .frame(width: 320, height: 520)
}

#Preview("PopoverHeader") {
    ZStack {
        Color.optaBackground

        PopoverHeader(
            isPinned: .constant(false),
            momentum: MomentumState(color: .active, rotationSpeed: 2.0),
            chipName: "M3 Pro"
        )
    }
    .frame(width: 320, height: 60)
}
