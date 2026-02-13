//
//  MarkdownContentTests.swift
//  OptaMoltTests
//
//  Tests for MarkdownContent view and markdown parsing.
//

import XCTest
import SwiftUI
@testable import OptaMolt

final class MarkdownContentTests: XCTestCase {

    // MARK: - Block Parsing Tests

    func testPlainTextRendersUnchanged() {
        let content = "This is plain text without any formatting."
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, content)
        } else {
            XCTFail("Expected paragraph block")
        }
    }

    func testEmptyContentReturnsEmptyBlocks() {
        let content = ""
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 0)
    }

    func testWhitespaceOnlyContentReturnsEmptyBlocks() {
        let content = "   \n  \n   "
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 0)
    }

    // MARK: - Bullet List Tests

    func testBulletListWithDash() {
        let content = "- First item\n- Second item\n- Third item"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 3)
            XCTAssertEqual(items[0], "First item")
            XCTAssertEqual(items[1], "Second item")
            XCTAssertEqual(items[2], "Third item")
        } else {
            XCTFail("Expected bullet list block")
        }
    }

    func testBulletListWithAsterisk() {
        let content = "* Item one\n* Item two"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 2)
            XCTAssertEqual(items[0], "Item one")
            XCTAssertEqual(items[1], "Item two")
        } else {
            XCTFail("Expected bullet list block")
        }
    }

    func testBulletListWithPlus() {
        let content = "+ Alpha\n+ Beta"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 2)
            XCTAssertEqual(items[0], "Alpha")
            XCTAssertEqual(items[1], "Beta")
        } else {
            XCTFail("Expected bullet list block")
        }
    }

    func testMixedBulletStyles() {
        // All bullet styles should work together as one list
        let content = "- Dash item\n* Asterisk item\n+ Plus item"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 3)
        } else {
            XCTFail("Expected bullet list block")
        }
    }

    // MARK: - Mixed Content Tests

    func testParagraphFollowedByList() {
        let content = "Introduction text\n\n- First\n- Second"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 2)

        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "Introduction text")
        } else {
            XCTFail("Expected paragraph first")
        }

        if case .bulletList(let items) = blocks[1] {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("Expected bullet list second")
        }
    }

    func testListFollowedByParagraph() {
        let content = "- First\n- Second\n\nConclusion text"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 2)

        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("Expected bullet list first")
        }

        if case .paragraph(let text) = blocks[1] {
            XCTAssertEqual(text, "Conclusion text")
        } else {
            XCTFail("Expected paragraph second")
        }
    }

    func testMultipleParagraphsAndLists() {
        let content = """
            Intro paragraph

            - Item A
            - Item B

            Middle paragraph

            - Item C
            - Item D

            Final paragraph
            """
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 5)

        // Verify alternating pattern
        XCTAssertTrue(isParagraph(blocks[0]))
        XCTAssertTrue(isBulletList(blocks[1]))
        XCTAssertTrue(isParagraph(blocks[2]))
        XCTAssertTrue(isBulletList(blocks[3]))
        XCTAssertTrue(isParagraph(blocks[4]))
    }

    // MARK: - Streaming Resilience Tests

    func testIncompleteBoldDoesNotCrash() {
        // Unclosed bold marker should render gracefully
        let content = "This is **incomplete bold"
        let view = MarkdownContent(content: content)

        // Should not crash
        let blocks = view.parseBlocks(content)
        XCTAssertGreaterThan(blocks.count, 0)

        // View should render
        XCTAssertNotNil(view.body)
    }

    func testIncompleteItalicDoesNotCrash() {
        // Unclosed italic marker should render gracefully
        let content = "This is *incomplete italic"
        let view = MarkdownContent(content: content)

        // Should not crash
        let blocks = view.parseBlocks(content)
        XCTAssertGreaterThan(blocks.count, 0)

        // View should render
        XCTAssertNotNil(view.body)
    }

    func testIncompleteLinkDoesNotCrash() {
        // Incomplete link syntax should render gracefully
        let content = "Click [here](http://example"
        let view = MarkdownContent(content: content)

        // Should not crash
        let blocks = view.parseBlocks(content)
        XCTAssertGreaterThan(blocks.count, 0)

        // View should render
        XCTAssertNotNil(view.body)
    }

    func testIncompleteInlineCodeDoesNotCrash() {
        // Unclosed backtick should render gracefully
        let content = "Use `incomplete code"
        let view = MarkdownContent(content: content)

        // Should not crash
        let blocks = view.parseBlocks(content)
        XCTAssertGreaterThan(blocks.count, 0)

        // View should render
        XCTAssertNotNil(view.body)
    }

    func testPartialBulletListDuringStreaming() {
        // Partial list should render available items
        let content = "- First item\n- Second"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("Expected bullet list")
        }
    }

    // MARK: - Edge Cases

    func testSingleCharacterContent() {
        let content = "X"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
    }

    func testLineBreaksOnly() {
        let content = "\n\n\n"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 0)
    }

    func testBulletWithoutSpace() {
        // "-item" should not be treated as bullet (requires "- ")
        let content = "-item without space"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .paragraph = blocks[0] {
            // Good - not treated as bullet
        } else {
            XCTFail("Expected paragraph, not bullet list")
        }
    }

    func testEmptyBulletItem() {
        let content = "- \n- Second item"
        let view = MarkdownContent(content: content)
        let blocks = view.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .bulletList(let items) = blocks[0] {
            XCTAssertEqual(items.count, 2)
            XCTAssertEqual(items[0], "")  // Empty item is preserved
            XCTAssertEqual(items[1], "Second item")
        } else {
            XCTFail("Expected bullet list")
        }
    }

    // MARK: - View Construction Tests

    func testMarkdownContentViewConstruction() {
        let view = MarkdownContent(content: "Test content")
        XCTAssertNotNil(view.body)
    }

    func testMarkdownContentWithCustomTextColor() {
        let view = MarkdownContent(content: "Test", textColor: .red)
        XCTAssertNotNil(view.body)
    }

    func testMarkdownContentDefaultTextColor() {
        let view = MarkdownContent(content: "Test")
        // Should use default color without crashing
        XCTAssertNotNil(view.body)
    }

    // MARK: - ContentBlock Equality Tests

    func testContentBlockParagraphEquality() {
        let block1 = ContentBlock.paragraph("Hello")
        let block2 = ContentBlock.paragraph("Hello")
        let block3 = ContentBlock.paragraph("World")

        XCTAssertEqual(block1, block2)
        XCTAssertNotEqual(block1, block3)
    }

    func testContentBlockBulletListEquality() {
        let block1 = ContentBlock.bulletList(["A", "B"])
        let block2 = ContentBlock.bulletList(["A", "B"])
        let block3 = ContentBlock.bulletList(["A", "B", "C"])

        XCTAssertEqual(block1, block2)
        XCTAssertNotEqual(block1, block3)
    }

    func testContentBlockDifferentTypesNotEqual() {
        let paragraph = ContentBlock.paragraph("- Item")
        let list = ContentBlock.bulletList(["Item"])

        XCTAssertNotEqual(paragraph, list)
    }

    // MARK: - Helper Functions

    private func isParagraph(_ block: ContentBlock) -> Bool {
        if case .paragraph = block { return true }
        return false
    }

    private func isBulletList(_ block: ContentBlock) -> Bool {
        if case .bulletList = block { return true }
        return false
    }
}
