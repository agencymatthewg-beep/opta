//
//  AttachmentPreview.swift
//  OptaMolt
//
//  Thumbnail strip shown above the input bar for pending attachments.
//  Horizontal scroll with remove buttons.
//

import SwiftUI

// MARK: - Attachment Preview Strip

public struct AttachmentPreviewStrip: View {
    @Binding var attachments: [ChatAttachment]

    public init(attachments: Binding<[ChatAttachment]>) {
        self._attachments = attachments
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { attachment in
                    AttachmentThumbnail(
                        attachment: attachment,
                        onRemove: { remove(attachment) }
                    )
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.optaSurface.opacity(0.3))
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: attachments.count)
    }

    private func remove(_ attachment: ChatAttachment) {
        attachments.removeAll { $0.id == attachment.id }
    }
}

// MARK: - Single Thumbnail

struct AttachmentThumbnail: View {
    let attachment: ChatAttachment
    let onRemove: () -> Void

    @State private var isHovering = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if attachment.isImage {
                imageThumbnail
            } else {
                fileThumbnail
            }

            // Remove button
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.white)
                    .background(Circle().fill(Color.black.opacity(0.6)))
            }
            .buttonStyle(.plain)
            .offset(x: 4, y: -4)
            .opacity(isHovering ? 1 : 0.6)
        }
        .onHover { isHovering = $0 }
    }

    @ViewBuilder
    private var imageThumbnail: some View {
        Group {
            if let data = attachment.thumbnailData ?? attachment.data,
               let platformImg = platformImage(from: data) {
                #if canImport(AppKit)
                Image(nsImage: platformImg)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                #elseif canImport(UIKit)
                Image(uiImage: platformImg)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                #endif
            } else {
                Color.optaSurface
                    .overlay {
                        Image(systemName: "photo")
                            .foregroundColor(.optaTextMuted)
                    }
            }
        }
        .frame(width: 60, height: 60)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
    }

    @ViewBuilder
    private var fileThumbnail: some View {
        VStack(spacing: 4) {
            Image(systemName: iconForMimeType(attachment.mimeType))
                .font(.system(size: 20))
                .foregroundColor(.optaTextSecondary)

            Text(attachment.filename)
                .font(.system(size: 9))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)
                .truncationMode(.middle)

            Text(attachment.formattedSize)
                .font(.system(size: 8))
                .foregroundColor(.optaTextMuted)
        }
        .frame(width: 80, height: 60)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.optaSurface.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
    }

    #if canImport(AppKit)
    private func platformImage(from data: Data) -> NSImage? {
        NSImage(data: data)
    }
    #elseif canImport(UIKit)
    private func platformImage(from data: Data) -> UIImage? {
        UIImage(data: data)
    }
    #endif
}

// MARK: - Inline Attachment View (in message bubbles)

public struct InlineAttachmentView: View {
    let attachment: ChatAttachment

    public init(attachment: ChatAttachment) {
        self.attachment = attachment
    }

    public var body: some View {
        if attachment.isImage {
            imageView
        } else {
            fileView
        }
    }

    @ViewBuilder
    private var imageView: some View {
        Group {
            if let data = attachment.data {
                #if canImport(AppKit)
                if let nsImage = NSImage(data: data) {
                    Image(nsImage: nsImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                }
                #elseif canImport(UIKit)
                if let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                }
                #endif
            }
        }
        .frame(maxWidth: 300)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
        )
    }

    @ViewBuilder
    private var fileView: some View {
        HStack(spacing: 10) {
            Image(systemName: iconForMimeType(attachment.mimeType))
                .font(.system(size: 24))
                .foregroundColor(.optaTextSecondary)
                .frame(width: 36, height: 36)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaSurface.opacity(0.5))
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.filename)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)

                Text(attachment.formattedSize)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaSurface.opacity(0.3))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
        )
    }
}

// MARK: - Helpers

func iconForMimeType(_ mimeType: String) -> String {
    if mimeType.hasPrefix("image/") { return "photo" }
    if mimeType.hasPrefix("video/") { return "film" }
    if mimeType.hasPrefix("audio/") { return "waveform" }
    if mimeType.contains("pdf") { return "doc.richtext" }
    if mimeType.contains("json") || mimeType.contains("text") { return "doc.text" }
    return "doc"
}
