# Directory Structure

*Last updated: 2025-01-29*

## Workspace Overview

```
Opta/
├── .claude/                    # Shared agent config, commands, plugins
├── .planning/                  # Root-level planning (this directory)
│   └── codebase/               # Architecture documentation
├── apps/
│   ├── desktop/                # Desktop applications
│   ├── ios/                    # iOS applications
│   ├── web/                    # Web applications
│   └── shared/                 # Shared Rust crates
├── personal/                   # Personal context
├── project/                    # Cross-cutting project context
├── research/                   # Gemini Deep Research outputs
├── ideas/                      # Project brainstorms
└── CLAUDE.md                   # Root project instructions
```

## App Structure

### Desktop: `apps/desktop/opta-native/`

```
opta-native/
├── .claude/                    # App-level agent config
├── .planning/                  # Phase planning documents
├── src/                        # React frontend (Vite)
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component
│   ├── index.css               # Global styles (31KB)
│   ├── pages/                  # 7 main pages
│   │   ├── Dashboard.tsx
│   │   ├── Games.tsx
│   │   ├── Chess.tsx
│   │   ├── Optimize.tsx
│   │   ├── PinpointOptimize.tsx
│   │   ├── Score.tsx
│   │   └── Settings.tsx
│   ├── components/             # 73+ UI components
│   │   ├── Layout.tsx
│   │   ├── chess/              # Chess-specific components
│   │   ├── charts/             # Data visualization
│   │   ├── effects/            # Visual effects
│   │   ├── navigation/         # Nav components
│   │   ├── OptaRing3D/         # 3D ring visualization
│   │   ├── optimization/       # Optimization UI
│   │   ├── pinpoint/           # Pinpoint feature
│   │   ├── SyncStatus/         # Sync indicators
│   │   ├── ui/                 # Base UI components
│   │   └── visualizations/     # Data viz
│   ├── contexts/               # 8 Context providers
│   │   ├── ChessSettingsContext.tsx
│   │   ├── ChromeContext.tsx
│   │   ├── FogContext.tsx
│   │   ├── OptaRingContext.tsx
│   │   ├── ParticleContext.tsx
│   │   ├── PerformanceContext.tsx
│   │   ├── RadialNavContext.tsx
│   │   └── RingLessonContext.tsx
│   ├── hooks/                  # 60+ custom hooks
│   ├── lib/                    # 25 utility modules
│   ├── types/                  # 20+ type definition files
│   ├── data/                   # Config/defaults
│   └── assets/                 # Images/fonts
├── src-tauri/                  # Tauri backend
│   ├── src/
│   │   ├── main.rs             # Entry point
│   │   ├── claude.rs           # Claude integration
│   │   └── platform/
│   │       └── macos.rs        # macOS system integration
│   ├── Cargo.toml
│   └── .cargo/config.toml      # Apple Silicon optimization
├── mcp-server/                 # Python MCP server
│   ├── src/opta_mcp/
│   │   └── server.py           # System telemetry tools
│   └── pyproject.toml
├── public/                     # Static assets
├── schemas/                    # Data schemas
├── scripts/                    # Build scripts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md                   # App instructions
└── DESIGN_SYSTEM.md            # Design specifications (445 lines)
```

### iOS: `apps/ios/opta/`

```
opta/
├── .claude/                    # App-level agent config
├── .planning/                  # Phase planning
├── Opta Scan/                  # Main SwiftUI source
│   ├── Opta_ScanApp.swift      # Entry point (@main)
│   ├── Views/                  # SwiftUI views
│   │   ├── CaptureView.swift
│   │   ├── ProcessingView.swift
│   │   ├── ResultView.swift
│   │   ├── HistoryView.swift
│   │   ├── SettingsView.swift
│   │   ├── OnboardingView.swift
│   │   ├── QuestionsView.swift
│   │   └── Components/         # Reusable view components
│   ├── Services/               # 12 service classes
│   │   ├── CameraService.swift
│   │   ├── MLXService.swift
│   │   ├── LLMProvider.swift
│   │   ├── ImagePreprocessor.swift
│   │   ├── GenerationStream.swift
│   │   ├── ResponseParser.swift
│   │   ├── KeychainService.swift
│   │   ├── ModelDownloadManager.swift
│   │   ├── NetworkMonitor.swift
│   │   ├── PerformanceManager.swift
│   │   ├── FrameRateManager.swift
│   │   └── StorageManager.swift
│   ├── Models/                 # ViewModels + data models
│   ├── Design/                 # Design system
│   │   ├── OptaColors.swift
│   │   ├── OptaAnimations.swift
│   │   ├── OptaHaptics.swift
│   │   ├── OptaTypography.swift
│   │   └── Glass/              # Glass effects
│   ├── Gestures/               # Gesture handlers
│   ├── Shaders/                # Metal shaders
│   ├── Assets.xcassets/        # Images and colors
│   └── OptaScan.xcdatamodeld   # Core Data model
├── packages/                   # Package dependencies
├── .xcodeproj/                 # Xcode project
└── CLAUDE.md                   # App instructions
```

