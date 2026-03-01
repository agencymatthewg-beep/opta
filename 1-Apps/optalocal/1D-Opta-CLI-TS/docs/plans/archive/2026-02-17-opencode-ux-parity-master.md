---
status: archived
---

# OpenCode UX Parity — Master Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every UX gap between Opta CLI and OpenCode, transforming Opta from an inline REPL into a polished full-screen TUI that owns every pixel.

**Architecture:** Three-phase approach — Phase 1 maxes out current Commander.js stack (no new deps needed), Phase 2 migrates to Ink (React-for-terminals) for full-screen layout, Phase 3 adds advanced TUI features (split panes, focus, keybindings). Each phase is independently shippable.

**Tech Stack:** TypeScript, Commander.js (entry), Ink 5 (Phase 2+), chalk, marked-terminal, @inquirer/prompts, vitest

---

## Gap Inventory — 33 Features Across 6 Dimensions

Every gap from the Detailed UX Comparison Table is listed below with its assigned phase.

### TUI Framework & Layout (8 gaps) — all CLOSED

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G01 | Framework (full-screen TUI) | CLOSED | `src/tui/App.tsx` + Ink render |
| G02 | Alternate buffer layout | CLOSED | `src/tui/render.tsx` — Ink managed |
| G03 | 3-panel system | CLOSED | `src/tui/SplitPane.tsx` + `Sidebar.tsx` |
| G04 | Persistent status bar | CLOSED | `src/tui/StatusBar.tsx` |
| G05 | Sidebar panel | CLOSED | `src/tui/Sidebar.tsx` (tokens/cost/model) |
| G06 | Responsive resize | CLOSED | `src/tui/hooks/useTerminalSize.ts` |
| G07 | Focus management | CLOSED | `src/tui/FocusContext.tsx` (infrastructure) |
| G08 | Scrollable message list | CLOSED | `src/tui/ScrollView.tsx` + `MessageList.tsx` |

### Editor & Input (8 gaps) — all CLOSED (1 remaining: G14 clipboard paste)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G09 | Multiline input | CLOSED | `InputBox.tsx` Alt+Return, `[2 lines]` display |
| G10 | Paste detection | CLOSED | Bracketed paste via `\x1b[?2004h` in InputBox.tsx + `handlePaste()` abbreviated display |
| G11 | @ file autocomplete | CLOSED | `InputBox.tsx` navigable dropdown: ↑↓ selection, Tab accept, Esc dismiss, ▸ highlight |
| G12 | Shell mode | CLOSED | `!` prefix with yellow indicator in `InputBox.tsx` |
| G13 | Line range refs | CLOSED | `src/core/fileref.ts` `parseLineRange()` |
| G14 | Image paste/attach | PARTIAL | `resolveImageRefs()` via @path; no clipboard paste (platform limitation) |
| G15 | Input history | CLOSED | `src/ui/history.ts` + InputBox Up/Down |
| G16 | Visual mode indicators | CLOSED | Mode badges + red bypass border |

### Rendering & Display (5 gaps) — 4 CLOSED, 1 PARTIAL

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G17 | Thinking collapse toggle | CLOSED | `src/tui/ThinkingBlock.tsx` expanded/collapsed |
| G18 | Tool call cards | CLOSED | `src/tui/ToolCard.tsx` per-tool icons, states |
| G19 | Inline diff viewer | CLOSED | `src/ui/diff.ts` unified + inline formats |
| G20 | Theme system | CLOSED | 5 built-in + custom themes from `~/.config/opta/themes/*.json` and `.opta/themes/*.json` |
| G21 | Syntax highlighting | PARTIAL | `marked-terminal` basic; no Prism/shiki |

### Session & State (4 gaps) — all CLOSED

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G22 | Session export formats | CLOSED | `json`/`markdown`/`text` in `src/commands/share.ts` |
| G23 | Token/cost persistent display | CLOSED | Sidebar always-visible tokens + cost |
| G24 | Statistics dashboard | CLOSED | `src/memory/analytics.ts` SessionAnalytics |
| G25 | Session picker/browser | CLOSED | `SessionBrowserOverlay.tsx` with search, resume, delete; Ctrl+O keybinding |

### Commands & Workflow (5 gaps) — all CLOSED

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G26 | Server mode | CLOSED | `src/commands/server.ts` |
| G27 | Interactive model picker | CLOSED | `src/tui/ModelPicker.tsx` |
| G28 | Agent selection picker | CLOSED | `AgentPickerOverlay.tsx` 6 profiles, 2-tab interface, keyboard nav |
| G29 | External editor ($EDITOR) | CLOSED | `src/commands/editor.ts` |
| G30 | Non-interactive mode | CLOSED | `opta do` with `json`/`text`/`quiet` |

