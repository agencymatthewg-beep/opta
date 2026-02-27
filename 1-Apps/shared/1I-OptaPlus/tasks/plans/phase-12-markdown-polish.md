# Phase 12: Markdown Rendering Polish

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-12-markdown-polish.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` — Current message rendering
3. `Shared/Sources/OptaMolt/Chat/CodeBlockView.swift` — Code block rendering
4. `Shared/Sources/OptaMolt/Chat/ChartView.swift` — Chart rendering
5. `Shared/Sources/OptaMolt/Chat/LinkPreview.swift` — Link preview
6. `Shared/Tests/OptaMoltTests/MarkdownContentTests.swift` — Existing markdown tests

Current state: Basic markdown works (bold, italic, code, headings, lists, blockquotes). Known gaps: tables, nested lists, task lists, horizontal rules, strikethrough, inline images, LaTeX.
</context>

<instructions>
### 1. Tables

Parse markdown tables and render as native SwiftUI grid:

```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

Render with:
- Header row: bold, slight background tint
- Cell borders: subtle hairline (0.5pt, optaGlass color)
- Horizontal scroll if table wider than bubble
- Copy table button (copies as markdown)

### 2. Task Lists (Checkboxes)

```markdown
- [x] Completed task
- [ ] Incomplete task
```

Render with:
- Checkbox icon (filled/empty square)
- Strikethrough on completed items
- NOT interactive (these are bot output, not editable)

### 3. Nested Lists

Support 3 levels of nesting with proper indentation:
```markdown
- Level 1
  - Level 2
    - Level 3
```

Each level indented by 16pt. Bullet style changes: •, ◦, ▪

### 4. Horizontal Rules

```markdown
---
```

Render as a subtle divider line with opacity 0.3.

### 5. Strikethrough

```markdown
~~deleted text~~
```

Render with `.strikethrough()` modifier.

### 6. Inline Code Improvements

- Background: `optaGlass` at 0.15 opacity
- Font: `.system(.body, design: .monospaced)`
- Padding: 2pt horizontal, 1pt vertical
- Rounded corners: 4pt

### 7. Code Block Improvements

- Language label in top-right corner (swift, python, bash, etc.)
- Copy button always visible (not just on hover)
- Line numbers (optional, toggle in settings)
- Syntax highlighting colors:
  - Keywords: `optaViolet`
  - Strings: `optaCyan`
  - Comments: `optaGlass` at 0.5
  - Numbers: `optaAmber`

### 8. Link Rendering

- Detect URLs in text and make tappable
- Style: `optaBlue`, underlined
- macOS: open in default browser
- iOS: open in SFSafariViewController (in-app)
- Link previews for known domains (GitHub, YouTube) — title + favicon

### 9. Block Quotes Polish

```markdown
> This is a quote
```

- Left border: 3pt, `optaViolet`
- Background: `optaGlass` at 0.05
- Italic text
- Nested blockquotes with darker tint

### 10. Tests

Update `MarkdownContentTests.swift`:
- Table parsing + column count
- Task list detection
- Nested list depth
- Strikethrough detection
- Horizontal rule detection
- All existing tests must still pass
</instructions>

<constraints>
- Pure SwiftUI text rendering — no WKWebView, no AttributedString from HTML
- Use Swift's built-in markdown parsing where possible (AttributedString(markdown:))
- Custom parser only for features AttributedString doesn't support (tables, task lists)
- Performance: parse once, cache parsed result (don't re-parse on every render)
- Max table columns: 10 (wider = horizontal scroll)
- Max code block height: 400pt (then scroll)
- Both platforms build with 0 errors
</constraints>

<output>
Test checklist:
1. Table renders with headers, borders, horizontal scroll
2. Task lists show checkboxes (not interactive)
3. 3-level nested lists render with correct indentation
4. Horizontal rule renders as divider
5. ~~Strikethrough~~ renders correctly
6. Inline code has background tint
7. Code blocks have language label + copy button
8. URLs are tappable links
9. Blockquotes have left border + tint
10. All existing markdown tests still pass
11. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 12 — Markdown rendering polished on both platforms" --mode now
```
</output>
