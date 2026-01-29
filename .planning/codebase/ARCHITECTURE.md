# Architecture

*Last updated: 2025-01-29*

## Pattern Overview

**Multi-app monorepo** with four independent app ecosystems using a unified design system and shared Rust infrastructure.

| App | Pattern | Tech Stack |
|-----|---------|------------|
| Desktop | Component composition + Context-based state | React 19 + TypeScript + Vite + Tauri v2 |
| iOS | MVVM with Service layer | SwiftUI + Core Data + async/await |
| Web | Server/Client boundary (App Router) | Next.js 15+ + React |
| Shared | Crux event architecture (Elm-like) | Rust + UniFFI + wgpu |

## Layers

### Desktop App (Opta Native)

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation Layer                                          │
│ └─ src/pages/ (7 pages)                                     │
│    Dashboard, Games, Chess, Optimize, PinpointOptimize,     │
│    Score, Settings                                          │
├─────────────────────────────────────────────────────────────┤
│ Component Layer                                             │
│ └─ src/components/ (73+ components, 17 subdirectories)      │
│    chess/, charts/, effects/, navigation/, OptaRing3D/,     │
│    optimization/, pinpoint/, SyncStatus/, ui/, visualizations│
├─────────────────────────────────────────────────────────────┤
│ State Layer                                                 │
│ └─ src/contexts/ (8 Context providers)                      │
│    ChessSettings, Chrome, Fog, OptaRing, Particle,          │
│    Performance, RadialNav, RingLesson                       │
├─────────────────────────────────────────────────────────────┤
│ Business Logic Layer                                        │
│ └─ src/hooks/ (60+ custom hooks)                            │
│    useChessGame, useGameSession, useLlm, useExpertise,      │
│    useConflicts, useKnowledgeGraph, useLauncher             │
├─────────────────────────────────────────────────────────────┤
│ Utility Layer                                               │
│ └─ src/lib/ (25 modules)                                    │
│    animations, pgnParser, tutoringEngine, performance       │
├─────────────────────────────────────────────────────────────┤
│ Backend Layer (Tauri)                                       │
│ └─ src-tauri/src/ (Rust)                                    │
│    main.rs, claude.rs, platform/macos.rs                    │
└─────────────────────────────────────────────────────────────┘
```

### iOS App (Opta Scan)

```
┌─────────────────────────────────────────────────────────────┐
│ App Entry                                                   │
│ └─ Opta_ScanApp.swift (@main)                               │
├─────────────────────────────────────────────────────────────┤
│ Views (SwiftUI)                                             │
│ └─ Views/                                                   │
│    CaptureView, ProcessingView, ResultView, HistoryView,    │
│    SettingsView, OnboardingView, QuestionsView              │
├─────────────────────────────────────────────────────────────┤
│ View Models                                                 │
│ └─ Models/                                                  │
│    ScanFlow, ScanHistory, OptaModelConfiguration            │
├─────────────────────────────────────────────────────────────┤
│ Services (12 services)                                      │
│ └─ Services/                                                │
│    CameraService, MLXService, LLMProvider, ImagePreprocessor│
│    GenerationStream, ResponseParser, KeychainService,       │
│    ModelDownloadManager, NetworkMonitor, PerformanceManager,│
│    FrameRateManager, StorageManager                         │
├─────────────────────────────────────────────────────────────┤
│ Design System                                               │
│ └─ Design/                                                  │
│    OptaColors, OptaAnimations, OptaHaptics, OptaTypography  │
├─────────────────────────────────────────────────────────────┤
│ Data Layer                                                  │
│ └─ OptaScan.xcdatamodeld (Core Data)                        │
└─────────────────────────────────────────────────────────────┘
```

### Web App (Opta Life Manager)

```
┌─────────────────────────────────────────────────────────────┐
│ App Router                                                  │
│ └─ app/ (layout.tsx, page.tsx, template.tsx)                │
├─────────────────────────────────────────────────────────────┤
│ API Routes                                                  │
│ └─ app/api/ (auth/, refresh-linked/)                        │
├─────────────────────────────────────────────────────────────┤
│ Components                                                  │
│ └─ components/ui/, components/widgets/                      │
├─────────────────────────────────────────────────────────────┤
│ Server Actions                                              │
│ └─ lib/actions.ts (24.5KB)                                  │
├─────────────────────────────────────────────────────────────┤
│ Services                                                    │
│ └─ lib/                                                     │
│    ai-commander.ts, ai-summary.ts, todoist.ts, weather.ts,  │
│    news.ts, token-refresh.ts, account-storage.ts            │
├─────────────────────────────────────────────────────────────┤
│ Client State                                                │
│ └─ contextsHooks/                                           │
└─────────────────────────────────────────────────────────────┘
```

### Shared Rust Layer (Crux Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│ opta-core (Crux App)                                        │
│ ├─ lib.rs       - Entry point                               │
│ ├─ app.rs       - Application definition                    │
│ ├─ model.rs     - State model                               │
│ ├─ event.rs     - Event types                               │
│ ├─ view_model.rs - ViewModel derivation                     │
│ └─ effect.rs    - Side effects                              │
├─────────────────────────────────────────────────────────────┤
│ opta-render (GPU Layer)                                     │
│ ├─ bridge.rs    - FFI bridge                                │
│ └─ encoder.rs   - GPU command encoding                      │
├─────────────────────────────────────────────────────────────┤
│ opta-shared (Utilities)                                     │
│ └─ error.rs     - Shared error types                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Desktop Request Lifecycle

```
User Interaction
      │
      ▼
