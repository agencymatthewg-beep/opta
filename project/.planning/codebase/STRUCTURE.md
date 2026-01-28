# Codebase Structure

**Analysis Date:** 2026-01-28
**Structure:** Numbered Hierarchical Organization

## Directory Layout

```
Opta/
├── 1. Apps/
│   ├── 1. iOS/
│   │   ├── 1. Opta/                    # Main iOS app (SwiftUI)
│   │   │   ├── apps/mobile/            # Main Expo app
│   │   │   └── packages/               # Shared packages (api, shared)
│   │   └── 3. Opta LM iOS/             # Life Manager iOS (SwiftUI)
│   ├── 2. Desktop/
│   │   ├── 1. Opta Native/             # Main desktop app (Tauri + React + SwiftUI hybrid)
│   │   │   ├── src/                    # React frontend
│   │   │   ├── src-tauri/              # Tauri Rust backend
│   │   │   ├── OptaNative/             # SwiftUI native components
│   │   │   └── scripts/                # Python telemetry scripts
│   │   └── 2. Opta Mini/               # Menu bar agent (SwiftUI)
│   ├── 3. Web/
│   │   ├── 1. Opta Life Manager/       # Web app (Next.js 15)
│   │   │   ├── app/                    # App Router pages
│   │   │   ├── components/             # React components
│   │   │   └── lib/                    # Utilities and API clients
│   │   ├── 2. Opta LM Edge/            # Edge deployment variant
│   │   ├── 3. Optamize Website/        # Marketing website
│   │   └── 4. AI Components/           # Shared component library
│   └── 4. Shared/
│       ├── 1. opta-native/             # Rust workspace
│       │   ├── opta-core/              # Crux core logic
│       │   ├── opta-shared/            # Shared types/utilities
│       │   ├── opta-render/            # wgpu GPU rendering
│       │   └── OptaApp/                # macOS SwiftUI app
│       └── 2. design-assets/           # Logos, icons, animation frames
│           ├── logos/                  # App logos (PNG, SVG)
│           ├── icons/                  # Icon sets
│           ├── animation-frames/       # Opta Ring frames
│           └── Opta Aesthetic Vision/  # Design specs
├── 2. Gemini Deep Research/            # Research and exploration
└── 3. Matthew x Opta/
    ├── 1. personal/                    # Personal context (calendar, hardware, goals)
    ├── 2. project/                     # Cross-project planning
    │   ├── .planning/                  # This folder
    │   └── reorganization-docs/        # Reorganization documentation
    └── 3. agent-config/                # Agent configuration
        ├── .claude/                    # Claude Code config
        ├── .serena/                    # Serena MCP config
        └── .opta/                      # Opta-specific context
```

## Directory Purposes

### 1. Apps/2. Desktop/1. Opta Native/

