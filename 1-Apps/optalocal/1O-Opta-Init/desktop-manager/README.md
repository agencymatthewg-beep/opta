# Opta Init Desktop Manager

Tauri desktop scaffold for managing Opta Init apps on macOS and Windows.

## Features

- Manifest-driven app catalog (`stable` / `beta` channels)
- App actions via Tauri commands:
  - `fetch_manifest`
  - `list_installed_apps` (best-effort from Opta CLI + filesystem scan)
  - `install_app`
  - `update_app`
  - `launch_app`
  - `daemon_status`
  - `daemon_start`
  - `daemon_stop`
  - `open_url`
- Dark desktop UI with:
  - Left rail links (Init site, LMX, Accounts, Docs)
  - App cards (install/update/launch)
  - Daemon control card

## Prerequisites

- Node.js 18+
- Rust toolchain (stable)
- Platform build prerequisites for Tauri

## Run (dev)

```bash
cd desktop-manager
npm install
npm run tauri dev
```

## Typecheck / Build

```bash
cd desktop-manager
npm run typecheck
npm run build
```

## Rust Check

```bash
cd desktop-manager/src-tauri
cargo check
```

## Notes

- Install/update/launch and daemon lifecycle are executed through best-effort CLI wrappers around `opta` commands.
- If `opta` is missing from `PATH`, commands return clear errors and the UI surfaces those messages.
- Manager fetches channel manifests from:
  - `https://init.optalocal.com/desktop/manifest-stable.json`
  - `https://init.optalocal.com/desktop/manifest-beta.json`
- Optional override for staging/dev:
  - set `OPTA_INIT_MANIFEST_BASE_URL` (for example `http://localhost:3000`) to resolve manifests from `<base>/desktop/manifest-*.json`
- Source channel manifests are synced to `public/desktop/*` via:
  - `npm run sync:desktop-manifests`
- Manifest fetch falls back to an embedded manifest if remote fetch/parsing fails.