Page Component (src/pages/)
      │
      ▼
Custom Hook (src/hooks/)
      │
      ▼
Context Update (src/contexts/)
      │
      ▼
Component Re-render
      │
      └──► Tauri IPC (for system integration)
           │
           ▼
      Rust Backend (src-tauri/)
           │
           └──► MCP Server (Python) for AI/telemetry
```

### iOS Request Lifecycle

```
User Capture
      │
      ▼
CaptureView
      │
      ▼
CameraService (photo acquisition)
      │
      ▼
ImagePreprocessor (optimization)
      │
      ▼
LLMProvider (backend selection)
      │
      ├──► MLXService (local inference)
      │
      └──► Cloud API (remote inference)
           │
           ▼
      GenerationStream (streaming response)
           │
           ▼
      ResponseParser
           │
           ▼
      ResultView (display)
           │
           ▼
      ScanHistory (Core Data persistence)
```

### Web Request Lifecycle

```
Client Interaction
      │
      ▼
Client Component
      │
      ▼
Server Action ("use server")
      │
      ▼
Service Layer (lib/*.ts)
      │
      ├──► External API (Todoist, Weather, etc.)
      │
      └──► AI Commander (orchestration)
           │
           ▼
      Streaming Response
           │
           ▼
      Client Render
```

## Key Abstractions

### Desktop
- **Context-based State** - Global state via React Context + custom hooks
- **Component Composition** - 73+ components organized by domain
- **Service-like Hooks** - Custom hooks act as service layer

### iOS
- **MVVM with @Published** - Services and ViewModels expose @Published properties
- **Single Service Responsibility** - Each service handles one concern
- **Async/await** - Modern concurrency throughout

### Web
- **Server/Client Boundary** - "use server" actions for server-side logic
- **MCP Integration** - Multiple MCP servers for external tools
- **Streaming Responses** - AI responses streamed to client

### Shared Rust
- **Crux Event Architecture** - Event-driven state management (Elm-like)
- **UniFFI Bridges** - Language interop for Swift/Kotlin
- **wgpu GPU Abstraction** - Cross-platform rendering (Metal on Apple)

## Entry Points

| App | Entry Point | Type |
|-----|-------------|------|
| Desktop (Frontend) | `apps/desktop/opta-native/src/main.tsx` | React |
| Desktop (Backend) | `apps/desktop/opta-native/src-tauri/src/main.rs` | Rust |
| Desktop (MCP) | `apps/desktop/opta-native/mcp-server/src/opta_mcp/server.py` | Python |
| iOS (Opta Scan) | `apps/ios/opta/Opta Scan/Opta_ScanApp.swift` | SwiftUI |
| Web (Life Manager) | `apps/web/opta-life-manager/app/layout.tsx` | Next.js |
| Web (AICompare) | `apps/web/AICompare/src/app/page.tsx` | Next.js |
| Shared (Core) | `apps/shared/opta-native/opta-core/src/lib.rs` | Rust |
