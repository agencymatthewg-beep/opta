# Opta Init Desktop Manager

This is the Tauri native application for Opta Init. It serves as the "Core Cluster" dashboard for managing the entire Opta Local stack on macOS and Windows. 

> **Note on Architecture:** This desktop application is distributed via the web landing page located at the root of `1O-Opta-Init`. The website (`init.optalocal.com`) serves as the marketing and download portal, while this `desktop-manager` directory contains the actual Rust/Tauri source code for the tool users install.

## Features

- **Core Cluster UI**: Visually orchestrates Opta apps (LMX, CLI, Code, Accounts, Status, Learn, Help) using an immersive SVG-based radial interface.
- **Manifest-driven App Catalog**: Reads from `stable` / `beta` channels.
- **System Actions**:
  - `fetch_manifest`
  - `list_installed_apps` (best-effort from Opta CLI + filesystem scan)
  - `install_app`
  - `update_app`
  - `launch_app`
  - `verify_app`
  - `open_app_folder`
- **Daemon Control**: Directly interfaces with the local `opta daemon` (start, stop, status).

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
- Source channel manifests are synced to `public/desktop/*` via:
  - `npm run sync:desktop-manifests` in the parent directory.
