# Dependency Policy — 1P Opta Code

Canonical standard: `../../docs/standards/DEPENDENCY-LIFECYCLE.md`

## Commands

### Check
```bash
npm outdated || true
npm audit
```

### Safe upgrade (patch/minor in-range)
```bash
npm update
npm run deps:verify
```

### Major upgrade (scheduled only)
```bash
npx npm-check-updates -u
npm install
npm run deps:verify
```

## Verification Gate
```bash
npm run typecheck
npm run test:run
npm run build
npm audit
```

## Coupled packages (upgrade together)
- vite
- vitest
- @vitejs/plugin-react
- jsdom
