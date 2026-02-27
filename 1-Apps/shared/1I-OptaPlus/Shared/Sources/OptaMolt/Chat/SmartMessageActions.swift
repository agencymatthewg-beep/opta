//
//  SmartMessageActions.swift
//  OptaMolt
//
//  Auto-detect actionable content: URLs, emails, phone numbers, file paths.
//  Code blocks: "Run in Terminal" option (macOS only).
//

import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Smart Action Type

public enum SmartAction: Identifiable {
    case url(URL)
    case email(String)
    case phone(String)
    case filePath(String)
    case codeBlock(language: String?, code: String)

    public var id: String {
        switch self {
        case .url(let u): return "url:\(u.absoluteString)"
        case .email(let e): return "email:\(e)"
        case .phone(let p): return "phone:\(p)"
        case .filePath(let f): return "path:\(f)"
        case .codeBlock(_, let c): return "code:\(c.prefix(50))"
        }
    }

    public var icon: String {
        switch self {
        case .url: return "safari"
        case .email: return "envelope"
        case .phone: return "phone"
        case .filePath: return "folder"
        case .codeBlock: return "terminal"
        }
    }

    public var label: String {
        switch self {
        case .url(let u): return u.host ?? u.absoluteString
        case .email(let e): return e
        case .phone(let p): return p
        case .filePath(let f): return (f as NSString).lastPathComponent
        case .codeBlock(let lang, _): return "Run \(lang ?? "code") in Terminal"
        }
    }
}

// MARK: - Smart Action Detector

public struct SmartActionDetector {
    // Email regex
    private static let emailPattern = try! NSRegularExpression(
        pattern: #"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"#
    )

    // Phone regex (international-ish)
    private static let phonePattern = try! NSRegularExpression(
        pattern: #"(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}"#
    )

    // File path regex (Unix paths)
    private static let pathPattern = try! NSRegularExpression(
        pattern: #"(?:~|/)[/\w.\-@]+"#
    )

    // Code block regex
    private static let codeBlockPattern = try! NSRegularExpression(
        pattern: #"```(\w*)\n([\s\S]*?)```"#
    )

    public static func detect(in text: String) -> [SmartAction] {
        var actions: [SmartAction] = []
        let range = NSRange(text.startIndex..., in: text)

        // Emails
        for match in emailPattern.matches(in: text, range: range) {
            if let r = Range(match.range, in: text) {
                actions.append(.email(String(text[r])))
            }
        }

        // Phones
        for match in phonePattern.matches(in: text, range: range) {
            if let r = Range(match.range, in: text) {
                let phone = String(text[r])
                if phone.count >= 7 { actions.append(.phone(phone)) }
            }
        }

        // File paths (at least 2 path components)
        for match in pathPattern.matches(in: text, range: range) {
            if let r = Range(match.range, in: text) {
                let path = String(text[r])
                if path.components(separatedBy: "/").count >= 3 {
                    actions.append(.filePath(path))
                }
            }
        }

        // Code blocks
        for match in codeBlockPattern.matches(in: text, range: range) {
            let lang = match.range(at: 1).location != NSNotFound
                ? (Range(match.range(at: 1), in: text).map { String(text[$0]) })
                : nil
            if let codeRange = Range(match.range(at: 2), in: text) {
                let code = String(text[codeRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !code.isEmpty {
                    actions.append(.codeBlock(language: lang?.isEmpty == true ? nil : lang, code: code))
                }
            }
        }

        return actions
    }

    /// Execute a smart action.
    public static func execute(_ action: SmartAction) {
        switch action {
        case .url(let url):
            openURL(url)
        case .email(let email):
            if let url = URL(string: "mailto:\(email)") { openURL(url) }
        case .phone(let phone):
            let digits = phone.filter { $0.isNumber || $0 == "+" }
            if let url = URL(string: "tel:\(digits)") { openURL(url) }
        case .filePath(let path):
            #if canImport(AppKit)
            let expanded = NSString(string: path).expandingTildeInPath
            NSWorkspace.shared.selectFile(expanded, inFileViewerRootedAtPath: "")
            #elseif canImport(UIKit)
            // On iOS, copy path to clipboard as fallback
            UIPasteboard.general.string = path
            #endif
        case .codeBlock:
            break // Handled by confirmation UI
        }
    }

    private static func openURL(_ url: URL) {
        #if canImport(AppKit)
        NSWorkspace.shared.open(url)
        #elseif canImport(UIKit)
        UIApplication.shared.open(url)
        #endif
    }
}

// MARK: - Smart Actions Menu (for context menus)

public struct SmartActionsMenu: View {
    let actions: [SmartAction]
    let onRunCode: ((String) -> Void)?

    public init(text: String, onRunCode: ((String) -> Void)? = nil) {
        self.actions = SmartActionDetector.detect(in: text)
        self.onRunCode = onRunCode
    }

    public var body: some View {
        if !actions.isEmpty {
            Divider()
            ForEach(actions) { action in
                switch action {
                case .codeBlock(_, let code):
                    #if os(macOS)
                    Button {
                        onRunCode?(code)
                    } label: {
                        Label(action.label, systemImage: action.icon)
                    }
                    #else
                    EmptyView()
                    #endif
                default:
                    Button {
                        SmartActionDetector.execute(action)
                    } label: {
                        Label(action.label, systemImage: action.icon)
                    }
                }
            }
        }
    }
}
