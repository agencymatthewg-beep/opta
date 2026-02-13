//
//  KeyboardShortcuts.swift
//  OptaPlusMacOS
//
//  Keyboard shortcut cheat sheet overlay (⌘/).
//  Glass panel showing all shortcuts in organized groups.
//

import SwiftUI

// MARK: - Shortcut Entry

struct ShortcutEntry: Identifiable {
    let id = UUID()
    let keys: String
    let description: String
}

struct ShortcutGroup: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let shortcuts: [ShortcutEntry]
}

// MARK: - Keyboard Shortcuts View

struct KeyboardShortcutsView: View {
    @Binding var isPresented: Bool

    private let groups: [ShortcutGroup] = [
        ShortcutGroup(name: "Navigation", icon: "arrow.triangle.turn.up.right.diamond", shortcuts: [
            ShortcutEntry(keys: "⌘1–6", description: "Switch to bot 1–6"),
            ShortcutEntry(keys: "⌘P", description: "Command palette"),
            ShortcutEntry(keys: "⌘F", description: "Search messages"),
            ShortcutEntry(keys: "Esc", description: "Close panel / abort"),
        ]),
        ShortcutGroup(name: "Chat", icon: "bubble.left.and.bubble.right", shortcuts: [
            ShortcutEntry(keys: "⏎", description: "Send message"),
            ShortcutEntry(keys: "⇧⏎", description: "New line"),
            ShortcutEntry(keys: "⌘K", description: "Clear chat"),
            ShortcutEntry(keys: "Esc", description: "Abort generation"),
        ]),
        ShortcutGroup(name: "Window", icon: "macwindow", shortcuts: [
            ShortcutEntry(keys: "⌘N", description: "New window"),
            ShortcutEntry(keys: "⌘,", description: "Settings"),
            ShortcutEntry(keys: "⌘W", description: "Close window"),
            ShortcutEntry(keys: "⌘/", description: "This cheat sheet"),
        ]),
        ShortcutGroup(name: "Sessions", icon: "rectangle.stack", shortcuts: [
            ShortcutEntry(keys: "⌘]", description: "Toggle session drawer"),
            ShortcutEntry(keys: "⌘P → New Session", description: "Create session"),
        ]),
    ]

    var body: some View {
        ZStack {
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            VStack(spacing: 0) {
                // Header
                HStack {
                    Image(systemName: "keyboard")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.optaPrimary)

                    Text("Keyboard Shortcuts")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    Spacer()

                    Button(action: { isPresented = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)

                Divider().background(Color.optaBorder.opacity(0.5))

                // Groups in 2-column grid
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible(), spacing: 16),
                        GridItem(.flexible(), spacing: 16),
                    ], spacing: 16) {
                        ForEach(groups) { group in
                            ShortcutGroupCard(group: group)
                        }
                    }
                    .padding(20)
                }
            }
            .frame(width: 520)
            .frame(maxHeight: 420)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .shadow(color: Color.optaPrimary.opacity(0.1), radius: 24, y: 8)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaPrimary.opacity(0.15), lineWidth: 1)
            )
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
        .transition(.opacity.combined(with: .scale(scale: 0.95)))
    }
}

// MARK: - Shortcut Group Card

struct ShortcutGroupCard: View {
    let group: ShortcutGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: group.icon)
                    .font(.system(size: 11))
                    .foregroundColor(.optaPrimary)

                Text(group.name.uppercased())
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }

            ForEach(group.shortcuts) { shortcut in
                HStack(spacing: 8) {
                    Text(shortcut.keys)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextPrimary)
                        .frame(minWidth: 50, alignment: .leading)

                    Text(shortcut.description)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextSecondary)
                        .lineLimit(1)

                    Spacer()
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.optaSurface.opacity(0.3))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
    }
}
