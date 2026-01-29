# Testing

*Last updated: 2025-01-29*

## Current State

**Testing Strategy**: Compile-time validation + manual QA

| Platform | Unit Tests | Integration Tests | E2E Tests |
|----------|------------|-------------------|-----------|
| Desktop (TypeScript) | Not configured | Not configured | Not configured |
| Desktop (Rust) | Available | Available | Not configured |
| iOS (Swift) | XCTest available | Not configured | Not configured |
| Web (TypeScript) | Not configured | Not configured | Not configured |
| Shared (Rust) | Available | Available | Not applicable |

## Validation Methods

### TypeScript Strict Mode

Primary type safety validation for all TypeScript apps.

**Configuration** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Files**:
- `apps/desktop/opta-native/tsconfig.json`
- `apps/web/opta-life-manager/tsconfig.json`
- `apps/web/AICompare/tsconfig.json`

### Build Verification

```bash
# Desktop
cd apps/desktop/opta-native
npm run build          # Full TypeScript + Vite build
tsc --noEmit           # Type checking only

# Web
cd apps/web/opta-life-manager
npm run build          # Next.js production build
```

### Runtime Validation

**Zod Schemas** (API routes):
```typescript
// apps/ios/opta/packages/api/src/routes/*.ts
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
```

## Rust Tests

### Test Files

Located in `apps/shared/opta-native/opta-render/tests/`:

| File | Purpose |
|------|---------|
| `ring_test.rs` | Ring configuration and rendering |
| `timing_test.rs` | Animation timing |
| `shader_test.rs` | Shader compilation |
| `effects_test.rs` | Visual effects |
| `theme_test.rs` | Theme system |
| `accessibility_test.rs` | A11y compliance |
| `integration_tests.rs` | Full integration |

### Running Tests

```bash
cd apps/shared/opta-native
cargo test                           # Run all tests
cargo test --package opta-render     # Package-specific
cargo test ring_test                 # Single test file
```

### Test Pattern

```rust
// apps/shared/opta-native/opta-render/tests/ring_test.rs
#[test]
fn test_ring_config_defaults() {
    let config = RingConfig::default();
    assert!((config.major_radius - 1.0).abs() < f32::EPSILON);
    assert_eq!(config.major_segments, 64);
}
```

### Linting

```bash
cargo check                          # Type checking
cargo clippy -- -W clippy::pedantic  # Linting
cargo fmt --check                    # Formatting
```

## Swift Tests (XCTest)

### Test File

`apps/desktop/opta-native/src-tauri/swift-plugin/Tests/OptaMenuBarTests/OptaMenuBarTests.swift`

### Test Pattern

```swift
import XCTest
@testable import OptaMenuBar

final class OptaMenuBarTests: XCTestCase {
    func testSystemMetrics() {
        let metrics = SystemMetrics()
        XCTAssertGreaterThan(metrics.cpuUsage, 0)
    }

    func testMomentumState() {
        let state = MomentumState.idle
        XCTAssertEqual(state, .idle)
    }
}
```

### Test Coverage

- FlatBuffersBridge
- SystemMetrics
- MomentumState
- MomentumColor

## Manual Testing

### Desktop Development

```bash
cd apps/desktop/opta-native
npm run dev                          # Hot reload development
```

### iOS Development

- Xcode builds and Simulator testing
- Device testing via TestFlight

### Web Development

```bash
cd apps/web/opta-life-manager
npm run dev                          # Next.js dev server
```

## Testing Gaps

### High Priority

1. **TypeScript Unit Tests**
   - Add Vitest for `apps/desktop/opta-native/`
   - Add Vitest for `apps/web/opta-life-manager/`
   - Focus: Custom hooks, utility functions

2. **API Route Tests**
   - Add tests for `apps/ios/opta/packages/api/src/routes/`
   - Focus: Request validation, response format

3. **Crux App Logic Tests**
   - Add tests for `apps/shared/opta-native/opta-core/`
   - Focus: Event handling, state transitions

### Medium Priority

1. **E2E Tests**
   - Add Playwright for critical user flows
   - Focus: Authentication, core features

2. **Visual Regression**
   - Add design system compliance tests
   - Focus: Glass effects, animations

### Low Priority

1. **Performance Benchmarks**
   - GPU rendering performance
   - Animation frame rates

2. **Load Testing**
   - Web API capacity

## Recommended Test Setup

### Vitest (TypeScript)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Test Structure

```
src/
├── hooks/
│   ├── useChessGame.ts
│   └── useChessGame.test.ts    # Co-located tests
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
└── test/
    └── setup.ts                 # Test setup
```

### Running Tests (Future)

```bash
# TypeScript (once configured)
npm test                         # Run all tests
npm test -- --watch              # Watch mode
npm test -- --coverage           # Coverage report

# Rust
cargo test                       # Already available

# Swift
xcodebuild test                  # Xcode test runner
```
