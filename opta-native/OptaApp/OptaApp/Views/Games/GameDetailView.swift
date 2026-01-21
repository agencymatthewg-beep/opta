//
//  GameDetailView.swift
//  OptaApp
//
//  Detail view for a single game with optimization profile management,
//  performance history chart, and quick actions.
//

import SwiftUI
import Charts

// MARK: - GameDetailView

/// Detail view for a selected game.
///
/// Sections:
/// - Hero: Large icon, name, platform, playtime stats
/// - Optimization: Profile settings, optimize now, edit profile
/// - Performance History: FPS chart over sessions, CPU/GPU stats
/// - Quick Actions: Launch, reset profile, view in Finder
struct GameDetailView: View {

    // MARK: - Environment

    @Environment(\.optaCoreManager) private var coreManager: OptaCoreManager?

    // MARK: - Properties

    /// The game to display (binding to allow updates)
    @Binding var game: Game

    /// Whether the profile editor sheet is shown
    @State private var showProfileEditor = false

    /// Whether the game is being launched
    @State private var isLaunching = false

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero section
                heroSection

                // Optimization section
                optimizationSection

                // Performance history section
                performanceHistorySection

                // Quick actions section
                quickActionsSection
            }
            .padding(20)
        }
        .background(Color(hex: "09090B"))
        .navigationTitle(game.name)
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button {
                    coreManager?.navigate(to: .games)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Library")
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(isPresented: $showProfileEditor) {
            ProfileEditorSheet(game: $game)
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        HStack(spacing: 20) {
            // Large icon
            Group {
                if let iconData = game.iconData,
                   let nsImage = NSImage(data: iconData) {
                    Image(nsImage: nsImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } else {
                    Image(systemName: "gamecontroller.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.white.opacity(0.3))
                        .frame(width: 100, height: 100)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.white.opacity(0.05))
                        )
                }
            }
            .frame(width: 100, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.3), radius: 8, y: 4)

            // Info
            VStack(alignment: .leading, spacing: 8) {
                // Name with optimized badge
                HStack(spacing: 8) {
                    Text(game.name)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(.white)

                    if game.isOptimized {
                        Label("Optimized", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "22C55E"))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color(hex: "22C55E").opacity(0.15))
                            )
                    }
                }

                // Platform
                HStack(spacing: 6) {
                    Image(systemName: game.platform.iconName)
                        .font(.system(size: 12))
                    Text(game.platform.displayName)
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(.white.opacity(0.6))

                // Stats row
                HStack(spacing: 20) {
                    statItem(label: "Playtime", value: game.formattedPlaytime)
                    statItem(label: "Last Played", value: game.lastPlayedRelative)

                    if let avgFps = game.averageFps {
                        statItem(label: "Avg FPS", value: String(format: "%.0f", avgFps))
                    }
                }
                .padding(.top, 4)
            }

            Spacer()
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private func statItem(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.5))
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Optimization Section

    private var optimizationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Optimization")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            HStack(spacing: 12) {
                // Profile card
                VStack(alignment: .leading, spacing: 12) {
                    // Current profile settings
                    if let profile = game.optimizationProfile {
                        VStack(alignment: .leading, spacing: 8) {
                            profileRow(icon: "dial.high.fill", label: "Quality", value: profile.qualityLevelName)

                            if !profile.processesToKill.isEmpty {
                                profileRow(
                                    icon: "xmark.app.fill",
                                    label: "Kill Processes",
                                    value: "\(profile.processesToKill.count) configured"
                                )
                            }

                            if let lastOptimized = profile.lastOptimizedAt {
                                profileRow(
                                    icon: "clock.fill",
                                    label: "Last Optimized",
                                    value: RelativeDateTimeFormatter().localizedString(for: lastOptimized, relativeTo: Date())
                                )
                            }
                        }
                    } else {
                        Text("No profile configured")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )
                )

                // Action buttons
                VStack(spacing: 8) {
                    // Optimize Now
                    Button {
                        optimizeGame()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "bolt.fill")
                            Text("Optimize Now")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(hex: "8B5CF6"))
                        )
                    }
                    .buttonStyle(.plain)

                    // Edit Profile
                    Button {
                        showProfileEditor = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "slider.horizontal.3")
                            Text("Edit Profile")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.1))
                        )
                    }
                    .buttonStyle(.plain)
                }
                .frame(width: 160)
            }

            // Recommendations based on hardware usage
            if let recommendations = generateRecommendations() {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recommendations")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))

                    ForEach(recommendations, id: \.self) { rec in
                        HStack(spacing: 8) {
                            Image(systemName: "lightbulb.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color(hex: "F59E0B"))
                            Text(rec)
                                .font(.system(size: 12))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(hex: "F59E0B").opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(hex: "F59E0B").opacity(0.2), lineWidth: 1)
                        )
                )
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private func profileRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(Color(hex: "8B5CF6"))
                .frame(width: 20)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.6))
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Performance History Section

    private var performanceHistorySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance History")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            if game.performanceHistory.isEmpty {
                // Empty state
                VStack(spacing: 8) {
                    Image(systemName: "chart.xyaxis.line")
                        .font(.system(size: 32))
                        .foregroundStyle(.white.opacity(0.2))
                    Text("No performance data yet")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.5))
                    Text("Launch the game with optimization to track performance")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            } else {
                // FPS Chart
                VStack(alignment: .leading, spacing: 8) {
                    Text("FPS Over Sessions")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))

                    Chart(game.performanceHistory.suffix(10)) { snapshot in
                        LineMark(
                            x: .value("Session", snapshot.timestamp, unit: .day),
                            y: .value("FPS", snapshot.avgFps)
                        )
                        .foregroundStyle(Color(hex: "8B5CF6"))
                        .lineStyle(StrokeStyle(lineWidth: 2))

                        PointMark(
                            x: .value("Session", snapshot.timestamp, unit: .day),
                            y: .value("FPS", snapshot.avgFps)
                        )
                        .foregroundStyle(Color(hex: "8B5CF6"))
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { _ in
                            AxisValueLabel()
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisValueLabel()
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                    .frame(height: 150)
                }

                // Usage stats
                HStack(spacing: 16) {
                    if let avgCpu = game.averageCpuUsage {
                        usageCard(
                            label: "Avg CPU",
                            value: String(format: "%.0f%%", avgCpu),
                            color: usageColor(avgCpu)
                        )
                    }

                    if let avgGpu = game.averageGpuUsage {
                        usageCard(
                            label: "Avg GPU",
                            value: String(format: "%.0f%%", avgGpu),
                            color: usageColor(avgGpu)
                        )
                    }

                    // Best/worst session
                    if let best = game.performanceHistory.max(by: { $0.avgFps < $1.avgFps }) {
                        usageCard(
                            label: "Best FPS",
                            value: String(format: "%.0f", best.avgFps),
                            color: Color(hex: "22C55E")
                        )
                    }

                    if let worst = game.performanceHistory.min(by: { $0.avgFps < $1.avgFps }) {
                        usageCard(
                            label: "Worst FPS",
                            value: String(format: "%.0f", worst.avgFps),
                            color: Color(hex: "EF4444")
                        )
                    }
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private func usageCard(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(color.opacity(0.1))
        )
    }

    private func usageColor(_ usage: Float) -> Color {
        if usage >= 90 {
            return Color(hex: "EF4444")  // Red
        } else if usage >= 80 {
            return Color(hex: "F59E0B")  // Yellow
        } else {
            return Color(hex: "22C55E")  // Green
        }
    }

    // MARK: - Quick Actions Section

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)

            HStack(spacing: 12) {
                // Launch Game
                actionButton(
                    icon: "play.fill",
                    label: "Launch Game",
                    color: Color(hex: "22C55E"),
                    isLoading: isLaunching
                ) {
                    launchGame()
                }

                // Reset Profile
                actionButton(
                    icon: "arrow.counterclockwise",
                    label: "Reset Profile",
                    color: Color(hex: "F59E0B")
                ) {
                    resetProfile()
                }

                // View in Finder
                actionButton(
                    icon: "folder",
                    label: "Show in Finder",
                    color: Color(hex: "3B82F6")
                ) {
                    showInFinder()
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private func actionButton(
        icon: String,
        label: String,
        color: Color,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 12))
                }
                Text(label)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(color.opacity(0.3), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    // MARK: - Actions

    private func optimizeGame() {
        print("[GameDetailView] Optimizing: \(game.name)")

        // Create or update profile
        if game.optimizationProfile == nil {
            game.optimizationProfile = GameOptimizationProfile()
        }
        game.optimizationProfile?.lastOptimizedAt = Date()

        // Update in cache
        Task {
            await GameDetectionService.shared.updateGame(game)
        }
    }

    private func launchGame() {
        isLaunching = true
        print("[GameDetailView] Launching: \(game.name)")

        // Launch via NSWorkspace
        let url = URL(fileURLWithPath: game.executablePath)
        NSWorkspace.shared.open(url) { _, error in
            DispatchQueue.main.async {
                isLaunching = false
                if let error = error {
                    print("[GameDetailView] Launch error: \(error)")
                } else {
                    // Update last played
                    game.lastPlayed = Date()
                    Task {
                        await GameDetectionService.shared.updateGame(game)
                    }
                }
            }
        }
    }

    private func resetProfile() {
        game.optimizationProfile = nil
        Task {
            await GameDetectionService.shared.updateGame(game)
        }
    }

    private func showInFinder() {
        let url = URL(fileURLWithPath: game.executablePath)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    private func generateRecommendations() -> [String]? {
        var recommendations: [String] = []

        // Check GPU usage
        if let avgGpu = game.averageGpuUsage, avgGpu > 90 {
            recommendations.append("GPU usage is high. Consider lowering quality settings.")
        }

        // Check CPU usage
        if let avgCpu = game.averageCpuUsage, avgCpu > 80 {
            recommendations.append("CPU usage is high. Close background applications before playing.")
        }

        // Check if low FPS
        if let avgFps = game.averageFps, avgFps < 30 {
            recommendations.append("FPS is low. Try reducing graphics settings or resolution.")
        }

        // Check if no profile
        if game.optimizationProfile == nil {
            recommendations.append("Create an optimization profile for better performance.")
        }

        return recommendations.isEmpty ? nil : recommendations
    }
}

// MARK: - Profile Editor Sheet

/// Sheet for editing game optimization profile settings.
struct ProfileEditorSheet: View {

    @Environment(\.dismiss) private var dismiss

    @Binding var game: Game

    @State private var qualityLevel: Int
    @State private var processesToKill: [String]
    @State private var newProcess: String = ""

    init(game: Binding<Game>) {
        self._game = game
        let profile = game.wrappedValue.optimizationProfile ?? GameOptimizationProfile()
        self._qualityLevel = State(initialValue: profile.qualityLevel)
        self._processesToKill = State(initialValue: profile.processesToKill)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Edit Profile")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(.white.opacity(0.5))
                }
                .buttonStyle(.plain)
            }
            .padding(16)
            .background(Color(hex: "09090B"))

            Divider()
                .background(Color.white.opacity(0.1))

            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Quality Level
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Quality Level")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)

                        Picker("Quality", selection: $qualityLevel) {
                            Text("Low").tag(0)
                            Text("Medium").tag(1)
                            Text("High").tag(2)
                            Text("Ultra").tag(3)
                            Text("Adaptive").tag(4)
                        }
                        .pickerStyle(.segmented)
                    }

                    // Processes to Kill
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Processes to Kill")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)

                        Text("These processes will be terminated when launching with optimization.")
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.5))

                        // Add process
                        HStack {
                            TextField("Process name (e.g., Spotify)", text: $newProcess)
                                .textFieldStyle(.plain)
                                .padding(8)
                                .background(
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(Color.white.opacity(0.05))
                                )

                            Button {
                                if !newProcess.isEmpty && !processesToKill.contains(newProcess) {
                                    processesToKill.append(newProcess)
                                    newProcess = ""
                                }
                            } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 28, height: 28)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(Color(hex: "8B5CF6"))
                                    )
                            }
                            .buttonStyle(.plain)
                        }

                        // Process list
                        ForEach(processesToKill, id: \.self) { process in
                            HStack {
                                Text(process)
                                    .font(.system(size: 12))
                                    .foregroundStyle(.white)
                                Spacer()
                                Button {
                                    processesToKill.removeAll { $0 == process }
                                } label: {
                                    Image(systemName: "minus.circle.fill")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color(hex: "EF4444"))
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(8)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.white.opacity(0.05))
                            )
                        }
                    }
                }
                .padding(16)
            }

            Divider()
                .background(Color.white.opacity(0.1))

            // Footer
            HStack {
                Button {
                    dismiss()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    saveProfile()
                    dismiss()
                } label: {
                    Text("Save")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color(hex: "8B5CF6"))
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(16)
            .background(Color(hex: "09090B"))
        }
        .frame(width: 400, height: 500)
        .background(Color(hex: "0A0A0C"))
    }

    private func saveProfile() {
        var profile = game.optimizationProfile ?? GameOptimizationProfile()
        profile.qualityLevel = qualityLevel
        profile.processesToKill = processesToKill
        game.optimizationProfile = profile

        Task {
            await GameDetectionService.shared.updateGame(game)
        }
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var game = Game(
        name: "Cyberpunk 2077",
        executablePath: "/Applications/Cyberpunk2077.app",
        platform: .steam,
        lastPlayed: Date().addingTimeInterval(-86400 * 2),
        totalPlaytime: 3600 * 45,
        optimizationProfile: GameOptimizationProfile(qualityLevel: 3),
        performanceHistory: [
            PerformanceSnapshot(avgFps: 55, avgCpuUsage: 65, avgGpuUsage: 85, sessionDuration: 3600),
            PerformanceSnapshot(timestamp: Date().addingTimeInterval(-86400), avgFps: 58, avgCpuUsage: 62, avgGpuUsage: 82, sessionDuration: 7200),
            PerformanceSnapshot(timestamp: Date().addingTimeInterval(-86400 * 2), avgFps: 52, avgCpuUsage: 70, avgGpuUsage: 90, sessionDuration: 5400)
        ]
    )

    GameDetailView(game: $game)
        .frame(width: 800, height: 700)
}
