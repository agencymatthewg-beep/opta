//
//  CommandPalette.swift
//  OptaPlusMacOS
//
//  Spotlight-style command palette overlay (⌘P).
//  Cinematic Void design — glass, violet accents, fuzzy matching.
//

import SwiftUI
import OptaMolt

// MARK: - Command Palette Action

struct PaletteAction: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let subtitle: String?
    let action: () -> Void

    init(icon: String, title: String, subtitle: String? = nil, action: @escaping () -> Void) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.action = action
    }
}

// MARK: - Fuzzy Match

private func fuzzyMatch(query: String, target: String) -> Bool {
    guard !query.isEmpty else { return true }
    let q = query.lowercased()
    let t = target.lowercased()
    var qi = q.startIndex
    for ch in t {
        if ch == q[qi] {
            qi = q.index(after: qi)
            if qi == q.endIndex { return true }
        }
    }
    return false
}

private func fuzzyScore(query: String, target: String) -> Int {
    guard !query.isEmpty else { return 0 }
    let q = query.lowercased()
    let t = target.lowercased()
    var score = 0
    var qi = q.startIndex
    var consecutive = 0
    for (i, ch) in t.enumerated() {
        if qi < q.endIndex && ch == q[qi] {
            score += 1 + consecutive * 2
            if i == 0 { score += 5 } // prefix bonus
            consecutive += 1
            qi = q.index(after: qi)
        } else {
            consecutive = 0
        }
    }
    return qi == q.endIndex ? score : -1
}

// MARK: - Command Palette View

