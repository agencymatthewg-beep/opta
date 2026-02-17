//
//  ThemeCreatorModule.swift
//  OptaPlusMacOS
//
//  F5. Custom Theme Creator — users create, edit, and share custom themes
//  beyond the 3 built-in ones. Live preview, import/export as JSON, color
//  picker with hex input, undo/redo stack, and theme gallery.
//
//  Module registration:  Add as a tab in SettingsView or standalone window.
//  Module removal:       Delete this file. Themes revert to the 3 built-in ones.
//
//  Keyboard shortcuts:
//    Cmd+Shift+T  — Open theme creator
//    Cmd+Z        — Undo theme change (within creator)
//    Cmd+Shift+Z  — Redo theme change (within creator)
//
//  Event bus:
//    Posts:    .module_theme_applied(themeId: String)
//              .module_theme_exported(json: String)
//    Listens:  .module_theme_toggle
//              .importTheme(json: String)
//
//  Persistence:
//    JSON files in App Support/OptaPlus/Themes/ (one file per custom theme)
//    Also registers custom themes with ThemeManager for live switching.
//
//  Inter-module interaction:
//    - Extends ThemeManager with custom theme support
//    - AnalyticsModule can show theme usage stats
//    - SplitPaneModule applies theme per-pane (optional)
//
//  How to add:
//    1. Add a "Custom Themes" tab to SettingsView
//    2. Add .onReceive(publisher(for: .module_theme_toggle)) listener
//    3. Wire Cmd+Shift+T keyboard shortcut
//    4. Add "Theme Creator" to CommandPalette
//
//  How to remove:
//    1. Delete this file
//    2. Remove the "Custom Themes" tab from SettingsView
//    3. Remove notification listeners
//    4. Call ThemeCreatorModule.cleanup() to remove custom theme files
//    5. ThemeManager continues to work with built-in themes only
//

import SwiftUI
import Combine
import OptaMolt
import UniformTypeIdentifiers
import os.log

// MARK: - Custom Theme (Serializable)

/// A user-created theme with full color specification. Unlike AppTheme which
/// uses SwiftUI Color (not Codable), this uses hex strings for serialization.
struct CustomTheme: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var backgroundHex: String
    var surfaceHex: String
    var elevatedHex: String
    var accentHex: String
    var accentGlowHex: String
    var textPrimaryHex: String
    var textSecondaryHex: String
    var textMutedHex: String
    var createdAt: Date
    var modifiedAt: Date
    var author: String?
    var description: String?

    init(
        id: String = UUID().uuidString,
        name: String = "New Theme",
        backgroundHex: String = "#050505",
        surfaceHex: String = "#0A0A0A",
        elevatedHex: String = "#121212",
        accentHex: String = "#8B5CF6",
        accentGlowHex: String = "#A78BFA",
        textPrimaryHex: String = "#EDEDED",
        textSecondaryHex: String = "#A1A1AA",
        textMutedHex: String = "#52525B",
        author: String? = nil,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.backgroundHex = backgroundHex
        self.surfaceHex = surfaceHex
        self.elevatedHex = elevatedHex
        self.accentHex = accentHex
        self.accentGlowHex = accentGlowHex
        self.textPrimaryHex = textPrimaryHex
        self.textSecondaryHex = textSecondaryHex
        self.textMutedHex = textMutedHex
        self.createdAt = Date()
        self.modifiedAt = Date()
        self.author = author
        self.description = description
    }

    /// Convert to AppTheme for use with ThemeManager.
    func toAppTheme() -> AppTheme {
        AppTheme(
            id: id,
            name: name,
            backgroundColor: Color(hex: backgroundHex),
            surfaceColor: Color(hex: surfaceHex),
            elevatedColor: Color(hex: elevatedHex),
            accentColor: Color(hex: accentHex),
            accentGlow: Color(hex: accentGlowHex)
        )
    }

    /// Create from an existing AppTheme (for editing built-in themes as templates).
    static func from(appTheme: AppTheme) -> CustomTheme {
        CustomTheme(
            name: "\(appTheme.name) Copy",
            backgroundHex: appTheme.backgroundColor.hexString,
            surfaceHex: appTheme.surfaceColor.hexString,
            elevatedHex: appTheme.elevatedColor.hexString,
            accentHex: appTheme.accentColor.hexString,
            accentGlowHex: appTheme.accentGlow.hexString
        )
    }
}

