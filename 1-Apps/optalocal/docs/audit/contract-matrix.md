# Contract Matrix (2026-03)

## Canonical contracts
- **Daemon v3 contract authority**: `1D-Opta-CLI-TS/src/protocol/v3/*`
- **Shared client package**: `1D-Opta-CLI-TS/packages/protocol-shared`, `packages/daemon-client`
- **LMX discovery+inference contract**: `1M-Opta-LMX/src/opta_lmx/discovery.py` and `/v1/*` API

## Consumer mapping
- 1P consumes daemon v3 via:
  - `src/lib/daemonClient.ts` (`/v3/ws`, `/v3/*` HTTP)
  - `src/hooks/useConnectionHealth.ts` (`/v3/health`)
  - package deps: `@opta/daemon-client`, `@opta/protocol-shared` (file-linked)
- 1D consumes 1M via LMX discovery/inference operations and endpoint assumptions (`/v1/discovery`, `/v1/models`, `/v1/chat/stream`).

## Drift checks
1. **Daemon operation parity**: required checks pass; unmatched operation list contains `ceo.benchmark`.
2. **Version namespace split**: 1D/1P daemon is `v3`; 1M inference/discovery is `v1` (expected but requires explicit adapter boundary docs).
3. **Discovery schema versioning**: 1M hardcodes `schema_version: 2026-03-02`; without compatibility policy this can drift from clients.

## Current status
- Required contract tests: PASS
- Required parity gates: PASS
- Drift warnings: 3 (non-blocking, medium risk)

## Recommended contract guardrails (not applied)
- Add machine-readable compatibility matrix (`daemon_v3` x `lmx_discovery_schema_version`) and gate in CI.
- Promote `ceo.benchmark` from unmatched to explicit state (`supported|deprecated|intentionally-unmapped`) in parity artifacts.
- Add discovery schema semver policy and deprecation windows in `1M` docs/tests.
