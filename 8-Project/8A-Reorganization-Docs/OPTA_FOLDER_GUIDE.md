# 📚 OPTA PROJECT - COMPLETE FOLDER GUIDE

**Last Updated:** 2026-01-28
**Version:** 2.0 (Post-Restructure)

This guide explains the purpose, contents, and technical details of every folder in the Opta project. Use this as your reference when navigating the codebase.

---

## 🗂️ Top-Level Structure

```
/Opta/
├── 1. Apps/
├── 2. Gemini Deep Research/
└── 3. Matthew x Opta/
```

---

# 1️⃣ APPS

**Path:** `/Opta/1. Apps/`

**Purpose:** Contains all user-facing applications across iOS, Desktop, and Web platforms, plus shared infrastructure used by multiple apps.

**Who Uses It:** Developers, End Users, Build Systems

**Structure:**
```
1. Apps/
├── 1. iOS/
├── 2. Desktop/
├── 3. Web/
└── 4. Shared/
```

---

## 1.1 iOS Apps

**Path:** `/Opta/1. Apps/1. iOS/`

**Purpose:** Native iOS applications built with SwiftUI and React Native.

**Platform:** iOS 17+

**Structure:**
```
1. iOS/
├── 1. Opta/
├── 2. Opta Scan/
└── 3. Opta LM iOS/
```

---

### 1.1.1 Opta (Main iOS App)

**Path:** `/Opta/1. Apps/1. iOS/1. Opta/`

**Purpose:** Primary Opta mobile application - AI-powered visual scanner that analyzes photos and provides optimized recommendations.

**Tech Stack:**
- **Framework:** React Native (Expo SDK)
- **Languages:** TypeScript, JavaScript
- **Monorepo:** PNPM Workspaces + Turborepo
- **State:** Zustand, React Query
- **Backend:** Hono.js (Node.js)

**Key Files:**
- `apps/mobile/` - Main React Native app
- `packages/api/` - Hono backend for AI vision processing
- `packages/shared/` - Shared TypeScript code
- `turbo.json` - Turborepo build orchestration
- `pnpm-workspace.yaml` - PNPM workspace config

**Who Uses It:**
- End Users (iOS/Android via Expo)
- Developers
- Build Systems (Expo EAS, App Store Connect)

**Dependencies:**
- External: OpenAI Vision API, Claude API
- Internal: None (standalone app)

**Build/Deploy:**
```bash
cd "1. Apps/1. iOS/1. Opta"
pnpm install
pnpm build
# Deploy via Expo EAS
```

---

### 1.1.2 Opta Scan

**Path:** `/Opta/1. Apps/1. iOS/2. Opta Scan/`

**Purpose:** Specialized iOS feature app for photo scanning and optimization analysis (may be integrated into main Opta app or standalone).

**Tech Stack:**
- **Language:** Swift 5.9+
- **UI:** SwiftUI
- **Project:** Xcode 15+

**Key Files:**
- `Opta Scan.xcodeproj` - Xcode project
- `Design/` - SwiftUI design system (20+ files)
  - `OptaDesignSystem.swift` - Core design tokens
  - `OptaAnimations.swift` - Animation system
  - `GlassModifiers.swift` - Glass morphism effects
  - `OptaHaptics.swift` - Haptic feedback

**Who Uses It:**
- End Users (iOS)
- iOS Developers

**Dependencies:**
- Internal: May use `1. Apps/4. Shared/1. opta-native/` Rust core via UniFFI
- External: CoreML, Vision framework

**Build/Deploy:**
- Open in Xcode, build for iOS 17+
- Deploy via App Store Connect

---

### 1.1.3 Opta LM iOS

**Path:** `/Opta/1. Apps/1. iOS/3. Opta LM iOS/`

**Purpose:** Native iOS client for Opta Life Manager - personal productivity dashboard with Google service integrations.

**Tech Stack:**
- **Language:** Swift 5.9+
- **UI:** SwiftUI
- **Project Gen:** XcodeGen (`project.yml`)
- **Auth:** Google Sign-In for iOS

**Key Files:**
- `project.yml` - XcodeGen project definition
- `OptaLMiOS/` - Swift source code
- `Widgets/` - iOS Home Screen Widgets
- `Intents/` - Siri Shortcuts integration
- `GoogleService.xcconfig` - Google services config

**Who Uses It:**
- End Users (iOS)
- iOS Developers

