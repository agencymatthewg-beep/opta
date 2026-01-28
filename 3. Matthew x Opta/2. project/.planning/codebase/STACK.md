# Technology Stack

**Analysis Date:** 2026-01-28

## Languages

**Primary:**
- TypeScript 5.3-5.8 - All web/desktop application code (`Opta MacOS/tsconfig.json`, `opta-life-manager/package.json`)
- Rust 2021 edition - Native core, GPU rendering, system integration (`opta-native/Cargo.toml`, `Opta MacOS/src-tauri/Cargo.toml`)
- Swift 5.x - iOS native apps and macOS SwiftUI components (`Opta MacOS/OptaNative/`, `opta-native/OptaApp/`)

**Secondary:**
- Python 3.x - Hardware telemetry scripts (`Opta MacOS/scripts/requirements.txt`)
- JavaScript - Config files, build scripts

## Runtime

**Environment:**
- Node.js 20-22.x (`opta-life-manager/.nvmrc`, `Opta iOS/package.json`)
- Rust toolchain - Apple Silicon optimized (aarch64-apple-darwin)
- WebView2/WebKit - Tauri runtime for desktop

**Package Manager:**
- pnpm 9.0.0 - Opta iOS monorepo workspace
- npm - opta-life-manager, Opta MacOS
- Cargo - Rust dependency management
- Lockfiles: `package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock` present

## Frameworks

**Core:**
- Tauri v2 - Desktop application framework (`Opta MacOS/src-tauri/tauri.conf.json`)
- React 19.1.0 - Frontend UI (`Opta MacOS/package.json`, `opta-life-manager/package.json`)
- Next.js 15.5.9 - Web app with App Router (`opta-life-manager/package.json`)
- Crux 0.8 - Elm Architecture for Rust (`opta-native/Cargo.toml`)
- SwiftUI - Native macOS/iOS UI framework

**Testing:**
- TypeScript strict mode - Primary validation (no explicit test framework)
- Design system compliance - DESIGN_SYSTEM.md as quality gate

**Build/Dev:**
- Vite 7.0.4 - Desktop app bundling (`Opta MacOS/vite.config.ts`)
- Turbo - Monorepo task orchestration (`Opta iOS/`)
- Expo 51.0.0 - React Native development (`Opta iOS/apps/mobile/`)
- wgpu 24.0 - GPU abstraction with Metal backend

## Key Dependencies

**Critical:**
- Crux (crux_core 0.8, crux_http 0.9) - Cross-platform Elm architecture (`opta-native/Cargo.toml`)
- UniFFI 0.28 - Rust-Swift FFI bindings (`opta-native/Cargo.toml`)
- next-auth 5.0.0-beta.30 - Authentication (`opta-life-manager/auth.ts`)
- wgpu 24.0 - GPU rendering with Metal backend (`opta-native/opta-render/Cargo.toml`)

**UI & Animation:**
- Framer Motion 12.29.0 - React animations (`Opta MacOS/package.json`)
- Radix UI - Accessible component primitives (Dialog, Dropdown, Progress, Tooltip)
- Three.js 0.182.0 + React Three Fiber 9.5.0 - 3D graphics
- Tailwind CSS 3.4-4.x - Utility-first styling
- Lucide React 0.562.0 - Icon library

**Infrastructure:**
- tokio 1.36 - Async Rust runtime (`opta-native/Cargo.toml`)
- rusqlite 0.31 - SQLite with bundled bindings
- macOS IOKit - Hardware telemetry (core-foundation, io-kit-sys, mach2)

**Gaming/AI:**
- chess.js 1.4.0 + react-chessboard 5.8.6 - Chess functionality
- stockfish 17.1.0 - Chess engine WASM
- @google/generative-ai 0.24.1 - Gemini AI client

## Configuration

**Environment:**
- `.env` files for API keys (TODOIST_API_TOKEN, ANTHROPIC_API_KEY, OPENAI_API_KEY)
- `.env.example` templates in `opta-life-manager/`, `Opta iOS/`
- Google OAuth configured via next-auth (`opta-life-manager/auth.ts`)

**Build:**
- `Opta MacOS/tsconfig.json` - ES2020 target, bundler resolution, path aliases (@/)
- `Opta MacOS/vite.config.ts` - 2000KB chunk limit, vendor splitting
- `Opta MacOS/src-tauri/tauri.conf.json` - macOS entitlements, DMG bundling
- `opta-life-manager/next.config.ts` - Edge runtime ready

## Platform Requirements

**Development:**
- macOS (primary development platform)
- Node.js 20+, Rust toolchain, Xcode
- Optional: Docker for isolated testing

**Production:**
- Opta MacOS: Distributed as DMG/App bundle (App Store ready)
- opta-life-manager: Vercel deployment
- Opta iOS: Native iOS app via App Store
- opta-native: Compiled library via UniFFI

---

*Stack analysis: 2026-01-28*
*Update after major dependency changes*
