//
//  KeyboardShortcutsView.swift
//  OptaApp
//
//  Keyboard shortcuts configuration view with customizable key bindings.
//

import SwiftUI
import Carbon.HIToolbox

// MARK: - Shortcut Action

/// Available actions that can be bound to keyboard shortcuts.
enum ShortcutAction: String, CaseIterable, Codable, Identifiable {
    case quickOptimize = "quickOptimize"
    case toggleMenuBar = "toggleMenuBar"
    case openDashboard = "openDashboard"
    case toggleFPSOverlay = "toggleFPSOverlay"
    case pauseRendering = "pauseRendering"
    case showHideWindow = "showHideWindow"

    var id: String { rawValue }

    var name: String {
        switch self {
        case .quickOptimize: return "Quick Optimize"
        case .toggleMenuBar: return "Toggle Menu Bar"
        case .openDashboard: return "Open Dashboard"
        case .toggleFPSOverlay: return "Toggle FPS Overlay"
        case .pauseRendering: return "Pause Rendering"
        case .showHideWindow: return "Show/Hide Window"
        }
    }

    var description: String {
        switch self {
        case .quickOptimize: return "Run optimization instantly"
        case .toggleMenuBar: return "Show or hide menu bar icon"
        case .openDashboard: return "Open main dashboard window"
        case .toggleFPSOverlay: return "Toggle frame rate display"
        case .pauseRendering: return "Pause/resume GPU rendering"
        case .showHideWindow: return "Toggle window visibility"
        }
    }

    var defaultShortcut: KeyboardShortcut {
        switch self {
        case .quickOptimize: return KeyboardShortcut(key: "p", modifiers: [.command, .shift])
        case .toggleMenuBar: return KeyboardShortcut(key: "m", modifiers: [.command, .shift])
        case .openDashboard: return KeyboardShortcut(key: "o", modifiers: [.command, .shift])
        case .toggleFPSOverlay: return KeyboardShortcut(key: "f", modifiers: [.command, .shift])
        case .pauseRendering: return KeyboardShortcut(key: ".", modifiers: [.command])
        case .showHideWindow: return KeyboardShortcut(key: "h", modifiers: [.command, .shift])
        }
    }
}

// MARK: - Keyboard Shortcut Model

/// A customizable keyboard shortcut configuration.
struct KeyboardShortcut: Codable, Equatable, Hashable {
    var key: String
    var modifiers: [ModifierKey]

    /// Display string for the shortcut (e.g., "⌘⇧P")
    var displayString: String {
        let modifierString = modifiers
            .sorted { $0.displayOrder < $1.displayOrder }
            .map { $0.symbol }
            .joined()
        return modifierString + key.uppercased()
    }

    /// Check if shortcut is valid
    var isValid: Bool {
        !key.isEmpty && !modifiers.isEmpty
    }
}

// MARK: - Modifier Key

/// Keyboard modifier keys.
enum ModifierKey: String, Codable, CaseIterable {
    case command = "command"
    case shift = "shift"
    case option = "option"
    case control = "control"

    var symbol: String {
        switch self {
        case .command: return "⌘"
        case .shift: return "⇧"
        case .option: return "⌥"
        case .control: return "⌃"
        }
    }

    var displayOrder: Int {
        switch self {
        case .control: return 0
        case .option: return 1
        case .shift: return 2
        case .command: return 3
        }
    }

    var eventFlag: NSEvent.ModifierFlags {
        switch self {
        case .command: return .command
        case .shift: return .shift
        case .option: return .option
        case .control: return .control
        }
    }
}

// MARK: - Shortcuts Configuration

/// Full shortcuts configuration storage.
struct ShortcutsConfiguration: Codable {
    var shortcuts: [String: KeyboardShortcut]

    init() {
        // Initialize with defaults
        shortcuts = [:]
        for action in ShortcutAction.allCases {
            shortcuts[action.rawValue] = action.defaultShortcut
        }
    }

    /// Get shortcut for action
    func shortcut(for action: ShortcutAction) -> KeyboardShortcut {
        shortcuts[action.rawValue] ?? action.defaultShortcut
    }

    /// Set shortcut for action
    mutating func setShortcut(_ shortcut: KeyboardShortcut, for action: ShortcutAction) {
        shortcuts[action.rawValue] = shortcut
    }

    /// Reset action to default
    mutating func resetToDefault(_ action: ShortcutAction) {
        shortcuts[action.rawValue] = action.defaultShortcut
    }