### Keyboard & Navigation (3 gaps) — 3 CLOSED

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| G31 | Customizable keybindings | CLOSED | `.opta/keybindings.json` via `loadKeybindings()` |
| G32 | Tab panel navigation | CLOSED | `Ctrl+]`/`Ctrl+[` cycle panels via FocusContext + keybindings.ts |
| G33 | Escape key handling | CLOSED | InputBox + overlay dismiss in `useKeyboardSetup` |

---

## Phase Overview

### Phase 1: Pre-Ink Enhancements (Current Stack)

No new major dependencies. Maximizes what's possible with Commander.js + @inquirer/prompts + chalk.

| Sub-Phase | Gaps Covered | Plan File | Est. Tasks |
|-----------|-------------|-----------|------------|
| **P1A: Input & Editor** | G09, G10, G11, G12, G13, G14, G15, G16, G29, G33 | `2026-02-17-ux-phase1a-input-editor.md` | 14 |
| **P1B: Rendering & Display** | G17, G18, G19, G20, G21 | `2026-02-17-ux-phase1b-rendering.md` | 12 |
| **P1C: Session & Workflow** | G22, G23, G24, G25, G26, G27, G28, G30 | `2026-02-17-ux-phase1c-session-workflow.md` | 14 |

**Total Phase 1:** 40 tasks, ~10 gaps fully closed, ~8 gaps improved, independent of Ink.

### Phase 2: Ink Migration (Full-Screen TUI)

Adds Ink 5 as dependency. Migrates from print-to-stdout to full-screen React component tree.

| Gaps Covered | Plan File | Est. Tasks |
|-------------|-----------|------------|
| G01, G02, G04, G06 | `2026-02-17-ux-phase2-ink-migration.md` | 16 |

**Result:** Full-screen alternate buffer, persistent status bar, responsive resize.

### Phase 3: Advanced TUI (Split Panes + Polish)

Builds on Ink foundation. Adds multi-panel layout, focus system, keybindings.

| Gaps Covered | Plan File | Est. Tasks |
|-------------|-----------|------------|
| G03, G05, G07, G08, G31, G32 | `2026-02-17-ux-phase3-advanced-tui.md` | 14 |

**Result:** 3-panel layout, sidebar, scrollable history, tab navigation, custom keybindings.

---

## Execution Order

```
Phase 1A (Input) ──┐
Phase 1B (Render) ─┼── All independent, can parallelize
Phase 1C (Session) ┘
        │
        ▼
   Phase 2 (Ink Migration)
        │
        ▼
   Phase 3 (Advanced TUI)
```

Phase 1 sub-phases are independent and can execute in any order or in parallel. Phase 2 depends on Phase 1 being complete (all tests green). Phase 3 depends on Phase 2.

---

## Gap Closure Summary

| Phase | Gaps Fully Closed | Gaps Improved | Remaining |
|-------|-------------------|---------------|-----------|
| P1A | G12, G13, G29, G33 | G09, G10, G11, G14, G15, G16 | 0 |
| P1B | G17, G18, G19, G20 | G21 | 0 |
| P1C | G22, G24, G25, G27 | G23, G26, G28, G30 | 0 |
| P2 | G01, G02, G04, G06 | — | 0 |
| P3 | G03, G05, G07, G08, G31, G32 | — | 0 |
| **Total** | **31/33 fully closed** | **2 partial** | **0 remaining** |

31 of 33 gaps fully closed. 2 remain partial:
- G14 (image clipboard paste) — platform limitation, @path attachment works
- G21 (syntax highlighting) — `marked-terminal` basic, no Prism/shiki

---

## Sub-Plan Files

1. [`2026-02-17-ux-phase1a-input-editor.md`](./2026-02-17-ux-phase1a-input-editor.md) — Multiline input, shell mode, @ autocomplete, line ranges, /editor, escape, paste detection, image attach, history, mode indicators
2. [`2026-02-17-ux-phase1b-rendering.md`](./2026-02-17-ux-phase1b-rendering.md) — Tool call cards, inline diffs, theme system, thinking toggle, syntax highlighting
3. [`2026-02-17-ux-phase1c-session-workflow.md`](./2026-02-17-ux-phase1c-session-workflow.md) — Session picker, model picker, JSON export, analytics, server mode, agent picker, non-interactive
4. [`2026-02-17-ux-phase2-ink-migration.md`](./2026-02-17-ux-phase2-ink-migration.md) — Full-screen TUI, alternate buffer, Ink component tree, persistent status bar, resize
5. [`2026-02-17-ux-phase3-advanced-tui.md`](./2026-02-17-ux-phase3-advanced-tui.md) — Split panes, sidebar, focus management, scrollable messages, keybindings, tab nav
