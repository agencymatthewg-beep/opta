//
//  ProfileManagerView.swift
//  OptaApp
//
//  Optimization profile management view for saving, loading, and exporting profiles.
//

import SwiftUI
import UniformTypeIdentifiers

// MARK: - ProfileManagerView

/// View for managing optimization profiles.
///
/// Features:
/// - List of saved profiles with metadata
/// - Create new profile
/// - Apply profile to current settings
/// - Export/Import profiles as JSON
/// - Swipe to delete
struct ProfileManagerView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorTemperature) private var colorTemp

    // MARK: - State

    @StateObject private var profileManager = ProfileManager.shared
    @State private var showingAddSheet = false
    @State private var showingImportPicker = false
    @State private var showingExportSheet = false
    @State private var selectedProfile: OptimizationProfile?
    @State private var exportURL: URL?
    @State private var newProfileName = ""

    // MARK: - App Storage (for applying profiles)

    @AppStorage("qualityPreset") private var qualityPreset = 2
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("autoOptimize") private var autoOptimize = false

    // MARK: - Body

    var body: some View {
        Group {
            if profileManager.profiles.isEmpty {
                emptyStateView
            } else {
                profileListView
            }
        }
        .navigationTitle("Profiles")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Label("New Profile", systemImage: "plus")
                    }

                    Button {
                        showingImportPicker = true
                    } label: {
                        Label("Import Profile", systemImage: "square.and.arrow.down")
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            addProfileSheet
        }
        .fileImporter(
            isPresented: $showingImportPicker,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result: result)
        }
        .sheet(isPresented: $showingExportSheet) {
            if let url = exportURL {
                ShareSheet(items: [url])
            }
        }
    }

    // MARK: - Profile List

    private var profileListView: some View {
        List {
            ForEach(profileManager.profiles) { profile in
                ProfileRowView(
                    profile: profile,
                    onApply: { applyProfile(profile) },
                    onExport: { exportProfile(profile) }
                )
            }
            .onDelete(perform: deleteProfiles)
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .background(Color(hex: "0A0A0F"))
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "square.stack.3d.up")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Profiles")
                .font(.headline)

            Text("Save your current settings as a profile to quickly switch between configurations.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                showingAddSheet = true
            } label: {
                Label("Create Profile", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .tint(colorTemp.tintColor)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "0A0A0F"))
    }

    // MARK: - Add Profile Sheet

    private var addProfileSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Profile Name", text: $newProfileName)
                } header: {
                    Text("Name")
                }

                Section {
                    HStack {
                        Text("Quality Level")
                        Spacer()
                        Text(qualityLevelName(qualityPreset))
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Haptic Feedback")
                        Spacer()
                        Text(enableHaptics ? "Enabled" : "Disabled")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Auto-Optimize")
                        Spacer()
                        Text(autoOptimize ? "Enabled" : "Disabled")
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Current Settings")
                } footer: {
                    Text("These settings will be saved to the profile.")
                }
            }
            .formStyle(.grouped)
            .navigationTitle("New Profile")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        newProfileName = ""
                        showingAddSheet = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveNewProfile()
                    }
                    .disabled(newProfileName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .frame(minWidth: 350, minHeight: 300)
    }

    // MARK: - Actions

    private func saveNewProfile() {
        let profile = OptimizationProfile(
            name: newProfileName.trimmingCharacters(in: .whitespaces),
            qualityLevel: qualityPreset,
            enableHaptics: enableHaptics,
            autoOptimize: autoOptimize,
            processTerminationList: []
        )

        profileManager.save(profile: profile)
        newProfileName = ""
        showingAddSheet = false
    }

    private func applyProfile(_ profile: OptimizationProfile) {
        // Apply settings from profile
        qualityPreset = profile.qualityLevel
        enableHaptics = profile.enableHaptics
        autoOptimize = profile.autoOptimize

        // Mark as used
        profileManager.markAsUsed(id: profile.id)

        print("[ProfileManagerView] Applied profile: \(profile.name)")
    }

    private func exportProfile(_ profile: OptimizationProfile) {
        if let url = profileManager.export(profile: profile) {
            exportURL = url
            showingExportSheet = true
        }
    }

    private func deleteProfiles(at offsets: IndexSet) {
        for index in offsets {
            let profile = profileManager.profiles[index]
            profileManager.delete(id: profile.id)
        }
    }

    private func handleImport(result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            _ = profileManager.importProfile(from: url)
        case .failure(let error):
            print("[ProfileManagerView] Import error: \(error)")
        }
    }

    private func qualityLevelName(_ level: Int) -> String {
        switch level {
        case 0: return "Low"
        case 1: return "Medium"
        case 2: return "High"
        case 3: return "Ultra"
        case 4: return "Adaptive"
        default: return "Unknown"
        }
    }
}

