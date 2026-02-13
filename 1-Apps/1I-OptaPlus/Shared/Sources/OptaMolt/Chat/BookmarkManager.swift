//
//  BookmarkManager.swift
//  OptaMolt
//
//  Bookmark important messages across all bots.
//  Stored locally as JSON.
//

import Foundation
import SwiftUI

// MARK: - Bookmark Model

public struct MessageBookmark: Identifiable, Codable, Equatable {
    public let id: String
    public let messageId: String
    public let contentPreview: String
    public let botName: String
    public let botId: String
    public let timestamp: Date
    public var note: String

    public init(messageId: String, contentPreview: String, botName: String, botId: String, timestamp: Date, note: String = "") {
        self.id = UUID().uuidString
        self.messageId = messageId
        self.contentPreview = String(contentPreview.prefix(300))
        self.botName = botName
        self.botId = botId
        self.timestamp = timestamp
        self.note = note
    }
}

// MARK: - Bookmark Manager

@MainActor
public final class BookmarkManager: ObservableObject {
    public static let shared = BookmarkManager()

    @Published public var bookmarks: [MessageBookmark] = []

    private let fileURL: URL

    private init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OptaPlus", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        self.fileURL = support.appendingPathComponent("bookmarks.json")
        load()
    }

    public func isBookmarked(_ messageId: String) -> Bool {
        bookmarks.contains { $0.messageId == messageId }
    }

    public func toggle(message: ChatMessage, botName: String, botId: String) {
        if let idx = bookmarks.firstIndex(where: { $0.messageId == message.id }) {
            bookmarks.remove(at: idx)
        } else {
            let bm = MessageBookmark(
                messageId: message.id,
                contentPreview: message.content,
                botName: botName,
                botId: botId,
                timestamp: message.timestamp
            )
            bookmarks.insert(bm, at: 0)
        }
        save()
    }

    public func updateNote(_ bookmarkId: String, note: String) {
        if let idx = bookmarks.firstIndex(where: { $0.id == bookmarkId }) {
            bookmarks[idx].note = note
            save()
        }
    }

    public func remove(_ bookmarkId: String) {
        bookmarks.removeAll { $0.id == bookmarkId }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode([MessageBookmark].self, from: data) else { return }
        bookmarks = decoded
    }

    private func save() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(bookmarks) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}

// MARK: - Bookmarks View

public struct BookmarksView: View {
    @StateObject private var manager = BookmarkManager.shared
    @State private var editingNote: String? = nil
    @State private var noteText = ""
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                if manager.bookmarks.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bookmark.slash")
                            .font(.system(size: 36))
                            .foregroundColor(.optaTextMuted)
                        Text("No bookmarks yet")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                        Text("Long-press or right-click a message to bookmark it")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(manager.bookmarks) { bm in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 6) {
                                    Image(systemName: "bookmark.fill")
                                        .font(.system(size: 10))
                                        .foregroundColor(.optaPrimary)
                                    Text(bm.botName)
                                        .font(.caption.weight(.semibold))
                                        .foregroundColor(.optaTextSecondary)
                                    Spacer()
                                    Text(bm.timestamp, style: .relative)
                                        .font(.caption2)
                                        .foregroundColor(.optaTextMuted)
                                }
                                Text(bm.contentPreview)
                                    .font(.subheadline)
                                    .foregroundColor(.optaTextPrimary)
                                    .lineLimit(3)
                                if !bm.note.isEmpty {
                                    Text("📝 \(bm.note)")
                                        .font(.caption)
                                        .foregroundColor(.optaTextSecondary)
                                        .italic()
                                }
                            }
                            .padding(.vertical, 4)
                            .contextMenu {
                                Button {
                                    editingNote = bm.id
                                    noteText = bm.note
                                } label: {
                                    Label("Edit Note", systemImage: "pencil")
                                }
                                Button(role: .destructive) {
                                    manager.remove(bm.id)
                                } label: {
                                    Label("Remove Bookmark", systemImage: "bookmark.slash")
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Bookmarks")
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
            .alert("Edit Note", isPresented: Binding(
                get: { editingNote != nil },
                set: { if !$0 { editingNote = nil } }
            )) {
                TextField("Note", text: $noteText)
                Button("Save") {
                    if let id = editingNote {
                        manager.updateNote(id, note: noteText)
                    }
                    editingNote = nil
                }
                Button("Cancel", role: .cancel) { editingNote = nil }
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 300)
        #endif
    }
}
