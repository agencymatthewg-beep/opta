//
//  SyntaxHighlighter.swift
//  OptaMolt
//
//  Lightweight regex-based syntax highlighting for code blocks.
//  Uses design token colors for consistent styling.
//

import SwiftUI

// MARK: - Syntax Highlighter

/// Lightweight regex-based syntax highlighting
///
/// Applies color highlighting to code using pattern matching:
/// - **Keywords** (purple): `func`, `var`, `let`, `if`, `else`, `return`, etc.
/// - **Strings** (blue): `"..."` and `'...'`
/// - **Comments** (secondary): `//...` and `/* ... */`
/// - **Numbers** (amber): integers, floats, hex values
/// - **Types** (green): PascalCase identifiers
///
/// Usage:
/// ```swift
/// let highlighted = SyntaxHighlighter.highlight("let x = 42", language: "swift")
/// Text(highlighted)
/// ```
public enum SyntaxHighlighter {

    // MARK: - Public API

    // MARK: - Cinematic Void Theme Colors

    /// Violet-tinted keywords matching the Cinematic Void theme
    public static let keywordColor = Color(red: 0.68, green: 0.45, blue: 1.0)     // Violet keywords
    /// Green strings
    public static let stringColor = Color(red: 0.45, green: 0.85, blue: 0.55)      // Emerald green
    /// Amber numbers
    public static let numberColor = Color(red: 0.95, green: 0.75, blue: 0.30)      // Warm amber
    /// Type/class color
    public static let typeColor = Color(red: 0.40, green: 0.78, blue: 0.90)        // Cyan-tinted
    /// Comment color
    public static let commentColor = Color(white: 0.45)                              // Muted gray
    /// Decorator/attribute color
    public static let decoratorColor = Color(red: 0.85, green: 0.55, blue: 0.95)   // Light violet
    /// Variable color
    public static let variableColor = Color(red: 0.55, green: 0.85, blue: 0.75)    // Teal
    /// Operator/punctuation
    public static let operatorColor = Color(red: 0.75, green: 0.65, blue: 0.90)    // Soft violet

    /// Highlights code and returns an AttributedString
    /// - Parameters:
    ///   - code: The source code to highlight
    ///   - language: Optional language hint (e.g., "swift", "python", "javascript")
    /// - Returns: AttributedString with syntax highlighting applied
    public static func highlight(_ code: String, language: String?) -> AttributedString {
        var result = AttributedString(code)

        // Set base monospace font
        result.font = .system(.body, design: .monospaced)
        result.foregroundColor = .optaTextPrimary

        // Get patterns for the language
        let patterns = getPatterns(for: language)

        // Apply highlighting in order (later patterns can override earlier ones)
        // Order: comments first (lowest priority), then strings, numbers, types, keywords (highest)
        for pattern in patterns {
            applyHighlighting(&result, pattern: pattern, originalCode: code)
        }

        return result
    }

    /// Detects language from code content using heuristics
    /// - Parameter code: The source code to analyze
    /// - Returns: Detected language or nil if unknown
    public static func detectLanguage(from code: String) -> String? {
        // Check for shebang
        if code.hasPrefix("#!/usr/bin/env python") || code.hasPrefix("#!/usr/bin/python") {
            return "python"
        }
        if code.hasPrefix("#!/bin/bash") || code.hasPrefix("#!/bin/sh") {
            return "bash"
        }

        // Swift indicators
        if code.contains("import SwiftUI") || code.contains("import Foundation") ||
           code.contains("@State") || code.contains("@Published") ||
           code.contains("struct ") && code.contains(": View") {
            return "swift"
        }

        // Python indicators
        if code.contains("def ") && code.contains(":") && !code.contains("{") ||
           code.contains("import ") && !code.contains(";") && !code.contains("{") ||
           code.contains("print(") && !code.contains(";") {
            return "python"
        }

        // JavaScript/TypeScript indicators
        if code.contains("const ") || code.contains("=>") ||
           code.contains("function ") || code.contains("async ") ||
           code.contains("console.log") {
            return code.contains(": string") || code.contains(": number") ? "typescript" : "javascript"
        }

        // Rust indicators
        if code.contains("fn ") && code.contains("->") ||
           code.contains("let mut ") || code.contains("impl ") {
            return "rust"
        }

        // Go indicators
        if code.contains("func ") && code.contains("package ") ||
           code.contains(":= ") {
            return "go"
        }

        // JSON indicators
        if code.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("{") &&
           code.contains("\":") {
            return "json"
        }

        return nil
    }

    // MARK: - Pattern Definitions

    /// A highlighting pattern with regex and color
    private struct HighlightPattern {
        let regex: NSRegularExpression
        let color: Color

