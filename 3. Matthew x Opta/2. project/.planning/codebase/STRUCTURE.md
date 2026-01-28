# Codebase Structure

**Analysis Date:** 2026-01-28

## Directory Layout

```
Opta/
├── Opta MacOS/           # Desktop app (Tauri + React + SwiftUI hybrid)
│   ├── src/              # React frontend
│   ├── src-tauri/        # Tauri Rust backend
│   ├── OptaNative/       # SwiftUI native components
│   └── scripts/          # Python telemetry scripts
├── Opta iOS/             # Mobile monorepo (Expo + React Native)
│   ├── apps/mobile/      # Main Expo app
│   └── packages/         # Shared packages (api, shared)
├── opta-life-manager/    # Web app (Next.js 15)
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   └── lib/              # Utilities and API clients
├── opta-native/          # Rust workspace
│   ├── opta-core/        # Crux core logic
│   ├── opta-shared/      # Shared types/utilities
│   ├── opta-render/      # wgpu GPU rendering
│   └── OptaApp/          # macOS SwiftUI app
├── OptaLMiOS/            # Life Manager iOS (SwiftUI)
├── Opta Mini/            # Menu bar agent (SwiftUI)
├── .planning/            # Project planning docs
├── .personal/            # Personal context
└── .serena/              # Serena MCP config
```

## Directory Purposes

**Opta MacOS/src/**
- Purpose: React frontend for desktop app
- Contains: Pages, components, hooks, contexts, utilities
- Key files: `main.tsx`, `App.tsx`, `pages/*.tsx`
- Subdirectories: `components/`, `hooks/`, `contexts/`, `lib/`, `pages/`, `types/`

**Opta MacOS/src-tauri/**
- Purpose: Tauri Rust backend
- Contains: IPC commands, system integration, window management
- Key files: `main.rs`, `lib.rs`, `telemetry.rs`, `processes.rs`
- Subdirectories: `src/` (Rust source), `icons/`, `capabilities/`

**Opta MacOS/OptaNative/**
- Purpose: SwiftUI native components (hybrid approach)
- Contains: Views, ViewModels, Utilities, Services
- Key files: `Views/MainWindow/`, `ViewModels/ChessViewModel.swift`
- Subdirectories: `Views/`, `ViewModels/`, `Utilities/`, `Services/`

**opta-native/opta-core/**
- Purpose: Cross-platform Crux core
- Contains: App logic, model, events, effects, capabilities
- Key files: `lib.rs`, `app.rs`, `model.rs`, `event.rs`, `effect.rs`
- Subdirectories: `src/` only

**opta-native/opta-render/**
- Purpose: GPU rendering with wgpu
- Contains: Render pipelines, shaders, GPU abstractions
- Key files: `lib.rs`, shader files (.wgsl)
- Subdirectories: `src/`, `shaders/`

**opta-life-manager/**
- Purpose: Next.js web application
- Contains: App Router pages, Server Actions, components
- Key files: `app/page.tsx`, `auth.ts`, `lib/actions.ts`
- Subdirectories: `app/`, `components/`, `lib/`

**Opta iOS/packages/api/**
- Purpose: Hono API server for mobile
- Contains: Route handlers, middleware, validation
- Key files: `src/index.ts`, `src/routes/*.ts`
- Subdirectories: `src/routes/`, `src/middleware/`

## Key File Locations

**Entry Points:**
- `Opta MacOS/src/main.tsx` - React app mount
- `Opta MacOS/src-tauri/src/main.rs` → `lib.rs` - Tauri backend
- `opta-life-manager/app/page.tsx` - Next.js home
- `opta-native/opta-core/src/lib.rs` - Crux library
- `Opta iOS/apps/mobile/app/_layout.tsx` - Expo Router root

**Configuration:**
- `Opta MacOS/tsconfig.json` - TypeScript config
- `Opta MacOS/vite.config.ts` - Vite bundler config
- `Opta MacOS/src-tauri/tauri.conf.json` - Tauri app config
- `opta-life-manager/next.config.ts` - Next.js config
- `opta-native/Cargo.toml` - Rust workspace manifest

**Core Logic:**
- `opta-native/opta-core/src/app.rs` - Crux application
- `opta-life-manager/lib/actions.ts` - Server Actions
- `Opta MacOS/src/hooks/*.ts` - React hooks
- `Opta MacOS/OptaNative/OptaNative/ViewModels/*.swift` - SwiftUI ViewModels

**Testing:**
- No dedicated test directories (design system compliance as quality gate)
- TypeScript strict mode in all tsconfig.json files

**Documentation:**
- `CLAUDE.md` - Root instructions
- `Opta MacOS/CLAUDE.md` - Desktop-specific instructions
- `Opta MacOS/DESIGN_SYSTEM.md` - UI/UX guidelines
- `.planning/` - Project state and roadmaps

## Naming Conventions

**Files:**
- kebab-case.ts/tsx for TypeScript modules (`use-processes.ts`)
- PascalCase.tsx for React components (`ProcessList.tsx`)
- PascalCase.swift for Swift files (`ChessViewModel.swift`)
- snake_case.rs for Rust files (`telemetry.rs`)

**Directories:**
- kebab-case for all directories (`src-tauri/`, `opta-core/`)
- Plural for collections (`components/`, `hooks/`, `services/`)
- PascalCase for Swift directories (`Views/`, `ViewModels/`)

**Special Patterns:**
- `index.ts` for barrel exports
- `*.test.ts` for tests (when present)
- `_archive/` for deprecated code
- `Generated/` for auto-generated UniFFI bindings

## Where to Add New Code

**New Feature (Desktop):**
- Primary code: `Opta MacOS/src/pages/` or `Opta MacOS/src/components/`
- Hooks: `Opta MacOS/src/hooks/`
- Tauri commands: `Opta MacOS/src-tauri/src/`
- Config if needed: `Opta MacOS/src/lib/`

**New Feature (Native Rust):**
- Core logic: `opta-native/opta-core/src/`
- Shared types: `opta-native/opta-shared/src/`
- GPU rendering: `opta-native/opta-render/src/`

**New Feature (Web):**
- Pages: `opta-life-manager/app/`
- Components: `opta-life-manager/components/`
- Server Actions: `opta-life-manager/lib/actions.ts`
- API integrations: `opta-life-manager/lib/`

**New Route (Mobile API):**
- Definition: `Opta iOS/packages/api/src/routes/`
- Shared types: `Opta iOS/packages/shared/src/`

**Utilities:**
- React utilities: `Opta MacOS/src/lib/`
- Rust utilities: `opta-native/opta-shared/src/`
- Web utilities: `opta-life-manager/lib/`

## Special Directories

**opta-native/OptaApp/OptaApp/Generated/**
- Purpose: Auto-generated UniFFI Swift bindings
- Source: Generated by `uniffi-bindgen` from Rust
- Committed: Yes (regenerate on Rust interface changes)

**.planning/**
- Purpose: Project state and planning documents
- Source: Created by GSD workflow
- Committed: Yes

**Opta MacOS/node_modules/**
- Purpose: npm dependencies
- Source: npm install
- Committed: No (gitignored)

---

*Structure analysis: 2026-01-28*
*Update when directory structure changes*
