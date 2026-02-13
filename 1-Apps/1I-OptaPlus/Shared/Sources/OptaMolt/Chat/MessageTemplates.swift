//
//  MessageTemplates.swift
//  OptaMolt
//
//  Save and reuse frequently sent messages as templates with variable substitution.
//

import Foundation
import SwiftUI

// MARK: - Message Template Model

public struct MessageTemplate: Identifiable, Codable, Equatable {
    public let id: String
    public var name: String
    public var content: String
    public var createdAt: Date
    
    public init(id: String = UUID().uuidString, name: String, content: String, createdAt: Date = Date()) {
        self.id = id
        self.name = name
        self.content = content
        self.createdAt = createdAt
    }
    
    /// Resolve template variables like {{botname}}, {{date}}, {{time}}.
    public func resolved(botName: String) -> String {
        let now = Date()
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "yyyy-MM-dd"
        let timeFmt = DateFormatter()
        timeFmt.dateFormat = "HH:mm"
        
        return content
            .replacingOccurrences(of: "{{botname}}", with: botName)
            .replacingOccurrences(of: "{{date}}", with: dateFmt.string(from: now))
            .replacingOccurrences(of: "{{time}}", with: timeFmt.string(from: now))
    }
}

// MARK: - Template Manager

public final class MessageTemplateManager: ObservableObject {
    public static let shared = MessageTemplateManager()
    
    private let fileURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OptaPlus", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("message-templates.json")
    }()
    
    @Published public var templates: [MessageTemplate] = []
    
    private init() {
        load()
    }
    
    public func add(name: String, content: String) {
        templates.append(MessageTemplate(name: name, content: content))
        save()
    }
    
    public func update(_ template: MessageTemplate) {
        if let idx = templates.firstIndex(where: { $0.id == template.id }) {
            templates[idx] = template
            save()
        }
    }
    
    public func delete(id: String) {
        templates.removeAll { $0.id == id }
        save()
    }
    
    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? JSONDecoder().decode([MessageTemplate].self, from: data) else { return }
        self.templates = saved
    }
    
    private func save() {
        if let data = try? JSONEncoder().encode(templates) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}

// MARK: - Template Picker View

public struct TemplatePickerView: View {
    @ObservedObject private var manager = MessageTemplateManager.shared
    let botName: String
    let onSelect: (String) -> Void
    let onDismiss: () -> Void
    
    @State private var editingTemplate: MessageTemplate?
    @State private var editName = ""
    @State private var editContent = ""
    
    public init(botName: String, onSelect: @escaping (String) -> Void, onDismiss: @escaping () -> Void) {
        self.botName = botName
        self.onSelect = onSelect
        self.onDismiss = onDismiss
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Templates")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.optaTextMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            
            if manager.templates.isEmpty {
                Text("No templates yet.\nLong-press send to save one.")
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(manager.templates) { tmpl in
                            Button(action: {
                                onSelect(tmpl.resolved(botName: botName))
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(tmpl.name)
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(.optaTextPrimary)
                                        Text(tmpl.content.prefix(60) + (tmpl.content.count > 60 ? "…" : ""))
                                            .font(.system(size: 11))
                                            .foregroundColor(.optaTextMuted)
                                            .lineLimit(1)
                                    }
                                    Spacer()
                                    Button(action: {
                                        manager.delete(id: tmpl.id)
                                    }) {
                                        Image(systemName: "trash")
                                            .font(.system(size: 10))
                                            .foregroundColor(.optaTextMuted)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 200)
            }
        }
        .frame(width: 260)
        .padding(.bottom, 8)
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
    }
}
