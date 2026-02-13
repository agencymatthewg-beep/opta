//
//  ChatTextInput.swift
//  OptaPlusMacOS
//
//  NSViewRepresentable wrapping NSTextView for full key event control.
//  Return sends the message; Shift+Return inserts a newline.
//

import SwiftUI
import AppKit
import OptaMolt

struct ChatTextInput: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String = "Message…"
    var font: NSFont = .systemFont(ofSize: 14)
    var textColor: NSColor = .white
    var onSend: () -> Void
    var onImagePasted: ((ChatAttachment) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder

        let textView = ChatNSTextView()
        textView.delegate = context.coordinator
        textView.onSend = onSend
        textView.onImagePasted = onImagePasted
        textView.font = font
        textView.textColor = textColor
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainerInset = NSSize(width: 0, height: 4)
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.lineFragmentPadding = 0

        // Placeholder
        textView.placeholderString = placeholder

        scrollView.documentView = textView

        // Constrain max height to ~6 lines
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        let maxHeight = scrollView.heightAnchor.constraint(lessThanOrEqualToConstant: 120)
        maxHeight.isActive = true

        context.coordinator.textView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? ChatNSTextView else { return }

        // Only update text if it differs (avoids cursor jump)
        if textView.string != text {
            textView.string = text
        }
        textView.font = font
        textView.textColor = textColor
        textView.placeholderString = placeholder
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ChatTextInput
        weak var textView: ChatNSTextView?

        init(_ parent: ChatTextInput) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
        }
    }
}

// MARK: - Custom NSTextView (key handling)

final class ChatNSTextView: NSTextView {
    var onSend: (() -> Void)?
    var onImagePasted: ((ChatAttachment) -> Void)?
    var placeholderString: String? {
        didSet { needsDisplay = true }
    }

    override func paste(_ sender: Any?) {
        let pb = NSPasteboard.general
        // Check for image data first
        if let image = pb.readObjects(forClasses: [NSImage.self])?.first as? NSImage,
           let tiff = image.tiffRepresentation,
           let rep = NSBitmapImageRep(data: tiff),
           let pngData = rep.representation(using: .png, properties: [:]) {
            let attachment = ChatAttachment(
                filename: "pasted-image.png",
                mimeType: "image/png",
                sizeBytes: pngData.count,
                data: pngData
            )
            onImagePasted?(attachment)
            return
        }
        // Fall through to normal text paste
        super.paste(sender)
    }

    override func keyDown(with event: NSEvent) {
        let isReturn = event.keyCode == 36
        let isShiftHeld = event.modifierFlags.contains(.shift)

        if isReturn && !isShiftHeld {
            // Return without Shift → send
            onSend?()
            return
        }

        if isReturn && isShiftHeld {
            // Shift+Return → insert newline
            insertNewline(nil)
            return
        }

        super.keyDown(with: event)
    }

    // Draw placeholder when empty
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        if string.isEmpty, let placeholder = placeholderString {
            let attrs: [NSAttributedString.Key: Any] = [
                .foregroundColor: NSColor.secondaryLabelColor,
                .font: font ?? NSFont.systemFont(ofSize: 14),
            ]
            let inset = textContainerInset
            let rect = NSRect(
                x: inset.width + (textContainer?.lineFragmentPadding ?? 0),
                y: inset.height,
                width: bounds.width - inset.width * 2,
                height: bounds.height - inset.height * 2
            )
            NSString(string: placeholder).draw(in: rect, withAttributes: attrs)
        }
    }

    override var acceptsFirstResponder: Bool { true }
}

// MARK: - Focus Support

extension ChatTextInput {
    /// Wrapper that adds FocusState support.
    struct Focused: View {
        @Binding var text: String
        var isFocused: FocusState<Bool>.Binding
        var placeholder: String = "Message…"
        var onSend: () -> Void

        var body: some View {
            ChatTextInput(
                text: $text,
                placeholder: placeholder,
                onSend: onSend
            )
            .focused(isFocused)
        }
    }
}
