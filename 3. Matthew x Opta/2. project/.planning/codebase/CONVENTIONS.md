# Coding Conventions

**Analysis Date:** 2026-01-28

## Naming Patterns

**Files:**
- TypeScript: kebab-case (`use-processes.ts`, `chess-settings.ts`)
- React Components: PascalCase (`ProcessList.tsx`, `OptaRing3D.tsx`)
- Swift: PascalCase (`ChessViewModel.swift`, `DesignSystem.swift`)
- Rust: snake_case (`telemetry.rs`, `mod.rs`)
- Config: kebab-case or standard names (`vite.config.ts`, `tsconfig.json`)

**Functions:**
- TypeScript: camelCase (`fetchTelemetry`, `handleClick`)
- Hooks: use* prefix (`useProcesses`, `useTelemetry`, `useChessGame`)
- Swift: camelCase (`updateScore`, `processMove`)
- Rust: snake_case (`get_processes`, `send_telemetry`)
- Async: No special prefix, use async/await

**Variables:**
- TypeScript/Swift: camelCase (`currentScore`, `isLoading`)
- Rust: snake_case (`process_list`, `is_running`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- No underscore prefix for private (use TypeScript private keyword)

**Types:**
- Interfaces: PascalCase, no I prefix (`User`, `ProcessInfo`, not `IUser`)
- Types: PascalCase (`OptaScore`, `TelemetryData`)
- Enums: PascalCase name, UPPER_CASE values in Rust (`Status::PENDING`)
- Swift: PascalCase for all types and enums

## Code Style

**Formatting (TypeScript):**
- 2-space indentation
- Single quotes for strings
- Semicolons required
- 100 character line length (soft)
- Trailing commas in multi-line

**Formatting (Rust):**
- 4-space indentation
- rustfmt standard formatting
- 100 character line length

**Formatting (Swift):**
- 4-space indentation
- SwiftFormat/SwiftLint conventions
- 120 character line length

**Linting:**
- ESLint config in `opta-life-manager/eslint.config.mjs`
- TypeScript strict mode enabled
- Clippy for Rust (pedantic mode in some crates)

## Import Organization

**Order (TypeScript):**
1. React imports (`import React from 'react'`)
2. External packages (`framer-motion`, `@tauri-apps/api`)
3. Internal modules (`@/lib`, `@/components`, `@/hooks`)
4. Relative imports (`./utils`, `../types`)
5. Type imports (`import type { User }`)

**Grouping:**
- Blank line between groups
- Alphabetical within each group (not enforced strictly)

**Path Aliases:**
- `@/` maps to `src/` in Opta MacOS
- `@/` maps to root in opta-life-manager
- No aliases in Rust (use crate paths)

## Error Handling

**Patterns (TypeScript):**
- try/catch at service boundaries
- Throw errors with descriptive messages
- Toast notifications for user-facing errors
- Console.error for logging (production gap noted)

**Patterns (Rust):**
- `thiserror` for error types (`opta-native/opta-shared/src/error.rs`)
- Result<T, E> for fallible functions
- `?` operator for error propagation
- Descriptive error messages with context

**Patterns (Swift):**
- throws functions with do-catch
- Result types for async operations
- @MainActor for UI-safe callbacks

## Logging

**Framework:**
- TypeScript: console.log/warn/error (no structured logging library)
- Rust: tracing crate (partially integrated)
- Swift: print/OSLog

**Patterns:**
- Log at service boundaries
- Include context in error logs
- TODO: Migrate to structured logging in production

## Comments

**When to Comment:**
- Explain complex algorithms or workarounds
- Document business rules
- JSDoc for public APIs
- Avoid obvious comments

**JSDoc/TSDoc:**
- Used extensively in `Opta MacOS/src/components/`
- `@fileoverview` at file top
- `@param`, `@returns`, `@throws` for functions
- `@see` for referencing DESIGN_SYSTEM.md

**TODO Comments:**
- Format: `// TODO: description`
- Found in: `opta-life-manager/`, `Opta iOS/packages/api/`
- Tracked in CONCERNS.md for critical items

**Rust Doc Comments:**
- `///` for public items
- `//!` for module-level docs
- 2552+ doc comments in opta-native

## Function Design

**Size:**
- Aim for <50 lines per function
- Extract helpers for complex logic
- Some large files exist (>900 lines) - refactoring opportunities noted

**Parameters:**
- Max 3-4 parameters preferred
- Use options object/struct for more
- Destructure in TypeScript function signatures

**Return Values:**
- Explicit returns
- Return early for guard clauses
- Avoid undefined returns (use null or throw)

## Module Design

**Exports (TypeScript):**
- Named exports preferred
- Default exports for React page components
- Barrel exports via `index.ts`

**Exports (Rust):**
- `pub` for public API
- `pub(crate)` for crate-internal
- Re-export from lib.rs

**React Component Pattern:**
```typescript
/**
 * ComponentName - Brief description
 *
 * Longer description of purpose.
 * @see DESIGN_SYSTEM.md - Part X: Section name
 */
export function ComponentName({ prop1, prop2 }: Props) {
  // hooks first
  const [state, setState] = useState();

  // handlers
  const handleAction = () => {};

  // render
  return <div>...</div>;
}
```

**Swift View Pattern:**
```swift
/// View description
struct ViewName: View {
    // State properties
    @State private var value = 0

    // Environment
    @EnvironmentObject var viewModel: ViewModel

    var body: some View {
        // View hierarchy
    }
}
```

---

*Convention analysis: 2026-01-28*
*Update when patterns change*
