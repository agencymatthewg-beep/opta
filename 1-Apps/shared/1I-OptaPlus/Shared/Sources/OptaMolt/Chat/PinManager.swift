//
//  PinManager.swift
//  OptaMolt
//
//  Local persistence for pinned message IDs per bot.
//

import Foundation
import SwiftUI

// MARK: - Pin Manager

@MainActor
public final class PinManager: ObservableObject {
    public static let shared = PinManager()

    /// botId → Set of pinned message IDs
    @Published public var pinnedIds: [String: Set<String>] = [:]

    private let fileURL: URL

    private init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OptaPlus", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        self.fileURL = support.appendingPathComponent("pinned-messages.json")
        load()
    }

    public func isPinned(_ messageId: String, botId: String) -> Bool {
        pinnedIds[botId]?.contains(messageId) ?? false
    }

    public func togglePin(_ messageId: String, botId: String) {
        if pinnedIds[botId] == nil { pinnedIds[botId] = [] }
        if pinnedIds[botId]!.contains(messageId) {
            pinnedIds[botId]!.remove(messageId)
        } else {
            pinnedIds[botId]!.insert(messageId)
        }
        save()
    }

    public func pinnedMessages(from messages: [ChatMessage], botId: String) -> [ChatMessage] {
        guard let ids = pinnedIds[botId] else { return [] }
        return messages.filter { ids.contains($0.id) }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data) else { return }
        pinnedIds = decoded.mapValues { Set($0) }
    }

    private func save() {
        let encodable = pinnedIds.mapValues { Array($0) }
        if let data = try? JSONEncoder().encode(encodable) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}

// MARK: - Pinned Messages Sheet

public struct PinnedMessagesSheet: View {
    let messages: [ChatMessage]
    let botName: String
    let onScrollTo: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    public init(messages: [ChatMessage], botName: String, onScrollTo: @escaping (String) -> Void) {
        self.messages = messages
        self.botName = botName
        self.onScrollTo = onScrollTo
    }

    public var body: some View {
        NavigationStack {
            Group {
                if messages.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "pin.slash")
                            .font(.system(size: 36))
                            .foregroundColor(.optaTextMuted)
                        Text("No pinned messages")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(messages) { msg in
                        Button {
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                onScrollTo(msg.id)
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Image(systemName: "pin.fill")
                                        .font(.system(size: 10))
                                        .foregroundColor(.yellow)
                                    Text(msg.sender == .user ? "You" : botName)
                                        .font(.caption.weight(.semibold))
                                        .foregroundColor(.optaTextSecondary)
                                    Spacer()
                                    Text(msg.timestamp, style: .relative)
                                        .font(.caption2)
                                        .foregroundColor(.optaTextMuted)
                                }
                                Text(msg.content.prefix(200))
                                    .font(.subheadline)
                                    .foregroundColor(.optaTextPrimary)
                                    .lineLimit(3)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Pinned Messages")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            #else
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 300)
        #endif
    }
}
