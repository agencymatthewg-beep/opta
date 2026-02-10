# Architecture

**Analysis Date:** 2026-01-28

## Pattern Overview

**Overall:** Distributed Monorepo with Platform Abstraction Layer

**Key Characteristics:**
- Multi-app workspace (4 distinct applications sharing code)
- Platform-specific UI (React/SwiftUI) with shared Rust core
- Event-driven architecture using Crux Elm pattern
- GPU-accelerated rendering via wgpu/Metal
- MCP-first AI integration strategy

## Layers

**Presentation Layer:**
- Purpose: Platform-specific user interfaces
- Contains: React components, SwiftUI views, animations, styling
- Location: `Opta MacOS/src/`, `opta-native/OptaApp/OptaApp/Views/`
- Depends on: Bridge/IPC layer, state management
- Used by: End users

**Bridge/IPC Layer:**
- Purpose: Cross-platform communication (Tauri commands, UniFFI bindings)
- Contains: Tauri commands, Swift-Rust bindings, event channels
- Location: `Opta MacOS/src-tauri/src/`, `opta-native/opta-core/src/lib.rs`
- Depends on: Core logic layer
- Used by: Presentation layer

**Service Layer:**
- Purpose: Business logic and API integrations
- Contains: Auth services, API clients, data transformations
- Location: `opta-life-manager/lib/`, `opta-native/OptaApp/OptaApp/Services/`
- Depends on: State layer, external APIs
- Used by: Bridge layer, presentation components

**State/Effects Layer (Crux):**
- Purpose: Centralized state management and side effect handling
- Contains: Model, Update, Events, Effects (Elm architecture)
- Location: `opta-native/opta-core/src/app.rs`, `opta-native/opta-core/src/model.rs`
- Depends on: Shared types
- Used by: All platform shells

**Core Logic Layer:**
- Purpose: Platform-agnostic algorithms and computations
- Contains: Chess engine, optimization algorithms, scoring
- Location: `opta-native/opta-core/src/`
- Depends on: Shared utilities only
- Used by: State layer

**Rendering Layer:**
- Purpose: GPU-accelerated graphics
- Contains: WGSL shaders, wgpu pipelines, Metal integration
- Location: `opta-native/opta-render/`, `Opta MacOS/src/components/OptaRing3D/shaders/`
- Depends on: Core logic for data
- Used by: Presentation layer

**Shared Layer:**
- Purpose: Common types, utilities, error handling
- Contains: Error types, constants, cross-platform utilities
- Location: `opta-native/opta-shared/`
- Depends on: Nothing (leaf dependency)
- Used by: All other layers

**Infrastructure Layer:**
- Purpose: External service integrations
- Contains: MCP servers, API clients, database connections
- Location: `opta-life-manager/lib/actions.ts`, `Opta MacOS/scripts/`
- Depends on: Environment configuration
- Used by: Service layer

## Data Flow

**Desktop App (Tauri + React):**

1. User interacts with React UI (`Opta MacOS/src/pages/*.tsx`)
2. React calls Tauri command via `@tauri-apps/api/core`
3. Tauri backend receives in `src-tauri/src/lib.rs`
4. Rust command invokes Crux core or native APIs
5. Result serialized and returned to React
6. React state updates, UI re-renders

**Native Swift App (Crux + SwiftUI):**

1. User interacts with SwiftUI view
2. Event dispatched to Crux shell (`opta-native/opta-core/`)
3. Model updated, effects triggered (`app.rs` → `effect.rs`)
4. Effects execute (HTTP, storage, render)
5. View model updates via UniFFI callback
6. SwiftUI observes changes, UI updates

**Web App (Next.js):**

1. Server Component fetches data via Server Actions (`opta-life-manager/lib/actions.ts`)
2. Data passed to Client Components
3. Client interactions call API routes or Server Actions
4. External APIs called (Google Calendar, Todoist, etc.)
5. Response returned, page re-renders

**State Management:**
- Opta MacOS: React Context + custom hooks (`src/contexts/`, `src/hooks/`)
- opta-native: Crux Model with immutable updates (`opta-core/src/model.rs`)
- opta-life-manager: Server Components + NextAuth session

## Key Abstractions

**Tauri Command Pattern:**
- Purpose: Type-safe IPC between React and Rust
- Examples: `telemetry.rs`, `processes.rs`, `settings.rs`
- Pattern: `#[tauri::command]` macros, async/await

**Crux Elm Architecture:**
- Purpose: Predictable state management across platforms
- Examples: `App`, `Model`, `Event`, `Effect` in `opta-core/`
- Pattern: Update function returns (Model, Vec<Effect>)

**Context + Hooks Pattern:**
- Purpose: React state sharing and side effects
- Examples: `ChessSettingsContext.tsx`, `useProcesses.ts`, `useTelemetry.ts`
- Pattern: Provider wraps app, hooks consume context

**Platform Abstraction Layer:**
- Purpose: Same Rust core on macOS/Windows/Linux/iOS
- Examples: UniFFI bindings, conditional compilation
- Pattern: Shared core + platform-specific shells

## Entry Points

**Opta MacOS (Desktop):**
- Location: `Opta MacOS/src/main.tsx` (React), `Opta MacOS/src-tauri/src/main.rs` → `lib.rs` (Rust)
- Triggers: App launch, window creation
- Responsibilities: Initialize Tauri, mount React, setup IPC

**opta-native (Rust Library):**
- Location: `opta-native/opta-core/src/lib.rs`
- Triggers: UniFFI bindings from Swift/Kotlin
- Responsibilities: Initialize Crux app, expose FFI interface

**opta-life-manager (Web):**
- Location: `opta-life-manager/app/layout.tsx`, `opta-life-manager/app/page.tsx`
- Triggers: HTTP request to Vercel
- Responsibilities: NextAuth session, render React tree

**Opta iOS (Mobile):**
- Location: `Opta iOS/apps/mobile/app/_layout.tsx` (Expo Router)
- Triggers: App launch
- Responsibilities: Initialize Expo, configure navigation

## Error Handling

**Strategy:** Layered error handling with unified types

**Patterns:**
- Rust: `thiserror` derives for typed errors (`opta-shared/src/error.rs`)
- TypeScript: try/catch at service boundaries
- SwiftUI: Result types with @MainActor async handling
- User-facing: Toast notifications via react-hot-toast

## Cross-Cutting Concerns

**Logging:**
- Rust: `tracing` crate (not yet fully integrated)
- TypeScript: console.log (production logging gaps noted in CONCERNS.md)
- Swift: OSLog / print statements

**Validation:**
- Zod schemas at API boundaries (`Opta iOS/packages/api/src/routes/`)
- TypeScript strict mode for compile-time checks
- Rust type system for invariant enforcement

**Authentication:**
- next-auth for web (Google OAuth, session cookies)
- Tauri secure storage for desktop credentials
- No centralized auth for native apps yet

---

*Architecture analysis: 2026-01-28*
*Update when major patterns change*
