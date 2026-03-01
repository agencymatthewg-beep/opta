# Auto Task: Undo/rollback

## Why now
Competitive gap score is **3** (HIGH). Multiple competitors now ship this capability.

## Objective
Implement **Undo/rollback** in Opta CLI with production-safe defaults and no regression to current behavior.

## Scope
- Add the smallest viable end-to-end implementation.
- Keep changes modular and testable.
- Avoid architecture rewrites unless strictly required.

## Context files (read first)
- `CLAUDE.md`
- `docs/competitive/COMPETITIVE-MATRIX.md`
- `docs/ROADMAP.md`
- Relevant command/runtime files under `src/`

## Implementation constraints
- Backward compatible CLI UX
- Clear error handling and user-facing messaging
- Unit/integration tests for new behavior
- Keep implementation focused (no unrelated refactors)

## Validation checklist
- Feature works in a clean session
- Existing command flows remain unchanged
- Tests pass for happy path + failure path
- Help/docs reflect new behavior

## Definition of done
- Feature merged with tests
- Matrix row can be moved to ✅
- Short release-note entry added
