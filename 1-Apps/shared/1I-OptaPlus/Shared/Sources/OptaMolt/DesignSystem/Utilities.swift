//
//  Utilities.swift
//  OptaMolt
//
//  Shared formatting and clipboard utilities used across iOS and macOS.
//  Centralised here to eliminate duplication in view-local private functions.
//

import SwiftUI

#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - OptaFormatting

public enum OptaFormatting {

    // MARK: Cached formatters (allocated once)

    private static let mediumDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    // MARK: - Relative Time

    /// Human-readable relative time: "just now", "3m ago", "2h ago", "5d ago", or "Feb 12".
    public static func relativeTime(_ date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(seconds / 60)m ago" }
        if seconds < 86400 { return "\(seconds / 3600)h ago" }
        if seconds < 604800 { return "\(seconds / 86400)d ago" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    // MARK: - Format Date

    /// Medium-style date with short time: "Feb 15, 2026, 10:30 PM".
    public static func formatDate(_ date: Date) -> String {
        mediumDateFormatter.string(from: date)
    }

    // MARK: - Format Uptime

    /// Human-readable uptime from seconds: "45s", "12m", "3h 22m", "2d 5h".
    public static func formatUptime(_ seconds: Double) -> String {
        let s = Int(seconds)
        let days = s / 86400
        let hours = (s % 86400) / 3600
        let mins = (s % 3600) / 60
        if days > 0 { return "\(days)d \(hours)h" }
        if hours > 0 { return "\(hours)h \(mins)m" }
        if s >= 60 { return "\(mins)m" }
        return "\(s)s"
    }

    // MARK: - Format Duration

    /// Human-readable duration from milliseconds: "120ms", "3.5s", "2m 15s".
    public static func formatDuration(_ ms: Int) -> String {
        if ms < 1000 { return "\(ms)ms" }
        if ms < 60_000 { return String(format: "%.1fs", Double(ms) / 1000) }
        return "\(ms / 60_000)m \((ms % 60_000) / 1000)s"
    }

    // MARK: - Clipboard

    /// Cross-platform copy to system clipboard.
    public static func copyToClipboard(_ text: String) {
        #if canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #elseif canImport(UIKit)
        UIPasteboard.general.string = text
        #endif
    }
}

// MARK: - ChannelType Color Extension

public extension ChannelType {
    /// The Opta accent color for this channel type.
    var color: Color {
        switch self {
        case .telegram: return .optaBlue
        case .direct:   return .optaCoral
        case .whatsapp: return .optaGreen
        case .discord:  return .optaIndigo
        }
    }
}