// MARK: - Undo Entry

/// A single state snapshot for undo/redo.
private struct UndoEntry {
    let theme: CustomTheme
    let description: String
}

// MARK: - Theme Store

/// Persists custom themes in App Support.
actor ThemeStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "ThemeStore")
    private let storageDir: URL

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        self.storageDir = appSupport.appendingPathComponent("OptaPlus/Themes", isDirectory: true)
        try? FileManager.default.createDirectory(at: storageDir, withIntermediateDirectories: true)
    }

    func saveTheme(_ theme: CustomTheme) {
        let url = storageDir.appendingPathComponent("theme-\(theme.id).json")
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(theme)
            try data.write(to: url, options: .atomic)
        } catch {
            Self.logger.error("Failed to save theme \(theme.name): \(error.localizedDescription)")
        }
    }

    func loadAll() -> [CustomTheme] {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: storageDir, includingPropertiesForKeys: nil) else {
            return []
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return files.compactMap { url -> CustomTheme? in
            guard url.lastPathComponent.hasPrefix("theme-"),
                  url.pathExtension == "json",
                  let data = try? Data(contentsOf: url) else { return nil }
            return try? decoder.decode(CustomTheme.self, from: data)
        }.sorted { $0.modifiedAt > $1.modifiedAt }
    }

    func deleteTheme(id: String) {
        let url = storageDir.appendingPathComponent("theme-\(id).json")
        try? FileManager.default.removeItem(at: url)
    }

    func clearAll() {
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: storageDir, includingPropertiesForKeys: nil) {
            for file in files {
                try? fm.removeItem(at: file)
            }
        }
    }

    /// Export a theme as a shareable JSON string.
    func exportTheme(_ theme: CustomTheme) -> String? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(theme) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Import a theme from a JSON string.
    func importTheme(from json: String) -> CustomTheme? {
        guard let data = json.data(using: .utf8) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(CustomTheme.self, from: data)
    }
}

// MARK: - Theme Creator View Model

@MainActor
final class ThemeCreatorViewModel: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "ThemeCreator")

    // MARK: Published State
    @Published var customThemes: [CustomTheme] = []
    @Published var editingTheme: CustomTheme?
    @Published var isEditing: Bool = false
    @Published var showExportSheet: Bool = false
    @Published var showImportSheet: Bool = false
    @Published var exportedJSON: String = ""
    @Published var importJSON: String = ""
    @Published var importError: String?

    // Undo/Redo
    private var undoStack: [UndoEntry] = []
    private var redoStack: [UndoEntry] = []
    @Published var canUndo: Bool = false
    @Published var canRedo: Bool = false

    private let store = ThemeStore()

    // MARK: - Load

    func loadThemes() async {
        customThemes = await store.loadAll()
    }

    // MARK: - Create

    func createNewTheme() {
        let theme = CustomTheme()
        editingTheme = theme
        isEditing = true
        clearUndoHistory()
    }

    func duplicateBuiltIn(_ appTheme: AppTheme) {
        let theme = CustomTheme.from(appTheme: appTheme)
        editingTheme = theme
        isEditing = true
        clearUndoHistory()
    }

    // MARK: - Edit with Undo

    func updateTheme(_ keyPath: WritableKeyPath<CustomTheme, String>, value: String, description: String) {
        guard var theme = editingTheme else { return }
        // Push current state to undo
        pushUndo(description: description)
        theme[keyPath: keyPath] = value
        theme.modifiedAt = Date()
        editingTheme = theme
    }

    func updateThemeName(_ name: String) {
        guard var theme = editingTheme else { return }
        pushUndo(description: "Rename theme")
        theme.name = name
        theme.modifiedAt = Date()
        editingTheme = theme
    }

    func undo() {
        guard let entry = undoStack.popLast(), var current = editingTheme else { return }
        redoStack.append(UndoEntry(theme: current, description: entry.description))
        editingTheme = entry.theme
        canUndo = !undoStack.isEmpty
        canRedo = true
    }

    func redo() {
        guard let entry = redoStack.popLast(), let _ = editingTheme else { return }
        undoStack.append(UndoEntry(theme: editingTheme!, description: entry.description))
        editingTheme = entry.theme
        canUndo = true
        canRedo = !redoStack.isEmpty
    }

    private func pushUndo(description: String) {
        guard let theme = editingTheme else { return }
        undoStack.append(UndoEntry(theme: theme, description: description))
        redoStack.removeAll()
        canUndo = true
        canRedo = false
    }

    private func clearUndoHistory() {
        undoStack.removeAll()
        redoStack.removeAll()
        canUndo = false
        canRedo = false
    }

    // MARK: - Save

    func saveTheme() async {
        guard let theme = editingTheme else { return }
        await store.saveTheme(theme)
        await loadThemes()
        isEditing = false
        Self.logger.info("Saved custom theme: \(theme.name)")
    }

    // MARK: - Delete

    func deleteTheme(_ id: String) async {
        await store.deleteTheme(id: id)
        await loadThemes()
        if editingTheme?.id == id {
            isEditing = false
            editingTheme = nil
        }
    }

    // MARK: - Apply

    func applyTheme(_ theme: CustomTheme) {
        let appTheme = theme.toAppTheme()
        ThemeManager.shared.currentTheme = appTheme
        NotificationCenter.default.post(
            name: .module_theme_applied,
            object: nil,
            userInfo: ["themeId": theme.id]
        )
    }

    // MARK: - Export/Import

    func exportCurrentTheme() async {
        guard let theme = editingTheme else { return }
        if let json = await store.exportTheme(theme) {
            exportedJSON = json
            showExportSheet = true
        }
    }

    func importFromJSON() async {
        let trimmed = importJSON.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            importError = "JSON string is empty"
            return
        }
        if let theme = await store.importTheme(from: trimmed) {
            await store.saveTheme(theme)
            await loadThemes()
            editingTheme = theme
            isEditing = true
            importError = nil
            showImportSheet = false
        } else {
            importError = "Invalid theme JSON format"
        }
    }
}

