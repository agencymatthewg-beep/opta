# Opta - Multi-Platform Optimization Suite

A comprehensive system optimization suite for macOS and iOS platforms.

## Project Structure

This monorepo contains two separate applications:

```
/Opta/
├── Opta MacOS/          # Desktop application (Tauri + React)
├── Opta iOS/            # Mobile application (SwiftUI)
├── .personal/           # Shared personal context
└── .serena/             # Serena MCP configuration
```

## Applications

### Opta MacOS (Desktop)

**Tech Stack:** Tauri v2, React 19, TypeScript, Rust, Python MCP Server

The desktop application provides:
- Hardware telemetry monitoring
- Process management
- Game detection and optimization
- Optimization scoring
- AI-powered recommendations (hybrid local/cloud)

**Development:**
```bash
cd "Opta MacOS"
npm install
npm run tauri dev
```

### Opta iOS (Mobile)

**Tech Stack:** SwiftUI, Rust core (via UniFFI), CoreML

The mobile application provides:
- On-device optimization insights
- Cross-device sync with macOS
- WidgetKit home screen widgets
- Siri/Shortcuts integration

**Development:**
```bash
cd "Opta iOS"
open Opta.xcodeproj
```

## Claude Code Integration

Each app has its own Claude configuration:

| App | Instructions | Commands | Planning |
|-----|--------------|----------|----------|
| MacOS | `Opta MacOS/CLAUDE.md` | `Opta MacOS/.claude/commands/` | `Opta MacOS/.planning/` |
| iOS | `Opta iOS/CLAUDE.md` | `Opta iOS/.claude/commands/` | `Opta iOS/.planning/` |

### Shared Context

Personal context (calendar, hardware, goals) is shared between both apps at the root level:
- `.personal/calendar.md` - Events and deadlines
- `.personal/hardware.md` - Device ecosystem
- `.personal/goals.md` - Current priorities

## Development Workflow

1. **Choose your target app** - Work in either `Opta MacOS/` or `Opta iOS/`
2. **Claude commands are local** - Each app has its own slash commands
3. **Planning is separate** - Each app tracks its own roadmap and state
4. **Personal context is shared** - Referenced via `../.personal/` from either app

## License

Proprietary - All rights reserved.