**Dependencies:**
- Backend: Connects to `1. Apps/3. Web/1. Opta Life Manager/` API
- External: Google Sign-In, Firebase (optional)

**Build/Deploy:**
```bash
cd "1. Apps/1. iOS/3. Opta LM iOS"
xcodegen generate
# Open .xcodeproj in Xcode
```

---

## 1.2 Desktop Apps

**Path:** `/Opta/1. Apps/2. Desktop/`

**Purpose:** Native desktop applications for macOS, Windows, and Linux.

**Platform:** macOS 12+, Windows 10+, Linux

**Structure:**
```
2. Desktop/
├── 1. Opta Native/
└── 2. Opta Mini/
```

---

### 1.2.1 Opta Native

**Path:** `/Opta/1. Apps/2. Desktop/1. Opta Native/`

**Purpose:** Flagship desktop application - AI-powered PC optimization orchestrator that unifies and manages optimization tools for gamers and power users.

**Tech Stack:**
- **Framework:** Tauri v2 (Rust + Web)
- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS (Obsidian Standard v2.0)
- **3D Graphics:** React Three Fiber (`@react-three/fiber`)
- **Animations:** Framer Motion
- **Backend:** Rust (Tokio async runtime)

**Key Files:**
- `src/` - React frontend source
- `src-tauri/` - Rust backend source
- `DESIGN_SYSTEM.md` - Complete design specification ("Living Artifact" philosophy)
- `CLAUDE.md` - Project instructions for AI agents
- `tauri.conf.json` - Tauri app configuration
- `justfile` - Build automation commands
- `package.json` - npm dependencies
- `Cargo.toml` - Rust dependencies (in `src-tauri/`)

**Who Uses It:**
- End Users (macOS, future Windows/Linux)
- Developers
- AI Agents (Claude, for development)

**Dependencies:**
- Internal: **CRITICAL** - Uses `1. Apps/4. Shared/1. opta-native/` Rust core
- External: Python MCP Server (in `mcp-server/`)

**Build/Deploy:**
```bash
cd "1. Apps/2. Desktop/1. Opta Native"
npm install
npm run build
npm run tauri build -- --target aarch64-apple-darwin
# Outputs .dmg to src-tauri/target/release/bundle/dmg/
```

**Design Philosophy:**
The "Obsidian Standard" design system creates a "Living Artifact" experience:
- **Core Element:** 3D Opta Ring (animated, reactive)
- **Colors:** Deep obsidian blacks, electric purples, glass morphism
- **Typography:** Sora font (Light, Regular, SemiBold, Bold)
- **Animations:** Framer Motion only, physics-based springs
- **Effects:** Glass blur, glow, particle systems

---

### 1.2.2 Opta Mini

**Path:** `/Opta/1. Apps/2. Desktop/2. Opta Mini/`

**Purpose:** Lightweight macOS menu bar utility providing quick access to Opta features without launching the full desktop app.

**Tech Stack:**
- **Language:** Swift 5.9+
- **UI:** SwiftUI
- **Type:** Menu Bar App (LSUIElement = YES)

**Key Files:**
- `OptaMini.xcodeproj` - Xcode project
- `OptaMini/OptaMiniApp.swift` - Main entry point (AppDelegate-based)
- `OptaMini/` - Swift source code

**Who Uses It:**
- End Users (macOS)
- macOS Developers

**Dependencies:**
- Internal: Likely uses `1. Apps/4. Shared/1. opta-native/` via UniFFI Swift bindings
- System: macOS 12+ APIs

**Build/Deploy:**
- Open in Xcode, build for macOS
- Distribute as standalone .app

---

## 1.3 Web Apps

**Path:** `/Opta/1. Apps/3. Web/`

**Purpose:** Web-based applications and marketing sites accessible via browser.

**Platform:** Modern browsers (Chrome, Safari, Firefox, Edge)

**Structure:**
```
3. Web/
├── 1. Opta Life Manager/
├── 2. Opta LM Edge/
└── 3. Optamize Website/
```

---

### 1.3.1 Opta Life Manager

**Path:** `/Opta/1. Apps/3. Web/1. Opta Life Manager/`

**Purpose:** Web application for personal productivity management with deep Google service integrations (Calendar, Gmail, Drive) and AI assistance via Gemini.

**Tech Stack:**
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js
- **AI:** Google Gemini API (`@google/generative-ai`)
- **APIs:** Google Calendar, Gmail, Drive
- **Animations:** Framer Motion

