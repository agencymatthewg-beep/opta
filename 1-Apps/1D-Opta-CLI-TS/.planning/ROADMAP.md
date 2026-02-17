# Roadmap: Opta CLI

## Overview

Opta CLI is a self-hosted AI coding assistant that connects to local LLM inference via Opta-LMX. The v0.1-v0.5 work built the complete agent loop, tool system, MCP integration, and basic TUI scaffolding. This roadmap tracks the next milestone: making the full-screen TUI a premium, production-quality experience competitive with OpenCode.

## Domain Expertise

None (internal project, no external domain skills)

## Milestones

- 🚧 **v0.6.0 Premium TUI** — Phases 1-10 (in progress)

## Phases

- [ ] **Phase 1: tui-markdown** — Markdown rendering in TUI message output
- [ ] **Phase 2: tui-input** — Multiline input with history and @file completion
- [ ] **Phase 3: tui-slash-commands** — Full slash command support in TUI mode
- [ ] **Phase 4: tui-tool-display** — Rich tool call cards with collapsible results
- [ ] **Phase 5: tui-thinking** — Thinking block display with expand/collapse
- [ ] **Phase 6: tui-permissions** — Interactive permission prompts in TUI mode
- [ ] **Phase 7: tui-scrollback** — Line-accurate scrolling and viewport management
- [ ] **Phase 8: tui-integration** — Wire remaining REPL features (@file, title, shell, cost)
- [ ] **Phase 9: tui-keybindings** — Complete all keybinding actions + help overlay
- [ ] **Phase 10: tui-polish** — Visual refinement, responsive layout, edge cases

## Phase Details

### 🚧 v0.6.0 Premium TUI (In Progress)

**Milestone Goal:** Transform the scaffolded TUI into a premium, functional, stable full-screen experience that matches or exceeds OpenCode's terminal UX quality.

#### Phase 1: tui-markdown
**Goal**: Render assistant markdown output (code blocks, headers, lists, bold/italic, links) in the Ink TUI with syntax highlighting and proper terminal formatting
**Depends on**: Nothing (first phase)
**Research**: Likely (need to evaluate Ink-compatible markdown rendering — marked-terminal, glamour alternatives, or custom renderer)
**Research topics**: Ink-compatible markdown rendering libraries, terminal syntax highlighting in React/Ink, how OpenCode renders markdown in bubbletea

Plans:
- [ ] 01-01: TUI Markdown Rendering (4 tasks: MarkdownText component, streaming debounce, MessageList integration, cache + width)

#### Phase 2: tui-input
**Goal**: Replace single-line ink-text-input with multiline editor supporting input history (up/down), paste detection, and @file autocomplete hints
**Depends on**: Phase 1
**Research**: Unlikely (existing InputEditor and InputHistory patterns in src/ui/)

Plans:
- [ ] 02-01: TBD

#### Phase 3: tui-slash-commands
**Goal**: Route slash commands typed in TUI input through dispatchSlashCommand, display results in the message area, and handle mode switches (/plan, /model, /agent)
**Depends on**: Phase 2
**Research**: Unlikely (existing slash command registry in src/commands/slash/)

Plans:
- [ ] 03-01: TBD

#### Phase 4: tui-tool-display
**Goal**: Rich tool call visualization with expandable/collapsible result cards, file path links, colored status indicators, and progress tracking per tool
**Depends on**: Phase 1
**Research**: Unlikely (existing toolcards.ts patterns)

Plans:
- [ ] 04-01: TBD

#### Phase 5: tui-thinking
**Goal**: Display model thinking/reasoning blocks with collapse/expand toggle (Ctrl+T), buffered output with summary line when collapsed
**Depends on**: Phase 1
**Research**: Unlikely (existing ThinkingRenderer in src/ui/thinking.ts)

Plans:
- [ ] 05-01: TBD

#### Phase 6: tui-permissions
**Goal**: Interactive Y/n/always permission prompts when tools require approval, replacing the current silent deny behavior in TUI mode
**Depends on**: Phase 3
**Research**: Unlikely (existing permission system in core/tools/permissions.ts)

Plans:
- [ ] 06-01: TBD

#### Phase 7: tui-scrollback
**Goal**: Line-accurate viewport scrolling (not item-based), proper scroll position for wrapped text, scroll-to-bottom on new content, scrollbar proportional to content size
**Depends on**: Phase 4
**Research**: Likely (Ink's text measurement and wrapping behavior, virtual scroll approaches in React terminal)
**Research topics**: Ink text wrapping measurement, line-height calculation in terminal React, virtual scrolling approaches

Plans:
- [ ] 07-01: TBD

#### Phase 8: tui-integration
**Goal**: Wire remaining REPL features into TUI: @file reference resolution, session title generation, !shell command execution, cost estimation, promptTokens tracking
**Depends on**: Phase 6
**Research**: Unlikely (all features already implemented in REPL, just need TUI plumbing)

Plans:
- [ ] 08-01: TBD

#### Phase 9: tui-keybindings
**Goal**: Implement all keybinding actions (help overlay, slash menu, expand thinking), add Ctrl+? help panel showing available shortcuts, context-sensitive bindings
**Depends on**: Phase 8
**Research**: Unlikely (keybindings.ts already defines the actions)

Plans:
- [ ] 09-01: TBD

#### Phase 10: tui-polish
**Goal**: Visual refinement pass — responsive breakpoints for narrow terminals, color theme consistency, edge case handling (empty states, long messages, rapid input), performance optimization
**Depends on**: Phase 9
**Research**: Unlikely (testing and iteration)

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. tui-markdown | v0.6.0 | 0/1 | Planned | - |
| 2. tui-input | v0.6.0 | 0/? | Not started | - |
| 3. tui-slash-commands | v0.6.0 | 0/? | Not started | - |
| 4. tui-tool-display | v0.6.0 | 0/? | Not started | - |
| 5. tui-thinking | v0.6.0 | 0/? | Not started | - |
| 6. tui-permissions | v0.6.0 | 0/? | Not started | - |
| 7. tui-scrollback | v0.6.0 | 0/? | Not started | - |
| 8. tui-integration | v0.6.0 | 0/? | Not started | - |
| 9. tui-keybindings | v0.6.0 | 0/? | Not started | - |
| 10. tui-polish | v0.6.0 | 0/? | Not started | - |
