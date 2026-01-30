//
//  CodeBlockTests.swift
//  OptaMoltTests
//
//  Tests for code block parsing, rendering, and syntax highlighting.
//

import XCTest
@testable import OptaMolt

final class CodeBlockTests: XCTestCase {

    // MARK: - Code Block Detection Tests

    /// Test 1: Single code block detection and extraction
    func testSingleCodeBlockDetection() {
        let content = """
        Here is some code:

        ```swift
        let x = 42
        ```

        That's it!
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        // Should have: paragraph, code block, paragraph
        XCTAssertEqual(blocks.count, 3, "Should have 3 blocks")

        if case .codeBlock(let code, let language) = blocks[1] {
            XCTAssertEqual(code, "let x = 42")
            XCTAssertEqual(language, "swift")
        } else {
            XCTFail("Second block should be a code block")
        }
    }

    /// Test 2: Code block with language hint parsed correctly
    func testCodeBlockWithLanguageHint() {
        let content = """
        ```python
        def hello():
            print("Hello")
        ```
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "python")
            XCTAssertTrue(code.contains("def hello():"))
            XCTAssertTrue(code.contains("print"))
        } else {
            XCTFail("Should be a code block with python language")
        }
    }

    /// Test 3: Code block without language hint
    func testCodeBlockWithoutLanguageHint() {
        let content = """
        ```
        npm install
        npm run dev
        ```
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        XCTAssertEqual(blocks.count, 1)

        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertNil(language, "Language should be nil when not specified")
            XCTAssertTrue(code.contains("npm install"))
        } else {
            XCTFail("Should be a code block without language")
        }
    }

    /// Test 4: Multiple code blocks in content
    func testMultipleCodeBlocks() {
        let content = """
        First code:

        ```swift
        let a = 1
        ```

        Second code:

        ```python
        b = 2
        ```

        Done.
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        // Count code blocks
        let codeBlocks = blocks.filter {
            if case .codeBlock = $0 { return true }
            return false
        }

        XCTAssertEqual(codeBlocks.count, 2, "Should have 2 code blocks")

        // Verify languages
        if case .codeBlock(_, let lang1) = codeBlocks[0] {
            XCTAssertEqual(lang1, "swift")
        }
        if case .codeBlock(_, let lang2) = codeBlocks[1] {
            XCTAssertEqual(lang2, "python")
        }
    }

    /// Test 5: Unclosed code block during streaming
    func testUnclosedCodeBlockStreaming() {
        let content = """
        ```python
        print("Hello
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary, isStreaming: true)
        let blocks = markdown.parseBlocks(content)

        // Should still render as code block (partial)
        XCTAssertEqual(blocks.count, 1)

        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "python")
            XCTAssertTrue(code.contains("print"))
        } else {
            XCTFail("Should be a partial code block")
        }
    }

    /// Test 6: hasPartialCodeBlock detection
    func testHasPartialCodeBlockDetection() {
        let completeContent = """
        ```swift
        let x = 1
        ```
        """

        let partialContent = """
        ```swift
        let x = 1
        """

        XCTAssertFalse(MarkdownContent.hasPartialCodeBlock(completeContent))
        XCTAssertTrue(MarkdownContent.hasPartialCodeBlock(partialContent))
    }

    /// Test 7: Mixed content - paragraphs + code blocks
    func testMixedContent() {
        let content = """
        Here's **bold** text.

        ```swift
        let code = "inline"
        ```

        - Bullet one
        - Bullet two

        ```json
        {"key": "value"}
        ```

        Final paragraph.
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        // Should have: paragraph, code block, bullet list, code block, paragraph
        var paragraphCount = 0
        var codeBlockCount = 0
        var bulletListCount = 0

        for block in blocks {
            switch block {
            case .paragraph:
                paragraphCount += 1
            case .codeBlock:
                codeBlockCount += 1
            case .bulletList:
                bulletListCount += 1
            case .collapsible:
                break
            case .table:
                break
            case .chart:
                break
            case .image:
                break
            }
        }

        XCTAssertEqual(codeBlockCount, 2, "Should have 2 code blocks")
        XCTAssertEqual(bulletListCount, 1, "Should have 1 bullet list")
        XCTAssertGreaterThanOrEqual(paragraphCount, 2, "Should have at least 2 paragraphs")
    }

    /// Test 8: Code block preserves indentation
    func testCodeBlockPreservesIndentation() {
        let content = """
        ```swift
        func test() {
            if true {
                print("indented")
            }
        }
        ```
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        if case .codeBlock(let code, _) = blocks[0] {
            XCTAssertTrue(code.contains("    if true"), "Should preserve 4-space indent")
            XCTAssertTrue(code.contains("        print"), "Should preserve 8-space indent")
        } else {
            XCTFail("Should be a code block")
        }
    }

    /// Test 9: Code block with special characters
    func testCodeBlockWithSpecialCharacters() {
        let content = """
        ```bash
        echo "Hello, $USER!"
        cat file.txt | grep "pattern" > output.txt
        ```
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "bash")
            XCTAssertTrue(code.contains("$USER"))
            XCTAssertTrue(code.contains("|"))
            XCTAssertTrue(code.contains(">"))
        } else {
            XCTFail("Should be a code block")
        }
    }

    /// Test 10: Empty code block
    func testEmptyCodeBlock() {
        let content = """
        ```swift
        ```
        """

        let markdown = MarkdownContent(content: content, textColor: .optaTextPrimary)
        let blocks = markdown.parseBlocks(content)

        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "swift")
            XCTAssertTrue(code.isEmpty, "Code should be empty")
        } else {
            XCTFail("Should be an empty code block")
        }
    }
}

// MARK: - Syntax Highlighting Tests

final class SyntaxHighlighterTests: XCTestCase {

    /// Test 1: Swift keywords are highlighted
    func testSwiftKeywordsHighlighted() {
        let code = "func greet(name: String) { return name }"
        let highlighted = SyntaxHighlighter.highlight(code, language: "swift")

        // The highlighted string should be an AttributedString
        XCTAssertFalse(highlighted.characters.isEmpty)

        // We can't easily test colors in unit tests, but we can verify the string content is preserved
        XCTAssertTrue(String(highlighted.characters).contains("func"))
        XCTAssertTrue(String(highlighted.characters).contains("return"))
    }

    /// Test 2: String literals are highlighted
    func testStringLiteralsHighlighted() {
        let code = """
        let message = "Hello, World!"
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "swift")

        XCTAssertTrue(String(highlighted.characters).contains("Hello, World!"))
    }

    /// Test 3: Comments are highlighted
    func testCommentsHighlighted() {
        let code = """
        // This is a comment
        let x = 42 // inline comment
        /* block comment */
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "swift")

        XCTAssertTrue(String(highlighted.characters).contains("This is a comment"))
        XCTAssertTrue(String(highlighted.characters).contains("block comment"))
    }

    /// Test 4: Numbers are highlighted
    func testNumbersHighlighted() {
        let code = """
        let decimal = 42
        let hex = 0xFF
        let float = 3.14
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "swift")

        XCTAssertTrue(String(highlighted.characters).contains("42"))
        XCTAssertTrue(String(highlighted.characters).contains("0xFF"))
        XCTAssertTrue(String(highlighted.characters).contains("3.14"))
    }

    /// Test 5: Language detection from code
    func testLanguageDetection() {
        let swiftCode = """
        import SwiftUI
        struct ContentView: View {
            var body: some View { Text("Hi") }
        }
        """

        let pythonCode = """
        def calculate(n):
            return n * 2
        """

        let jsCode = """
        const handler = async () => {
            await fetch(url);
        };
        """

        XCTAssertEqual(SyntaxHighlighter.detectLanguage(from: swiftCode), "swift")
        XCTAssertEqual(SyntaxHighlighter.detectLanguage(from: pythonCode), "python")
        XCTAssertEqual(SyntaxHighlighter.detectLanguage(from: jsCode), "javascript")
    }

    /// Test 6: Generic fallback for unknown language
    func testGenericFallback() {
        let code = "some random code here = 42"
        let highlighted = SyntaxHighlighter.highlight(code, language: nil)

        // Should still produce an attributed string without crashing
        XCTAssertFalse(highlighted.characters.isEmpty)
    }

    /// Test 7: Python syntax highlighting
    func testPythonSyntax() {
        let code = """
        def fibonacci(n):
            if n <= 1:
                return n
            return fibonacci(n-1) + fibonacci(n-2)
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "python")

        XCTAssertTrue(String(highlighted.characters).contains("def"))
        XCTAssertTrue(String(highlighted.characters).contains("return"))
    }

    /// Test 8: JSON syntax highlighting
    func testJSONSyntax() {
        let code = """
        {
            "name": "test",
            "count": 42,
            "active": true
        }
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "json")

        XCTAssertTrue(String(highlighted.characters).contains("name"))
        XCTAssertTrue(String(highlighted.characters).contains("true"))
    }

    /// Test 9: Rust syntax highlighting
    func testRustSyntax() {
        let code = """
        fn main() {
            let mut x = 5;
            println!("x = {}", x);
        }
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "rust")

        XCTAssertTrue(String(highlighted.characters).contains("fn"))
        XCTAssertTrue(String(highlighted.characters).contains("mut"))
    }

    /// Test 10: Shell/Bash syntax highlighting
    func testShellSyntax() {
        let code = """
        #!/bin/bash
        echo "Hello, $USER"
        for i in {1..5}; do
            echo $i
        done
        """
        let highlighted = SyntaxHighlighter.highlight(code, language: "bash")

        XCTAssertTrue(String(highlighted.characters).contains("echo"))
        XCTAssertTrue(String(highlighted.characters).contains("done"))
    }
}
