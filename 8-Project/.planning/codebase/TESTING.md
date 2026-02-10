# Testing Patterns

**Analysis Date:** 2026-01-28

## Test Framework

**Runner:**
- No explicit test framework configured
- TypeScript strict mode serves as primary validation
- Design system compliance (DESIGN_SYSTEM.md) as quality gate

**Assertion Library:**
- Not applicable (no unit test files detected)

**Run Commands:**
```bash
# TypeScript type checking
npm run typecheck                    # or tsc --noEmit

# Linting
npm run lint                         # ESLint

# Build verification
npm run build                        # Full build
cargo check                          # Rust type checking
cargo clippy                         # Rust linting
```

## Test File Organization

**Location:**
- No dedicated test directories found
- No `*.test.ts` or `*.spec.ts` files in main source
- Testing strategy relies on TypeScript strict mode + manual QA

**Structure:**
```
Opta MacOS/
  src/
    components/    # No tests alongside
    hooks/         # No tests alongside
    lib/           # No tests alongside

opta-native/
  opta-core/
    src/           # No tests directory
```

## Quality Assurance Strategy

**TypeScript Strict Mode:**
- Enabled in all `tsconfig.json` files
- Catches type errors at compile time
- Enforces null checks, strict function types

**Design System Compliance:**
- `DESIGN_SYSTEM.md` defines visual standards
- Components reference design system sections via JSDoc `@see`
- Manual review against design specifications

**Rust Checks:**
```bash
cargo check                          # Type checking
cargo clippy -- -W clippy::pedantic  # Linting
cargo fmt --check                    # Formatting
```

## Manual Testing Patterns

**Desktop App (Tauri):**
```bash
cd "Opta MacOS"
npm run dev                          # Development mode with hot reload
npm run tauri dev                    # Full Tauri development
```

**Web App (Next.js):**
```bash
cd opta-life-manager
npm run dev                          # Development server
```

**Mobile App (Expo):**
```bash
cd "Opta iOS/apps/mobile"
npx expo start                       # Development server
```

## Coverage

**Requirements:**
- No enforced coverage targets
- No coverage tooling configured

**Focus Areas (Recommended for Future):**
- API route handlers (`Opta iOS/packages/api/src/routes/`)
- Crux core logic (`opta-native/opta-core/src/`)
- Authentication flows (`opta-life-manager/auth.ts`)
- Data transformations (`opta-life-manager/lib/`)

## Test Types (Recommended)

**Unit Tests (Not Yet Implemented):**
- Scope: Individual functions, utilities, transformations
- Framework recommendation: Vitest for TypeScript, built-in for Rust
- Location recommendation: `*.test.ts` alongside source

**Integration Tests (Not Yet Implemented):**
- Scope: API routes, Tauri commands, Crux effects
- Framework recommendation: Supertest for API, Tauri test utils

**E2E Tests (Not Yet Implemented):**
- Scope: User flows, multi-step interactions
- Framework recommendation: Playwright for web, XCTest for iOS/macOS

## Validation Patterns Currently Used

**Zod Schemas:**
- Location: `Opta iOS/packages/api/src/routes/*.ts`
- Purpose: Runtime validation of API request bodies
- Example: `feedbackSchema` in `feedback.ts`

**TypeScript Type Guards:**
- Location: Throughout codebase
- Purpose: Runtime type narrowing

**Swift Property Wrappers:**
- Location: SwiftUI views
- Purpose: State validation and UI binding

## Common Patterns (If Tests Were Added)

**Recommended Async Testing:**
```typescript
import { describe, it, expect } from 'vitest';

describe('fetchTelemetry', () => {
  it('should return telemetry data', async () => {
    const result = await fetchTelemetry();
    expect(result).toMatchObject({
      cpu: expect.any(Number),
      memory: expect.any(Number),
    });
  });
});
```

**Recommended Crux Testing:**
```rust
#[test]
fn test_update_increments_counter() {
    let mut model = Model::default();
    let effects = App::update(Event::Increment, &mut model, &caps);
    assert_eq!(model.count, 1);
}
```

## Gaps and Recommendations

**High Priority:**
- Add Vitest for TypeScript unit tests
- Add tests for API routes in `Opta iOS/packages/api/`
- Add tests for Crux app logic

**Medium Priority:**
- Add E2E tests for critical user flows
- Add visual regression tests for design system compliance

**Low Priority:**
- Add performance benchmarks for GPU rendering
- Add load tests for web API

---

*Testing analysis: 2026-01-28*
*Update when test infrastructure is added*
