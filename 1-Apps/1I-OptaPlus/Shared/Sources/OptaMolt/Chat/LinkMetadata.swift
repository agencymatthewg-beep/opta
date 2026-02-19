//
//  LinkMetadata.swift
//  OptaMolt
//
//  URL metadata extraction for rich link previews.
//  Fetches Open Graph / HTML meta tags and displays title + description + thumbnail.
//  Zero external dependencies — uses URLSession + basic HTML parsing.
//

import Foundation
import SwiftUI
import os.log
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Link Metadata Model

/// Extracted metadata from a URL (Open Graph, Twitter Card, or HTML meta).
public struct LinkMetadata: Equatable, Sendable {
    public let url: URL
    public let title: String?
    public let description: String?
    public let imageURL: URL?
    public let siteName: String?
    public let hostname: String
    
    public init(url: URL, title: String? = nil, description: String? = nil, imageURL: URL? = nil, siteName: String? = nil) {
        self.url = url
        self.title = title
        self.description = description
        self.imageURL = imageURL
        self.siteName = siteName
        self.hostname = url.host?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString
    }
}

// MARK: - Metadata Fetcher

/// Fetches and caches URL metadata using lightweight HTML parsing.
public actor LinkMetadataFetcher {
    public static let shared = LinkMetadataFetcher()
    
    private var cache: [URL: LinkMetadata] = [:]
    private var inFlight: [URL: Task<LinkMetadata?, Never>] = [:]
    private let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "LinkMetadata")
    
    /// Fetch metadata for a URL (cached).
    public func fetch(url: URL) async -> LinkMetadata? {
        if let cached = cache[url] { return cached }
        
        // Deduplicate in-flight requests
        if let existing = inFlight[url] {
            return await existing.value
        }
        
        let task = Task<LinkMetadata?, Never> {
            await fetchMetadata(url: url)
        }
        inFlight[url] = task
        let result = await task.value
        inFlight.removeValue(forKey: url)
        
        if let result {
            cache[url] = result
        }
        return result
    }
    
    private func fetchMetadata(url: URL) async -> LinkMetadata? {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", forHTTPHeaderField: "User-Agent")
        // Only fetch the first 50KB for metadata
        request.setValue("bytes=0-51200", forHTTPHeaderField: "Range")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...399).contains(httpResponse.statusCode),
                  let html = String(data: data.prefix(51200), encoding: .utf8) else {
                return LinkMetadata(url: url)
            }
            return parseHTML(html, url: url)
        } catch {
            logger.debug("Failed to fetch metadata for \(url): \(error.localizedDescription)")
            return nil
        }
    }
    
    private func parseHTML(_ html: String, url: URL) -> LinkMetadata {
        let title = extractMeta(html, property: "og:title")
            ?? extractMeta(html, name: "twitter:title")
            ?? extractHTMLTitle(html)
        
        let description = extractMeta(html, property: "og:description")
            ?? extractMeta(html, name: "twitter:description")
            ?? extractMeta(html, name: "description")
        
        let imageString = extractMeta(html, property: "og:image")
            ?? extractMeta(html, name: "twitter:image")
        
        let imageURL: URL? = imageString.flatMap { img in
            if img.hasPrefix("http") {
                return URL(string: img)
            } else if img.hasPrefix("//") {
                return URL(string: "https:\(img)")
            } else {
                return URL(string: img, relativeTo: url)?.absoluteURL
            }
        }
        
        let siteName = extractMeta(html, property: "og:site_name")
        
        return LinkMetadata(
            url: url,
            title: title?.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description?.trimmingCharacters(in: .whitespacesAndNewlines),
            imageURL: imageURL,
            siteName: siteName?.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }
    
    // MARK: - HTML Parsing Helpers
    
    private func extractMeta(_ html: String, property: String) -> String? {
        // Match: <meta property="og:title" content="...">
        let pattern = #"<meta[^>]*property\s*=\s*["']\#(property)["'][^>]*content\s*=\s*["']([^"']*)["']"#
        let altPattern = #"<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']\#(property)["']"#
        
        if let match = html.range(of: pattern, options: .regularExpression),
           let contentRange = extractGroup(from: String(html[match]), pattern: #"content\s*=\s*["']([^"']*)["']"#) {
            return String(contentRange)
        }
        if let match = html.range(of: altPattern, options: .regularExpression),
           let contentRange = extractGroup(from: String(html[match]), pattern: #"content\s*=\s*["']([^"']*)["']"#) {
            return String(contentRange)
        }
        return nil
    }
    
    private func extractMeta(_ html: String, name: String) -> String? {
        let pattern = #"<meta[^>]*name\s*=\s*["']\#(name)["'][^>]*content\s*=\s*["']([^"']*)["']"#
        let altPattern = #"<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']\#(name)["']"#
        
        if let match = html.range(of: pattern, options: [.regularExpression, .caseInsensitive]),
           let contentRange = extractGroup(from: String(html[match]), pattern: #"content\s*=\s*["']([^"']*)["']"#) {
            return String(contentRange)
        }
        if let match = html.range(of: altPattern, options: [.regularExpression, .caseInsensitive]),
           let contentRange = extractGroup(from: String(html[match]), pattern: #"content\s*=\s*["']([^"']*)["']"#) {
            return String(contentRange)
        }
        return nil
    }
    
    private func extractHTMLTitle(_ html: String) -> String? {
        let pattern = #"<title[^>]*>([^<]*)</title>"#
        guard let match = html.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
        let matched = String(html[match])
        return extractGroup(from: matched, pattern: #">([^<]*)<"#).map(String.init)
    }
    
    private func extractGroup(from text: String, pattern: String) -> Substring? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return text[range]
    }
}

