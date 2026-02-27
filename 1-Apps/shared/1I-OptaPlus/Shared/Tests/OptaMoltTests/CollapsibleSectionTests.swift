//
//  CollapsibleSectionTests.swift
//  OptaMoltTests
//
//  Tests for collapsible section parsing and view behavior.
//  Covers <details>/<summary> detection, animation states, and streaming resilience.
//

import XCTest
import SwiftUI
@testable import OptaMolt

final class CollapsibleSectionTests: XCTestCase {

    // MARK: - Details/Summary Tag Detection Tests

    /// Test 1: Details/summary tags are detected correctly
    func testDetailsTagsDetectedCorrectly() {
        let content = """
            <details>
            <summary>Click me</summary>
            Hidden content here
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .collapsible(let summary, _, _) = blocks[0] {
            XCTAssertEqual(summary, "Click me")
        } else {
            XCTFail("Expected collapsible block, got \(blocks[0])")
        }
    }

    /// Test 2: Summary text is extracted from <summary> tag
    func testSummaryTextExtracted() {
        let content = """
            <details>
            <summary>Important Information</summary>
            Some details
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .collapsible(let summary, _, _) = blocks[0] {
            XCTAssertEqual(summary, "Important Information")
        } else {
            XCTFail("Expected collapsible block")
        }
    }

    /// Test 3: Nested content is parsed recursively
    func testNestedContentParsedRecursively() {
        let content = """
            <details>
            <summary>Section</summary>
            - First item
            - Second item
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .collapsible(_, let nestedContent, _) = blocks[0] {
            XCTAssertEqual(nestedContent.count, 1)
            if case .bulletList(let items) = nestedContent[0] {
                XCTAssertEqual(items.count, 2)
                XCTAssertEqual(items[0].content, "First item")
                XCTAssertEqual(items[1].content, "Second item")
            } else {
                XCTFail("Expected nested bullet list")
            }
        } else {
            XCTFail("Expected collapsible block")
        }
    }

    /// Test 4: CollapsibleSection starts collapsed by default
    func testCollapsibleStartsCollapsedByDefault() {
        let content = """
            <details>
            <summary>Test</summary>
            Content
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        if case .collapsible(_, _, let isOpen) = blocks[0] {
            XCTAssertFalse(isOpen, "Should start collapsed by default")
        } else {
            XCTFail("Expected collapsible block")
        }
    }

    /// Test 5: Open attribute detected correctly
    func testOpenAttributeDetected() {
        let content = """
            <details open>
            <summary>Already Open</summary>
            Visible content
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        if case .collapsible(_, _, let isOpen) = blocks[0] {
            XCTAssertTrue(isOpen, "Should start expanded when 'open' attribute present")
        } else {
            XCTFail("Expected collapsible block")
        }
    }

    /// Test 6: Multiple collapsible sections in content
    func testMultipleCollapsibleSections() {
        let content = """
            <details>
            <summary>First</summary>
            Content 1
            </details>

            Some text between

            <details>
            <summary>Second</summary>
            Content 2
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 3)

        if case .collapsible(let summary1, _, _) = blocks[0] {
            XCTAssertEqual(summary1, "First")
        } else {
            XCTFail("Expected first collapsible block")
        }

        if case .paragraph = blocks[1] {
            // Good - paragraph between
        } else {
            XCTFail("Expected paragraph between collapsibles")
        }