**src/** - React frontend for desktop app
- Purpose: UI components, pages, hooks, contexts
- Key files: `main.tsx`, `App.tsx`, `pages/*.tsx`
- Subdirectories: `components/`, `hooks/`, `contexts/`, `lib/`, `pages/`, `types/`

**src-tauri/** - Tauri Rust backend
- Purpose: IPC commands, system integration, window management
- Key files: `main.rs`, `lib.rs`, `telemetry.rs`, `processes.rs`
- Subdirectories: `src/` (Rust source), `icons/`, `capabilities/`

**OptaNative/** - SwiftUI native components
- Purpose: Native macOS UI (hybrid approach)
- Key files: `Views/MainWindow/`, `ViewModels/ChessViewModel.swift`
- Subdirectories: `Views/`, `ViewModels/`, `Utilities/`, `Services/`

### 1. Apps/4. Shared/1. opta-native/

**opta-core/** - Cross-platform Crux core
- Purpose: Core app logic, model, events, effects
- Key files: `lib.rs`, `app.rs`, `model.rs`, `event.rs`, `effect.rs`

**opta-render/** - GPU rendering with wgpu
- Purpose: Render pipelines, shaders, GPU abstractions
- Key files: `lib.rs`, shader files (.wgsl)

**opta-shared/** - Shared Rust types and utilities
- Purpose: Types, constants, utilities used across workspace

### 1. Apps/3. Web/1. Opta Life Manager/

**app/** - Next.js App Router pages
- Purpose: Server and client components, routes
- Key files: `page.tsx`, `layout.tsx`, Server Actions

**components/** - React components
- Purpose: Reusable UI components

**lib/** - Utilities and API clients
- Purpose: Server Actions, API integrations, utilities
- Key files: `actions.ts`, `auth.ts`

### 1. Apps/1. iOS/1. Opta/

**apps/mobile/** - Main Expo app
- Purpose: React Native mobile app
- Key files: `app/_layout.tsx` (Expo Router root)

**packages/api/** - Hono API server
- Purpose: Mobile backend API
- Subdirectories: `src/routes/`, `src/middleware/`

**packages/shared/** - Shared mobile types
- Purpose: Types shared between frontend and API

## Key File Locations

**Entry Points:**
- `1. Apps/2. Desktop/1. Opta Native/src/main.tsx` - React app mount
- `1. Apps/2. Desktop/1. Opta Native/src-tauri/src/main.rs` - Tauri backend
- `1. Apps/3. Web/1. Opta Life Manager/app/page.tsx` - Next.js home
- `1. Apps/4. Shared/1. opta-native/opta-core/src/lib.rs` - Crux library
- `1. Apps/1. iOS/1. Opta/apps/mobile/app/_layout.tsx` - Expo Router root

**Configuration:**
- `1. Apps/2. Desktop/1. Opta Native/tsconfig.json` - TypeScript config
- `1. Apps/2. Desktop/1. Opta Native/vite.config.ts` - Vite bundler config
- `1. Apps/2. Desktop/1. Opta Native/src-tauri/tauri.conf.json` - Tauri config
- `1. Apps/3. Web/1. Opta Life Manager/next.config.ts` - Next.js config
- `1. Apps/4. Shared/1. opta-native/Cargo.toml` - Rust workspace manifest

**Core Logic:**
- `1. Apps/4. Shared/1. opta-native/opta-core/src/app.rs` - Crux application
- `1. Apps/3. Web/1. Opta Life Manager/lib/actions.ts` - Server Actions
- `1. Apps/2. Desktop/1. Opta Native/src/hooks/*.ts` - React hooks
- `1. Apps/2. Desktop/1. Opta Native/OptaNative/OptaNative/ViewModels/*.swift` - ViewModels

**Documentation:**
- `CLAUDE.md` - Root navigation
- `1. Apps/2. Desktop/1. Opta Native/CLAUDE.md` - Desktop instructions
- `1. Apps/2. Desktop/1. Opta Native/DESIGN_SYSTEM.md` - UI/UX guidelines
- `3. Matthew x Opta/2. project/.planning/` - Project state and roadmaps

## Naming Conventions

**Files:**
- kebab-case.ts/tsx for TypeScript modules (`use-processes.ts`)
- PascalCase.tsx for React components (`ProcessList.tsx`)
- PascalCase.swift for Swift files (`ChessViewModel.swift`)
- snake_case.rs for Rust files (`telemetry.rs`)

**Directories:**
- Numbered for top-level organization (`1. Apps/`, `2. Gemini Deep Research/`)
- kebab-case for code directories (`src-tauri/`, `opta-core/`)
- Plural for collections (`components/`, `hooks/`, `services/`)
- PascalCase for Swift directories (`Views/`, `ViewModels/`)

**Special Patterns:**
- `index.ts` for barrel exports
- `*.test.ts` for tests (when present)
- `_archive/` for deprecated code
- `Generated/` for auto-generated UniFFI bindings

## Where to Add New Code

**New Feature (Desktop):**
- Primary code: `1. Apps/2. Desktop/1. Opta Native/src/pages/` or `.../components/`
- Hooks: `1. Apps/2. Desktop/1. Opta Native/src/hooks/`
- Tauri commands: `1. Apps/2. Desktop/1. Opta Native/src-tauri/src/`
- Config: `1. Apps/2. Desktop/1. Opta Native/src/lib/`

**New Feature (Native Rust):**
- Core logic: `1. Apps/4. Shared/1. opta-native/opta-core/src/`
- Shared types: `1. Apps/4. Shared/1. opta-native/opta-shared/src/`
- GPU rendering: `1. Apps/4. Shared/1. opta-native/opta-render/src/`

**New Feature (Web):**
- Pages: `1. Apps/3. Web/1. Opta Life Manager/app/`
- Components: `1. Apps/3. Web/1. Opta Life Manager/components/`
- Server Actions: `1. Apps/3. Web/1. Opta Life Manager/lib/actions.ts`
- API integrations: `1. Apps/3. Web/1. Opta Life Manager/lib/`

**New Route (Mobile API):**
- Definition: `1. Apps/1. iOS/1. Opta/packages/api/src/routes/`
- Shared types: `1. Apps/1. iOS/1. Opta/packages/shared/src/`

**Utilities:**
- React utilities: `1. Apps/2. Desktop/1. Opta Native/src/lib/`
- Rust utilities: `1. Apps/4. Shared/1. opta-native/opta-shared/src/`
- Web utilities: `1. Apps/3. Web/1. Opta Life Manager/lib/`

## Special Directories

**1. Apps/4. Shared/1. opta-native/OptaApp/OptaApp/Generated/**
- Purpose: Auto-generated UniFFI Swift bindings
- Source: Generated by `uniffi-bindgen` from Rust
- Committed: Yes (regenerate on Rust interface changes)

**3. Matthew x Opta/2. project/.planning/**
- Purpose: Cross-project planning documents
- Source: Created by GSD workflow
- Committed: Yes

**node_modules/**
- Purpose: npm dependencies
- Source: npm install
- Committed: No (gitignored in all projects)

---

*Structure analysis: 2026-01-28*
*Updated after folder reorganization*
*Update when directory structure changes*
