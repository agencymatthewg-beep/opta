# Task: UX Parity with Claude Code + OpenCode

## Overview
Bring Opta CLI's user experience up to par with Claude Code and OpenCode — the two leading AI coding CLIs. This covers slash commands, interactive UI, status display, and workflow features.

## Current State (Opta CLI v1)
- Basic inquirer-based input prompt
- 11 slash commands: /exit, /help, /model, /history, /compact, /clear, /plan, /image, /undo, /undo list, /q
- Thinking display (dim text, but still leaking `</think>` tags)
- Status summary line after responses
- Session save/resume
- Git checkpoints with /undo

## Gap Analysis

### Priority 1 — Essential UX (Clauding task)

#### 1.1 Fix Think Tag Leaking (BUG)
The `</think>` tag still appears in output. The ThinkingRenderer buffer safety margin causes the close tag to leak when it arrives in a chunk boundary. Fix the edge case.

#### 1.2 Slash Command Menu (like /help but interactive)
When user types `/` alone, show an interactive fuzzy-searchable menu:
```
╭─ Commands ─────────────────────────────╮
│ /help        Show available commands   │
│ /exit        Save and exit             │
│ /model       Switch model              │
│ /plan        Toggle plan mode          │
│ /undo        Reverse last checkpoint   │
│ /compact     Force context compaction  │
│ /clear       Clear screen              │
│ /history     Show conversation summary │
│ /image       Analyze an image          │
│ /config      View/edit configuration   │
│ /status      Show system status        │
│ /diff        Show recent file changes  │
│ /cost        Show token cost breakdown │
│ /share       Export conversation       │
╰────────────────────────────────────────╯
```
Use `@inquirer/prompts` select or a custom fuzzy picker.

#### 1.3 @ File References
Allow `@path/to/file` in messages to auto-include file contents:
- Parse message for `@` references before sending
- Read file, prepend content as context
- Show dim confirmation: `  📎 attached: src/core/agent.ts (245 lines)`
- Support glob: `@src/**/*.ts`

#### 1.4 Enhanced Status Line
After each turn, show richer info:
```
  ⚙ thinking (47 tokens) → 182 tokens · 74 t/s · 2.4s · $0.00
```
- Token breakdown: thinking + response
- Speed
- Elapsed time
- Cost estimate (based on model pricing)

#### 1.5 New Slash Commands
Add these missing commands:
- `/status` — Show LMX connection, loaded models, memory, session stats
- `/config [key] [value]` — View/edit config inline
- `/diff` — Show git diff of changes made this session
- `/cost` — Token usage and cost breakdown for session
- `/share` — Export conversation to markdown file
- `/sessions` — List recent sessions with fuzzy search
- `/init` — Generate project context file (like CLAUDE.md)

### Priority 2 — Advanced UX (Future / Separate Clauding)

#### 2.1 Tab to Switch Modes
Like OpenCode: press Tab to toggle between Build/Plan modes.
Show mode indicator in prompt:
- `opta >` (build mode)
- `opta [plan] >` (plan mode - read-only)

#### 2.2 Rich Permission Prompts
When tool requires approval, show a visual diff:
```
╭─ File Edit ─ src/core/agent.ts ────────╮
│ - const old = 'value';                  │
│ + const new = 'updated';                │
╰─ Allow? (y/n/always) ──────────────────╯
```

#### 2.3 Custom Commands from Markdown
Like Claude Code's `.claude/commands/`:
- Scan `.opta/commands/*.md` at startup
- Each file becomes a `/command-name` slash command
- File content is injected as system context

#### 2.4 Image Drag-and-Drop
Detect terminal image paste events and auto-attach.

#### 2.5 Themes
Configurable color schemes in opta config.

#### 2.6 Keybind Customization
Ctrl+K for command palette, Ctrl+L for clear, etc.

## Implementation Plan (Priority 1 only)

### Files to modify:
- `src/ui/thinking.ts` — Fix tag leaking
- `src/commands/chat.ts` — Interactive slash menu, @ references
- `src/core/agent.ts` — Enhanced status line
- `src/ui/statusbar.ts` — Cost tracking

### Files to create:
- `src/commands/slash/status.ts` — /status command
- `src/commands/slash/config.ts` — /config command  
- `src/commands/slash/diff.ts` — /diff command
- `src/commands/slash/cost.ts` — /cost command
- `src/commands/slash/share.ts` — /share command
- `src/commands/slash/sessions.ts` — /sessions command
- `src/commands/slash/init.ts` — /init command
- `src/core/fileref.ts` — @ file reference parser
- `src/ui/menu.ts` — Interactive slash command menu

### Step 1: Fix think tag leak
Ensure ThinkingRenderer handles all edge cases for `</think>` across chunk boundaries.

### Step 2: Interactive slash menu
When input is exactly `/`, show interactive select menu instead of "Unknown command".

### Step 3: @ file references
Parse `@path` tokens, read files, inject as context.

### Step 4: New slash commands
Implement /status, /config, /diff, /cost, /share, /sessions, /init.

### Step 5: Enhanced status line
Add cost estimate, thinking token count, improve formatting.

### Step 6: Tab mode switching
Add readline keybind for Tab to toggle plan/build.

## Acceptance Criteria
- [ ] No `<think>` or `</think>` tags visible in output
- [ ] `/` alone shows interactive command menu
- [ ] `@file` references work in messages
- [ ] `/status` shows LMX health, model, memory
- [ ] `/diff` shows session git changes
- [ ] `/cost` shows token/cost breakdown
- [ ] `/share` exports conversation to file
- [ ] `/init` generates project context file
- [ ] Status line shows speed, cost, thinking tokens
- [ ] All 393+ existing tests still pass
- [ ] New features have tests

## Notes
- This is a large task. Recommend splitting into 2-3 Clauding sessions.
- Priority 1 items are the most impactful for daily use.
- Priority 2 items (TUI, themes, drag-drop) are future work.
- OpenCode uses Go + Bubbletea for full TUI — we can't match that with Node readline, but we can get close with inquirer + ANSI.