// MARK: - Theme Creator View

struct ThemeCreatorView: View {
    @StateObject private var vm = ThemeCreatorViewModel()
    @EnvironmentObject var appState: AppState
    @ObservedObject var themeManager: ThemeManager

    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            HStack(spacing: 0) {
                // Theme gallery sidebar
                themeGallery
                    .frame(width: 260)

                Divider().background(Color.optaBorder.opacity(0.2))

                // Editor or preview
                if vm.isEditing, let theme = vm.editingTheme {
                    themeEditor(theme)
                } else {
                    emptyEditorState
                }
            }
        }
        .task { await vm.loadThemes() }
        .onAppear {
            withAnimation(.optaSpring.delay(0.1)) { appeared = true }
        }
        .sheet(isPresented: $vm.showExportSheet) {
            exportSheet
        }
        .sheet(isPresented: $vm.showImportSheet) {
            importSheet
        }
    }

    // MARK: - Theme Gallery

    private var themeGallery: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Themes")
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                Spacer()

                Button(action: { vm.createNewTheme() }) {
                    Image(systemName: "plus")
                        .font(.system(size: 12))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .help("Create new theme")

                Button(action: { vm.showImportSheet = true }) {
                    Image(systemName: "square.and.arrow.down")
                        .font(.system(size: 12))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .help("Import theme from JSON")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            Divider().background(Color.optaBorder.opacity(0.2))

            ScrollView {
                VStack(spacing: 8) {
                    // Built-in themes
                    Text("BUILT-IN")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 14)
                        .padding(.top, 8)

                    ForEach(AppTheme.allBuiltIn, id: \.id) { theme in
                        ThemeGalleryCard(
                            name: theme.name,
                            backgroundHex: theme.backgroundColor.hexString,
                            accentHex: theme.accentColor.hexString,
                            isActive: themeManager.currentTheme.id == theme.id,
                            isEditing: false,
                            onSelect: { themeManager.currentTheme = theme },
                            onDuplicate: { vm.duplicateBuiltIn(theme) },
                            onDelete: nil
                        )
                    }

                    // Custom themes
                    if !vm.customThemes.isEmpty {
                        Text("CUSTOM")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 14)
                            .padding(.top, 12)

                        ForEach(vm.customThemes) { theme in
                            ThemeGalleryCard(
                                name: theme.name,
                                backgroundHex: theme.backgroundHex,
                                accentHex: theme.accentHex,
                                isActive: themeManager.currentTheme.id == theme.id,
                                isEditing: vm.editingTheme?.id == theme.id,
                                onSelect: { vm.applyTheme(theme) },
                                onDuplicate: {
                                    vm.editingTheme = theme
                                    vm.isEditing = true
                                },
                                onDelete: {
                                    Task { await vm.deleteTheme(theme.id) }
                                }
                            )
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 12)
            }
        }
        .background(Color.optaSurface.opacity(0.2))
    }

    // MARK: - Theme Editor

    private func themeEditor(_ theme: CustomTheme) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Editor header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        TextField("Theme Name", text: Binding(
                            get: { vm.editingTheme?.name ?? "" },
                            set: { vm.updateThemeName($0) }
                        ))
                        .textFieldStyle(.plain)
                        .font(.sora(18, weight: .bold))
                        .foregroundColor(.optaTextPrimary)

                        Text("Editing custom theme")
                            .font(.sora(11))
                            .foregroundColor(.optaTextMuted)
                    }

                    Spacer()

                    // Undo/Redo
                    HStack(spacing: 4) {
                        Button(action: { vm.undo() }) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.system(size: 11))
                        }
                        .buttonStyle(.plain)
                        .disabled(!vm.canUndo)
                        .foregroundColor(vm.canUndo ? .optaTextSecondary : .optaTextMuted.opacity(0.3))
                        .help("Undo (Cmd+Z)")

                        Button(action: { vm.redo() }) {
                            Image(systemName: "arrow.uturn.forward")
                                .font(.system(size: 11))
                        }
                        .buttonStyle(.plain)
                        .disabled(!vm.canRedo)
                        .foregroundColor(vm.canRedo ? .optaTextSecondary : .optaTextMuted.opacity(0.3))
                        .help("Redo (Cmd+Shift+Z)")
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .glassSubtle()

                    Button("Export") {
                        Task { await vm.exportCurrentTheme() }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.optaTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .glassSubtle()

                    Button("Apply") { vm.applyTheme(theme) }
                        .buttonStyle(.plain)
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.optaPrimary.opacity(0.12))
                        .clipShape(Capsule())

                    Button("Save") {
                        Task { await vm.saveTheme() }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.optaVoid)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color.optaPrimary)
                    .clipShape(Capsule())
                }

                Divider().background(Color.optaBorder.opacity(0.2))

                // Color editors
                HStack(alignment: .top, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("BACKGROUNDS")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        ThemeColorEditor(
                            label: "Background",
                            hex: Binding(
                                get: { vm.editingTheme?.backgroundHex ?? "#050505" },
                                set: { vm.updateTheme(\.backgroundHex, value: $0, description: "Change background") }
                            )
                        )

                        ThemeColorEditor(
                            label: "Surface",
                            hex: Binding(
                                get: { vm.editingTheme?.surfaceHex ?? "#0A0A0A" },
                                set: { vm.updateTheme(\.surfaceHex, value: $0, description: "Change surface") }
                            )
                        )

                        ThemeColorEditor(
                            label: "Elevated",
                            hex: Binding(
                                get: { vm.editingTheme?.elevatedHex ?? "#121212" },
                                set: { vm.updateTheme(\.elevatedHex, value: $0, description: "Change elevated") }
                            )
                        )
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("ACCENT")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        ThemeColorEditor(
                            label: "Primary",
                            hex: Binding(
                                get: { vm.editingTheme?.accentHex ?? "#8B5CF6" },
                                set: { vm.updateTheme(\.accentHex, value: $0, description: "Change accent") }
                            )
                        )

                        ThemeColorEditor(
                            label: "Glow",
                            hex: Binding(
                                get: { vm.editingTheme?.accentGlowHex ?? "#A78BFA" },
                                set: { vm.updateTheme(\.accentGlowHex, value: $0, description: "Change glow") }
                            )
                        )
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("TEXT")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)

                        ThemeColorEditor(
                            label: "Primary",
                            hex: Binding(
                                get: { vm.editingTheme?.textPrimaryHex ?? "#EDEDED" },
                                set: { vm.updateTheme(\.textPrimaryHex, value: $0, description: "Change text primary") }
                            )
                        )

                        ThemeColorEditor(
                            label: "Secondary",
                            hex: Binding(
                                get: { vm.editingTheme?.textSecondaryHex ?? "#A1A1AA" },
                                set: { vm.updateTheme(\.textSecondaryHex, value: $0, description: "Change text secondary") }
                            )
                        )

                        ThemeColorEditor(
                            label: "Muted",
                            hex: Binding(
                                get: { vm.editingTheme?.textMutedHex ?? "#52525B" },
                                set: { vm.updateTheme(\.textMutedHex, value: $0, description: "Change text muted") }
                            )
                        )
                    }
                }

                Divider().background(Color.optaBorder.opacity(0.2))

                // Live preview
                Text("LIVE PREVIEW")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                ThemeLivePreview(theme: theme)
            }
            .padding(24)
        }
    }

    // MARK: - Empty State

    private var emptyEditorState: some View {
        VStack(spacing: 16) {
            Image(systemName: "paintpalette")
                .font(.system(size: 44))
                .foregroundColor(.optaTextMuted)

            Text("Theme Creator")
                .font(.sora(17, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            Text("Select a theme to edit or create a new one")
                .font(.sora(13))
                .foregroundColor(.optaTextSecondary)

            Button("Create New Theme") { vm.createNewTheme() }
                .buttonStyle(.plain)
                .foregroundColor(.optaPrimary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.optaPrimary.opacity(0.12))
                .clipShape(Capsule())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Export Sheet

    private var exportSheet: some View {
        VStack(spacing: 16) {
            Text("Export Theme")
                .font(.sora(15, weight: .semibold))

            TextEditor(text: .constant(vm.exportedJSON))
                .font(.system(size: 11, design: .monospaced))
                .frame(height: 200)
                .glassSubtle()

            HStack {
                Button("Copy to Clipboard") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(vm.exportedJSON, forType: .string)
                }
                .buttonStyle(.plain)
                .foregroundColor(.optaPrimary)

                Spacer()

                Button("Close") { vm.showExportSheet = false }
                    .buttonStyle(.plain)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(24)
        .frame(width: 500)
    }

    // MARK: - Import Sheet

    private var importSheet: some View {
        VStack(spacing: 16) {
            Text("Import Theme")
                .font(.sora(15, weight: .semibold))

            TextEditor(text: $vm.importJSON)
                .font(.system(size: 11, design: .monospaced))
                .frame(height: 200)
                .glassSubtle()

            if let error = vm.importError {
                Text(error)
                    .font(.sora(11))
                    .foregroundColor(.optaRed)
            }

            HStack {
                Button("Paste from Clipboard") {
                    if let str = NSPasteboard.general.string(forType: .string) {
                        vm.importJSON = str
                    }
                }
                .buttonStyle(.plain)
                .foregroundColor(.optaTextSecondary)

                Spacer()

                Button("Cancel") { vm.showImportSheet = false }
                    .buttonStyle(.plain)
                    .foregroundColor(.optaTextMuted)

                Button("Import") {
                    Task { await vm.importFromJSON() }
                }
                .buttonStyle(.plain)
                .foregroundColor(.optaPrimary)
            }
        }
        .padding(24)
        .frame(width: 500)
    }
}

// MARK: - Theme Gallery Card

struct ThemeGalleryCard: View {
    let name: String
    let backgroundHex: String
    let accentHex: String
    let isActive: Bool
    let isEditing: Bool
    let onSelect: () -> Void
    let onDuplicate: () -> Void
    let onDelete: (() -> Void)?

    @State private var isHovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 10) {
                // Color swatch
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: backgroundHex))
                        .frame(width: 18, height: 28)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: accentHex))
                        .frame(width: 18, height: 28)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.sora(11, weight: isActive ? .semibold : .regular))
                        .foregroundColor(isActive ? .optaPrimary : .optaTextPrimary)

                    if isActive {
                        Text("Active")
                            .font(.sora(9))
                            .foregroundColor(.optaPrimary)
                    }
                }

                Spacer()

                if isHovered {
                    HStack(spacing: 4) {
                        Button(action: onDuplicate) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 9))
                                .foregroundColor(.optaTextMuted)
                        }
                        .buttonStyle(.plain)
                        .help("Duplicate")

                        if let onDelete {
                            Button(action: onDelete) {
                                Image(systemName: "trash")
                                    .font(.system(size: 9))
                                    .foregroundColor(.optaRed.opacity(0.7))
                            }
                            .buttonStyle(.plain)
                            .help("Delete")
                        }
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isEditing ? Color.optaPrimary.opacity(0.08) :
                            isHovered ? Color.optaElevated.opacity(0.4) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isActive ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { hover in
            withAnimation(.optaSnap) { isHovered = hover }
        }
    }
}

