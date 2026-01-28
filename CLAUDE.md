# Opta Project - Multi-App Workspace

This repository contains two separate Opta applications. Each app has its own Claude configuration and development workflow.

---

## Project Structure

```
/Opta/
├── 1. Apps/
│   ├── 1. iOS/
│   │   └── 1. Opta/     ← Mobile app (SwiftUI)
│   │       ├── .claude/         ← Commands, agents, skills for iOS dev
│   │       ├── .planning/       ← Roadmap, phases, state for iOS
│   │       └── CLAUDE.md        ← iOS-specific instructions
│   │
│   └── 2. Desktop/
│       └── 1. Opta Native/  ← Desktop app (Tauri + React)
│           ├── .claude/         ← Commands, agents, skills for macOS dev
│           ├── .planning/       ← Roadmap, phases, state for macOS
│           ├── CLAUDE.md        ← MacOS-specific instructions
│           └── DESIGN_SYSTEM.md ← UI/UX guidelines
│
└── 3. Matthew x Opta/   ← Personal and agent configuration
    ├── 1. personal/     ← Shared personal context (calendar, hardware, goals)
    ├── 2. project/      ← Cross-cutting Opta context
    └── 3. agent-config/ ← Agent configuration (.claude, .serena, .opta)
```

---

## How to Work on Each App

### Opta MacOS (Desktop)
```bash
cd "1. Apps/2. Desktop/1. Opta Native"
# Claude will use 1. Apps/2. Desktop/1. Opta Native/.claude/ and .planning/
```

**Tech Stack**: Tauri v2, React 19, TypeScript, Rust, Python MCP Server

### Opta iOS (Mobile)
```bash
cd "1. Apps/1. iOS/1. Opta"
# Claude will use 1. Apps/1. iOS/1. Opta/.claude/ and .planning/
```

**Tech Stack**: SwiftUI, Rust core (via UniFFI), CoreML

---

## Shared Resources

These remain at the root level for both apps:

| Resource | Location | Purpose |
|----------|----------|---------|
| Personal Context | `3. Matthew x Opta/1. personal/` | Calendar, hardware, goals, profile |
| Serena Config | `3. Matthew x Opta/3. agent-config/.serena/` | MCP server configuration |
| Git Repository | `.git/` | Unified version control |

---

## Active Agent: opta-optimizer

Both apps use the **opta-optimizer** agent. When working in either app folder, embody Opta's principles:

- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries
- Never miss significant details

---

## Session Start Protocol

At the START of every session:

1. **Identify which app you're working on** (MacOS or iOS)
2. **Read `3. Matthew x Opta/1. personal/calendar.md`** for today's events and deadlines
3. **Check the relevant `.planning/STATE.md`** for current progress
4. **Deliver a concise session briefing**

---

## Quick Navigation

- **MacOS Instructions**: `1. Apps/2. Desktop/1. Opta Native/CLAUDE.md`
- **iOS Instructions**: `1. Apps/1. iOS/1. Opta/CLAUDE.md`
- **MacOS Roadmap**: `1. Apps/2. Desktop/1. Opta Native/.planning/ROADMAP.md`
- **iOS Roadmap**: `1. Apps/1. iOS/1. Opta/.planning/ROADMAP.md`
- **Personal Calendar**: `3. Matthew x Opta/1. personal/calendar.md`