### Web: `apps/web/opta-life-manager/`

```
opta-life-manager/
├── .claude/                    # App-level config
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page
│   ├── template.tsx            # Page template
│   ├── globals.css             # Global styles
│   └── api/                    # API routes
│       ├── auth/
│       └── refresh-linked/
├── components/
│   ├── ui/                     # Base UI components
│   └── widgets/                # Composite widgets
├── lib/                        # Service layer (10 modules)
│   ├── actions.ts              # Server actions (24.5KB)
│   ├── ai-commander.ts         # AI orchestration (20.3KB)
│   ├── ai-summary.ts           # Briefing generation
│   ├── todoist.ts              # Task management
│   ├── weather.ts              # Weather data
│   ├── news.ts                 # News aggregation
│   ├── auth-actions.ts         # Auth flow
│   ├── account-storage.ts      # Account persistence
│   └── token-refresh.ts        # Token management
├── contextsHooks/              # Client state & hooks
├── types/                      # TypeScript types
├── auth.ts                     # NextAuth config
├── package.json
├── tsconfig.json
└── next.config.ts
```

### Shared: `apps/shared/opta-native/`

```
opta-native/
├── Cargo.toml                  # Workspace config
├── opta-core/                  # Crux event architecture
│   └── src/
│       ├── lib.rs              # Entry point
│       ├── app.rs              # Application definition
│       ├── model.rs            # State model
│       ├── event.rs            # Event types
│       ├── view_model.rs       # ViewModel derivation
│       └── effect.rs           # Side effects
├── opta-render/                # wgpu rendering
│   ├── src/
│   │   ├── bridge.rs           # FFI bridge
│   │   └── encoder.rs          # GPU commands
│   └── tests/                  # Integration tests
│       ├── ring_test.rs
│       ├── timing_test.rs
│       ├── shader_test.rs
│       ├── effects_test.rs
│       ├── theme_test.rs
│       └── accessibility_test.rs
├── opta-shared/                # Shared utilities
│   └── src/
│       └── error.rs            # Error types
├── scripts/                    # Build helpers
└── target/                     # Build artifacts
```

## Supporting Directories

### Personal: `personal/`

```
personal/
├── calendar.md                 # Today's events
├── hardware.md                 # Device ecosystem
├── workflows.md                # Cross-device setup
├── profile.md                  # Preferences
├── goals.md                    # Current priorities
├── studio-setup/               # Setup documentation
└── mac-studio-setup/           # Mac configuration
```

### Project: `project/`

```
project/
├── .planning/
│   ├── PROJECT.md              # Opta vision
│   ├── ROADMAP.md              # 10-phase plan
│   ├── STATE.md                # Current progress
│   ├── codebase/               # Architecture docs (legacy location)
│   └── phases/                 # Phase documentation
└── reorganization-docs/        # Migration guides
```

### Research: `research/`

```
research/
└── Gemini Deep Research/
    ├── All-Platforms/
    ├── macOS/
    ├── iOS/
    ├── Mobile/
    ├── Windows/
    └── Apple-Platforms/
```

## Key File Locations

| Purpose | Location |
|---------|----------|
| Root instructions | `CLAUDE.md` |
| Desktop instructions | `apps/desktop/opta-native/CLAUDE.md` |
| iOS instructions | `apps/ios/opta/CLAUDE.md` |
| Design system | `apps/desktop/opta-native/DESIGN_SYSTEM.md` |
| React entry | `apps/desktop/opta-native/src/main.tsx` |
| Tauri entry | `apps/desktop/opta-native/src-tauri/src/main.rs` |
| iOS entry | `apps/ios/opta/Opta Scan/Opta_ScanApp.swift` |
| Web entry | `apps/web/opta-life-manager/app/layout.tsx` |
| Rust workspace | `apps/shared/opta-native/Cargo.toml` |
| MCP server | `apps/desktop/opta-native/mcp-server/src/opta_mcp/server.py` |
| Calendar | `personal/calendar.md` |

## Per-App Configuration Pattern

Each app follows a consistent configuration pattern:

```
app/
├── .claude/                    # App-specific agent config and skills
├── .planning/                  # Phase docs, architecture notes
├── CLAUDE.md                   # App development guidelines
└── DESIGN_SYSTEM.md            # Design specifications (if applicable)
```