**Key Files:**
- `app/` - Next.js App Router pages
- `package.json` - Dependencies (80+ packages)
- `next.config.ts` - Next.js config (edge runtime)
- `wrangler.toml` - Cloudflare deployment config
- `tailwind.config.ts` - Tailwind customization

**Who Uses It:**
- End Users (Web)
- Web Developers

**Dependencies:**
- External: Google APIs, NextAuth providers
- Backend: May use Cloudflare Workers for edge functions

**Build/Deploy:**
```bash
cd "1. Apps/3. Web/1. Opta Life Manager"
npm install
npm run build
# Deploy to Vercel or Cloudflare Pages
```

**Environment Variables Required:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `GEMINI_API_KEY`

---

### 1.3.2 Opta LM Edge

**Path:** `/Opta/1. Apps/3. Web/2. Opta LM Edge/`

**Purpose:** Cloudflare Workers edge functions that provide serverless API endpoints for the Opta Life Manager web app.

**Tech Stack:**
- **Platform:** Cloudflare Workers
- **Language:** JavaScript/TypeScript
- **Framework:** Possibly Hono.js

**Key Files:**
- `wrangler.toml` - Cloudflare Workers config
- `src/` - Edge function source code

**Who Uses It:**
- Backend Systems
- `1. Apps/3. Web/1. Opta Life Manager/` (as API)

**Deploy:**
```bash
cd "1. Apps/3. Web/2. Opta LM Edge"
wrangler deploy
```

---

### 1.3.3 Optamize Website

**Path:** `/Opta/1. Apps/3. Web/3. Optamize Website/`

**Purpose:** Static marketing website for the Opta platform and Optamize brand.

**Tech Stack:**
- **Stack:** Plain HTML, CSS, JavaScript
- **Hosting:** Cloudflare Pages (inferred from `.wrangler/`)

**Key Files:**
- `index.html` - Homepage
- `styles.css` - Stylesheet
- `script.js` - Interactive elements

**Who Uses It:**
- General public (visitors, potential customers)
- Marketing team

**Deploy:**
- Push to Cloudflare Pages or any static host

---

## 1.4 Shared Infrastructure

**Path:** `/Opta/1. Apps/4. Shared/`

**Purpose:** Shared code, libraries, and assets used by multiple applications across the Opta ecosystem.

**Who Uses It:** All apps, Build Systems, Developers

**Structure:**
```
4. Shared/
├── 1. opta-native/
└── 2. design-assets/
```

---

### 1.4.1 opta-native (Rust Core)

**Path:** `/Opta/1. Apps/4. Shared/1. opta-native/`

**Purpose:** **CRITICAL INFRASTRUCTURE** - The technical heart of Opta. This Rust workspace contains shared business logic, data models, and rendering pipelines used by all native apps (iOS, macOS).

**Tech Stack:**
- **Language:** Rust 2021
- **Architecture:** Elm Architecture via Crux (`crux_core`)
- **FFI:** UniFFI 0.28 (generates Swift/Kotlin bindings)
- **Graphics:** wgpu 24.0 (Metal backend for Apple platforms)
- **Database:** Rusqlite 0.31 (embedded SQL)
- **Async:** Tokio 1.36
- **Math:** glam 0.27 (vector math for graphics)

**Workspace Members:**
- `opta-core/` - Core business logic, state management (Crux)
- `opta-shared/` - Shared types, data structures (serde, glam)
- `opta-render/` - GPU rendering pipeline (wgpu, Metal)

**Key Files:**
- `Cargo.toml` - Workspace root config
- `opta-core/Cargo.toml` - Core library dependencies
- `opta-core/src/opta.udl` - UniFFI interface definition
- `scripts/build-xcframework.sh` - Build script for iOS/macOS

**Who Uses It:**
- `1. Apps/2. Desktop/1. Opta Native/` (via Tauri Rust backend)
- `1. Apps/2. Desktop/2. Opta Mini/` (via UniFFI Swift bindings)
- `1. Apps/1. iOS/2. Opta Scan/` (via UniFFI Swift bindings)
- `1. Apps/1. iOS/3. Opta LM iOS/` (via UniFFI Swift bindings)

**Build/Deploy:**
```bash
cd "1. Apps/4. Shared/1. opta-native"

# Build Rust workspace
cargo build --release

# Generate Swift bindings + XCFramework for iOS/macOS
./scripts/build-xcframework.sh

# Output: target/xcframework/OptaCore.xcframework
```

