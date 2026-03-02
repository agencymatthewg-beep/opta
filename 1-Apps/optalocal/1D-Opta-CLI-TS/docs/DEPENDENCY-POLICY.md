# Dependency Policy — 1D Opta CLI

Canonical standard: `../../docs/standards/DEPENDENCY-LIFECYCLE.md`

## Commands

### Check
```bash
pnpm --filter @opta/opta-cli outdated || true
npm audit
```

### Safe upgrade (patch/minor in-range)
```bash
pnpm up
pnpm run deps:verify
```

### Major upgrade (scheduled only)
```bash
pnpm up --latest
pnpm run deps:verify
```

## Verification Gate
```bash
pnpm --filter @opta/opta-cli run typecheck
pnpm --filter @opta/opta-cli run test:run
pnpm --filter @opta/opta-cli run build
pnpm --filter @opta/opta-cli run check-dist
npm audit
```

## Coupled packages (upgrade together)
- vitest
- ink
- ink-testing-library
- typescript
- @typescript-eslint/*
