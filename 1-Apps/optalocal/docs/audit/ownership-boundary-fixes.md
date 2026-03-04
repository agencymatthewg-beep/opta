# Ownership Boundary Fixes (proposed, not applied)

## Boundary model
- **1D-Opta-CLI-TS** owns daemon protocol (`/v3`), operation catalog semantics, and shared TypeScript contract packages.
- **1M-Opta-LMX** owns inference/discovery contract (`/v1`, discovery schema), model lifecycle, performance profile truth.
- **1P-Opta-Code-Universal** owns UX behavior, presentation, and parity consumption (not contract definition).

## Fixes
1. Create `docs/contracts/OWNERSHIP.md` at ecosystem root with explicit ownership + review codeowners.
2. Make `1D/docs/parity/cli-surface.json` the only operation-catalog source; 1P consumes read-only.
3. Introduce `contract-compat.json` containing:
   - daemon contract version(s)
   - lmx discovery schema versions
   - supported compatibility windows
4. Add CI policy:
   - contract change requires corresponding test fixture delta + compatibility matrix update.
5. Add `deprecation-state` field for operations (`active|deprecated|retired|unmapped-intentional`).

## Expected impact
- Drift reduction: ~40-60% in parity/contract surprises.
- Faster integration triage: ~30% (single owner per interface).