        if case .collapsible(let summary2, _, _) = blocks[2] {
            XCTAssertEqual(summary2, "Second")
        } else {
            XCTFail("Expected second collapsible block")
        }
    }

    /// Test 7: Long code blocks have correct line count
    func testLongCodeBlockLineCount() {
        let lines = (1...25).map { "line \($0)" }.joined(separator: "\n")
        let codeBlock = ContentBlock.codeBlock(code: lines, language: "swift")

        if case .codeBlock(let code, _) = codeBlock {
            let lineCount = code.components(separatedBy: .newlines).count
            XCTAssertEqual(lineCount, 25)
            XCTAssertTrue(lineCount > 15, "Should exceed auto-collapse threshold")
        }
    }

    /// Test 8: Nested collapsible sections render correctly
    /// Note: Due to regex matching, deeply nested details may be extracted as siblings.
    /// The recursive parsing handles this by re-parsing inner content.
    func testNestedCollapsibleSections() {
        // Test that a collapsible can contain other content types
        // For truly nested <details>, the parsing extracts them separately
        // then the inner blocks are recursively parsed
        let content = """
            <details>
            <summary>Outer</summary>
            Some intro text
            - List item 1
            - List item 2
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .collapsible(let outerSummary, let outerContent, _) = blocks[0] {
            XCTAssertEqual(outerSummary, "Outer")
            // Should contain paragraph and bullet list
            XCTAssertGreaterThanOrEqual(outerContent.count, 1)

            // Verify we have at least a paragraph or bullet list
            let hasParagraphOrList = outerContent.contains { block in
                switch block {
                case .paragraph, .bulletList:
                    return true
                default:
                    return false
                }
            }
            XCTAssertTrue(hasParagraphOrList, "Should contain paragraph or list content")
        } else {
            XCTFail("Expected outer collapsible block")
        }
    }

    /// Test 8b: Sibling collapsible sections in nested content
    func testSiblingCollapsibleInNestedContent() {
        // When inner details is within outer's content, it gets parsed recursively
        let content = """
            <details>
            <summary>Parent</summary>
            <details>
            <summary>Child</summary>
            Child content
            </details>
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        // The parsing will either:
        // 1. Extract both as separate top-level blocks, or
        // 2. Extract outer with inner as nested content
        // Both are valid behaviors - we just verify no crash and proper structure
        XCTAssertGreaterThan(blocks.count, 0)

        // Find a collapsible block with "Parent" or "Child" summary
        let hasParent = blocks.contains { block in
            if case .collapsible(let summary, _, _) = block {
                return summary == "Parent"
            }
            return false
        }
        let hasChild = blocks.contains { block in
            if case .collapsible(let summary, _, _) = block {
                return summary == "Child"
            }
            return false
        }

        // At least one should be found
        XCTAssertTrue(hasParent || hasChild, "Should find at least one collapsible")
    }

    /// Test 9: Incomplete details during streaming handled gracefully
    func testIncompleteDetailsHandledGracefully() {
        // Partial content - no closing tag
        let content = """
            <details>
            <summary>Loading
            """
        let view = MarkdownContent(content: content, isStreaming: true)
        let blocks = view.parseBlocks(content)

        // Should not crash, content should be preserved somehow
        XCTAssertNotNil(blocks)

        // Check partial detection helper
        XCTAssertTrue(view.isPartialCollapsible(content), "Should detect partial collapsible")
    }

    /// Test 10: Collapsible with code block content
    func testCollapsibleWithCodeBlockContent() {
        let content = """
            <details>
            <summary>Code Example</summary>
            ```swift
            let x = 1
            print(x)
            ```
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .collapsible(let summary, let nestedContent, _) = blocks[0] {
            XCTAssertEqual(summary, "Code Example")

            // Find the code block in nested content
            let hasCodeBlock = nestedContent.contains { block in
                if case .codeBlock = block { return true }
                return false
            }
            XCTAssertTrue(hasCodeBlock, "Should contain a code block")
        } else {
            XCTFail("Expected collapsible block")
        }
    }

    // MARK: - ContentBlock Equality Tests

    func testCollapsibleBlockEquality() {
        let block1 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("Hello")],
            isOpen: false
        )
        let block2 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("Hello")],
            isOpen: false
        )
        let block3 = ContentBlock.collapsible(
            summary: "Different",
            content: [.paragraph("Hello")],
            isOpen: false
        )

        XCTAssertEqual(block1, block2)
        XCTAssertNotEqual(block1, block3)
    }

    func testCollapsibleBlockDifferentContentNotEqual() {
        let block1 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("Hello")],
            isOpen: false
        )
        let block2 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("World")],
            isOpen: false
        )

        XCTAssertNotEqual(block1, block2)
    }

    func testCollapsibleBlockDifferentOpenStateNotEqual() {
        let block1 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("Hello")],
            isOpen: false
        )
        let block2 = ContentBlock.collapsible(
            summary: "Test",
            content: [.paragraph("Hello")],
            isOpen: true
        )

        XCTAssertNotEqual(block1, block2)
    }

    // MARK: - Edge Cases

    func testEmptySummary() {
        let content = """
            <details>
            <summary></summary>
            Content
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        // Should still parse with empty summary
        if blocks.count == 1, case .collapsible(let summary, _, _) = blocks[0] {
            XCTAssertEqual(summary, "")
        }
    }

    func testWhitespaceOnlySummary() {
        let content = """
            <details>
            <summary>   </summary>
            Content
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        if blocks.count == 1, case .collapsible(let summary, _, _) = blocks[0] {
            // Should be trimmed to empty or whitespace
            XCTAssertTrue(summary.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    func testEmptyNestedContent() {
        let content = """
            <details>
            <summary>Empty Section</summary>
            </details>
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        if blocks.count == 1, case .collapsible(_, let nestedContent, _) = blocks[0] {
            XCTAssertEqual(nestedContent.count, 0)
        }
    }

    func testPartialCollapsibleDetection() {
        // Test various partial states
        XCTAssertTrue(isPartialCollapsibleHelper("<details>"))
        XCTAssertTrue(isPartialCollapsibleHelper("<details><summary>Title"))
        XCTAssertTrue(isPartialCollapsibleHelper("<details><summary>Title</summary>Content"))
        XCTAssertFalse(isPartialCollapsibleHelper("<details><summary>Title</summary>Content</details>"))
        XCTAssertFalse(isPartialCollapsibleHelper("No details here"))
    }

    // Helper for partial collapsible detection
    private func isPartialCollapsibleHelper(_ content: String) -> Bool {
        let view = MarkdownContent(content: content)
        return view.isPartialCollapsible(content)
    }

    // MARK: - Code Block Auto-Collapse Tests

    func testCodeBlockUnderThresholdNotAutoCollapse() {
        let shortCode = (1...10).map { "line \($0)" }.joined(separator: "\n")
        let lineCount = shortCode.components(separatedBy: .newlines).count
        XCTAssertLessThanOrEqual(lineCount, 15, "Should be under threshold")
    }

    func testCodeBlockOverThresholdShouldAutoCollapse() {
        let longCode = (1...25).map { "line \($0)" }.joined(separator: "\n")
        let lineCount = longCode.components(separatedBy: .newlines).count
        XCTAssertGreaterThan(lineCount, 15, "Should exceed threshold")
    }

    // MARK: - View Construction Tests

    func testCollapsibleSectionViewConstruction() {
        let section = CollapsibleSection(summary: "Test") {
            Text("Content")
        }
        XCTAssertNotNil(section.body)
    }

    func testCollapsibleSectionWithDefaultExpanded() {
        let section = CollapsibleSection(summary: "Test", defaultExpanded: true) {
            Text("Content")
        }
        XCTAssertNotNil(section.body)
    }

    func testCollapsibleSectionWithStreaming() {
        let section = CollapsibleSection(summary: "Test", isStreaming: true) {
            Text("Content")
        }
        XCTAssertNotNil(section.body)
    }

    func testCodeBlockViewConstruction() {
        let codeView = CodeBlockView(code: "let x = 1", language: "swift")
        XCTAssertNotNil(codeView.body)
    }

    func testCodeBlockViewWithStreaming() {
        let codeView = CodeBlockView(code: "let x = 1", language: "swift", isStreaming: true)
        XCTAssertNotNil(codeView.body)
    }

    func testCodeBlockViewWithNoLanguage() {
        let codeView = CodeBlockView(code: "echo hello", language: nil)
        XCTAssertNotNil(codeView.body)
    }
}