// MARK: - Profile Row View

/// A single profile row in the list.
struct ProfileRowView: View {

    @Environment(\.colorTemperature) private var colorTemp

    let profile: OptimizationProfile
    let onApply: () -> Void
    let onExport: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Profile icon (obsidian + violet)
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(hex: "0A0A0F"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(colorTemp.tintColor.opacity(colorTemp.glowOpacity * 0.25), lineWidth: 1)
                    )
                    .frame(width: 40, height: 40)

                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 18))
                    .foregroundColor(colorTemp.violetColor)
            }

            // Profile info
            VStack(alignment: .leading, spacing: 4) {
                Text(profile.name)
                    .font(.headline)

                HStack(spacing: 8) {
                    // Quality badge (violet intensity tiers)
                    Text(profile.qualityLevelName)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(qualityBadgeBackground)
                        .foregroundColor(qualityBadgeTextColor.opacity(qualityBadgeTextOpacity))
                        .cornerRadius(4)

                    // Last used indicator
                    if let lastUsed = profile.lastUsedAt {
                        Text("Used \(lastUsed.relativeFormatted)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("Created \(profile.createdAt.relativeFormatted)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            // Actions
            Button {
                onApply()
            } label: {
                Text("Apply")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.borderedProminent)
            .tint(colorTemp.tintColor)

            Menu {
                Button {
                    onExport()
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundColor(.secondary)
            }
            .menuStyle(.borderlessButton)
            .frame(width: 32)
        }
        .padding(.vertical, 8)
    }

    private var qualityBadgeBackground: Color {
        switch profile.qualityLevel {
        case 0: return colorTemp.violetColor.opacity(0.2)
        case 1: return colorTemp.violetColor.opacity(0.3)
        case 2: return colorTemp.violetColor.opacity(0.5)
        case 3: return colorTemp.violetColor.opacity(0.7)
        case 4: return colorTemp.violetColor
        default: return colorTemp.violetColor.opacity(0.2)
        }
    }

    private var qualityBadgeTextOpacity: Double {
        switch profile.qualityLevel {
        case 0: return 0.5
        case 1: return 0.7
        case 2: return 0.85
        case 3: return 1.0
        case 4: return 1.0
        default: return 0.5
        }
    }

    private var qualityBadgeTextColor: Color {
        profile.qualityLevel == 4 ? .white : colorTemp.violetColor
    }
}

// MARK: - Share Sheet

/// macOS share sheet wrapper.
struct ShareSheet: NSViewControllerRepresentable {
    let items: [Any]

    func makeNSViewController(context: Context) -> NSViewController {
        let controller = NSViewController()
        controller.view = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 300))

        DispatchQueue.main.async {
            guard let window = controller.view.window else { return }

            let picker = NSSharingServicePicker(items: items)
            picker.show(relativeTo: .zero, of: controller.view, preferredEdge: .minY)
        }

        return controller
    }

    func updateNSViewController(_ nsViewController: NSViewController, context: Context) {}
}

// MARK: - Date Extension

extension Date {
    /// Relative formatted date string (e.g., "2 hours ago", "Yesterday")
    var relativeFormatted: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Preview

#if DEBUG
struct ProfileManagerView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            ProfileManagerView()
        }
        .frame(width: 500, height: 400)
    }
}
#endif
