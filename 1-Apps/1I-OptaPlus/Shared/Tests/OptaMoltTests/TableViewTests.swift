//
//  TableViewTests.swift
//  OptaMoltTests
//
//  Unit tests for table parsing and TableView component.
//

import XCTest
@testable import OptaMolt
import SwiftUI

final class TableViewTests: XCTestCase {

    // MARK: - TableData Tests

    func testTableDataEquality() {
        let data1 = TableData(
            headers: ["A", "B"],
            rows: [["1", "2"]],
            alignments: [.left, .right]
        )
        let data2 = TableData(
            headers: ["A", "B"],
            rows: [["1", "2"]],
            alignments: [.left, .right]
        )
        let data3 = TableData(
            headers: ["A", "C"],
            rows: [["1", "2"]],
            alignments: [.left, .right]
        )

        XCTAssertEqual(data1, data2)
        XCTAssertNotEqual(data1, data3)
    }

    func testTableAlignmentEquality() {
        XCTAssertEqual(TableData.TableAlignment.left, TableData.TableAlignment.left)
        XCTAssertNotEqual(TableData.TableAlignment.left, TableData.TableAlignment.center)
        XCTAssertNotEqual(TableData.TableAlignment.center, TableData.TableAlignment.right)
    }

    func testTableDataInit() {
        let headers = ["Name", "Value", "Status"]
        let rows = [["Item", "100", "Active"]]
        let alignments: [TableData.TableAlignment] = [.left, .right, .center]

        let data = TableData(headers: headers, rows: rows, alignments: alignments)

        XCTAssertEqual(data.headers, headers)
        XCTAssertEqual(data.rows, rows)
        XCTAssertEqual(data.alignments, alignments)
    }

    // MARK: - Table Parsing Tests

    func testParseSimple2x2Table() {
        let content = """
        | Name | Value |
        |------|-------|
        | A    | 1     |
        | B    | 2     |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .table(let data) = blocks[0] {
            XCTAssertEqual(data.headers, ["Name", "Value"])
            XCTAssertEqual(data.rows.count, 2)
            XCTAssertEqual(data.rows[0], ["A", "1"])
            XCTAssertEqual(data.rows[1], ["B", "2"])
        } else {
            XCTFail("Expected table block")
        }
    }

    func testParseTableWith5PlusColumns() {
        let content = """
        | Col1 | Col2 | Col3 | Col4 | Col5 | Col6 |
        |------|------|------|------|------|------|
        | A1   | B1   | C1   | D1   | E1   | F1   |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .table(let data) = blocks[0] {
            XCTAssertEqual(data.headers.count, 6)
            XCTAssertEqual(data.rows.count, 1)
            XCTAssertEqual(data.rows[0].count, 6)
        } else {
            XCTFail("Expected table block")
        }
    }

    func testParseTableWithAlignmentMarkers() {
        let content = """
        | Left | Center | Right |
        |:-----|:------:|------:|
        | A    | B      | C     |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .table(let data) = blocks[0] {
            XCTAssertEqual(data.alignments, [.left, .center, .right])
        } else {
            XCTFail("Expected table block")
        }
    }

    func testParseTableMissingSeparatorRow() {
        // Without separator row, should be treated as regular content
        let content = """
        | Name | Value |
        | A    | 1     |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        // Without separator, the second row triggers fallback to paragraph
        XCTAssertFalse(blocks.isEmpty)
        // First row detected as header, second not a separator, so treated as paragraph
        if case .paragraph = blocks[0] {
            // Expected behavior
        } else if case .table = blocks[0] {
            XCTFail("Should not parse as table without separator")
        }
    }

