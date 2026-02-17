# Roadmap: Opta CLI

## Overview

Opta CLI is a self-hosted AI coding assistant that connects to local LLM inference via Opta-LMX. The v0.1-v0.5 work built the complete agent loop, tool system, MCP integration, and basic TUI scaffolding. This roadmap tracks the next milestone: making the full-screen TUI a premium, production-quality experience competitive with OpenCode.

## Domain Expertise

None (internal project, no external domain skills)

## Milestones

- ✅ **v0.6.0 Premium TUI** — Phases 1-10 (complete)

## Phases

- [x] **Phase 1: tui-markdown** — Markdown rendering in TUI message output
- [x] **Phase 2: tui-input** — Multiline input with history and @file completion
- [x] **Phase 3: tui-slash-commands** — Full slash command support in TUI mode
- [x] **Phase 4: tui-tool-display** — Rich tool call cards with collapsible results
- [x] **Phase 5: tui-thinking** — Thinking block display with expand/collapse
- [x] **Phase 6: tui-permissions** — Interactive permission prompts in TUI mode
- [x] **Phase 7: tui-scrollback** — Line-accurate scrolling and viewport management
- [x] **Phase 8: tui-integration** — Wire remaining REPL features (@file, title, shell, cost)
- [x] **Phase 9: tui-keybindings** — Complete all keybinding actions + help overlay
- [x] **Phase 10: tui-polish** — Visual refinement, responsive layout, edge cases

## Phase Details

### 🚧 v0.6.0 Premium TUI (In Progress)

**Milestone Goal:** Transform the scaffolded TUI into a premium, functional, stable full-screen experience that matches or exceeds OpenCode's terminal UX quality.

#### Phase 1: tui-markdown
**Goal**: Render assistant markdown output (code blocks, headers, lists, bold/italic, links) in the Ink TUI with syntax highlighting and proper terminal formatting
**Depends on**: Nothing (first phase)

Plans:
- [x] 01-01: TUI Markdown Rendering (4 tasks: MarkdownText component, streaming debounce, MessageList integration, cache + width) ✓

#### Phase 2: tui-input
**Goal**: Replace single-line ink-text-input with multiline editor supporting input history (up/down), paste detection, and @file autocomplete hints
**Depends on**: Phase 1

Plans:
- [x] 02-01: Multiline Input (3 tasks: custom input, history, @file autocomplete) ✓

#### Phase 3: tui-slash-commands
**Goal**: Route slash commands typed in TUI input through dispatchSlashCommand, display results in the message area, and handle mode switches (/plan, /model, /agent)
**Depends on**: Phase 2

Plans:
- [x] 03-01: Slash Command Routing (3 tasks: registry routing, autocomplete, output capture) ✓

#### Phase 4: tui-tool-display
**Goal**: Rich tool call visualization with expandable/collapsible result cards, file path links, colored status indicators, and progress tracking per tool
**Depends on**: Phase 1

Plans:
- [x] 04-01: ToolCard Component (3 tasks: component, integration, tests) ✓

#### Phase 5: tui-thinking
**Goal**: Display model thinking/reasoning blocks with collapse/expand toggle (Ctrl+T), buffered output with summary line when collapsed
**Depends on**: Phase 1

Plans:
- [x] 05-01: ThinkingBlock Component (4 tasks: component, message flow, keybinding, tests) ✓

#### Phase 6: tui-permissions
**Goal**: Interactive Y/n/always permission prompts when tools require approval, replacing the current silent deny behavior in TUI mode
**Depends on**: Phase 3

Plans:
- [x] 06-01: PermissionPrompt component + adapter bridge (4 tasks) ✓

#### Phase 7: tui-scrollback
**Goal**: Line-accurate viewport scrolling (not item-based), proper scroll position for wrapped text, scroll-to-bottom on new content, scrollbar proportional to content size
**Depends on**: Phase 4

Plans:
- [x] 07-01: ScrollView rewrite with line-based scrolling (3 tasks) ✓

#### Phase 8: tui-integration
**Goal**: Wire remaining REPL features into TUI: @file reference resolution, session title generation, !shell command execution, cost estimation, promptTokens tracking
**Depends on**: Phase 6

Plans:
- [x] 08-01: @file resolution, title generation, shell execution, cost state (4 tasks) ✓

#### Phase 9: tui-keybindings
**Goal**: Implement all keybinding actions (help overlay, slash menu, expand thinking), add Ctrl+? help panel showing available shortcuts, context-sensitive bindings
**Depends on**: Phase 8

Plans:
- [x] 09-01: HelpOverlay component + keybinding wiring (4 tasks) ✓

#### Phase 10: tui-polish
**Goal**: Visual refinement pass — responsive breakpoints for narrow terminals, color theme consistency, edge case handling (empty states, long messages, rapid input), performance optimization
**Depends on**: Phase 9

Plans:
- [x] 10-01: Responsive layout, compact modes, edge cases, color review (5 tasks) ✓

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. tui-markdown | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 2. tui-input | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 3. tui-slash-commands | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 4. tui-tool-display | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 5. tui-thinking | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 6. tui-permissions | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 7. tui-scrollback | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 8. tui-integration | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 9. tui-keybindings | v0.6.0 | 1/1 | Complete | 2026-02-17 |
| 10. tui-polish | v0.6.0 | 1/1 | Complete | 2026-02-17 |
