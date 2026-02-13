//
//  ChatExporter.swift
//  OptaMolt
//
//  Export chat history as Markdown, JSON, or plain text.
//  Platform-specific save/share integration for macOS and iOS.
//

import Foundation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Export Format

public enum ChatExportFormat: String, CaseIterable {
    case markdown = "md"
    case json = "json"
    case plainText = "txt"

    public var label: String {
        switch self {
        case .markdown: return "Markdown"
        case .json: return "JSON"
        case .plainText: return "Plain Text"
        }
    }

    public var fileExtension: String { rawValue }
    public var mimeType: String {
        switch self {
        case .markdown: return "text/markdown"
        case .json: return "application/json"
        case .plainText: return "text/plain"
        }
    }
}

// MARK: - Chat Exporter

public struct ChatExporter {

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f
    }()

    private static let fileDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    // MARK: - Export Content

    /// Generate export content as a String for the given format.
    public static func export(messages: [ChatMessage], botName: String, format: ChatExportFormat) -> String {
        switch format {
        case .markdown:
            return exportMarkdown(messages: messages, botName: botName)
        case .json:
            return exportJSON(messages: messages, botName: botName)
        case .plainText:
            return exportPlainText(messages: messages, botName: botName)
        }
    }

    /// Generate export data as Data.
    public static func exportData(messages: [ChatMessage], botName: String, format: ChatExportFormat) -> Data {
        export(messages: messages, botName: botName, format: format).data(using: .utf8) ?? Data()
    }

    /// Suggested filename for export.
    public static func suggestedFilename(botName: String, format: ChatExportFormat) -> String {
        let date = fileDateFormatter.string(from: Date())
        let safeName = botName.replacingOccurrences(of: " ", with: "-").lowercased()
        return "chat-\(safeName)-\(date).\(format.fileExtension)"
    }

    // MARK: - Markdown

    private static func exportMarkdown(messages: [ChatMessage], botName: String) -> String {
        var lines = [String]()
        lines.append("# Chat with \(botName)")
        lines.append("")
        lines.append("*Exported \(dateFormatter.string(from: Date()))*")
        lines.append("")
        lines.append("---")
        lines.append("")

        for message in messages {
            let sender: String
            switch message.sender {
            case .user: sender = "**You**"
            case .bot(let name): sender = "**\(name)**"
            }
            let time = dateFormatter.string(from: message.timestamp)
            lines.append("\(sender) — *\(time)*")
            lines.append("")
            lines.append(message.content)
            lines.append("")
            lines.append("---")
            lines.append("")
        }

        lines.append("*\(messages.count) messages total*")
        return lines.joined(separator: "\n")
    }

    // MARK: - JSON

    private static func exportJSON(messages: [ChatMessage], botName: String) -> String {
        struct ExportMessage: Codable {
            let id: String
            let sender: String
            let content: String
            let timestamp: String
        }

        let exportMessages = messages.map { msg in
            ExportMessage(
                id: msg.id,
                sender: msg.sender.accessibleName,
                content: msg.content,
                timestamp: ISO8601DateFormatter().string(from: msg.timestamp)
            )
        }

        struct ExportRoot: Codable {
            let botName: String
            let exportedAt: String
            let messageCount: Int
            let messages: [ExportMessage]
        }

        let root = ExportRoot(
            botName: botName,
            exportedAt: ISO8601DateFormatter().string(from: Date()),
            messageCount: messages.count,
            messages: exportMessages
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(root),
              let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }

    // MARK: - Plain Text

    private static func exportPlainText(messages: [ChatMessage], botName: String) -> String {
        var lines = [String]()
        lines.append("Chat with \(botName)")
        lines.append("Exported \(dateFormatter.string(from: Date()))")
        lines.append(String(repeating: "=", count: 50))
        lines.append("")

        for message in messages {
            let sender: String
            switch message.sender {
            case .user: sender = "You"
            case .bot(let name): sender = name
            }
            let time = dateFormatter.string(from: message.timestamp)
            lines.append("[\(time)] \(sender):")
            lines.append(message.content)
            lines.append("")
        }

        lines.append(String(repeating: "=", count: 50))
        lines.append("\(messages.count) messages total")
        return lines.joined(separator: "\n")
    }

    // MARK: - Platform Save/Share

    #if canImport(AppKit)
    /// macOS: Show NSSavePanel to save exported chat.
    @MainActor
    public static func saveWithPanel(messages: [ChatMessage], botName: String, format: ChatExportFormat) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename(botName: botName, format: format)
        panel.allowedContentTypes = [.plainText]
        panel.canCreateDirectories = true
        panel.title = "Export Chat"
        panel.message = "Save chat history with \(botName)"

        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let data = exportData(messages: messages, botName: botName, format: format)
            try? data.write(to: url, options: .atomic)
        }
    }
    #endif

    #if canImport(UIKit)
    /// iOS: Create a temporary file URL for sharing via UIActivityViewController.
    public static func temporaryFileURL(messages: [ChatMessage], botName: String, format: ChatExportFormat) -> URL? {
        let filename = suggestedFilename(botName: botName, format: format)
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        let data = exportData(messages: messages, botName: botName, format: format)
        do {
            try data.write(to: tempURL, options: .atomic)
            return tempURL
        } catch {
            NSLog("[ChatExporter] Failed to write temp file: \(error)")
            return nil
        }
    }
    #endif
}
