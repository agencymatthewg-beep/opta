# Opta Init — Component Location Contract

Last verified: 2026-03-02

## Canonical Location

- Canonical source path: `1-Apps/optalocal/1O-Opta-Init`
- Compatibility alias: `1-Apps/1O-Opta-Init -> ./optalocal/1O-Opta-Init`
- Rule: all active work happens in the canonical path under `optalocal/`.

## Component A — Website (init.optalocal.com)

### Purpose

Static onboarding and download website for Opta Local. It explains value, setup, architecture, and distributes desktop manager installers.

### Required Location

- Project root (`1O-Opta-Init/`) with Next.js app-router structure.

### Required Files

- `app/page.tsx` — homepage composition
- `app/layout.tsx` — app shell
- `app/globals.css` — global styles and tokens
- `components/OptaRing.tsx` — shared hero/download visual component
- `lib/download-artifacts.ts` — installer metadata for download UI
- `channels/stable.json` and `channels/beta.json` — release channel metadata
- `next.config.ts` — static export configuration
- `vercel.json` — deploy + routing config
- `package.json` — website build/dev scripts

## Component B — Desktop App (Opta Init Desktop Manager)

### Purpose

Native Tauri manager used after installation. It orchestrates install/update/launch/verify flows for Opta Local apps and controls daemon lifecycle.

### Required Location

- `1O-Opta-Init/desktop-manager/`

### Required Files

- `desktop-manager/src/App.tsx` — primary desktop UI
- `desktop-manager/src/main.tsx` — React entrypoint
- `desktop-manager/src/types.ts` — shared app types
- `desktop-manager/src-tauri/src/main.rs` — Tauri command/backend entrypoint
- `desktop-manager/src-tauri/Cargo.toml` — Rust crate definition
- `desktop-manager/src-tauri/tauri.conf.json` — native bundle/runtime config
- `desktop-manager/package.json` — desktop build/dev scripts

## Boundary Rules

- Website code stays at root (`app/`, `lib/`, `public/`, `channels/`), not inside `desktop-manager/`.
- Native app code stays in `desktop-manager/`, not mixed into the root Next.js app tree.
- `desktop-manager` binaries/installers are distributed by the website; the website itself is not the desktop manager runtime.

## Verification Snapshot (2026-03-02)

- Confirmed canonical path and alias symlink are correct.
- Confirmed a single `desktop-manager/` source tree exists under `1O-Opta-Init/`.
- Confirmed required website files and required desktop manager files listed above are present.
