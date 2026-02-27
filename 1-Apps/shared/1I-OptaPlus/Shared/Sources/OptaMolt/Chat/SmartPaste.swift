//
//  SmartPaste.swift
//  OptaMolt
//
//  Smart paste: auto-wrap code in fences, format URLs as markdown links.
//

import Foundation

public struct SmartPaste {
    
    /// Process pasted text and return transformed version.
    public static func process(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Already has code fences — leave as-is
        if trimmed.hasPrefix("```") { return text }
        
        // URL detection — single URL on its own line
        if looksLikeURL(trimmed) && !trimmed.contains("\n") {
            return "[\(trimmed)](\(trimmed))"
        }
        
        // Code detection
        if let lang = detectLanguage(trimmed) {
            return "```\(lang)\n\(trimmed)\n```"
        }
        
        return text
    }
    
    private static func looksLikeURL(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return (t.hasPrefix("http://") || t.hasPrefix("https://")) && !t.contains(" ") && t.contains(".")
    }
    
    /// Simple language detection heuristics.
    private static func detectLanguage(_ text: String) -> String? {
        let lines = text.components(separatedBy: .newlines)
        guard lines.count >= 2 else { return nil }
        
        let joined = text.lowercased()
        
        // Strong indicators
        if joined.contains("import swift") || joined.contains("func ") && joined.contains("-> ") { return "swift" }
        if joined.contains("#!/usr/bin/env python") || joined.contains("def ") && joined.contains("import ") { return "python" }
        if joined.contains("function ") && (joined.contains("const ") || joined.contains("let ") || joined.contains("=>")) { return "javascript" }
        if joined.contains("fn ") && joined.contains("let mut ") { return "rust" }
        if joined.contains("package main") || joined.contains("func main()") && joined.contains("fmt.") { return "go" }
        if joined.contains("#!/bin/bash") || joined.contains("#!/bin/sh") { return "bash" }
        if text.contains("<?php") { return "php" }
        if joined.contains("<html") || joined.contains("<!doctype") { return "html" }
        if joined.contains("select ") && joined.contains(" from ") && joined.contains(" where ") { return "sql" }
        
        // Generic code heuristics: brackets, semicolons, indentation
        let codeIndicators = ["{", "}", "()", "=>", "->", ";;", "    ", "\t", "return ", "if (", "for ("]
        let codeScore = codeIndicators.filter { text.contains($0) }.count
        if codeScore >= 3 { return "" }  // code fence with no language
        
        return nil
    }
}
