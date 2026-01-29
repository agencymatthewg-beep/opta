# Technical Concerns

*Last updated: 2025-01-29*

## Testing Gaps

### Critical: No Unit Test Framework Configured

**Impact**: High
**Locations**: All TypeScript apps

The desktop and web apps have no unit testing framework configured. TypeScript strict mode catches type errors but not runtime logic bugs.

**Files affected**:
- `apps/desktop/opta-native/package.json` - No test script
- `apps/web/opta-life-manager/package.json` - No test script
- `apps/web/AICompare/package.json` - No test script

**Recommendation**: Add Vitest with co-located tests for hooks and utilities.

### Medium: Limited iOS Test Coverage

**Impact**: Medium
**Location**: `apps/ios/opta/`

Only Swift plugin has tests (`OptaMenuBarTests.swift`). Main iOS app views and services lack test coverage.

**Files affected**:
- `apps/ios/opta/Opta Scan/Services/*.swift` - 12 services untested
- `apps/ios/opta/Opta Scan/Views/*.swift` - Views untested

## Type Safety

### Type Safety Bypasses (Desktop)

**Impact**: Low
**Location**: `apps/desktop/opta-native/src/`

Some `as any` and `as unknown` casts exist, though TypeScript strict mode is enabled.

**Common patterns found**:
```typescript
// @ts-ignore comments
// as any casts for third-party library interop
// as unknown for complex type transformations
```

**Recommendation**: Audit and replace with proper type guards where possible.

## Error Handling

### Inconsistent Error Handling Patterns

**Impact**: Medium
**Locations**: Multiple apps

Error handling varies between apps and even within apps.

**Desktop** (`apps/desktop/opta-native/src/`):
- Some hooks have try/catch, others rely on React error boundaries
- Console.error used for logging, no structured logging

**Web** (`apps/web/opta-life-manager/lib/`):
- Server actions have try/catch
- Error messages inconsistently formatted

**Recommendation**: Establish consistent error handling patterns per app.

## Security

### Environment Variables in .env.local

**Impact**: Low (gitignored correctly)
**Location**: `apps/web/opta-life-manager/.env.local`

Sensitive keys stored locally. File is properly gitignored but `.env.example` should be kept current.

**Keys present**:
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `TODOIST_API_TOKEN`

**Status**: Properly configured, just ensure `.env.example` stays in sync.

### Local Storage Usage

**Impact**: Low
**Locations**: Web apps

Some data stored in localStorage/sessionStorage. Non-sensitive data only.

**Recommendation**: Audit stored data periodically; prefer server-side session for sensitive data.

## Documentation

### Design System Compliance

**Impact**: Medium
**Location**: `apps/desktop/opta-native/DESIGN_SYSTEM.md`

445-line design system specification exists but compliance isn't automated.

**Concerns**:
- No automated checks for glass effect usage
- No validation that Framer Motion is used (not CSS transitions)
- No verification of Lucide icon usage

**Recommendation**: Add ESLint rules or CI checks for design system compliance.

## Code Organization

### Archive Folders

**Impact**: Low
**Locations**: Multiple

Archive folders exist with deprecated code:
- `apps/web/opta-life-manager/.archive/` (disk space usage)
- Various `_archive/` in components

**Recommendation**: Periodically clean up archives; keep only for reference during active refactoring.

### Large Files

**Impact**: Low
**Locations**: Desktop app

Some files are large but reasonably organized:
- `apps/desktop/opta-native/src/index.css` - 31KB (global styles)
- `apps/web/opta-life-manager/lib/actions.ts` - 24.5KB (server actions)
- `apps/web/opta-life-manager/lib/ai-commander.ts` - 20.3KB (AI orchestration)

**Status**: Acceptable for their purposes; monitor for splitting opportunities.

## Dependencies

### Beta Dependencies

**Impact**: Low
**Location**: `apps/web/opta-life-manager/package.json`

Using beta version of NextAuth:
```
next-auth@5.0.0-beta.30
```

**Recommendation**: Monitor for stable release; test thoroughly on upgrades.

### Dependency Count

**Impact**: Low
**Location**: All apps

Dependency counts are reasonable:
- Desktop: ~40 direct dependencies
- Web: ~25 direct dependencies

**Status**: No significant bloat detected.

## Performance

### No Performance Benchmarks

**Impact**: Medium
**Locations**: Shared Rust layer

GPU rendering (`opta-render`) has tests but no performance benchmarks.

**Files affected**:
- `apps/shared/opta-native/opta-render/tests/` - Functional tests only

**Recommendation**: Add criterion benchmarks for critical rendering paths.

### 3D Rendering Performance

**Impact**: Medium
**Location**: `apps/desktop/opta-native/src/components/OptaRing3D/`

Three.js + React Three Fiber used for 3D visualization. Performance on lower-end devices unknown.

**Recommendation**: Add performance monitoring; consider fallback for low-spec devices.

## TODO/FIXME Comments

### Tracked TODOs

**Impact**: Low
**Status**: Few critical TODOs found

Most TODO comments are minor improvements rather than critical fixes. No blocking issues discovered.

## Summary by Priority

### Address Soon

1. Add unit testing framework (Vitest) for TypeScript apps
2. Expand iOS service test coverage
3. Establish consistent error handling patterns

### Monitor

1. Beta dependency (next-auth)
2. Large file sizes
3. Archive folder disk usage

### Low Priority

1. Type safety bypass audit
2. Design system compliance automation
3. Performance benchmarking

## No Significant Concerns

- No hardcoded secrets in source code
- No obvious security vulnerabilities
- No deprecated APIs in critical paths
- Dependency versions reasonably current
- Code organization is logical and consistent
