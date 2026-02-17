# OpenCode UX Parity — Master Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every UX gap between Opta CLI and OpenCode, transforming Opta from an inline REPL into a polished full-screen TUI that owns every pixel.

**Architecture:** Three-phase approach — Phase 1 maxes out current Commander.js stack (no new deps needed), Phase 2 migrates to Ink (React-for-terminals) for full-screen layout, Phase 3 adds advanced TUI features (split panes, focus, keybindings). Each phase is independently shippable.

**Tech Stack:** TypeScript, Commander.js (entry), Ink 5 (Phase 2+), chalk, marked-terminal, @inquirer/prompts, vitest

---

## Gap Inventory — 33 Features Across 6 Dimensions

Every gap from the Detailed UX Comparison Table is listed below with its assigned phase.

### TUI Framework & Layout (8 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G01 | Framework | Bubble Tea (Go) full-screen | Commander.js inline REPL | Full rewrite | P2 |
| G02 | Layout engine | Full-screen alternate buffer | Inline print-to-stdout | Missing | P2 |
| G03 | Panel system | 3-panel flex (messages, sidebar, input) | Sequential print | Missing | P3 |
| G04 | Persistent status bar | Always-visible bottom bar | Post-response summary line | Missing | P2 |
| G05 | Sidebar panel | Token/cost/session info sidebar | None | Missing | P3 |
| G06 | Responsive resize | Terminal resize event handling | Fixed-width boxes (40 default) | Missing | P2 |
| G07 | Focus management | Tab between panels, useFocus | None | Missing | P3 |
| G08 | Scrollable message list | Scrollable history with viewport | Raw stdout scroll | Missing | P3 |

### Editor & Input (8 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G09 | Multiline input | Meta+Return inserts newlines | Single-line @inquirer/prompts | Missing | P1A |
| G10 | Paste detection | Auto-extmark, abbreviated display | Raw input, no detection | Missing | P1A |
| G11 | @ file autocomplete | Fuzzy file picker triggered by @ | @path resolution, no autocomplete | Partial | P1A |
| G12 | Shell mode | ! prefix with visual border change | /run command or agent tool | Missing | P1A |
| G13 | Line range refs | file:10-20 syntax in @ refs | Full file only via fileref.ts | Missing | P1A |
| G14 | Image paste/attach | Clipboard image via extmark | /image <path> command only | Missing | P1A |
| G15 | Input history | Up/Down with cursor-edge detection | @inquirer/prompts readline | Partial | P1A |
| G16 | Visual mode indicators | Border color changes per mode | Prompt prefix badge (plan/auto) | Partial | P1A |

### Rendering & Display (5 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G17 | Thinking collapse toggle | Interactive expand/collapse widget | Auto-collapse with token count | Missing | P1B |
| G18 | Tool call cards | Styled cards per tool type | Inline chalk text | Missing | P1B |
| G19 | Inline diff viewer | Side-by-side or unified diff | /diff --stat only | Missing | P1B |
| G20 | Theme system | 10+ themes, custom theme files | Hardcoded chalk colors | Missing | P1B |
| G21 | Syntax highlighting | Full code block highlighting | marked-terminal basic | Partial | P1B |

### Session & State (4 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G22 | Session export formats | JSON + Markdown + share URL | Markdown only via /share | Partial | P1C |
| G23 | Token/cost persistent display | Always-visible in sidebar | /cost command only | Missing | P1C |
| G24 | Statistics dashboard | Cross-session analytics & costs | None | Missing | P1C |
| G25 | Session picker/browser | Interactive TUI session browser | /sessions list + -r flag | Missing | P1C |

### Commands & Workflow (5 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G26 | Server mode | HTTP API endpoint for remote | None | Missing | P1C |
| G27 | Interactive model picker | TUI model browser with details | /model <name> text only | Missing | P1C |
| G28 | Agent selection | Multi-agent TUI picker | V3 sub-agents (no picker UI) | Missing | P1C |
| G29 | External editor ($EDITOR) | /editor command opens $EDITOR | None | Missing | P1A |
| G30 | Non-interactive mode | Rich CLI one-shot with flags | opta do (basic) | Partial | P1C |

### Keyboard & Navigation (3 gaps)

| # | Feature | OpenCode | Opta Current | Gap | Phase |
|---|---------|----------|-------------|-----|-------|
| G31 | Customizable keybindings | Config-based keybinding map | None | Missing | P3 |
| G32 | Tab panel navigation | Tab to switch focus panels | N/A (no panels) | Missing | P3 |
| G33 | Escape key handling | Cancel/close dialogs/modes | None | Missing | P1A |

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
| **Total** | **33/33 addressed** | | **0 remaining** |

All 33 gaps from the comparison table are covered. Zero gaps missed.

---

## Sub-Plan Files

1. [`2026-02-17-ux-phase1a-input-editor.md`](./2026-02-17-ux-phase1a-input-editor.md) — Multiline input, shell mode, @ autocomplete, line ranges, /editor, escape, paste detection, image attach, history, mode indicators
2. [`2026-02-17-ux-phase1b-rendering.md`](./2026-02-17-ux-phase1b-rendering.md) — Tool call cards, inline diffs, theme system, thinking toggle, syntax highlighting
3. [`2026-02-17-ux-phase1c-session-workflow.md`](./2026-02-17-ux-phase1c-session-workflow.md) — Session picker, model picker, JSON export, analytics, server mode, agent picker, non-interactive
4. [`2026-02-17-ux-phase2-ink-migration.md`](./2026-02-17-ux-phase2-ink-migration.md) — Full-screen TUI, alternate buffer, Ink component tree, persistent status bar, resize
5. [`2026-02-17-ux-phase3-advanced-tui.md`](./2026-02-17-ux-phase3-advanced-tui.md) — Split panes, sidebar, focus management, scrollable messages, keybindings, tab nav
