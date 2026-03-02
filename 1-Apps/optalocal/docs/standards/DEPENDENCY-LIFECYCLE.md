# OptaLocal Dependency Lifecycle Standard

Scope: `1D-Opta-CLI-TS`, `1M-Opta-LMX`, `1P-Opta-Code-Universal`

## 1) Upgrade Cadence
- **Patch/minor**: allowed in scheduled maintenance windows.
- **Major**: only in dedicated upgrade branches with explicit validation evidence.
- **Security exceptions**: high/critical can bypass schedule, but must still pass verification gates.

## 2) Safety Gates (must pass before merge)
- Typecheck/lint
- Tests
- Production build (if applicable)
- Security audit threshold: no high/critical

## 3) Rollback Rule
If any gate fails:
1. Revert lockfile + manifest in same branch.
2. Log failing package(s) and failing gate.
3. Retry in isolated branch with narrower scope.

## 4) Ownership
- Upgrade execution: automation + bot
- Major approval: Matthew

## 5) Critical Coupled Sets
### Opta Code (1P)
Upgrade these together: `vite`, `vitest`, `@vitejs/plugin-react`, `jsdom`.

### Opta CLI (1D)
Upgrade these together: `vitest`, `ink`, `ink-testing-library`, `typescript`, `@typescript-eslint/*`.

### Opta LMX (1M)
Pin and test as a stack: `vllm-mlx`, `mlx`, `mlx-lm`, `mlx-vlm`, `fastapi`, `uvicorn`, `pydantic`.
