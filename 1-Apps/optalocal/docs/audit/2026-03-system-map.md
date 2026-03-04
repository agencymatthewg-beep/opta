# 2026-03 System Map (CLI ↔ LMX ↔ Desktop)

## Topology
- **1D-Opta-CLI-TS**: primary orchestrator + daemon contract authority (`src/protocol/v3/*`, `packages/protocol-shared`, `packages/daemon-client`).
- **1M-Opta-LMX**: inference engine with OpenAI-compatible API (`/v1/*`) + discovery document (`/.well-known/opta-lmx`, `/v1/discovery`).
- **1P-Opta-Code-Universal**: desktop/web UI client; consumes daemon via `@opta/daemon-client` and `@opta/protocol-shared` (file deps to 1D).

## Data/control flows
1. User action in 1P -> `daemonClient` call (`/v3/health`, `/v3/ws`, `/v3/operations/...`).
2. 1D daemon receives v3 envelopes/events, executes operation handlers.
3. LMX-linked operations route to 1M endpoints (`/v1/models`, `/v1/chat/stream`, discovery metadata).
4. 1P parity checks consume exported CLI surface and compare operation coverage.

## Coupling map
- **Strong coupling**: 1P -> 1D packages via local file dependencies.
- **Medium coupling**: 1D -> 1M through service endpoint assumptions + model operation scopes (`/v3/lmx/*` operations in daemon surface).
- **Low coupling**: 1P direct to 1M (mostly indirect through daemon).

## Structural hotspots
- 1D: very large orchestration files (`src/benchmark/pages.ts` 1853 LOC, `src/index.ts` 1260 LOC, `src/protocol/v3/operations.ts` 1279 LOC).
- 1M: large API/core files (`engine_lifecycle.py` 1598 LOC, `main.py` 1058 LOC).
- 1P: UI concentration in `opta.css` (5569 LOC) + several 800–1100 LOC components/pages.

## Reliability observations
- Contract tests are present and passing across 1D/1M.
- Desktop parity check passes required checks, but still reports one unmatched operation (`ceo.benchmark`) indicating surface drift risk.
