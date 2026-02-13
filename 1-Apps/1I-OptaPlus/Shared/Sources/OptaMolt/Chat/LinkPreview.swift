//
//  LinkPreview.swift
//  OptaMolt
//
//  Link preview cards for URLs detected in messages.
//  Shows domain name, link icon, and glass-styled card.
//  Tappable to open URL in browser.
//

import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - URL Detection

/// Detects and extracts URLs from message text
public enum URLDetector {
    /// Extract all URLs from a string
    public static func detectURLs(in text: String) -> [URL] {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return []
        }
        let range = NSRange(text.startIndex..., in: text)
        let matches = detector.matches(in: text, options: [], range: range)
        return matches.compactMap { $0.url }
    }

    /// Check if a URL points to an image
    public static func isImageURL(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        return ["png", "jpg", "jpeg", "gif", "webp", "svg"].contains(ext)
    }
}

// MARK: - Link Preview Card

/// A glass-styled preview card for a URL
public struct LinkPreviewCard: View {
    let url: URL

    @State private var isHovered = false

    public init(url: URL) {
        self.url = url
    }

    private var hostname: String {
        url.host?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString
    }

    private var faviconURL: URL? {
        guard let host = url.host else { return nil }
        return URL(string: "https://www.google.com/s2/favicons?domain=\(host)&sz=32")
    }

    public var body: some View {
        Button(action: openURL) {
            HStack(spacing: 12) {
                // Link icon / favicon
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaPrimary.opacity(0.15))
                        .frame(width: 40, height: 40)

                    Image(systemName: "link")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.optaPrimary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    // Domain name
                    Text(hostname)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                        .lineLimit(1)

                    // Full URL (truncated)
                    Text(url.absoluteString)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                Spacer()

                Image(systemName: "arrow.up.right.square")
                    .font(.system(size: 14))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.optaSurface.opacity(0.6))
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaBorder.opacity(0.25), lineWidth: 0.5)
            )
            .brightness(isHovered ? 0.05 : 0)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) { isHovered = hovering }
        }
    }

    private func openURL() {
        #if canImport(AppKit)
        NSWorkspace.shared.open(url)
        #elseif canImport(UIKit)
        UIApplication.shared.open(url)
        #endif
    }
}

// MARK: - Link Previews Container

/// Displays link preview cards for all URLs detected in message text
public struct LinkPreviewsView: View {
    let text: String

    @State private var urls: [URL] = []

    public init(text: String) {
        self.text = text
    }

    public var body: some View {
        VStack(spacing: 6) {
            ForEach(urls, id: \.absoluteString) { url in
                if !URLDetector.isImageURL(url) {
                    LinkPreviewCard(url: url)
                }
            }
        }
        .onAppear { urls = URLDetector.detectURLs(in: text) }
        .onChange(of: text) { _, newText in urls = URLDetector.detectURLs(in: newText) }
    }
}

// MARK: - Preview

#if DEBUG
struct LinkPreview_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 12) {
            LinkPreviewCard(url: URL(string: "https://github.com/apple/swift")!)
            LinkPreviewCard(url: URL(string: "https://developer.apple.com/documentation/swiftui")!)
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