// MARK: - Theme Color Editor

struct ThemeColorEditor: View {
    let label: String
    @Binding var hex: String

    @State private var showPicker = false

    var body: some View {
        HStack(spacing: 8) {
            // Color swatch button
            Button(action: { showPicker.toggle() }) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: hex))
                    .frame(width: 28, height: 28)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
                    )
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showPicker) {
                ColorPicker("", selection: Binding(
                    get: { Color(hex: hex) },
                    set: { hex = $0.hexString }
                ), supportsOpacity: false)
                .labelsHidden()
                .padding(12)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.sora(10, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                TextField("#FFFFFF", text: $hex)
                    .textFieldStyle(.plain)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.optaTextPrimary)
                    .frame(width: 70)
            }
        }
    }
}

// MARK: - Theme Live Preview

struct ThemeLivePreview: View {
    let theme: CustomTheme

    var body: some View {
        VStack(spacing: 0) {
            // Mock chat preview
            ZStack {
                Color(hex: theme.backgroundHex).ignoresSafeArea()

                VStack(spacing: 10) {
                    // Bot message
                    HStack {
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("How can I help you today?")
                                .font(.sora(12))
                                .foregroundColor(Color(hex: theme.textPrimaryHex))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color(hex: theme.surfaceHex))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        Spacer()
                    }

                    // User message
                    HStack {
                        Spacer()
                        Text("Tell me about themes")
                            .font(.sora(12))
                            .foregroundColor(Color(hex: theme.textPrimaryHex))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color(hex: theme.accentHex).opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        Spacer()
                    }

                    // Accent elements
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color(hex: theme.accentHex))
                            .frame(width: 8, height: 8)
                        Text("Status: Active")
                            .font(.sora(10))
                            .foregroundColor(Color(hex: theme.textSecondaryHex))
                        Spacer()
                        Text("2 min ago")
                            .font(.sora(9))
                            .foregroundColor(Color(hex: theme.textMutedHex))
                    }
                    .padding(.horizontal, 16)
                }
                .padding(16)
            }
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
            )

            // Color palette strip
            HStack(spacing: 4) {
                colorStrip(theme.backgroundHex, label: "BG")
                colorStrip(theme.surfaceHex, label: "Surface")
                colorStrip(theme.elevatedHex, label: "Elevated")
                colorStrip(theme.accentHex, label: "Accent")
                colorStrip(theme.accentGlowHex, label: "Glow")
                colorStrip(theme.textPrimaryHex, label: "Text")
            }
            .padding(.top, 10)
        }
    }

    private func colorStrip(_ hex: String, label: String) -> some View {
        VStack(spacing: 2) {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(hex: hex))
                .frame(height: 20)
            Text(label)
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_theme_toggle = Notification.Name("module.theme.toggle")
    static let module_theme_applied = Notification.Name("module.theme.applied")
    static let module_theme_exported = Notification.Name("module.theme.exported")
    static let module_theme_importRequest = Notification.Name("module.theme.importRequest")
}

