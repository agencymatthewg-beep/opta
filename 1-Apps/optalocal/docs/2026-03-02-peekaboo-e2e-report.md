# Opta Local E2E Report (Peekaboo)

Date: 2026-03-02
Operator: Codex autonomous run
Workspace: <optalocal-root>

## Scope
- `1D-Opta-CLI-TS`
- `1M-Opta-LMX`
- `1O-Opta-Init`
- `1P-Opta-Code-Universal`
- `1R-Opta-Accounts`
- `1S-Opta-Status`
- `1T-Opta-Home`
- `1U-Opta-Help`
- `1V-Opta-Learn`

## Baseline Quality Gate
Executed:
- `npm run apps:verify`
- `npm run check:all`

Result:
- Registry verification passed (9 apps).
- Full cross-app check suite passed.

## Runtime Stabilization During E2E
Two runtime issues were discovered and handled live:

1. Turbopack cache corruption on synced filesystem in dev mode
- Symptoms: intermittent hangs/500s on `:3000` and `:3006`, ENOENT + Turbopack panic logs referencing `out/dev/*.sst` and missing build manifests.
- Mitigation: switched Next.js apps from `dev` to production `start` paths for deterministic runtime testing.

2. `1V-Opta-Learn` unresponsive dev server
- Symptoms: accepted TCP on `:3007` but no HTTP response (high CPU).
- Mitigation: removed stale Syncthing conflict files:
  - `app/page.sync-conflict-20260302-022156-3XDMW37.tsx`
  - `content/guides/index.sync-conflict-20260302-035928-3XDMW37.ts`
- Verification: `npm run check` passes for `1V-Opta-Learn` after cleanup.

## Endpoint Results
Local stack health:
- `http://localhost:1234/healthz` -> `200`
- `http://localhost:1234/readyz` -> `503` (no local model loaded)
- `http://localhost:3000` -> `200`
- `http://localhost:3001` -> `200`
- `http://localhost:3002` -> `307` (expected auth redirect)
- `http://localhost:3005` -> `200`
- `http://localhost:3006` -> `200`
- `http://localhost:3007` -> `200`
- `http://localhost:5173` -> `200`

Primary LMX Host (dedicated Apple Silicon host) verification from MacBook control plane:
- `http://lmx-host.local:1234/healthz` -> `200`
- `http://lmx-host.local:1234/readyz` -> `503` (`no models loaded`)
- `http://lmx-host.local:1234/v1/models` -> embedding model only
- CLI check against Primary LMX Host:
  - `OPTA_HOST=lmx-host.local OPTA_PORT=1234 node dist/index.js status --json`
  - Confirmed device identity: `Primary LMX Host`, `Apple M3 Ultra`, `512GB RAM`.
  - Confirmed `models: []` for inference path (not chat-ready yet).

## Peekaboo E2E Evidence
Automation method:
- `peekaboo app launch Safari --open <url> --wait-until-ready`
- `peekaboo image --mode frontmost --path <artifact>`

Artifacts:
- `<optalocal-root>/.e2e-artifacts/home-safari.png`
- `<optalocal-root>/.e2e-artifacts/init-safari.png`
- `<optalocal-root>/.e2e-artifacts/accounts-safari.png`
- `<optalocal-root>/.e2e-artifacts/status-safari.png`
- `<optalocal-root>/.e2e-artifacts/help-safari.png`
- `<optalocal-root>/.e2e-artifacts/learn-safari.png`
- `<optalocal-root>/.e2e-artifacts/code-safari.png`
- `<optalocal-root>/.e2e-artifacts/lmx-health-safari.png`
- `<optalocal-root>/.e2e-artifacts/lmx-ready-safari.png`

All Safari-driven `peekaboo app launch ... --open` calls succeeded for the full URL matrix.

## Interactive E2E (Accessibility-enabled)
- Accessibility permission is now granted for Peekaboo.
- Executed keyboard-driven interactions across all pages with successful action responses:
  - Home (`pagedown`)
  - Init (`pagedown`)
  - Accounts (`tab x2`)
  - Status (`end`, `home`)
  - Help (`pagedown`)
  - Learn (`pagedown`, `pageup`)
  - Code (`tab x3`)
- Artifacts:
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/home.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/init.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/accounts.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/status.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/help.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/learn.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/code.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/lmx-health.png`
  - `<optalocal-root>/.e2e-artifacts/interactive3-live/lmx-ready.png`

## Remaining Constraint
- Primary LMX Host model provisioning is blocked by remote filesystem permissions.
- Attempted from MacBook control plane:
  - `opta models download mlx-community/Qwen2.5-0.5B-Instruct-4bit --device lmx-host.local:1234`
  - Failure: `Permission denied: /Users/Shared/LMX-Models/gguf/opta-lmx-models/...`
- This prevents automatic loading of an inference model on Primary LMX Host from this session.

## Conclusion
- Opta Local ecosystem runtime endpoints are operational across all local apps.
- Critical runtime instability uncovered during dev-mode testing was mitigated for reliable operation.
- MacBook is validated as control/coding plane.
- Primary LMX Host is reachable and admin-accessible, but not inference-ready until model directory permissions are corrected and at least one inference model is downloaded/loaded.
