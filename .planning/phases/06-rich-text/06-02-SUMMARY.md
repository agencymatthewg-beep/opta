# Phase 06-02 Summary: Code Block Syntax Highlighting

**Status:** COMPLETE
**Date:** 2026-01-30

## Objective

Extend MarkdownContent to detect and render fenced code blocks (``` markers) with syntax highlighting, language labels, and copy functionality.

## What Was Built

### 1. Code Block Detection (MarkdownContent.swift)

Added `.codeBlock(code: String, language: String?)` case to `ContentBlock` enum and updated `parseBlocks()` to detect fenced code blocks:

- Pattern-based detection for complete code blocks: `` ```language\ncode\n``` ``
- Graceful handling of unclosed code blocks during streaming
- Static `hasPartialCodeBlock(_:)` helper for streaming detection
- Added `isStreaming` parameter to MarkdownContent for streaming-aware rendering

### 2. CodeBlockView Component

Created `Shared/Sources/OptaMolt/Chat/CodeBlockView.swift`:

- **Header**: Language label (lowercase) + copy button
- **Code content**: Horizontal scroll, syntax highlighted, text selectable
- **Auto-collapse**: Code blocks > 15 lines auto-collapse with "Show X more lines" button
- **Streaming support**: Progress indicator with "Streaming..." text
- **Copy button**: Hidden during streaming (code incomplete)

### 3. SyntaxHighlighter

Created `Shared/Sources/OptaMolt/Chat/SyntaxHighlighter.swift`:

**Language Support:**
- Swift
- Python
- JavaScript / TypeScript
- Rust
- Go
- JSON
- Shell/Bash
- HTML/XML
- CSS/SCSS

**Highlighting Categories (using design tokens):**
| Category | Color | Examples |
|----------|-------|----------|
| Keywords | optaPurple | `func`, `let`, `if`, `return` |
| Strings | optaBlue | `"hello"`, `'world'` |
| Comments | optaTextSecondary | `//`, `/* */`, `#` |
| Numbers | optaAmber | `42`, `0xFF`, `3.14` |
| Types | optaGreen | `String`, `View`, `MyClass` |

**Language Detection:**
- Auto-detects language from code content when not specified
- Checks for shebang, imports, keywords, and patterns
- Falls back to generic highlighting

### 4. Copy-to-Clipboard

Platform-specific clipboard integration:
- iOS: `UIPasteboard.general.string`
- macOS: `NSPasteboard.general.setString()`
- Visual feedback: Button shows "Copied!" with green checkmark for 2 seconds

### 5. Streaming Support

- Partial code block detection via odd count of ``` markers
- CodeBlockView shows animated streaming indicator
- Copy button hidden during streaming
- Content renders progressively as it arrives

### 6. Integration

Updated `MessageBubble.swift` to pass `isStreaming` state to `MarkdownContent`, enabling proper streaming-aware rendering of code blocks.

## Files Created

| File | Purpose |
|------|---------|
| `Shared/Sources/OptaMolt/Chat/SyntaxHighlighter.swift` | Regex-based syntax highlighting engine |
| `Shared/Tests/OptaMoltTests/CodeBlockTests.swift` | 20 unit tests (10 CodeBlock + 10 SyntaxHighlighter) |

## Files Modified

| File | Changes |
|------|---------|
| `Shared/Sources/OptaMolt/Chat/MarkdownContent.swift` | Added codeBlock case, isStreaming param, renderBlock handler |
| `Shared/Sources/OptaMolt/Chat/CodeBlockView.swift` | Added syntax highlighting integration |
| `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` | Pass isStreaming to MarkdownContent |

## Tests Added

### CodeBlockTests (10 tests)
1. `testSingleCodeBlockDetection` - Basic code block parsing
2. `testCodeBlockWithLanguageHint` - Language hint extraction
3. `testCodeBlockWithoutLanguageHint` - nil language handling
4. `testMultipleCodeBlocks` - Multiple blocks in content
5. `testUnclosedCodeBlockStreaming` - Partial block during streaming
6. `testHasPartialCodeBlockDetection` - Static helper function
7. `testMixedContent` - Paragraphs + bullets + code blocks
8. `testCodeBlockPreservesIndentation` - Whitespace preservation
9. `testCodeBlockWithSpecialCharacters` - Shell characters like $, |, >
10. `testEmptyCodeBlock` - Empty code block handling

### SyntaxHighlighterTests (10 tests)
1. `testSwiftKeywordsHighlighted` - Swift keyword detection
2. `testStringLiteralsHighlighted` - String highlighting
3. `testCommentsHighlighted` - Comment highlighting
4. `testNumbersHighlighted` - Number highlighting
5. `testLanguageDetection` - Auto-detection from code
6. `testGenericFallback` - Unknown language handling
7. `testPythonSyntax` - Python-specific patterns
8. `testJSONSyntax` - JSON highlighting
9. `testRustSyntax` - Rust-specific patterns
10. `testShellSyntax` - Shell/Bash patterns

## Verification

```bash
cd apps/OptaMolt/Shared
swift build         # Build complete (0.84s)
swift test --filter CodeBlockTests        # 10 tests passed
swift test --filter SyntaxHighlighterTests # 10 tests passed
```

## Commits

1. `feat(06-02): add code block detection to ContentBlock parsing`
2. `feat(06-02): create CodeBlockView component with syntax highlighting`
3. `feat(06-02): integrate CodeBlockView into MarkdownContent`
4. `test(06-02): add code block and syntax highlighting unit tests`

## Success Criteria

- [x] Fenced code blocks (```) detected and rendered
- [x] Language labels displayed when provided
- [x] Copy button copies code to clipboard with visual feedback
- [x] Syntax highlighting applies to keywords, strings, comments, numbers
- [x] Streaming code blocks show loading indicator
- [x] Copy button hidden during streaming
- [x] 20 new tests for code blocks and syntax highlighting
- [x] All existing tests pass

## Technical Notes

- SyntaxHighlighter uses `NSRegularExpression` with `DOTALL` and `MULTILINE` flags
- AttributedString used for efficient styled text rendering
- Highlighting patterns applied in order: comments -> strings -> numbers -> types -> keywords
- Auto-collapse threshold set to 15 lines for better UX
- Spring animations use `optaSpring` (0.3s response, 0.7 damping)

---
*Phase: 06-rich-text*
*Plan: 02 of 03*
*Wave: 2*