**Architecture:**
```
┌─────────────────────────────────────────┐
│      Native Apps (Swift/Kotlin)        │
│  (Opta Mini, iOS apps, Android future) │
└────────────────┬────────────────────────┘
                 │ UniFFI Bindings
┌────────────────▼────────────────────────┐
│          opta-core (Rust)              │
│  • Crux Core (Elm Architecture)        │
│  • Business Logic                      │
│  • State Management                    │
└────────────────┬────────────────────────┘
                 │
     ┌───────────┴──────────┐
     ▼                      ▼
┌─────────────┐    ┌──────────────────┐
│opta-shared  │    │  opta-render     │
│(Data Types) │    │  (wgpu/Metal)    │
└─────────────┘    └──────────────────┘
```

---

### 1.4.2 design-assets

**Path:** `/Opta/1. Apps/4. Shared/2. design-assets/`

**Purpose:** Centralized repository for brand assets, logos, icons, animation frames, and design specifications used across all apps.

**Contents:**
- `logos/` - Official Opta logos (SVG, PNG at various sizes)
  - `opta_lm_logo_v5.png`
  - `opta_mac_logo_v2.png`
  - `opta_mini_logo_v3.png`
  - `opta_scan_logo_v4.png`
- `icons/` - App icons for each platform
- `animation-frames/` - Frame sequences for Opta Ring animations
- `design-specs/` - Technical specifications
  - `OPTA_RING_SPECIFICATION.md`
  - `OPTA_TYPOGRAPHY_SPECIFICATION.md`
- `research/` - Design exploration documents
  - `gu-brand-atmosphere.html`
  - `gu-energy-equator.html`
  - `gu-opta-ring-design.html`
  - `gu-power-stone-ring.html`

**Who Uses It:**
- All app developers
- Designers
- Marketing
- Build systems (for app icon generation)

**Usage:**
```bash
# Copy logo to iOS app
cp "1. Apps/4. Shared/2. design-assets/logos/opta_scan_logo_v4.png" \
   "1. Apps/1. iOS/2. Opta Scan/Assets.xcassets/AppIcon.appiconset/"

# Reference in web app
<img src="/assets/logos/opta_lm_logo_v5.png" alt="Opta LM" />
```

---

# 2️⃣ GEMINI DEEP RESEARCH

**Path:** `/Opta/2. Gemini Deep Research/`

**Purpose:** Knowledge base containing research documents, competitive analysis, technical explorations, and strategic insights generated via Google Gemini for building successful AI applications.

**Who Uses It:**
- Matthew Byrden
- Developers (for reference)
- AI Agents (for context)

**Contents:**
- Research reports on AI app development strategies
- Competitive analysis of other AI products
- Technical deep dives into specific technologies
- Market trends and user behavior analysis
- Platform-specific best practices (iOS, macOS, Web)

**File Format:** Primarily HTML exports from Gemini research sessions

**Usage:**
- Reference during product planning
- Inform architectural decisions
- Understand competitive landscape
- Guide feature prioritization

**Example Files:**
- `ai-app-monetization-strategies.html`
- `cross-platform-rust-architecture.html`
- `gemini-vs-claude-comparison.html`

---

# 3️⃣ MATTHEW X OPTA

**Path:** `/Opta/3. Matthew x Opta/`

**Purpose:** Personal context, project management, and AI agent configuration specific to Matthew Byrden's development workflow and the Opta project vision.

**Who Uses It:**
- Matthew Byrden
- AI Agents (Claude, Serena)
- Build Systems (for MCP servers)

**Structure:**
```
3. Matthew x Opta/
├── 1. personal/
├── 2. project/
└── 3. agent-config/
```

---

## 3.1 personal

**Path:** `/Opta/3. Matthew x Opta/1. personal/`

**Purpose:** Matthew's personal context including calendar, hardware ecosystem, workflows, and goals. Used by AI agents to provide context-aware assistance.

**Key Files:**
- `calendar.md` - **READ AT SESSION START** - Events, deadlines, subscriptions
- `hardware.md` - Device ecosystem (Mac Studio, MacBook Pro, Gaming PC, Server)
- `workflows.md` - Device roles, Syncthing setup, cross-device patterns
- `goals.md` - Current priorities and focus areas
- `profile.md` - Preferences, communication style, working patterns

**Who Uses It:**
- Claude (opta-optimizer agent)
- Serena (MCP agent)
- Matthew (reference)

**Privacy:** This folder contains personal information and is excluded from public codebases.

