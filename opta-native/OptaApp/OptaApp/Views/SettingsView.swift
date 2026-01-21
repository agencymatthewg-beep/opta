//
//  SettingsView.swift
//  OptaApp
//
//  Application settings view with persistence via @AppStorage
//

import SwiftUI

// MARK: - Settings View

struct SettingsView: View {

    // MARK: - App Storage Properties

    @AppStorage("launchAtLogin") private var launchAtLogin = false
    @AppStorage("showMenuBarIcon") private var showMenuBarIcon = true
    @AppStorage("qualityPreset") private var qualityPreset = 2 // High
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("autoOptimize") private var autoOptimize = false

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var showingResetAlert = false

    // MARK: - Body

    var body: some View {
        Form {
            // General Section
            Section {
                Toggle("Launch at Login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, newValue in
                        LaunchAtLogin.isEnabled = newValue
                    }

                Toggle("Show Menu Bar Icon", isOn: $showMenuBarIcon)

                Toggle("Auto-Optimize on Launch", isOn: $autoOptimize)
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

                Toggle("Enable Haptic Feedback", isOn: $enableHaptics)
            } header: {
                Label("Rendering", systemImage: "cpu")
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
        .formStyle(.grouped)
        .frame(width: 450, height: 500)
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
    }

    private func clearRenderCache() {
        // Post notification to clear render cache
        NotificationCenter.default.post(name: .clearRenderCache, object: nil)
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let clearRenderCache = Notification.Name("clearRenderCache")
}

// MARK: - Settings Window

struct SettingsWindowView: View {
    var body: some View {
        NavigationStack {
            SettingsView()
        }
    }
}

// MARK: - Preview

#if DEBUG
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsWindowView()
            .frame(width: 450, height: 500)
    }
}
#endif
