# Opta - Multi-Platform Optimization Suite

A comprehensive system optimization suite spanning iOS, Desktop, and Web platforms.

## Project Structure

This monorepo uses a numbered hierarchical structure for clear organization:

```
/Opta/
├── 1. Apps/
│   ├── 1. iOS/
│   │   ├── 1. Opta/                    # Main iOS app (SwiftUI)
│   │   └── 3. Opta LM iOS/             # Life Manager iOS variant
│   ├── 2. Desktop/
│   │   ├── 1. Opta Native/             # Main desktop app (Tauri + React)
│   │   └── 2. Opta Mini/               # Lightweight menu bar variant
│   ├── 3. Web/
│   │   ├── 1. Opta Life Manager/       # Web-based life management (Next.js)
│   │   ├── 2. Opta LM Edge/            # Edge deployment variant
│   │   ├── 3. Optamize Website/        # Marketing website
│   │   └── 4. AI Components/           # Shared component library
│   └── 4. Shared/
│       ├── 1. opta-native/             # Rust core (UniFFI)
│       └── 2. design-assets/           # Logos, icons, design specs
├── 2. Gemini Deep Research/            # Research and exploration
└── 3. Matthew x Opta/                  # Personal and agent context
    ├── 1. personal/                    # Personal context (calendar, hardware, goals)
    ├── 2. project/                     # Cross-project planning and docs
    └── 3. agent-config/                # AI agent configurations (.claude, .serena, .opta)
```

## Primary Applications

### Opta Native (Desktop)

**Location:** `1. Apps/2. Desktop/1. Opta Native/`
**Tech Stack:** Tauri v2, React 19, TypeScript, Rust, Python MCP Server

The flagship desktop application providing:
- Real-time hardware telemetry monitoring
- Intelligent process management
- Game detection and optimization
- Shareable Optimization Score
- Hybrid AI (local Llama 3 8B + cloud Claude)

**Development:**
```bash
cd "1. Apps/2. Desktop/1. Opta Native"
npm install
npm run tauri dev
```

### Opta iOS (Mobile)

**Location:** `1. Apps/1. iOS/1. Opta/`
**Tech Stack:** SwiftUI, Rust core (via UniFFI), CoreML

Native iOS application with:
- On-device optimization insights
- Cross-device sync with desktop
- WidgetKit home screen widgets
- Siri/Shortcuts integration

**Development:**
```bash
cd "1. Apps/1. iOS/1. Opta"
open Opta.xcodeproj
```

### Opta Life Manager (Web)

**Location:** `1. Apps/3. Web/1. Opta Life Manager/`
**Tech Stack:** Next.js 15, React 19, TypeScript, Vercel

Web-based life management dashboard:
- Task and project tracking
- Calendar integration
- Optimization recommendations
- Cross-platform synchronization

**Development:**
```bash
cd "1. Apps/3. Web/1. Opta Life Manager"
npm install
npm run dev
```

## Shared Infrastructure

### Rust Core (`opta-native`)

**Location:** `1. Apps/4. Shared/1. opta-native/`

Shared Rust workspace providing:
- Hardware telemetry collection
- Process management primitives
- Cross-platform system APIs
- UniFFI bindings for Swift/TypeScript

**Workspace members:**
- `opta_telemetry` - Hardware monitoring
- `opta_process` - Process management
- `opta_game_detector` - Game detection
- `opta_mcp_server` - MCP protocol implementation

### Design Assets

**Location:** `1. Apps/4. Shared/2. design-assets/`

- `logos/` - App logos (PNG, SVG)
- `icons/` - Icon sets
- `animation-frames/` - Opta Ring animation frames
- `Opta Aesthetic Vision/` - Design specifications and inspiration

## Claude Code Integration

Each app has its own Claude configuration:

| App | Instructions | Planning |
|-----|--------------|----------|
| Opta Native | `1. Apps/2. Desktop/1. Opta Native/CLAUDE.md` | `1. Apps/2. Desktop/1. Opta Native/.planning/` |
| Opta iOS | `1. Apps/1. iOS/1. Opta/CLAUDE.md` | `1. Apps/1. iOS/1. Opta/.planning/` |

### Shared Context

Personal context is shared across all apps at:

**Location:** `3. Matthew x Opta/1. personal/`

- `calendar.md` - Events, subscriptions, deadlines
- `hardware.md` - Device ecosystem (Mac Studio, MacBook Pro, etc.)
- `workflows.md` - Work patterns and device roles
- `goals.md` - Current priorities
- `profile.md` - Communication style preferences

### Agent Configuration

**Location:** `3. Matthew x Opta/3. agent-config/`

- `.claude/` - Claude Code configuration
  - `commands.json` - Global slash commands
  - `agents/` - Agent definitions (opta-optimizer)
  - `skills/` - Reusable skills
- `.serena/` - Serena MCP configuration
- `.opta/` - Opta-specific agent context

### Project Planning

**Location:** `3. Matthew x Opta/2. project/`

- `.planning/` - Cross-project planning
  - `PROJECT.md` - Opta vision and requirements
  - `ROADMAP.md` - Overall development roadmap
  - `STATE.md` - Current progress
  - `codebase/` - Architecture documentation

## Development Workflow

1. **Choose your target app** - Navigate to the specific numbered app folder
2. **Claude commands are hierarchical** - Root commands work globally, app commands are local
3. **Planning is per-app** - Each app tracks its own roadmap in `.planning/`
4. **Personal context is shared** - All apps reference `3. Matthew x Opta/1. personal/`
5. **Design system is unified** - All apps follow `DESIGN_SYSTEM.md` in Opta Native

## Quick Commands

From the root `/Opta/` directory:

```bash
# Desktop development
cd "1. Apps/2. Desktop/1. Opta Native"
npm run tauri dev

# iOS development
cd "1. Apps/1. iOS/1. Opta"
open Opta.xcodeproj

# Web development
cd "1. Apps/3. Web/1. Opta Life Manager"
npm run dev

# Rust workspace
cd "1. Apps/4. Shared/1. opta-native"
cargo build --workspace
```

## Architecture

Opta follows a hybrid architecture:

- **Frontend:** React 19 (Desktop/Web), SwiftUI (iOS)
- **Backend:** Rust core with UniFFI bindings
- **AI:** Hybrid semantic router (local Llama 3 8B → cloud Claude for complex queries)
- **Integration:** MCP (Model Context Protocol) for all external integrations
- **Deployment:**
  - Desktop: Tauri v2 native apps
  - iOS: Native Swift with Rust core
  - Web: Vercel Edge with React Server Components

## License

Proprietary - All rights reserved.
