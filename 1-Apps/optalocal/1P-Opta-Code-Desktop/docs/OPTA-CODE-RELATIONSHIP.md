# Opta Code ↔ Opta CLI Relationship

## Naming
- Product name: **Opta Code** (formerly “Opta Codex”).
- Desktop surface label: **Opta Code Desktop**.

## Canonical Source Location
- Source of truth: `1-Apps/optalocal/1P-Opta-Code-Desktop`
- Compatibility alias path: `1-Apps/1P-Opta-Code-Desktop` (symlink to canonical domain path). Legacy Codex aliases removed and archived.

## Architecture Boundary
- **Opta CLI** = execution/runtime layer
  - daemon runtime
  - session orchestration
  - tool + permission handling
  - LMX integration and fallbacks
- **Opta Code Desktop** = UX/operator layer
  - connects to CLI daemon over `/v3/*` HTTP APIs
  - visual timeline, session controls, model controls

## Dependency Direction (must stay this way)
1. Opta Code Desktop → Opta CLI daemon APIs
2. Opta CLI daemon → Opta LMX
3. Opta LMX → local model/cache layer

Desktop must not bypass daemon for privileged actions.

## Why separate products
- Opta CLI can run headless/server contexts.
- Opta Code Desktop provides high-productivity UI without redefining runtime logic.
- Shared runtime keeps policy, safety, and behavior consistent across interfaces.

## Roadmap guardrails
- Keep runtime logic in CLI daemon, not in desktop app.
- Expose new features through daemon API first, then desktop UI.
- Treat desktop as a client of CLI, never a parallel runtime.

## Import Contract (Desktop → Daemon Client)
- Desktop consumes daemon APIs via `@opta/daemon-client` package exports and explicit subpath imports.
- Use:
  - `@opta/daemon-client/http-client`
  - `@opta/daemon-client/types`
- Do **not** derive subpaths from `@opta/daemon-client` root alias (this can produce invalid resolutions like `index.ts/http-client`).
- Vite aliases and TypeScript paths must map daemon-client subpaths directly to files under `1D-Opta-CLI-TS/packages/daemon-client/src/*`.