        init?(_ pattern: String, color: Color) {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines]) else {
                return nil
            }
            self.regex = regex
            self.color = color
        }
    }

    /// Get highlighting patterns for a language
    private static func getPatterns(for language: String?) -> [HighlightPattern] {
        let lang = (language ?? "").lowercased()

        switch lang {
        case "swift":
            return swiftPatterns
        case "python", "py":
            return pythonPatterns
        case "javascript", "js", "typescript", "ts":
            return javascriptPatterns
        case "rust", "rs":
            return rustPatterns
        case "go", "golang":
            return goPatterns
        case "json":
            return jsonPatterns
        case "bash", "sh", "shell", "zsh":
            return shellPatterns
        case "html", "xml":
            return htmlPatterns
        case "css", "scss", "sass":
            return cssPatterns
        default:
            return genericPatterns
        }
    }

    // MARK: - Language-Specific Patterns

    /// Swift syntax patterns
    private static var swiftPatterns: [HighlightPattern] {
        [
            // Comments (lowest priority - apply first)
            HighlightPattern(#"//.*$"#, color: SyntaxHighlighter.commentColor),
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(#""""[\s\S]*?""""#, color: SyntaxHighlighter.stringColor),  // Multi-line strings
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d+\.?\d*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Keywords (highest priority - apply last)
            HighlightPattern(
                #"\b(func|var|let|if|else|guard|switch|case|default|for|while|repeat|return|break|continue|import|struct|class|enum|protocol|extension|public|private|internal|fileprivate|open|static|final|override|mutating|throws|throw|try|catch|async|await|actor|some|any|where|in|is|as|self|Self|nil|true|false|init|deinit|subscript|typealias|associatedtype|inout|lazy|weak|unowned|didSet|willSet|get|set)\b"#,
                color: .optaPurple
            ),

            // Property wrappers
            HighlightPattern(#"@\w+"#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// Python syntax patterns
    private static var pythonPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"#.*$"#, color: SyntaxHighlighter.commentColor),

            // Strings (including triple-quoted)
            HighlightPattern(#"'''[\s\S]*?'''"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"\"\"\"[\s\S]*?\"\"\""#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"'(?:[^'\\]|\\.)*'"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d+\.?\d*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Keywords
            HighlightPattern(
                #"\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|raise|break|continue|pass|lambda|and|or|not|in|is|True|False|None|self|async|await|global|nonlocal)\b"#,
                color: .optaPurple
            ),

            // Decorators
            HighlightPattern(#"@\w+"#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// JavaScript/TypeScript syntax patterns
    private static var javascriptPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"//.*$"#, color: SyntaxHighlighter.commentColor),
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),

            // Strings (including template literals)
            HighlightPattern(#"`(?:[^`\\]|\\.)*`"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"'(?:[^'\\]|\\.)*'"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d+\.?\d*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Keywords
            HighlightPattern(
                #"\b(function|const|let|var|if|else|for|while|do|switch|case|default|break|continue|return|throw|try|catch|finally|new|delete|typeof|instanceof|in|of|class|extends|super|this|import|export|from|as|async|await|yield|true|false|null|undefined|void)\b"#,
                color: .optaPurple
            ),

            // Arrow functions
            HighlightPattern(#"=>"#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// Rust syntax patterns
    private static var rustPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"//.*$"#, color: SyntaxHighlighter.commentColor),
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(##"r#"[\s\S]*?"#"##, color: SyntaxHighlighter.stringColor),  // Raw strings
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"'(?:[^'\\]|\\.)*'"#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F_]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d[\d_]*\.?[\d_]*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Keywords
            HighlightPattern(
                #"\b(fn|let|mut|const|static|if|else|match|for|while|loop|break|continue|return|struct|enum|impl|trait|type|where|pub|crate|mod|use|as|self|Self|super|unsafe|async|await|move|ref|true|false|Some|None|Ok|Err)\b"#,
                color: .optaPurple
            ),

            // Macros
            HighlightPattern(#"\w+!"#, color: SyntaxHighlighter.keywordColor),

            // Lifetimes
            HighlightPattern(#"'[a-z_]\w*"#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// Go syntax patterns
    private static var goPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"//.*$"#, color: SyntaxHighlighter.commentColor),
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(#"`[^`]*`"#, color: SyntaxHighlighter.stringColor),  // Raw strings
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d+\.?\d*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Keywords
            HighlightPattern(
                #"\b(func|var|const|if|else|for|range|switch|case|default|break|continue|return|go|defer|select|chan|map|struct|interface|type|package|import|true|false|nil|make|new|append|len|cap|copy|delete|panic|recover)\b"#,
                color: .optaPurple
            ),

            // Short variable declaration
            HighlightPattern(#":="#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// JSON syntax patterns
    private static var jsonPatterns: [HighlightPattern] {
        [
            // Strings (keys and values)
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b"#, color: SyntaxHighlighter.numberColor),

            // Keywords
            HighlightPattern(#"\b(true|false|null)\b"#, color: SyntaxHighlighter.keywordColor),
        ].compactMap { $0 }
    }

    /// Shell/Bash syntax patterns
    private static var shellPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"#.*$"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(#"'[^']*'"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Variables
            HighlightPattern(#"\$\{?\w+\}?"#, color: SyntaxHighlighter.typeColor),

            // Numbers
            HighlightPattern(#"\b\d+\b"#, color: SyntaxHighlighter.numberColor),

            // Keywords
            HighlightPattern(
                #"\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|source|export|local|readonly|declare|unset|shift|break|continue|true|false)\b"#,
                color: .optaPurple
            ),
        ].compactMap { $0 }
    }

    /// HTML/XML syntax patterns
    private static var htmlPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"<!--[\s\S]*?-->"#, color: SyntaxHighlighter.commentColor),

            // Strings (attribute values)
            HighlightPattern(#""[^"]*""#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"'[^']*'"#, color: SyntaxHighlighter.stringColor),

            // Tags
            HighlightPattern(#"</?[a-zA-Z][a-zA-Z0-9]*"#, color: SyntaxHighlighter.keywordColor),
            HighlightPattern(#"/?>|<"#, color: SyntaxHighlighter.keywordColor),

            // Attributes
            HighlightPattern(#"\b[a-zA-Z-]+(?==)"#, color: SyntaxHighlighter.typeColor),
        ].compactMap { $0 }
    }

    /// CSS syntax patterns
    private static var cssPatterns: [HighlightPattern] {
        [
            // Comments
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(#""[^"]*""#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#"'[^']*'"#, color: SyntaxHighlighter.stringColor),

            // Colors (hex)
            HighlightPattern(#"#[0-9a-fA-F]{3,8}\b"#, color: SyntaxHighlighter.numberColor),

            // Numbers with units
            HighlightPattern(#"-?\d+\.?\d*(?:px|em|rem|%|vh|vw|deg|s|ms)?\b"#, color: SyntaxHighlighter.numberColor),

            // Properties
            HighlightPattern(#"\b[a-z-]+(?=\s*:)"#, color: SyntaxHighlighter.keywordColor),

            // Selectors (classes, ids)
            HighlightPattern(#"[.#][a-zA-Z_-][a-zA-Z0-9_-]*"#, color: SyntaxHighlighter.typeColor),
        ].compactMap { $0 }
    }

    /// Generic syntax patterns (fallback)
    private static var genericPatterns: [HighlightPattern] {
        [
            // C-style comments
            HighlightPattern(#"//.*$"#, color: SyntaxHighlighter.commentColor),
            HighlightPattern(#"/\*[\s\S]*?\*/"#, color: SyntaxHighlighter.commentColor),
            // Hash comments
            HighlightPattern(#"#.*$"#, color: SyntaxHighlighter.commentColor),

            // Strings
            HighlightPattern(#"'(?:[^'\\]|\\.)*'"#, color: SyntaxHighlighter.stringColor),
            HighlightPattern(#""(?:[^"\\]|\\.)*""#, color: SyntaxHighlighter.stringColor),

            // Numbers
            HighlightPattern(#"\b0x[0-9a-fA-F]+\b"#, color: SyntaxHighlighter.numberColor),
            HighlightPattern(#"\b\d+\.?\d*\b"#, color: SyntaxHighlighter.numberColor),

            // Types (PascalCase)
            HighlightPattern(#"\b[A-Z][a-zA-Z0-9]*\b"#, color: SyntaxHighlighter.typeColor),

            // Common keywords
            HighlightPattern(
                #"\b(if|else|for|while|do|switch|case|break|continue|return|function|func|def|class|struct|enum|var|let|const|import|export|from|true|false|null|nil|none|self|this)\b"#,
                color: .optaPurple
            ),
        ].compactMap { $0 }
    }

    // MARK: - Highlighting Application

    /// Apply a highlight pattern to an attributed string
    private static func applyHighlighting(
        _ result: inout AttributedString,
        pattern: HighlightPattern,
        originalCode: String
    ) {
        let nsRange = NSRange(originalCode.startIndex..., in: originalCode)
        let matches = pattern.regex.matches(in: originalCode, options: [], range: nsRange)

        for match in matches {
            guard let range = Range(match.range, in: originalCode) else { continue }

            // Convert String range to AttributedString range
            let startOffset = originalCode.distance(from: originalCode.startIndex, to: range.lowerBound)
            let endOffset = originalCode.distance(from: originalCode.startIndex, to: range.upperBound)

            guard let attrStart = result.index(result.startIndex, offsetByCharacters: startOffset),
                  let attrEnd = result.index(result.startIndex, offsetByCharacters: endOffset) else {
                continue
            }

            result[attrStart..<attrEnd].foregroundColor = pattern.color
        }
    }
}

// MARK: - AttributedString Extension

private extension AttributedString {
    /// Get an index offset by character count
    func index(_ i: AttributedString.Index, offsetByCharacters offset: Int) -> AttributedString.Index? {
        var current = i
        var remaining = offset

        while remaining > 0 {
            guard current < endIndex else { return nil }
            current = index(afterCharacter: current)
            remaining -= 1
        }

        return current
    }
}
