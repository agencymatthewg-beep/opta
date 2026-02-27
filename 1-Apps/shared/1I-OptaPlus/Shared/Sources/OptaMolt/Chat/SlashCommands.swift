//
//  SlashCommands.swift
//  OptaMolt
//
//  Slash command autocomplete system. Typing `/` shows a popup with built-in commands.
//

import Foundation
import SwiftUI

// MARK: - Slash Command Model

public struct SlashCommand: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let description: String
    public let icon: String
    
    public init(name: String, description: String, icon: String) {
        self.id = name
        self.name = name
        self.description = description
        self.icon = icon
    }
}

// MARK: - Slash Command Registry

public final class SlashCommandRegistry {
    public static let shared = SlashCommandRegistry()
    
    public let commands: [SlashCommand] = [
        SlashCommand(name: "/clear", description: "Clear chat history", icon: "trash"),
        SlashCommand(name: "/export", description: "Export chat as file", icon: "square.and.arrow.up"),
        SlashCommand(name: "/pin", description: "Pin last message", icon: "pin"),
        SlashCommand(name: "/search", description: "Search messages", icon: "magnifyingglass"),
        SlashCommand(name: "/theme", description: "Change theme", icon: "paintpalette"),
        SlashCommand(name: "/dashboard", description: "Open dashboard", icon: "square.grid.2x2"),
        SlashCommand(name: "/shortcuts", description: "View keyboard shortcuts", icon: "keyboard"),
        SlashCommand(name: "/template", description: "Insert a message template", icon: "doc.text"),
    ]
    
    public func filter(query: String) -> [SlashCommand] {
        let q = query.lowercased()
        if q.isEmpty || q == "/" { return commands }
        return commands.filter { cmd in
            cmd.name.lowercased().contains(q) || cmd.description.lowercased().contains(q)
        }
    }
}

// MARK: - Slash Command Popup View

public struct SlashCommandPopup: View {
    let query: String
    let onSelect: (SlashCommand) -> Void
    let onDismiss: () -> Void
    
    @State private var selectedIndex: Int = 0
    
    private var filtered: [SlashCommand] {
        SlashCommandRegistry.shared.filter(query: query)
    }
    
    public init(query: String, onSelect: @escaping (SlashCommand) -> Void, onDismiss: @escaping () -> Void) {
        self.query = query
        self.onSelect = onSelect
        self.onDismiss = onDismiss
    }
    
    public var body: some View {
        if filtered.isEmpty { return AnyView(EmptyView()) }
        
        return AnyView(
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(filtered.enumerated()), id: \.element.id) { index, cmd in
                    Button(action: { onSelect(cmd) }) {
                        HStack(spacing: 10) {
                            Image(systemName: cmd.icon)
                                .font(.system(size: 12))
                                .frame(width: 20)
                                .foregroundColor(.optaPrimary)
                            
                            VStack(alignment: .leading, spacing: 1) {
                                Text(cmd.name)
                                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                                    .foregroundColor(.optaTextPrimary)
                                Text(cmd.description)
                                    .font(.system(size: 11))
                                    .foregroundColor(.optaTextMuted)
                            }
                            
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            index == selectedIndex
                                ? Color.optaPrimary.opacity(0.12)
                                : Color.clear
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 280)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.optaSurface.opacity(0.85))
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaBorder.opacity(0.4), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.3), radius: 16, y: -4)
            .onChange(of: query) { _, _ in selectedIndex = 0 }
        )
    }
    
    // For macOS arrow key nav — called externally
    public func moveUp() { selectedIndex = max(0, selectedIndex - 1) }
    public func moveDown() { selectedIndex = min(filtered.count - 1, selectedIndex + 1) }
    public func selectCurrent() { if !filtered.isEmpty { onSelect(filtered[selectedIndex]) } }
}
