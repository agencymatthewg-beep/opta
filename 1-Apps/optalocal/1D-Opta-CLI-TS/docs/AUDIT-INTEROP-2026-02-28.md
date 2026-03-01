# Opta CLI Interop Audit (2026-02-28)

Scope: audit whether Opta CLI features are easily consumable by other Opta apps (Opta Code Desktop, Opta Local web/dashboard) and bots.

## Verdict

Interop is now substantially improved and functionally aligned, with one strategic gap remaining.

- Core daemon/runtime is strong and heavily tested.
- Critical protocol mismatches across 1P/1L have been fixed.
- Remaining work: converge all consumers on a single shared daemon SDK path.

## Evidence Summary

- Core test baseline is green (`npm run test:run`, `npm run test:parity:ws9`).
- Daemon v3 HTTP/WS routes are defined in `src/daemon/http-server.ts` and `src/daemon/ws-server.ts`.
- Shared protocol/client packages exist:
  - `packages/protocol-shared`
  - `packages/daemon-client`

## Interop Scorecard

| Area                                             | Status  | Notes                                                                                                  |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| Daemon API contract (v3)                         | Pass    | Typed schemas and route validation are present (`src/protocol/v3/*`, `src/daemon/http-server.ts`).     |
| Daemon client SDK availability                   | Pass    | `@opta/daemon-client` now exposes shared HTTP + LMX methods consumed by app clients.                   |
| Opta Code Desktop integration correctness        | Pass    | Envelope/payload mismatches fixed; daemon LMX bridge routes added for current desktop model flows.     |
| Opta Local web/dashboard integration correctness | Pass    | WS auth handshake fixed; daemon error handling and SSE fallback path now wired in chat streaming flow. |
| Single source of truth for protocol/client       | Partial | 1P + 1L control-plane methods now consume shared daemon HTTP client; WS path still app-local.          |
| Bot-friendly machine interfaces                  | Partial | Many CLI commands support `--json`, but app-level integration path should be daemon SDK-first.         |

## Critical Findings (Blockers)

1. Partial canonicalization remains
   - Control-plane calls are now shared, but WS transport helpers are still duplicated app-side.
   - Final step is converging stream transport under shared browser-safe utilities.

## Implemented Fixes

1. Dashboard WS auth contract aligned
   - `1L-Opta-Local/web/src/lib/opta-daemon-client.ts`
     - moved auth to handshake query token
     - removed unsupported post-open `{ type: 'auth' }` message
     - added explicit WS error frame handling

2. Dashboard transport resilience improved
   - `1L-Opta-Local/web/src/hooks/useChatStream.ts`
     - added SSE fallback after max WS reconnect attempts
     - centralized daemon event handling across WS/SSE paths

3. Desktop envelope/payload contract aligned
   - `1P-Opta-Code-Desktop/src/lib/daemonClient.ts`
     - standardized envelope field to `event`
     - added default `mode: "chat"` for `submitTurn`
     - included `requestId` in permission resolution body
   - `1P-Opta-Code-Desktop/src/hooks/useDaemonSessions.ts`
     - switched event routing from `kind` to `event`
     - added thinking text fallback from `payload.text`

4. Daemon LMX bridge routes added for desktop compatibility
   - `1D-Opta-CLI-TS/src/daemon/http-server.ts`
     - added `/v3/lmx/status`
     - added `/v3/lmx/models`
     - added `/v3/lmx/memory`
     - added `/v3/lmx/models/available`
     - added `/v3/lmx/models/load`
     - added `/v3/lmx/models/unload`
     - added `/v3/lmx/models/:modelId` (delete)
     - added `/v3/lmx/models/download`

5. Shared daemon SDK adoption for app control-plane requests
   - `packages/daemon-client/src/http-client.ts`
     - added typed `/v3/lmx/*` methods to canonical client
   - `1P-Opta-Code-Desktop/src/lib/daemonClient.ts`
     - migrated HTTP session + permission + LMX calls to `DaemonHttpClient`
   - `1L-Opta-Local/web/src/lib/opta-daemon-client.ts`
     - migrated HTTP session + permission + events calls to `DaemonHttpClient`

## Secondary Findings

- CLI lint has high warning volume under strict mode (`npm run lint -- --max-warnings=0` fails), which increases maintenance risk for downstream integrators.
- Interop docs are present but no canonical "consumer contract" doc that external bots/apps can implement against directly.

## What must be done before upload (interop gate)

1. Make one canonical client path
   - Keep `packages/daemon-client` + `packages/protocol-shared` as the only control-plane source.
   - Finish stream-plane convergence by extracting browser-safe WS helpers into shared package.

2. Publish/lock consumer contract
   - Promote daemon client package to a stable versioned contract (internal workspace version is fine if all apps consume same package).
   - Dedicated interop doc added: `docs/DAEMON-INTEROP-CONTRACT.md` with request/response/event examples and auth model.

3. Add automated cross-app protocol parity tests
   - Add CI checks proving 1D daemon + 1L/1P clients stay compatible on envelope and auth behavior.

## Go / No-Go

- **Conditional Go** for interop release readiness with current apps (1P + 1L) based on verified fixes.
- **Remaining strategic work** is SDK canonicalization to prevent future drift.
