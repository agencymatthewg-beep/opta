# Opta Init — Architecture

## Overview

The `1O-Opta-Init` project encompasses two distinct but related architectural surfaces:

1. **The Web Landing Page (`init.optalocal.com`)**: A pure static Next.js site. No server. No API. No database. Vercel CDN delivers the pre-built output globally. Its sole purpose is the Opta Initializer entry point and distribution of the Opta Init Desktop Manager.
2. **The Desktop Manager (`/desktop-manager`)**: A native Tauri application built with React + Vite on the frontend and Rust on the backend. It serves as the local orchestration engine (the "Core Cluster") for all Opta apps.

---

## 1. Web Landing Page Architecture

### Data Flow

```text
User hits init.optalocal.com
        |
Cloudflare DNS resolves init CNAME -> cname.vercel-dns.com
        |
Vercel serves static HTML/CSS/JS from CDN edge
        |
Browser renders page (no hydration needed for content)
        |
User clicks "Download Manager" -> triggers download of the Tauri .dmg/.exe
```

### Page Structure (Single Page)

```text
/ (page.tsx)
  ├── Header                — Logo + nav anchors
  ├── Hero                  — Core value prop + CTA
  ├── CLI Showcase          — Productized visual terminal panels
  ├── Install Section       — Bootstrap command + prerequisites
  ├── Layered Architecture  — Control Topology cards
  ├── Features Grid         — Capability cards
  ├── Downloads             — Manager packages exclusively
  └── Dashboard CTA         — Links to web platform
```

### Rendering & Deployment Strategy

- `output: 'export'` in `next.config.ts` — full static export.
- All content server-rendered at build time.
- Vercel deploys `out/` directory to the edge.

---

## 2. Desktop Manager Architecture (Tauri)

### Overview
The Desktop Manager is the actual runtime engine users install via `opta init` to manage their stack. It utilizes a visually rich "Core Cluster" layout with raw SVG icons, physics-based floating animations, and a centralized status bar.

### Backend (Rust / Tauri Core)
- **Manifest Fetching**: Pulls down `.json` release manifests from `init.optalocal.com/desktop/*`.
- **Command Orchestration**: Executes native OS commands (`open`, `explorer`, `xdg-open`) and `opta` CLI commands to launch, update, install, and verify Opta apps.
- **Daemon Control**: Manages the local `opta daemon` lifecycle (start/stop/status).

### Frontend (React / Vite)
- **App App.tsx**: The core interface containing the circular app cluster.
- **Interactivity**: Hover-based tooltips and global keyboard shortcuts (`s` for scan, `l` for launch, `u` for update, `d` for download, `v` for verify, `f` for folder).
- **Settings Modal**: Displays account linking status and exact installation paths/versions for all local apps.

### Build Pipeline

```bash
# Web Landing Page
npm run build (Next.js export)

# Desktop Manager
cd desktop-manager
npm run tauri build (Compiles Rust backend and Vite frontend into native app)
```
