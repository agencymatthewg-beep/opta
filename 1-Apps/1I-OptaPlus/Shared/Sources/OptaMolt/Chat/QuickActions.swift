//
//  QuickActions.swift
//  OptaMolt
//
//  Predefined prompt shortcuts shown as chips above input when chat is empty.
//

import Foundation
import SwiftUI

// MARK: - Quick Action Model

public struct QuickAction: Identifiable, Codable, Equatable, Hashable {
    public let id: String
    public var label: String
    public var prompt: String
    public var category: QuickActionCategory
    public var icon: String
    
    public init(id: String = UUID().uuidString, label: String, prompt: String, category: QuickActionCategory, icon: String = "sparkles") {
        self.id = id
        self.label = label
        self.prompt = prompt
        self.category = category
        self.icon = icon
    }
}

public enum QuickActionCategory: String, Codable, CaseIterable, Hashable {
    case general = "General"
    case code = "Code"
    case system = "System"
    
    public var icon: String {
        switch self {
        case .general: return "text.bubble"
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .system: return "gearshape"
        }
    }
}

// MARK: - Quick Action Manager

@MainActor
public final class QuickActionManager: ObservableObject {
    public static let shared = QuickActionManager()
    
    private let storageKey = "optaplus.quickActions"
    
    @Published public var actions: [QuickAction] {
        didSet { save() }
    }
    
    private init() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode([QuickAction].self, from: data), !saved.isEmpty {
            self.actions = saved
        } else {
            self.actions = Self.defaults
        }
    }
    
    public static let defaults: [QuickAction] = [
        QuickAction(label: "Summarize this", prompt: "Summarize this", category: .general, icon: "text.alignleft"),
        QuickAction(label: "Explain like I'm 5", prompt: "Explain like I'm 5", category: .general, icon: "lightbulb"),
        QuickAction(label: "Review this code", prompt: "Review this code", category: .code, icon: "magnifyingglass"),
        QuickAction(label: "Write a function", prompt: "Write a function that ", category: .code, icon: "function"),
        QuickAction(label: "Check status", prompt: "Check status", category: .system, icon: "heart.text.square"),
        QuickAction(label: "Run heartbeat", prompt: "Run heartbeat", category: .system, icon: "heart.circle"),
    ]
    
    public func add(_ action: QuickAction) {
        actions.append(action)
    }
    
    public func remove(id: String) {
        actions.removeAll { $0.id == id }
    }
    
    public func move(from source: IndexSet, to destination: Int) {
        actions.move(fromOffsets: source, toOffset: destination)
    }
    
    public func resetToDefaults() {
        actions = Self.defaults
    }
    
    private func save() {
        if let data = try? JSONEncoder().encode(actions) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
}

// MARK: - Quick Actions Chip View

public struct QuickActionsView: View {
    @ObservedObject private var manager = QuickActionManager.shared
    let onSelect: (String) -> Void
    
    public init(onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
    }
    
    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(manager.actions) { action in
                    Button(action: { onSelect(action.prompt) }) {
                        HStack(spacing: 4) {
                            Image(systemName: action.icon)
                                .font(.system(size: 10))
                            Text(action.label)
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(.optaTextSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(Color.optaSurface.opacity(0.6))
                                .overlay(Capsule().stroke(Color.optaBorder.opacity(0.4), lineWidth: 0.5))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 36)
    }
}