**Usage:**
```markdown
# Session Start Protocol (from CLAUDE.md)
1. Read `3. Matthew x Opta/1. personal/calendar.md`
2. Check today's events and deadlines
3. Brief Matthew on commitments
```

---

## 3.2 project

**Path:** `/Opta/3. Matthew x Opta/2. project/`

**Purpose:** Opta project vision, personality definition, brand guidelines, and high-level planning documents.

**Key Files:**
- `opta-ai-personality.md` - Personality traits for the Opta AI assistant
- `opta-vision.md` - Long-term product vision
- `opta-brand-guidelines.md` - Brand voice, messaging, positioning
- `opta-competitive-positioning.md` - Market differentiation

**Who Uses It:**
- Developers (for product direction)
- AI Agents (to embody Opta's personality)
- Marketing (for brand consistency)

---

## 3.3 agent-config

**Path:** `/Opta/3. Matthew x Opta/3. agent-config/`

**Purpose:** Configuration files for AI agents (Claude, Serena) and development tools (MCP servers).

**Key Files:**
- `.claude/` - Claude agent configuration
  - `agents/opta-optimizer.md` - Agent behavior definition
  - `agents/opta-optimizer-training.md` - Learned patterns
  - `skills/` - Custom skills (e.g., `opta-ring-animation.md`)
- `.serena/` - Serena MCP server config
- `.mcp.json` - MCP servers configuration (Google Drive, Gmail, Calendar, YouTube, Gemini)
- `.agent/` - Other agent-specific configs

**Who Uses It:**
- AI Agents (Claude, Serena)
- Development tools
- Matthew (to customize agent behavior)

**Example `.mcp.json` structure:**
```json
{
  "mcpServers": {
    "google-drive": { "command": "npx", "args": ["-y", "@isaacphi/mcp-gdrive"] },
    "gmail": { "command": "npx", "args": ["@gongrzhe/server-gmail-autoauth-mcp"] },
    "google-calendar": { "command": "npx", "args": ["@cocal/google-calendar-mcp"] },
    "youtube": { "command": "npx", "args": ["-y", "@kirbah/mcp-youtube"] },
    "gemini": { "command": "npx", "args": ["mcp-gemini-cli", "--allow-npx"] }
  }
}
```

---

# 🗂️ ROOT-LEVEL FILES

These files remain at the Opta root for tool compatibility and industry standards:

## .github/

**Purpose:** GitHub Actions CI/CD workflows

**Key Files:**
- `workflows/build.yml` - Automated testing and builds for all platforms

## .git/

**Purpose:** Git version control metadata

**Status:** Unified repository for all apps

## Configuration Files

| File | Purpose |
|------|---------|
| `.mcp.json` | MCP servers config (moved from root to `3. Matthew x Opta/3. agent-config/`) |
| `.gitignore` | Git ignore patterns |
| `CLAUDE.md` | Root-level Claude instructions (may be replaced by app-specific files) |
| `README.md` | Project overview |

---

# 🔀 CROSS-PROJECT DEPENDENCIES

This diagram shows which apps depend on each other:

```
┌─────────────────────────────────────────────────────────────┐
│           1. Apps/4. Shared/1. opta-native/                │
│                 (Rust Core - UniFFI)                        │
└──────────────┬────────────┬───────────┬─────────────────────┘
               │            │           │
      ┌────────▼────┐  ┌────▼─────┐  ┌─▼────────────┐
      │ Opta Native │  │Opta Mini │  │iOS Apps (3)  │
      │  (Tauri)    │  │(SwiftUI) │  │  (SwiftUI)   │
      └─────────────┘  └──────────┘  └──────────────┘

┌──────────────────────────────────────────────────────────────┐
│        1. Apps/4. Shared/2. design-assets/                  │
│              (Logos, Icons, Brand)                          │
└──────────────┬──────────────┬───────────┬──────────────────┘
               │              │           │
      ┌────────▼────┐  ┌──────▼─────┐  ┌─▼───────────┐
      │  All iOS    │  │  Desktop   │  │ Web Apps (3)│
      │  Apps (3)   │  │  Apps (2)  │  │             │
      └─────────────┘  └────────────┘  └─────────────┘

┌──────────────────────────────────────────────────────────────┐
│      1. Apps/3. Web/1. Opta Life Manager/ (Backend)        │
│                 (Next.js API Routes)                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                     ┌────────▼──────────┐
                     │  Opta LM iOS      │
                     │ (Native Client)   │
                     └───────────────────┘
```

**Key Insights:**
- `opta-native` is the ONLY shared code library
- Each app category (iOS, Desktop, Web) is otherwise independent
- Design assets are shared via file copying, not dynamic imports
- No npm workspaces or cross-project imports

---

# 🚀 QUICK START GUIDE

## For New Developers

### 1. Clone the Repository
```bash
git clone https://github.com/matthewbyrden/opta.git
cd Opta
```

### 2. Choose Your App

#### Work on Desktop App:
```bash
cd "1. Apps/2. Desktop/1. Opta Native"
npm install
npm run dev
```

#### Work on iOS App (React Native):
```bash
cd "1. Apps/1. iOS/1. Opta"
pnpm install
pnpm dev
```

#### Work on Web App:
```bash
cd "1. Apps/3. Web/1. Opta Life Manager"
npm install
npm run dev
```

### 3. Read Context Files

Before starting work:
1. Read `1. Apps/2. Desktop/1. Opta Native/DESIGN_SYSTEM.md`
2. Read `3. Matthew x Opta/1. personal/calendar.md` (if you're an AI agent)
3. Check `.planning/STATE.md` for current project status

---

# 📝 NAMING CONVENTIONS

## Folder Names
- **Top-level:** Numbered with periods: `1. Apps/`, `2. Gemini Deep Research/`
- **Sub-folders:** Numbered within category: `1. iOS/`, `2. Desktop/`, `3. Web/`
- **Capitalization:** Title Case for all folder names
- **Spaces:** Use spaces, not hyphens or underscores

## File Names
- **Code:** Use framework conventions (camelCase for JS, snake_case for Rust, PascalCase for Swift)
- **Docs:** Use SCREAMING_SNAKE_CASE for major docs (e.g., `DESIGN_SYSTEM.md`)
- **Config:** Use lowercase with dots (e.g., `package.json`, `tauri.conf.json`)

---

# 🔧 BUILD MATRIX

| App | Platform | Command | Output |
|-----|----------|---------|--------|
| **Opta Native** | macOS | `npm run build:dmg` | `.dmg` installer |
| **Opta Mini** | macOS | Xcode `Cmd+B` | `.app` bundle |
| **Opta (React Native)** | iOS | `pnpm build:ios` | `.ipa` via EAS |
| **Opta Scan** | iOS | Xcode `Cmd+B` | `.ipa` |
| **Opta LM iOS** | iOS | `xcodegen && xcodebuild` | `.ipa` |
| **Opta Life Manager** | Web | `npm run build` | Next.js dist |
| **Opta LM Edge** | Cloudflare | `wrangler deploy` | Workers deploy |
| **Optamize Website** | Web | Static copy | HTML files |
| **opta-native** | Rust | `cargo build --release` | `.a` libraries |

---

# 🎯 WHEN TO USE EACH FOLDER

| Scenario | Folder |
|----------|--------|
| Building mobile scanner feature | `1. Apps/1. iOS/2. Opta Scan/` |
| Desktop optimization UI changes | `1. Apps/2. Desktop/1. Opta Native/` |
| Menu bar app updates | `1. Apps/2. Desktop/2. Opta Mini/` |
| Life Manager web dashboard | `1. Apps/3. Web/1. Opta Life Manager/` |
| Adding shared Rust logic | `1. Apps/4. Shared/1. opta-native/` |
| Updating app logos | `1. Apps/4. Shared/2. design-assets/` |
| Researching new AI features | `2. Gemini Deep Research/` |
| Matthew's schedule | `3. Matthew x Opta/1. personal/calendar.md` |
| Opta personality tweaks | `3. Matthew x Opta/2. project/` |
| Configuring Claude agent | `3. Matthew x Opta/3. agent-config/.claude/` |

---

# 📚 RELATED DOCUMENTATION

- **Design System:** `1. Apps/2. Desktop/1. Opta Native/DESIGN_SYSTEM.md`
- **Project Instructions:** `1. Apps/2. Desktop/1. Opta Native/CLAUDE.md`
- **Roadmap:** `1. Apps/2. Desktop/1. Opta Native/.planning/ROADMAP.md`
- **Opta Ring Spec:** `1. Apps/4. Shared/2. design-assets/design-specs/OPTA_RING_SPECIFICATION.md`

---

**End of Guide**

*This document is maintained by the opta-optimizer agent and updated with each major restructuring.*