    func testParseEmptyTable() {
        let content = """
        | Name | Value |
        |------|-------|
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)
        if case .table(let data) = blocks[0] {
            XCTAssertEqual(data.headers, ["Name", "Value"])
            XCTAssertTrue(data.rows.isEmpty)
        } else {
            XCTFail("Expected table block")
        }
    }

    func testStreamingPartialTableHeaderOnly() {
        // During streaming, might have only header
        let content = "| Name | Value |"

        let markdown = MarkdownContent(content: content, textColor: .white, isStreaming: true)
        let blocks = markdown.parseBlocks(content)

        // Header-only should be flushed as table during streaming
        if case .table(let data) = blocks.first {
            XCTAssertEqual(data.headers, ["Name", "Value"])
            XCTAssertTrue(data.rows.isEmpty)
        } else {
            // Or as paragraph if no separator detected
            XCTAssertFalse(blocks.isEmpty)
        }
    }

    func testHasPartialTable() {
        // Complete table
        XCTAssertFalse(MarkdownContent.hasPartialTable("""
        | A | B |
        |---|---|
        | 1 | 2 |
        """))

        // Partial table - header only
        XCTAssertTrue(MarkdownContent.hasPartialTable("| A | B |"))

        // Partial row - incomplete
        XCTAssertTrue(MarkdownContent.hasPartialTable("| A | B"))

        // Header with incomplete separator
        XCTAssertTrue(MarkdownContent.hasPartialTable("""
        | A | B |
        |---
        """))
    }

    func testTableDataEqualityDifferentRows() {
        let data1 = TableData(
            headers: ["A"],
            rows: [["1"], ["2"]],
            alignments: [.left]
        )
        let data2 = TableData(
            headers: ["A"],
            rows: [["1"]],
            alignments: [.left]
        )

        XCTAssertNotEqual(data1, data2)
    }

    func testTableDataEqualityDifferentAlignments() {
        let data1 = TableData(
            headers: ["A"],
            rows: [["1"]],
            alignments: [.left]
        )
        let data2 = TableData(
            headers: ["A"],
            rows: [["1"]],
            alignments: [.right]
        )

        XCTAssertNotEqual(data1, data2)
    }

    // MARK: - TableView Construction Tests

    func testTableViewConstruction() {
        let data = TableData(
            headers: ["Name", "Value"],
            rows: [["Item", "100"]],
            alignments: [.left, .right]
        )

        let view = TableView(data: data)

        XCTAssertEqual(view.data, data)
    }

    func testTableViewWithCustomTextColor() {
        let data = TableData(
            headers: ["A"],
            rows: [],
            alignments: [.left]
        )

        let view = TableView(data: data, textColor: .red)

        XCTAssertEqual(view.textColor, .red)
    }

    func testTableViewDefaultTextColor() {
        let data = TableData(
            headers: ["A"],
            rows: [],
            alignments: [.left]
        )

        let view = TableView(data: data)

        XCTAssertEqual(view.textColor, .optaTextPrimary)
    }

    // MARK: - Integration Tests

    func testTableWithSurroundingContent() {
        let content = """
        Here is some text before the table.

        | Header |
        |--------|
        | Data   |

        And some text after.
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        // Should have: paragraph, table, paragraph
        XCTAssertGreaterThanOrEqual(blocks.count, 3)

        var foundTable = false
        for block in blocks {
            if case .table(let data) = block {
                foundTable = true
                XCTAssertEqual(data.headers, ["Header"])
                XCTAssertEqual(data.rows.count, 1)
            }
        }
        XCTAssertTrue(foundTable, "Should find a table in the content")
    }

    func testMultipleTablesInContent() {
        let content = """
        | Table1 |
        |--------|
        | A      |

        | Table2 |
        |--------|
        | B      |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        var tableCount = 0
        for block in blocks {
            if case .table = block {
                tableCount += 1
            }
        }
        XCTAssertEqual(tableCount, 2, "Should find 2 tables")
    }

    func testTableRowWithUnevenColumns() {
        // Rows with fewer columns than header should be padded
        let content = """
        | A | B | C |
        |---|---|---|
        | 1 | 2 |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        if case .table(let data) = blocks.first {
            XCTAssertEqual(data.headers.count, 3)
            // Row should be padded to match header count
            XCTAssertEqual(data.rows[0].count, 3)
        } else {
            XCTFail("Expected table block")
        }
    }

    func testTableRowWithExtraColumns() {
        // Rows with more columns than header should be truncated
        let content = """
        | A | B |
        |---|---|
        | 1 | 2 | 3 | 4 |
        """

        let markdown = MarkdownContent(content: content, textColor: .white)
        let blocks = markdown.parseBlocks(content)

        if case .table(let data) = blocks.first {
            XCTAssertEqual(data.headers.count, 2)
            // Row should be truncated to match header count
            XCTAssertEqual(data.rows[0].count, 2)
            XCTAssertEqual(data.rows[0], ["1", "2"])
        } else {
            XCTFail("Expected table block")
        }
    }

    func testContentBlockTableCase() {
        let data = TableData(
            headers: ["Test"],
            rows: [["Value"]],
            alignments: [.left]
        )
        let block = ContentBlock.table(data)

        if case .table(let extractedData) = block {
            XCTAssertEqual(extractedData, data)
        } else {
            XCTFail("Failed to extract table data")
        }
    }
}