// MARK: - Module Registration

/// **To add:**
///   1. Add "Custom Themes" tab to SettingsView
///   2. Add Cmd+Shift+T shortcut to toggle .module_theme_toggle
///   3. Add "Theme Creator" to CommandPalette
///   4. In SettingsView: `ThemeCreatorView(themeManager: themeManager)`
///
/// **To remove:**
///   1. Delete this file
///   2. Remove "Custom Themes" tab from SettingsView
///   3. Remove notification listener and keyboard shortcut
///   4. Call cleanup() to remove custom theme files
///   5. ThemeManager continues with built-in themes only
enum ThemeCreatorModule {
    static func register() {
        // Load custom themes into ThemeManager on app start
        Task {
            let store = ThemeStore()
            let themes = await store.loadAll()
            await MainActor.run {
                // If current theme is a custom one, restore it
                let currentId = ThemeManager.shared.currentTheme.id
                if let customTheme = themes.first(where: { $0.id == currentId }) {
                    ThemeManager.shared.currentTheme = customTheme.toAppTheme()
                }
            }
        }
    }

    /// Remove all custom theme files.
    static func cleanup() {
        Task {
            let store = ThemeStore()
            await store.clearAll()
            await MainActor.run {
                // Reset to default theme if current was custom
                if !AppTheme.allBuiltIn.contains(where: { $0.id == ThemeManager.shared.currentTheme.id }) {
                    ThemeManager.shared.currentTheme = .cinematicVoid
                }
            }
        }
    }
}
