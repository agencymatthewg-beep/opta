# Technology Stack

*Last updated: 2025-01-29*

## Languages

**Primary:**
- TypeScript 5.3-5.8 - All application code (desktop, web)
- Swift 5.x - iOS/macOS native apps
- Rust 2021 Edition - Core engine, desktop backend, shared libraries

**Secondary:**
- Python 3.10+ - MCP server, AI/ML integration
- JavaScript - Build scripts, configuration

## Runtime Environment

| Platform | Runtime | Version |
|----------|---------|---------|
| Web | Node.js | 22.x (`apps/web/opta-life-manager/.nvmrc`) |
| Desktop | Tauri v2 WebView | WebKit (macOS) |
| Desktop Backend | Rust | 2021 edition, aarch64-apple-darwin |
| iOS | SwiftUI | iOS 17+ |
| Python | UV | 3.10+ |

**Rust Toolchain:**
- Target: `aarch64-apple-darwin` (Apple Silicon)
- Features: `+neon` (ARM SIMD)
- Deployment: macOS 12.0+
- Config: `apps/desktop/opta-native/src-tauri/.cargo/config.toml`

## Package Managers

| Manager | Scope | Lock File |
|---------|-------|-----------|
| npm | Desktop, Web apps | `package-lock.json` |
| pnpm 9.0.0 | iOS monorepo | `pnpm-lock.yaml` |
| Cargo | Rust crates | `Cargo.lock` |
| UV | Python MCP server | `uv.lock` |

## Frameworks

### Frontend UI

| Framework | Version | Location |
|-----------|---------|----------|
| React | 19.1-19.2 | Desktop, Web apps |
| Next.js | 15.5-16.1 | `apps/web/opta-life-manager/`, `apps/web/AICompare/` |
| SwiftUI | 5.x | `apps/ios/opta/`, `apps/desktop/opta-mini/` |
| Vite | 7.0.4 | `apps/desktop/opta-native/vite.config.ts` |
| Tailwind CSS | 3.4-4.x | All TypeScript apps |

### Backend

| Framework | Version | Location |
|-----------|---------|----------|
| Tauri | v2 | `apps/desktop/opta-native/src-tauri/` |
| Turbo | 2.0.0 | `apps/ios/opta/package.json` |
| Crux | 0.8 | `apps/shared/opta-native/` (Elm architecture) |

### UI Components

- **Radix UI** - Dialog, Dropdown, Select, Tooltip, Progress, Scroll Area
- **Framer Motion** 12.x - Animation (MANDATORY per DESIGN_SYSTEM.md)
- **Lucide React** 0.56x - Icons (MANDATORY per DESIGN_SYSTEM.md)
- **@dnd-kit** - Drag and drop
- **CVA** 0.7.1 - Component variants

### 3D Graphics

- **Three.js** 0.182.0 - `apps/desktop/opta-native/`
- **React Three Fiber** 9.5.0
- **@react-three/drei** 10.7.7
- **wgpu** 24.0 - Rust GPU rendering (Metal backend)

## Key Dependencies

### Desktop App (`apps/desktop/opta-native/package.json`)

```
@tauri-apps/api@2.3.2           # Desktop integration
framer-motion@12.29.2           # Animation (required)
lucide-react@0.563              # Icons (required)
@radix-ui/*@1.1-2.2             # UI primitives
three@0.182.0                   # 3D rendering
@dnd-kit/*@6.3-10.0             # Drag-drop
chess.js@1.4.0                  # Chess logic
stockfish@17.1.0                # Chess engine (WASM)
zod@4.3.5                       # Schema validation
@google/generative-ai@0.24.1    # Gemini API
```

### Web App (`apps/web/opta-life-manager/package.json`)

```
next@15.5.9                     # Framework
react@18.3.1                    # UI library
next-auth@5.0.0-beta.30         # Authentication
@studio-freight/react-lenis     # Smooth scroll
```

### Shared Rust (`apps/shared/opta-native/Cargo.toml`)

```
crux_core@0.8                   # Elm architecture
crux_http@0.9                   # HTTP capabilities
uniffi@0.28                     # Swift/Kotlin FFI
wgpu@24.0                       # GPU rendering
tokio@1.36                      # Async runtime
rusqlite@0.31                   # SQLite (bundled)
serde@1.0                       # Serialization
```

## Configuration

### TypeScript

| Config | Target | Key Settings |
|--------|--------|--------------|
| `apps/desktop/opta-native/tsconfig.json` | ES2020 | React JSX, strict mode, path aliases |
| `apps/web/opta-life-manager/tsconfig.json` | ES2017 | Bundler resolution, Next.js plugins |
| `apps/web/AICompare/tsconfig.json` | ES2017 | ESNext modules |

### Build Tools

- **Vite** - Desktop bundling with chunk splitting
- **Next.js** - Web app builds (App Router)
- **Cargo** - Rust workspace builds with LTO

### Environment Variables

| Location | Purpose |
|----------|---------|
| `apps/web/opta-life-manager/.env.local` | API keys, OAuth secrets |
| `apps/ios/opta/.env.example` | Template for iOS config |
| Vercel Dashboard | Production secrets |

## Platform Requirements

| Platform | Minimum Version |
|----------|-----------------|
| macOS | 12.0+ (Monterey) |
| iOS | 17.0+ |
| Node.js | 22.x |
| Rust | 2021 Edition |
| Python | 3.10+ |
