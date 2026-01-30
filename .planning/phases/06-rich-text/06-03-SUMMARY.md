# Phase 06-03: Expandable/Collapsible Sections - Summary

**Status**: Complete
**Date**: 2026-01-30

## Objective Achieved

Implemented expandable/collapsible sections for organizing long content with smooth spring animations. Added support for `<details>/<summary>` HTML-style tags and auto-collapse for long code blocks (>15 lines).

## Files Created

### New Files

1. **`Shared/Sources/OptaMolt/Chat/CollapsibleSection.swift`**
   - `CollapsibleSection<Content: View>` - Generic collapsible container
   - `StreamingCollapsibleSection<Content: View>` - Streaming-aware variant
   - `CollapsibleBlockView` - MarkdownContent integration helper
   - Features: spring animations, rotating chevron, "Tap to expand" hint

2. **`Shared/Sources/OptaMolt/Chat/CodeBlockView.swift`**
   - Code block rendering with syntax highlighting
   - Auto-collapse for code >15 lines
   - Copy-to-clipboard button
   - Streaming state indicator
   - Language badge in header

3. **`Shared/Tests/OptaMoltTests/CollapsibleSectionTests.swift`**
   - 26 comprehensive test cases

### Modified Files

1. **`Shared/Sources/OptaMolt/Chat/MarkdownContent.swift`**
   - Added `.collapsible(summary:content:isOpen:)` case to `ContentBlock`
   - Added `extractCollapsibleBlocks()` for `<details>/<summary>` detection
   - Added `parseNestedContent()` for recursive block parsing
   - Added `isPartialCollapsible()` helper for streaming detection
   - Updated `renderBlock()` for collapsible case
   - Added code block fence detection in `parseBlocks()`

2. **`Shared/Sources/OptaMolt/Chat/SyntaxHighlighter.swift`**
   - Fixed Rust raw string regex pattern (used `##"..."##` delimiter)

## Features Implemented

### Collapsible Section Detection
- Detects `<details>/<summary>` HTML tags
- Supports optional `open` attribute for default expanded state
- Recursive nested content parsing
- Placeholder system for correct block ordering

### CollapsibleSection View
- Generic content via `@ViewBuilder`
- `@State` for expansion tracking
- Spring animation (`optaSpring`: 0.3s response, 0.7 damping)
- Rotating chevron (90 degrees on expand)
- Full header area tappable via `contentShape(Rectangle())`
- "Tap to expand" hint when collapsed

### CodeBlockView Auto-Collapse
- 15-line threshold for auto-collapse
- "Show more" / "Show less" toggle button
- Hidden line count display
- Spring animation for expand/collapse
- Streaming indicator when content incomplete

### Streaming Support
- Detects incomplete `<details>` blocks during streaming
- Auto-expand during streaming (prevents collapse)
- "Content loading..." indicator for partial content
- `isPartialCollapsible()` helper method

## Test Coverage

26 test cases covering:
1. Details/summary tag detection
2. Summary text extraction
3. Nested content recursive parsing
4. Default collapsed state
5. Open attribute detection
6. Multiple collapsible sections
7. Long code block line counting
8. Nested collapsible with mixed content
8b. Sibling collapsible in nested content
9. Incomplete details during streaming
10. Collapsible with code block content
- ContentBlock equality tests
- Edge cases (empty summary, whitespace, empty content)
- View construction tests for all components

## Commits

1. `ef4a336` - feat(06-03): add collapsible section detection to ContentBlock
2. `057713b` - feat(06-03): create CollapsibleSection view component
3. `4f58931` - test(06-03): add collapsible section unit tests

## Verification

```bash
cd /Users/matthewbyrden/Documents/Opta/apps/OptaMolt/Shared
swift build  # Build complete
swift test --filter Collapsible  # 26 tests, 0 failures
```

## Integration Notes

- `CollapsibleBlockView` is used by MarkdownContent to render `.collapsible` cases
- CodeBlockView includes syntax highlighting via SyntaxHighlighter
- Both views respect the `isStreaming` state for appropriate UX
- Uses design system colors: `optaSurface`, `optaSurfaceElevated`, `optaBorder`
- Uses design system animation: `optaSpring`

## Design System Compliance

- Surface colors: `optaSurface`, `optaSurfaceElevated`
- Border color: `optaBorder` at 50% opacity
- Text colors: `optaTextPrimary`, `optaTextSecondary`, `optaTextMuted`
- Accent color: `optaPurple` for links and buttons
- Animation: `optaSpring` (0.3s response, 0.7 damping)
- Border radius: 12pt for containers
- Spacing: 8pt vertical, 12pt horizontal padding
