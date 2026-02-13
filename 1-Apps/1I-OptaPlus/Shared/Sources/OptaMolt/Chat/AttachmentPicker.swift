//
//  AttachmentPicker.swift
//  OptaMolt
//
//  Menu button for selecting files or images to attach.
//  Uses native file importer on macOS and PhotosPicker on iOS.
//

import SwiftUI
import UniformTypeIdentifiers

// MARK: - Attachment Picker

public struct AttachmentPicker: View {
    @Binding var attachments: [ChatAttachment]
    @State private var showFilePicker = false

    /// Allowed content types for file import.
    private let allowedTypes: [UTType] = [
        .image, .pdf, .plainText, .json, .data,
        .mpeg4Movie, .quickTimeMovie, .mp3, .wav, .aiff
    ]

    /// Maximum single file size (50 MB).
    private let maxFileSize = 50 * 1024 * 1024

    public init(attachments: Binding<[ChatAttachment]>) {
        self._attachments = attachments
    }

    public var body: some View {
        Button(action: { showFilePicker = true }) {
            Image(systemName: "paperclip")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(attachments.isEmpty ? .optaTextSecondary : .optaPrimary)
        }
        .buttonStyle(.plain)
        .help("Attach files")
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: allowedTypes,
            allowsMultipleSelection: true
        ) { result in
            handleFileSelection(result)
        }
    }

    // MARK: - File Handling

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            for url in urls {
                guard url.startAccessingSecurityScopedResource() else { continue }
                defer { url.stopAccessingSecurityScopedResource() }

                guard let data = try? Data(contentsOf: url) else { continue }
                guard data.count <= maxFileSize else { continue }

                let mimeType = UTType(filenameExtension: url.pathExtension)?
                    .preferredMIMEType ?? "application/octet-stream"

                let thumbnail = mimeType.hasPrefix("image/")
                    ? generateThumbnail(from: data)
                    : nil

                let attachment = ChatAttachment(
                    filename: url.lastPathComponent,
                    mimeType: mimeType,
                    sizeBytes: data.count,
                    data: data,
                    thumbnailData: thumbnail
                )
                attachments.append(attachment)
            }
        case .failure:
            break
        }
    }

    /// Generate a small JPEG thumbnail from image data.
    private func generateThumbnail(from data: Data) -> Data? {
        #if canImport(AppKit)
        guard let image = NSImage(data: data) else { return nil }
        let maxDim: CGFloat = 200
        let size = image.size
        let scale = min(maxDim / size.width, maxDim / size.height, 1.0)
        let newSize = NSSize(width: size.width * scale, height: size.height * scale)

        let resized = NSImage(size: newSize)
        resized.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: newSize),
                   from: NSRect(origin: .zero, size: size),
                   operation: .copy, fraction: 1.0)
        resized.unlockFocus()

        guard let tiff = resized.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.7])
        #elseif canImport(UIKit)
        guard let uiImage = UIImage(data: data) else { return nil }
        let maxDim: CGFloat = 200
        let scale = min(maxDim / uiImage.size.width, maxDim / uiImage.size.height, 1.0)
        let newSize = CGSize(width: uiImage.size.width * scale, height: uiImage.size.height * scale)

        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        uiImage.draw(in: CGRect(origin: .zero, size: newSize))
        let resized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        return resized?.jpegData(compressionQuality: 0.7)
        #else
        return nil
        #endif
    }
}