// MARK: - Rich Link Preview Card

/// Enhanced link preview card with metadata (title, description, thumbnail).
public struct RichLinkPreviewCard: View {
    let url: URL
    @State private var metadata: LinkMetadata?
    @State private var isLoading = true
    @State private var isHovered = false
    
    public init(url: URL) {
        self.url = url
    }
    
    private var hostname: String {
        url.host?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString
    }
    
    public var body: some View {
        Button(action: openURL) {
            HStack(spacing: 12) {
                // Thumbnail or icon
                thumbnailView
                
                // Text content
                VStack(alignment: .leading, spacing: 3) {
                    if let title = metadata?.title, !title.isEmpty {
                        Text(title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.optaTextPrimary)
                            .lineLimit(2)
                    }
                    
                    if let desc = metadata?.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.optaTextSecondary)
                            .lineLimit(2)
                    }
                    
                    // Domain
                    HStack(spacing: 4) {
                        Image(systemName: "link")
                            .font(.system(size: 9))
                        Text(metadata?.siteName ?? hostname)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(Color.optaTextMuted)
                }
                
                Spacer(minLength: 0)
                
                Image(systemName: "arrow.up.right.square")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.optaTextMuted)
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
            withAnimation(.easeOut(duration: 0.15)) { isHovered = hovering }
        }
        .task {
            metadata = await LinkMetadataFetcher.shared.fetch(url: url)
            isLoading = false
        }
    }
    
    @ViewBuilder
    private var thumbnailView: some View {
        if let imageURL = metadata?.imageURL {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                default:
                    linkIcon
                }
            }
        } else {
            linkIcon
        }
    }
    
    private var linkIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.optaPrimary.opacity(0.15))
                .frame(width: 48, height: 48)
            Image(systemName: "link")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.optaPrimary)
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

// MARK: - Rich Link Previews Container

/// Displays rich link preview cards for all URLs detected in message text.
/// Use this instead of LinkPreviewsView for enhanced metadata display.
public struct RichLinkPreviewsView: View {
    let text: String
    @State private var urls: [URL] = []
    
    public init(text: String) {
        self.text = text
    }
    
    public var body: some View {
        VStack(spacing: 6) {
            ForEach(urls.prefix(3), id: \.absoluteString) { url in
                if !URLDetector.isImageURL(url) {
                    RichLinkPreviewCard(url: url)
                }
            }
        }
        .onAppear { urls = URLDetector.detectURLs(in: text) }
        .onChange(of: text) { _, newText in urls = URLDetector.detectURLs(in: newText) }
    }
}

// MARK: - Preview

#if DEBUG
struct RichLinkPreview_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 12) {
            RichLinkPreviewCard(url: URL(string: "https://github.com/apple/swift")!)
            RichLinkPreviewCard(url: URL(string: "https://developer.apple.com/documentation/swiftui")!)
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
