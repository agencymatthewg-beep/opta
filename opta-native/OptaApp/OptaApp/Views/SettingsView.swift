//
//  SettingsView.swift
//  OptaApp
//
//  Application settings view with navigation to configuration sections.
//

import SwiftUI

// MARK: - Settings View

/// Main settings view with navigation to all configuration sections.
///
/// Sections:
/// - General: Launch at login, menu bar, auto-optimize
/// - Rendering: Quality preset, haptics
/// - Profiles: ProfileManagerView
/// - Keyboard Shortcuts: KeyboardShortcutsView
/// - Appearance: ThemeCustomizationView
/// - About: Version info, links
/// - Advanced: Reset, clear cache
struct SettingsView: View {

    // MARK: - App Storage Properties

    @AppStorage("launchAtLogin") private var launchAtLogin = false
    @AppStorage("showMenuBarIcon") private var showMenuBarIcon = true
    @AppStorage("qualityPreset") private var qualityPreset = 2 // High
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("autoOptimize") private var autoOptimize = false

    // MARK: - Properties

    /// Optional CoreManager for event dispatch when connected
    var coreManager: OptaCoreManager?

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var showingResetAlert = false

    // MARK: - Body

    var body: some View {
        List {
            // General Section
            Section {
                Toggle("Launch at Login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, newValue in
                        LaunchAtLogin.isEnabled = newValue
                        dispatchSettingsChange()
                    }

                Toggle("Show Menu Bar Icon", isOn: $showMenuBarIcon)
                    .onChange(of: showMenuBarIcon) { _, _ in
                        dispatchSettingsChange()
                    }

                Toggle("Auto-Optimize on Launch", isOn: $autoOptimize)
                    .onChange(of: autoOptimize) { _, _ in
                        dispatchSettingsChange()
                    }
            } header: {
                Label("General", systemImage: "gearshape")
            }

            // Rendering Section
            Section {
                Picker("Quality Preset", selection: $qualityPreset) {
                    Text("Low").tag(0)
                    Text("Medium").tag(1)
                    Text("High").tag(2)
                    Text("Ultra").tag(3)
                    Text("Adaptive").tag(4)
                }
                .pickerStyle(.segmented)
                .onChange(of: qualityPreset) { _, _ in
                    dispatchSettingsChange()
                }

                Toggle("Enable Haptic Feedback", isOn: $enableHaptics)
                    .onChange(of: enableHaptics) { _, _ in
                        dispatchSettingsChange()
                    }
            } header: {
                Label("Rendering", systemImage: "cpu")
            }

            // Profiles Section
            Section {
                NavigationLink {
                    ProfileManagerView()
                } label: {
                    SettingsRowView(
                        icon: "square.stack.3d.up",
                        title: "Profiles",
                        subtitle: "Save and load optimization configurations"
                    )
                }
            } header: {
                Label("Configuration", systemImage: "slider.horizontal.3")
            }

            // Keyboard Shortcuts Section
            Section {
                NavigationLink {
                    KeyboardShortcutsView()
                } label: {
                    SettingsRowView(
                        icon: "keyboard",
                        title: "Keyboard Shortcuts",
                        subtitle: "Customize key bindings"
                    )
                }
            } header: {
                Label("Controls", systemImage: "hand.tap")
            }

            // Appearance Section
            Section {
                NavigationLink {
                    ThemeCustomizationView()
                } label: {
                    SettingsRowView(
                        icon: "paintpalette",
                        title: "Appearance",
                        subtitle: "Colors, blur, glow, animations"
                    )
                }
            } header: {
                Label("Visual", systemImage: "sparkles")
            }

            // About Section
            Section {
                HStack {
                    Text("Version")
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Render Engine")
                    Spacer()
                    Text("wgpu + Metal")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Build")
                    Spacer()
                    Text(buildNumber)
                        .foregroundColor(.secondary)
                }

                Link(destination: URL(string: "https://github.com/optaapp/opta")!) {
                    HStack {
                        Text("GitHub Repository")
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .foregroundColor(.secondary)
                    }
                }
            } header: {
                Label("About", systemImage: "info.circle")
            }

            // Advanced Section
            Section {
                Button("Reset All Settings") {
                    showingResetAlert = true
                }
                .foregroundColor(.red)

                Button("Clear Render Cache") {
                    clearRenderCache()
                }
            } header: {
                Label("Advanced", systemImage: "wrench.and.screwdriver")
            }
        }
        .listStyle(.insetGrouped)
        .frame(minWidth: 450, idealWidth: 500, minHeight: 550, idealHeight: 650)
        .navigationTitle("Settings")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") {
                    dismiss()
                }
            }
        }
        .alert("Reset Settings", isPresented: $showingResetAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                resetAllSettings()
            }
        } message: {
            Text("This will reset all settings to their default values. This action cannot be undone.")
        }
    }

    // MARK: - Computed Properties

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    // MARK: - Actions

    private func resetAllSettings() {
        launchAtLogin = false
        showMenuBarIcon = true
        qualityPreset = 2
        enableHaptics = true
        autoOptimize = false

        // Update system settings
        LaunchAtLogin.isEnabled = false

        // Dispatch to core
        dispatchSettingsChange()
    }

    private func clearRenderCache() {
        // Post notification to clear render cache
        NotificationCenter.default.post(name: .clearRenderCache, object: nil)
    }

    /// Dispatch settings change event to Crux core (if connected)
    private func dispatchSettingsChange() {
        // Optional: dispatch event to core when settings change
        // coreManager?.dispatch(.settingsChanged)
        #if DEBUG
        print("[SettingsView] Settings changed")
        #endif
    }
}

// MARK: - Settings Row View

/// A consistent row style for settings navigation links.
struct SettingsRowView: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.ultraThinMaterial)
                    .frame(width: 36, height: 36)

                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "#8B5CF6"))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let clearRenderCache = Notification.Name("clearRenderCache")
}

// MARK: - Settings Window

/// Standalone settings window wrapper with NavigationStack.
struct SettingsWindowView: View {
    var coreManager: OptaCoreManager?

    var body: some View {
        NavigationStack {
            SettingsView(coreManager: coreManager)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsWindowView()
            .frame(width: 500, height: 650)
    }
}
#endif
