# Opta Project - Multi-App Workspace

This repository contains two separate Opta applications. Each app has its own Claude configuration and development workflow.

---

## Project Structure

```
/Opta/
├── Opta MacOS/          ← Desktop app (Tauri + React)
│   ├── .claude/         ← Commands, agents, skills for macOS dev
│   ├── .planning/       ← Roadmap, phases, state for macOS
│   ├── CLAUDE.md        ← MacOS-specific instructions
│   └── DESIGN_SYSTEM.md ← UI/UX guidelines
│
├── Opta iOS/            ← Mobile app (SwiftUI)
│   ├── .claude/         ← Commands, agents, skills for iOS dev
│   ├── .planning/       ← Roadmap, phases, state for iOS
│   └── CLAUDE.md        ← iOS-specific instructions
│
├── .personal/           ← Shared personal context (calendar, hardware, goals)
├── .serena/             ← Serena MCP configuration
└── .opta/               ← Shared Opta context
```

---

## How to Work on Each App

### Opta MacOS (Desktop)
```bash
cd "Opta MacOS"
# Claude will use Opta MacOS/.claude/ and Opta MacOS/.planning/
```

**Tech Stack**: Tauri v2, React 19, TypeScript, Rust, Python MCP Server

### Opta iOS (Mobile)
```bash
cd "Opta iOS"
# Claude will use Opta iOS/.claude/ and Opta iOS/.planning/
```

**Tech Stack**: SwiftUI, Rust core (via UniFFI), CoreML

---

## Shared Resources

These remain at the root level for both apps:

| Resource | Location | Purpose |
|----------|----------|---------|
| Personal Context | `.personal/` | Calendar, hardware, goals, profile |
| Serena Config | `.serena/` | MCP server configuration |
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
2. **Read `.personal/calendar.md`** for today's events and deadlines
3. **Check the relevant `.planning/STATE.md`** for current progress
4. **Deliver a concise session briefing**

---

## Quick Navigation

- **MacOS Instructions**: `Opta MacOS/CLAUDE.md`
- **iOS Instructions**: `Opta iOS/CLAUDE.md`
- **MacOS Roadmap**: `Opta MacOS/.planning/ROADMAP.md`
- **iOS Roadmap**: `Opta iOS/.planning/ROADMAP.md`
- **Personal Calendar**: `.personal/calendar.md`