    /// Reset all to defaults
    mutating func resetAll() {
        for action in ShortcutAction.allCases {
            shortcuts[action.rawValue] = action.defaultShortcut
        }
    }

    /// Find conflicting action (if any)
    func findConflict(for shortcut: KeyboardShortcut, excluding action: ShortcutAction) -> ShortcutAction? {
        for otherAction in ShortcutAction.allCases {
            if otherAction == action { continue }
            if self.shortcut(for: otherAction) == shortcut {
                return otherAction
            }
        }
        return nil
    }
}

// MARK: - KeyboardShortcutsView

/// View for configuring keyboard shortcuts.
struct KeyboardShortcutsView: View {

    // MARK: - Storage

    @AppStorage("keyboardShortcuts") private var shortcutsData: Data = Data()

    // MARK: - State

    @State private var config = ShortcutsConfiguration()
    @State private var editingAction: ShortcutAction?
    @State private var showingConflictAlert = false
    @State private var conflictAction: ShortcutAction?
    @State private var pendingShortcut: KeyboardShortcut?
    @State private var showingResetAlert = false

    // MARK: - Body

    var body: some View {
        Form {
            Section {
                ForEach(ShortcutAction.allCases) { action in
                    shortcutRow(for: action)
                }
            } header: {
                Label("Shortcuts", systemImage: "keyboard")
            } footer: {
                Text("Click on a shortcut to change it. Use modifier keys (⌘, ⇧, ⌥, ⌃) with a letter or number key.")
            }

            Section {
                Button("Reset All to Defaults") {
                    showingResetAlert = true
                }
                .foregroundColor(.red)
            } header: {
                Label("Reset", systemImage: "arrow.counterclockwise")
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Keyboard Shortcuts")
        .onAppear {
            loadConfiguration()
        }
        .sheet(item: $editingAction) { action in
            ShortcutRecorderSheet(
                action: action,
                currentShortcut: config.shortcut(for: action),
                onSave: { shortcut in
                    handleShortcutSave(shortcut, for: action)
                },
                onCancel: {
                    editingAction = nil
                }
            )
        }
        .alert("Shortcut Conflict", isPresented: $showingConflictAlert) {
            Button("Replace") {
                if let pending = pendingShortcut, let action = editingAction {
                    // Remove from conflicting action
                    if let conflict = conflictAction {
                        config.resetToDefault(conflict)
                    }
                    config.setShortcut(pending, for: action)
                    saveConfiguration()
                }
                editingAction = nil
            }
            Button("Cancel", role: .cancel) {
                editingAction = nil
            }
        } message: {
            if let conflict = conflictAction {
                Text("This shortcut is already assigned to \"\(conflict.name)\". Replace it?")
            }
        }
        .alert("Reset Shortcuts", isPresented: $showingResetAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                config.resetAll()
                saveConfiguration()
            }
        } message: {
            Text("Reset all keyboard shortcuts to their default values?")
        }
    }

    // MARK: - Shortcut Row

    private func shortcutRow(for action: ShortcutAction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(action.name)
                    .font(.headline)
                Text(action.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Shortcut badge
            Button {
                editingAction = action
            } label: {
                Text(config.shortcut(for: action).displayString)
                    .font(.system(.body, design: .monospaced))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .cornerRadius(6)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Configuration Persistence

    private func loadConfiguration() {
        guard !shortcutsData.isEmpty else {
            config = ShortcutsConfiguration()
            return
        }

        let decoder = JSONDecoder()
        if let decoded = try? decoder.decode(ShortcutsConfiguration.self, from: shortcutsData) {
            config = decoded
        } else {
            config = ShortcutsConfiguration()
        }
    }

    private func saveConfiguration() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(config) {
            shortcutsData = data
        }
    }

    private func handleShortcutSave(_ shortcut: KeyboardShortcut, for action: ShortcutAction) {
        // Check for conflicts
        if let conflict = config.findConflict(for: shortcut, excluding: action) {
            conflictAction = conflict
            pendingShortcut = shortcut
            showingConflictAlert = true
        } else {
            config.setShortcut(shortcut, for: action)
            saveConfiguration()
            editingAction = nil
        }
    }
}

// MARK: - Shortcut Recorder Sheet

/// Sheet for recording a new keyboard shortcut.
struct ShortcutRecorderSheet: View {

    let action: ShortcutAction
    let currentShortcut: KeyboardShortcut
    let onSave: (KeyboardShortcut) -> Void
    let onCancel: () -> Void

    @State private var recordedKey: String = ""
    @State private var recordedModifiers: [ModifierKey] = []
    @State private var isRecording = false

    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "keyboard")
                    .font(.system(size: 32))
                    .foregroundColor(Color(hex: "#8B5CF6"))

                Text("Set Shortcut for \"\(action.name)\"")
                    .font(.headline)

                Text("Press your desired key combination")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Recording area
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
                    .frame(height: 80)

                if recordedKey.isEmpty {
                    Text(currentShortcut.displayString)
                        .font(.system(size: 28, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                } else {
                    Text(displayString)
                        .font(.system(size: 28, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(hex: "#8B5CF6"))
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isRecording ? Color(hex: "#8B5CF6") : Color.clear, lineWidth: 2)
            )
            .onAppear {
                isRecording = true
            }

            // Instructions
            VStack(spacing: 8) {
                HStack(spacing: 16) {
                    ForEach(ModifierKey.allCases, id: \.self) { modifier in
                        HStack(spacing: 4) {
                            Text(modifier.symbol)
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(recordedModifiers.contains(modifier) ? Color(hex: "#8B5CF6") : .secondary)
                            Text(modifier.rawValue.capitalized)
                                .font(.caption)
                                .foregroundColor(recordedModifiers.contains(modifier) ? .primary : .secondary)
                        }
                    }
                }

                Text("Hold modifier keys, then press a letter or number")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Buttons
            HStack(spacing: 16) {
                Button("Reset to Default") {
                    recordedKey = action.defaultShortcut.key
                    recordedModifiers = action.defaultShortcut.modifiers
                }
                .buttonStyle(.bordered)

                Spacer()

                Button("Cancel") {
                    onCancel()
                }
                .keyboardShortcut(.escape, modifiers: [])

                Button("Save") {
                    if !recordedKey.isEmpty && !recordedModifiers.isEmpty {
                        onSave(KeyboardShortcut(key: recordedKey, modifiers: recordedModifiers))
                    } else {
                        onSave(currentShortcut)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: "#8B5CF6"))
                .disabled(recordedKey.isEmpty && recordedModifiers.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 400)
        .background(
            KeyEventMonitor(
                onKeyPress: { key, modifiers in
                    recordedKey = key
                    recordedModifiers = modifiers
                },
                onModifiersChanged: { modifiers in
                    recordedModifiers = modifiers
                }
            )
        )
    }

    private var displayString: String {
        let modifierString = recordedModifiers
            .sorted { $0.displayOrder < $1.displayOrder }
            .map { $0.symbol }
            .joined()
        return modifierString + recordedKey.uppercased()
    }
}

// MARK: - Key Event Monitor

/// View modifier that monitors key events.
struct KeyEventMonitor: NSViewRepresentable {
    let onKeyPress: (String, [ModifierKey]) -> Void
    let onModifiersChanged: ([ModifierKey]) -> Void

    func makeNSView(context: Context) -> KeyCaptureView {
        let view = KeyCaptureView()
        view.onKeyPress = onKeyPress
        view.onModifiersChanged = onModifiersChanged
        return view
    }

    func updateNSView(_ nsView: KeyCaptureView, context: Context) {
        nsView.onKeyPress = onKeyPress
        nsView.onModifiersChanged = onModifiersChanged
    }
}

/// Custom NSView that captures key events.
class KeyCaptureView: NSView {
    var onKeyPress: ((String, [ModifierKey]) -> Void)?
    var onModifiersChanged: (([ModifierKey]) -> Void)?

    override var acceptsFirstResponder: Bool { true }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        window?.makeFirstResponder(self)
    }

    override func keyDown(with event: NSEvent) {
        guard let characters = event.charactersIgnoringModifiers?.lowercased(),
              !characters.isEmpty else { return }

        let modifiers = parseModifiers(event.modifierFlags)
        guard !modifiers.isEmpty else { return }

        onKeyPress?(characters, modifiers)
    }

    override func flagsChanged(with event: NSEvent) {
        let modifiers = parseModifiers(event.modifierFlags)
        onModifiersChanged?(modifiers)
    }

    private func parseModifiers(_ flags: NSEvent.ModifierFlags) -> [ModifierKey] {
        var modifiers: [ModifierKey] = []
        if flags.contains(.command) { modifiers.append(.command) }
        if flags.contains(.shift) { modifiers.append(.shift) }
        if flags.contains(.option) { modifiers.append(.option) }
        if flags.contains(.control) { modifiers.append(.control) }
        return modifiers
    }
}

// MARK: - Preview

#if DEBUG
struct KeyboardShortcutsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            KeyboardShortcutsView()
        }
        .frame(width: 500, height: 500)
    }
}
#endif
