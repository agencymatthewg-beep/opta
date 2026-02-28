# 1P-Opta-Code-Desktop

Canonical path: `1-Apps/optalocal/1P-Opta-Code-Desktop`

## Purpose

Opta Code Desktop — a native desktop wrapper around the Opta Code web UI, built with **Tauri v2** and **Vite + TypeScript**. It connects to the Opta CLI daemon (`opta daemon start`) over HTTP/WebSocket to stream AI coding sessions in real time.

## Boundary

- Consumes Opta CLI daemon APIs. Does not reimplement runtime orchestration.
- Multi-platform: macOS (`.app` / `.dmg`), Windows (`.msi` / `.exe` NSIS).
- The Rust shell (`src-tauri/`) is intentionally minimal — native OS access added via Tauri commands only when required.

---

## Development

### Prerequisites

- Node.js 22+
- Rust stable (for Tauri): `rustup toolchain install stable`
- Tauri CLI: `cargo install tauri-cli --version "^2"`

### Run (web dev server only)

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
```

### Run (full Tauri desktop app)

```bash
npm run tauri dev    # Spawns Vite + wraps in native window
```

### Build

```bash
npm run build        # Vite production build → dist/
npm run tauri build  # Tauri bundle → src-tauri/target/release/bundle/
```

Tauri outputs:
- **macOS**: `bundle/macos/Opta Code.app` + `bundle/dmg/*.dmg`
- **Windows**: `bundle/msi/*.msi` + `bundle/nsis/*.exe`

---

## Windows Build (CI)

The GitHub Actions workflow `.github/workflows/opta-code-windows-build.yml` runs on every push to `main` that touches this directory:

1. **Unit tests** (Linux, fast) — TypeScript type-check + Vitest
2. **Windows installer** (`windows-latest`) — Tauri v2 MSI + NSIS via `tauri-apps/tauri-action`
3. **Smoke test** (main-only) — verifies installer artifact exists

Artifacts are uploaded as `opta-code-windows-installer` and retained for 30 days.

### Build locally on Windows

```powershell
npm ci
npm run build
npx tauri build --target x86_64-pc-windows-msvc
```

---

## Architecture

```
src/                  Vite + React frontend
src-tauri/            Tauri v2 Rust shell
  src/main.rs         Binary entry point
  src/lib.rs          Library (tauri::Builder setup)
  Cargo.toml          Rust package (tauri v2, tauri-plugin-opener)
  tauri.conf.json     Window config, bundle targets, CSP
```

## Daemon Connection

The frontend connects to the Opta CLI daemon at `http://127.0.0.1:9999` by default. Start the daemon before launching the desktop app:

```bash
cd ../1D-Opta-CLI-TS
npm run dev -- daemon start
```