struct CommandPaletteView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @Binding var isPresented: Bool
    var onSearchMessages: (() -> Void)?
    var onToggleSessions: (() -> Void)?

    @State private var query = ""
    @State private var selectedIndex = 0
    @FocusState private var isFocused: Bool

    private var allActions: [PaletteAction] {
        var actions: [PaletteAction] = []

        // Bot switching
        for bot in appState.bots {
            actions.append(PaletteAction(
                icon: bot.emoji.isEmpty ? "cpu" : bot.emoji,
                title: "Switch to \(bot.name)",
                subtitle: "\(bot.host):\(bot.port)"
            ) {
                windowState.selectBot(bot, in: appState)
                isPresented = false
            })
        }

        // Session actions
        actions.append(PaletteAction(icon: "plus.message", title: "New Session", subtitle: "Create a new chat session") {
            if let bot = windowState.selectedBot(in: appState) {
                let vm = appState.viewModel(for: bot)
                if let session = vm.createSession(name: "Quick", mode: .direct) {
                    vm.switchSession(session)
                }
            }
            isPresented = false
        })

        actions.append(PaletteAction(icon: "trash", title: "Clear Chat", subtitle: "Remove all messages") {
            if let vm = windowState.selectedViewModel(in: appState) {
                vm.messages.removeAll()
            }
            isPresented = false
        })

        actions.append(PaletteAction(icon: "sidebar.right", title: "Toggle Sessions", subtitle: "Show/hide session drawer") {
            onToggleSessions?()
            isPresented = false
        })

        actions.append(PaletteAction(icon: "gear", title: "Settings", subtitle: "Open app settings") {
            appState.showingSettings = true
            isPresented = false
        })

        actions.append(PaletteAction(icon: "wifi.slash", title: "Disconnect", subtitle: "Disconnect from current bot") {
            if let vm = windowState.selectedViewModel(in: appState) {
                vm.disconnect()
            }
            isPresented = false
        })

        actions.append(PaletteAction(icon: "magnifyingglass", title: "Search Messages", subtitle: "Find text in chat (⌘F)") {
            onSearchMessages?()
            isPresented = false
        })

        actions.append(PaletteAction(icon: "bolt.circle", title: "Automations", subtitle: "Toggle cron job manager (⌘J)") {
            NotificationCenter.default.post(name: .toggleAutomations, object: nil)
            isPresented = false
        })

        actions.append(PaletteAction(icon: "globe.americas", title: "Bot Web", subtitle: "Toggle network topology (⌘⇧B)") {
            NotificationCenter.default.post(name: .toggleBotWeb, object: nil)
            isPresented = false
        })

        actions.append(PaletteAction(icon: "ant", title: "Debug", subtitle: "Toggle debug panel (⌘⇧G)") {
            NotificationCenter.default.post(name: .toggleDebug, object: nil)
            isPresented = false
        })

        return actions
    }

    private var filteredActions: [PaletteAction] {
        guard !query.isEmpty else { return allActions }
        return allActions
            .map { ($0, fuzzyScore(query: query, target: $0.title)) }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .map { $0.0 }
    }

    var body: some View {
        ZStack {
            // Backdrop
            Color.optaVoid.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            VStack(spacing: 0) {
                // Search field
                HStack(spacing: 10) {
                    Image(systemName: "command")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.optaPrimary)

                    TextField("Type a command…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.sora(16))
                        .foregroundColor(.optaTextPrimary)
                        .focused($isFocused)
                        .onSubmit { executeSelected() }
                        .accessibilityLabel("Command palette search")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

                Divider().background(Color.optaBorder.opacity(0.5))

                // Results
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 2) {
                            ForEach(Array(filteredActions.enumerated()), id: \.element.id) { index, action in
                                PaletteRow(
                                    action: action,
                                    isSelected: index == selectedIndex
                                )
                                .id(index)
                                .onTapGesture {
                                    action.action()
                                }
                            }
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 8)
                    }
                    .frame(maxHeight: 320)
                    .onChange(of: selectedIndex) { _, newIdx in
                        withAnimation(.spring(response: 0.15, dampingFraction: 0.8)) {
                            proxy.scrollTo(newIdx, anchor: .center)
                        }
                    }
                }

                // Footer hint
                HStack(spacing: 16) {
                    shortcutHint("↑↓", label: "navigate")
                    shortcutHint("↩", label: "select")
                    shortcutHint("esc", label: "close")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.optaSurface.opacity(0.3))
            }
            .frame(width: 480)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .shadow(color: Color.optaPrimary.opacity(0.15), radius: 30, y: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaPrimary.opacity(0.2), lineWidth: 1)
            )
            .padding(.top, 80)
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .onAppear {
            isFocused = true
            selectedIndex = 0
        }
        .onChange(of: query) { _, _ in
            selectedIndex = 0
        }
        .onKeyPress(.upArrow) {
            if selectedIndex > 0 { selectedIndex -= 1 }
            return .handled
        }
        .onKeyPress(.downArrow) {
            if selectedIndex < filteredActions.count - 1 { selectedIndex += 1 }
            return .handled
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
    }

    private func executeSelected() {
        let actions = filteredActions
        guard selectedIndex < actions.count else { return }
        actions[selectedIndex].action()
    }

    private func shortcutHint(_ key: String, label: String) -> some View {
        HStack(spacing: 4) {
            Text(key)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.optaSurface.opacity(0.6))
                )
            Text(label)
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
        }
    }
}

// MARK: - Palette Row

struct PaletteRow: View {
    let action: PaletteAction
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Icon — emoji or SF Symbol
            Group {
                if action.icon.unicodeScalars.count == 1 && action.icon.unicodeScalars.first!.value > 0x1F000 {
                    Text(action.icon)
                        .font(.system(size: 16))
                } else {
                    Image(systemName: action.icon)
                        .font(.system(size: 14))
                        .foregroundColor(isSelected ? .optaPrimary : .optaTextSecondary)
                }
            }
            .frame(width: 24)

            VStack(alignment: .leading, spacing: 1) {
                Text(action.title)
                    .font(.sora(13, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(.optaTextPrimary)

                if let subtitle = action.subtitle {
                    Text(subtitle)
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected ? Color.optaPrimary.opacity(0.15) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}
