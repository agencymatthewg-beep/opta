# 1O-Opta-Init

Canonical path: `1-Apps/optalocal/1O-Opta-Init`

## Purpose
Opta Init is the core entry point and lifecycle manager for the Opta Local stack. It consists of two tightly coupled components:

1. **Opta Init Web Landing Page** (`/app`, `/lib`, `/public`): A highly optimized, statically exported Next.js website deployed to `init.optalocal.com`. It serves strictly as the download and discovery portal for the desktop manager.
2. **Opta Init Desktop Manager** (`/desktop-manager`): A Tauri-based native application that acts as the "Core Cluster" for your local AI stack. It orchestrates downloading, updating, verifying, launching, and managing the daemon for all Opta Local apps (LMX, CLI, Code, Accounts, Status, Learn, Help).

## Architecture & Relationship

- The **Web Landing Page** (`init.optalocal.com`) is the distribution mechanism. It restricts downloads exclusively to the Opta Init Manager.
- The **Desktop Manager** (Tauri app) is the actual orchestration tool that users install on their machines. It reads release manifests published by the web layer and executes native terminal commands to manage the other applications.
- **Shared Code**: They share aesthetic principles and the core `React` component structures (e.g., the `OptaRing` or unified layouts) but act as entirely separate build targets. The web app builds via Next.js for Vercel, and the desktop manager builds via Vite/Tauri for macOS/Windows.

## Key relations
- Feeds consistent structure into the Opta app ecosystem.
- Orchestrates the lifecycle of `1D-Opta-CLI-TS` and `1M-Opta-LMX`.
- Serves as the primary onboarding funnel for operators.
- Should follow canonical path contract from `1-Apps/PATH-CONTRACT.md`.

## Location + File Contract

For the exact location split, required files, and purpose boundaries between the website and desktop app, see:

- `docs/COMPONENT-LOCATION-CONTRACT.md`
