//
//  AsyncImageView.swift
//  OptaMolt
//
//  Renders inline images with async loading, shimmer placeholder, and tap-to-expand.
//  Implements Opta glass styling with loading states.
//

import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Shimmer Effect

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [
                        Color.white.opacity(0),
                        Color.white.opacity(0.08),
                        Color.white.opacity(0)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 300
                    }
                }
            )
            .clipped()
    }
}

private extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - AsyncImageView

/// Async image view for displaying markdown inline images
/// Features: shimmer loading, tap-to-expand, error retry
public struct AsyncImageView: View {
    let data: ImageData

    @State private var showFullScreen = false

    public init(data: ImageData) {
        self.data = data
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            AsyncImage(url: data.url) { phase in
                switch phase {
                case .empty:
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.optaSurface.opacity(0.5))
                        .frame(height: 160)
                        .shimmer()
                        .overlay(
                            ProgressView()
                                .tint(.optaPurple)
                        )
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.optaBorder.opacity(0.15), lineWidth: 0.5)
                        )
                        .onTapGesture { showFullScreen = true }
                case .failure:
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.optaSurface.opacity(0.4))
                        .frame(height: 100)
                        .overlay(
                            VStack(spacing: 8) {
                                Image(systemName: "photo.badge.exclamationmark")
                                    .foregroundColor(.optaTextMuted)
                                Text("Failed to load image")
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            }
                        )
                @unknown default:
                    EmptyView()
                }
            }

            // Caption
            if let caption = data.caption, !caption.isEmpty {
                Text(caption)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
                    .italic()
            }
        }
        .accessibilityLabel(data.altText)
        .sheet(isPresented: $showFullScreen) {
            FullScreenImageView(url: data.url, altText: data.altText)
        }
    }
}

// MARK: - Full Screen Image View

private struct FullScreenImageView: View {
    let url: URL
    let altText: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                case .empty:
                    ProgressView().tint(.white)
                default:
                    Image(systemName: "photo.badge.exclamationmark")
                        .foregroundColor(.gray)
                        .font(.largeTitle)
                }
            }

            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.8))
                    .padding()
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Inline Image URL View

/// Detects image URLs in text and shows inline previews
public struct InlineImageURLsView: View {
    let text: String

    @State private var imageURLs: [URL] = []

    public init(text: String) {
        self.text = text
    }

    public var body: some View {
        VStack(spacing: 6) {
            ForEach(imageURLs, id: \.absoluteString) { url in
                AsyncImageView(data: ImageData(
                    url: url,
                    altText: url.lastPathComponent
                ))
            }
        }
        .onAppear { imageURLs = extractImageURLs() }
        .onChange(of: text) { _, _ in imageURLs = extractImageURLs() }
    }

    private func extractImageURLs() -> [URL] {
        URLDetector.detectURLs(in: text).filter { URLDetector.isImageURL($0) }
    }
}

// MARK: - File Attachment View

/// Displays a file attachment with name, size, and download action
public struct FileAttachmentView: View {
    let attachment: ChatAttachment

    @State private var isHovered = false

    public init(attachment: ChatAttachment) {
        self.attachment = attachment
    }

    private var fileIcon: String {
        let ext = (attachment.filename as NSString).pathExtension.lowercased()
        switch ext {
        case "pdf": return "doc.fill"
        case "zip", "tar", "gz", "rar": return "archivebox.fill"
        case "mp3", "wav", "m4a": return "waveform"
        case "mp4", "mov", "avi": return "film"
        case "txt", "md": return "doc.text"
        case "swift", "py", "js", "ts": return "chevron.left.forwardslash.chevron.right"
        default: return "doc"
        }
    }

    public var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.optaPrimary.opacity(0.12))
                    .frame(width: 36, height: 36)

                Image(systemName: fileIcon)
                    .font(.system(size: 15))
                    .foregroundColor(.optaPrimary)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(attachment.filename)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)

                Text(attachment.formattedSize)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
            }

            Spacer()

            Image(systemName: "arrow.down.circle")
                .font(.system(size: 16))
                .foregroundColor(.optaTextMuted)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.optaSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
        )
        .brightness(isHovered ? 0.03 : 0)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Inline Attachment View (Enhanced)

/// Enhanced view for rendering inline attachments (images + files)
public struct InlineAttachmentView: View {
    let attachment: ChatAttachment

    @State private var showFullImage = false

    public init(attachment: ChatAttachment) {
        self.attachment = attachment
    }

    public var body: some View {
        if attachment.isImage {
            imageView
        } else {
            FileAttachmentView(attachment: attachment)
        }
    }

    @ViewBuilder
    private var imageView: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let data = attachment.thumbnailData ?? attachment.data {
                #if canImport(AppKit)
                if let nsImage = NSImage(data: data) {
                    Image(nsImage: nsImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .onTapGesture { showFullImage = true }
                }
                #elseif canImport(UIKit)
                if let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .onTapGesture { showFullImage = true }
                }
                #endif
            } else {
                // Fallback: show filename
                FileAttachmentView(attachment: attachment)
            }

            Text(attachment.filename)
                .font(.system(size: 11))
                .foregroundColor(.optaTextMuted)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct AsyncImageView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            AsyncImageView(data: ImageData(
                url: URL(string: "https://picsum.photos/200/150")!,
                altText: "Sample image",
                caption: "A beautiful scene"
            ))

            FileAttachmentView(attachment: ChatAttachment(
                filename: "document.pdf",
                mimeType: "application/pdf",
                sizeBytes: 245_760
            ))

            FileAttachmentView(attachment: ChatAttachment(
                filename: "archive.zip",
                mimeType: "application/zip",
                sizeBytes: 1_048_576
            ))
        }
        .padding()
        .background(Color.optaBackground)
    }
}
#endif
