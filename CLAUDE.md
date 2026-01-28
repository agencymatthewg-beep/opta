# Opta Project - Multi-App Workspace

This repository contains multiple Opta applications. Each app has its own Claude configuration and development workflow.

---

## Project Structure

```
Opta/
├── .claude/                  ← Root-level agent config, commands, plugins
│   ├── commands/             ← Shared Claude commands
│   ├── agents/               ← Agent definitions
│   └── plugins/local/        ← Local plugins
│
├── apps/
│   ├── desktop/
│   │   ├── opta-native/      ← Main desktop app (Tauri + React)
│   │   │   ├── .claude/
│   │   │   ├── .planning/
│   │   │   ├── CLAUDE.md
│   │   │   └── DESIGN_SYSTEM.md
│   │   └── opta-mini/        ← Mini menubar app
│   │
│   ├── ios/
│   │   ├── opta/             ← Main iOS app (SwiftUI)
│   │   │   ├── .claude/
│   │   │   ├── .planning/
│   │   │   └── CLAUDE.md
│   │   └── opta-lm/          ← Life Manager iOS app
│   │
│   ├── shared/               ← Shared code/assets
│   └── web/                  ← Web applications
│
├── personal/                 ← Personal context (calendar, hardware, goals)
├── project/                  ← Cross-cutting Opta project context
├── research/                 ← Gemini Deep Research outputs
└── ideas/                    ← Project ideas and brainstorms
```

---

## How to Work on Each App

### Opta Native (Desktop)
```bash
cd apps/desktop/opta-native
# Claude uses apps/desktop/opta-native/.claude/ and .planning/
```

**Tech Stack**: Tauri v2, React 19, TypeScript, Rust, Python MCP Server

### Opta iOS (Mobile)
```bash
cd apps/ios/opta
# Claude uses apps/ios/opta/.claude/ and .planning/
```

**Tech Stack**: SwiftUI, Rust core (via UniFFI), CoreML

### Opta Mini (Menubar)
```bash
cd apps/desktop/opta-mini
```

**Tech Stack**: SwiftUI, menubar-only interface

---

## Shared Resources

| Resource | Location | Purpose |
|----------|----------|---------|
| Personal Context | `personal/` | Calendar, hardware, goals, profile |
| Project Context | `project/` | Cross-cutting Opta vision and specs |
| Research | `research/` | Gemini Deep Research outputs |
| Ideas | `ideas/` | Project ideas and brainstorms |
| Root Commands | `.claude/commands/` | Shared Claude commands |
| Git Repository | `.git/` | Unified version control |

---

## Active Agent: opta-optimizer

All apps use the **opta-optimizer** agent. When working in any app folder, embody Opta's principles:

- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries
- Never miss significant details

---

## Session Start Protocol

At the START of every session:

1. **Identify which app you're working on** (Desktop, iOS, Web)
2. **Read `personal/calendar.md`** for today's events and deadlines
3. **Check the relevant `.planning/STATE.md`** for current progress
4. **Deliver a concise session briefing**

---

## Quick Navigation

- **Desktop Instructions**: `apps/desktop/opta-native/CLAUDE.md`
- **iOS Instructions**: `apps/ios/opta/CLAUDE.md`
- **Desktop Roadmap**: `apps/desktop/opta-native/.planning/ROADMAP.md`
- **iOS Roadmap**: `apps/ios/opta/.planning/ROADMAP.md`
- **Personal Calendar**: `personal/calendar.md`
- **Project Vision**: `project/vision.md`
