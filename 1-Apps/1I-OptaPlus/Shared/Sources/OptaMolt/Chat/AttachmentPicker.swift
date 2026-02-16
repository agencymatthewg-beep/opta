//
//  AttachmentPicker.swift
//  OptaMolt
//
//  Menu button for selecting files or images to attach.
//  Uses native file importer on macOS and PhotosPicker + file importer on iOS.
//

import SwiftUI
import UniformTypeIdentifiers
#if canImport(PhotosUI)
import PhotosUI
#endif

// MARK: - Attachment Limits

public enum AttachmentLimits {
    public static let maxFileBytes = 10 * 1024 * 1024 // 10 MB
    public static let maxAttachmentsPerMessage = 5
}

// MARK: - Attachment Error

public enum AttachmentError: LocalizedError, Identifiable {
    case fileTooLarge(filename: String, sizeBytes: Int)
    case tooManyAttachments
    case unreadableFile(filename: String)

    public var id: String {
        switch self {
        case .fileTooLarge(let name, _): return "large-\(name)"
        case .tooManyAttachments: return "too-many"
        case .unreadableFile(let name): return "unreadable-\(name)"
        }
    }

    public var errorDescription: String? {
        switch self {
        case .fileTooLarge(let name, let size):
            let mb = String(format: "%.1f", Double(size) / (1024 * 1024))
            return "\(name) is \(mb) MB. Maximum is 10 MB."
        case .tooManyAttachments:
            return "Maximum \(AttachmentLimits.maxAttachmentsPerMessage) attachments per message."
        case .unreadableFile(let name):
            return "Could not read \(name)."
        }
    }
}

// MARK: - Attachment Picker

public struct AttachmentPicker: View {
    @Binding var attachments: [ChatAttachment]
    @State private var showFilePicker = false
    @State private var attachmentError: AttachmentError?

    #if os(iOS)
    @State private var showActionSheet = false
    @State private var showPhotoPicker = false
    @State private var selectedPhotos: [PhotosPickerItem] = []
    #endif

    /// Allowed content types for file import.
    private let allowedTypes: [UTType] = [
        .image, .pdf, .plainText, .json, .data,
        .mpeg4Movie, .quickTimeMovie, .mp3, .wav, .aiff
    ]

    public init(attachments: Binding<[ChatAttachment]>) {
        self._attachments = attachments
    }

    public var body: some View {
        #if os(iOS)
        iOSPicker
        #else
        macOSPicker
        #endif
    }

    // MARK: - macOS Picker

    #if os(macOS)
    private var macOSPicker: some View {
        Button(action: { showFilePicker = true }) {
            Image(systemName: "paperclip")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(attachments.isEmpty ? .optaTextSecondary : .optaPrimary)
        }
        .buttonStyle(.plain)
        .help("Attach files (max 10 MB each, up to 5)")
        .disabled(attachments.count >= AttachmentLimits.maxAttachmentsPerMessage)
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: allowedTypes,
            allowsMultipleSelection: true
        ) { result in
            handleFileSelection(result)
        }
        .alert(item: $attachmentError) { error in
            Alert(
                title: Text("Attachment Error"),
                message: Text(error.errorDescription ?? "Unknown error"),
                dismissButton: .default(Text("OK"))
            )
        }
    }
    #endif

    // MARK: - iOS Picker

    #if os(iOS)
    private var iOSPicker: some View {
        Button(action: { showActionSheet = true }) {
            Image(systemName: "plus.circle.fill")
                .font(.title3)
                .foregroundColor(attachments.isEmpty ? .optaTextMuted : .optaPrimary)
        }
        .disabled(attachments.count >= AttachmentLimits.maxAttachmentsPerMessage)
        .accessibilityLabel("Attach file")
        .accessibilityHint("Opens photo or file picker")
        .confirmationDialog("Attach", isPresented: $showActionSheet, titleVisibility: .hidden) {
            Button("Photo Library") {
                showPhotoPicker = true
            }
            Button("Choose File") {
                showFilePicker = true
            }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: $selectedPhotos,
            maxSelectionCount: max(0, AttachmentLimits.maxAttachmentsPerMessage - attachments.count),
            matching: .images
        )
        .onChange(of: selectedPhotos) { _, newItems in
            handlePhotoSelection(newItems)
            selectedPhotos = []
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: allowedTypes,
            allowsMultipleSelection: true
        ) { result in
            handleFileSelection(result)
        }
        .alert(item: $attachmentError) { error in
            Alert(
                title: Text("Attachment Error"),
                message: Text(error.errorDescription ?? "Unknown error"),
                dismissButton: .default(Text("OK"))
            )
        }
    }

    private func handlePhotoSelection(_ items: [PhotosPickerItem]) {
        for item in items {
            guard attachments.count < AttachmentLimits.maxAttachmentsPerMessage else {
                attachmentError = .tooManyAttachments
                return
            }

            Task {
                guard let data = try? await item.loadTransferable(type: Data.self) else { return }

                if data.count > AttachmentLimits.maxFileBytes {
                    await MainActor.run {
                        attachmentError = .fileTooLarge(filename: "photo", sizeBytes: data.count)
                    }
                    return
                }

                let mimeType = "image/jpeg"
                let filename = "photo-\(UUID().uuidString.prefix(8)).jpg"
                let thumbnail = generateThumbnail(from: data)

                let attachment = ChatAttachment(
                    filename: filename,
                    mimeType: mimeType,
                    sizeBytes: data.count,
                    data: data,
                    thumbnailData: thumbnail
                )
                await MainActor.run {
                    attachments.append(attachment)
                }
            }
        }
    }
    #endif

    // MARK: - File Handling

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            for url in urls {
                guard attachments.count < AttachmentLimits.maxAttachmentsPerMessage else {
                    attachmentError = .tooManyAttachments
                    return
                }

                guard url.startAccessingSecurityScopedResource() else {
                    attachmentError = .unreadableFile(filename: url.lastPathComponent)
                    continue
                }
                defer { url.stopAccessingSecurityScopedResource() }

                guard let data = try? Data(contentsOf: url) else {
                    attachmentError = .unreadableFile(filename: url.lastPathComponent)
                    continue
                }
                guard data.count <= AttachmentLimits.maxFileBytes else {
                    attachmentError = .fileTooLarge(filename: url.lastPathComponent, sizeBytes: data.count)
                    continue
                }

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
