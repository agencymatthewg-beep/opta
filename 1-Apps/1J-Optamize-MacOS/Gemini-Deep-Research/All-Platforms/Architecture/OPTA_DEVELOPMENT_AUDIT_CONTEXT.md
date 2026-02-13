# Opta Development Architecture - Gemini Audit Context

**Purpose**: This document provides a comprehensive overview of how Opta has been developed for iOS/Mobile and macOS platforms, including all software, frameworks, and coding methodologies used. This context allows Gemini to audit the codebase and recommend changes to ensure optimal design and premium aesthetic quality.

**Reference**: This document should be read alongside `Premium App UI_UX Investigation.md` for the theoretical framework.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Platform Architecture](#2-platform-architecture)
3. [Cross-Platform Web App (Tauri + React)](#3-cross-platform-web-app-tauri--react)
4. [Native macOS App (Swift/SwiftUI)](#4-native-macos-app-swiftswiftui)
5. [Design System Implementation](#5-design-system-implementation)
6. [Premium Visual Effects Stack](#6-premium-visual-effects-stack)
7. [Animation Architecture](#7-animation-architecture)
8. [Typography and Styling](#8-typography-and-styling)
9. [Performance Optimization](#9-performance-optimization)
10. [Comparison with Gemini Research Recommendations](#10-comparison-with-gemini-research-recommendations)
11. [Audit Focus Areas](#11-audit-focus-areas)

---

## 1. Project Overview

**Opta** is an AI-powered PC/Gaming optimization orchestrator designed to replace fragmented optimization tools with a unified, premium solution. The application has been developed with a "premium visual experience" as a core pillar, drawing inspiration from Linear, Arc Browser, and the Zed editor.

### Current Version: v7.0.0

**Development Timeline:**
- v1.0 MVP: Foundation, Hardware Telemetry, Process Management
- v1.1: macOS Refinement
- v2.0: Social Features, Chess Integration
- v3.0: Native macOS Platform
- v4.0: Rich Features (WebGL, Visualizations, AI/ML)
- v5.0: Premium Visual Experience (3D Ring, Particles, Glass Depth)
- v5.1: Ring Visual Enhancement
- v6.0: Optimization Intelligence Core
- v7.0: Chess Mastery Experience

### Core Design Pillars

| Pillar | Description |
|--------|-------------|
| Sci-Fi HUD | Cyberpunk/TRON aesthetic with neon elements |
| Apple Refinement | Spring physics, smooth transitions, attention to detail |
| Linear Sophistication | Glass depth, subtle animations, professional feel |
| "Living Artifact" | The UI breathes and responds; the Opta Ring is the soul |

---

## 2. Platform Architecture

Opta employs a **dual-track development strategy**:

### Track 1: Cross-Platform Web App (Primary)
- **Target**: macOS, Windows, Linux
- **Framework**: Tauri v2 (Rust) + React 19 + TypeScript
- **Rendering**: WebGL via Three.js + CSS glassmorphism

### Track 2: Native macOS App (Secondary)
- **Target**: macOS 12.0+ (Apple Silicon optimized)
- **Framework**: Swift + SwiftUI
- **Rendering**: Native AppKit/SwiftUI + NSVisualEffectView

### iOS/Mobile Status

**Current State**: iOS/Mobile is currently **out of scope** for v1-v7.

**Technical Readiness**: The web app architecture could theoretically support mobile via:
1. **React Native conversion** using the patterns from `Premium App UI_UX Investigation.md`
2. **Tauri Mobile** (Android/iOS support in Tauri v2)
3. **Dedicated SwiftUI iOS app** extending the native macOS codebase

**Mobile-Ready Components**:
- The React component architecture is designed for responsive layouts
- Design system uses relative units and CSS variables
- Animation system supports reduced-motion preferences

---

## 3. Cross-Platform Web App (Tauri + React)

### 3.1 Technology Stack

```json
{
  "core": {
    "tauri": "^2",
    "rust-backend": "1.x",
    "react": "^19.1.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.4"
  },
  "ui-framework": {
    "tailwindcss": "^3.4.17",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.4.0"
  },
  "animation": {
    "framer-motion": "^12.26.2"
  },
  "3d-graphics": {
    "@react-three/fiber": "^9.5.0",
    "@react-three/drei": "^10.7.7",
    "@react-three/postprocessing": "^3.0.4",
    "@react-spring/three": "^10.0.3",
    "three": "^0.182.0"
  },
  "icons": {
    "lucide-react": "^0.562.0"
  },
  "ui-components": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-tooltip": "^1.2.8"
  },
  "data-visualization": {
    "echarts": "^6.0.0",
    "echarts-for-react": "^3.0.5",
    "@visx/hierarchy": "^3.12.0"
  },
  "particles": {
    "@tsparticles/react": "^3.0.0",
    "@tsparticles/slim": "^3.9.1"
  }
}
```

### 3.2 Tauri Configuration

```json
{
  "productName": "Opta",
  "version": "7.0.0",
  "identifier": "com.opta.optimizer",
  "app": {
    "macOSPrivateApi": true,
    "windows": [{
      "titleBarStyle": "Overlay",
      "hiddenTitle": true,
      "transparent": true,
      "decorations": true
    }]
  },
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "12.0"
    }
  }
}
```

**Key Tauri Features Used:**
- `macOSPrivateApi: true` - Enables vibrancy and transparency effects
- `titleBarStyle: Overlay` - Native traffic light positioning
- `transparent: true` - Required for glass effects with backdrop-filter

### 3.3 Rust Backend

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-os = "2"
tokio = { version = "1", features = ["sync", "time", "rt-multi-thread", "net", "process"] }

[profile.release]
lto = true
opt-level = "s"
codegen-units = 1
strip = true
panic = "abort"
```

**Backend Responsibilities:**
- IPC bridge between frontend and system
- Process spawning for Python MCP server
- Global shortcut handling
- Platform detection

### 3.4 Project Structure

```
/src
├── components/
│   ├── ui/                    # shadcn/ui components (Radix-based)
│   ├── effects/               # WebGL effects (Glass, Neon, Particles)
│   ├── OptaRing3D/           # Three.js 3D ring implementation
│   ├── navigation/           # Radial nav, command palette
│   ├── visualizations/       # ECharts, Visx charts
│   └── DragDrop/             # dnd-kit integration
├── hooks/                     # Custom React hooks
├── lib/
│   ├── shaders/              # GLSL shaders (Glass, Chromatic, OLED)
│   ├── animations.ts         # Framer Motion presets
│   └── utils.ts              # cn() helper for Tailwind
├── pages/                     # Page components
├── contexts/                  # React Context providers
└── types/                     # TypeScript types
```

---

## 4. Native macOS App (Swift/SwiftUI)

### 4.1 Technology Stack

```swift
// Target: macOS 14.0+ (Sonoma)
// Framework: SwiftUI + AppKit interop
// Hardware Access: IOKit (SMC sensors)

// Key Dependencies:
// - Foundation
// - SwiftUI
// - AppKit (NSVisualEffectView)
// - IOKit (hardware sensors)
```

### 4.2 Project Structure

```
/OptaNative
├── OptaNative/
│   ├── App.swift                      # Main entry point
│   ├── Services/
│   │   ├── TelemetryService.swift     # Hardware monitoring
│   │   ├── ProcessService.swift       # Process management
│   │   └── HelperManager.swift        # Privileged operations
│   ├── ViewModels/
│   │   ├── TelemetryViewModel.swift   # @Observable pattern
│   │   └── ProcessViewModel.swift
│   ├── Views/
│   │   ├── MainWindow/
│   │   │   ├── MainWindowView.swift
│   │   │   ├── DashboardView.swift
│   │   │   └── TelemetryCard.swift
│   │   ├── MenuBar/
│   │   │   ├── MenuBarView.swift
│   │   │   ├── PopoverView.swift
│   │   │   └── SystemOrbitalView.swift
│   │   └── Components/
│   │       ├── GlassBackground.swift
│   │       ├── VisualEffects.swift
│   │       └── ChromaticLoadingEffect.swift
│   └── Utilities/
│       ├── DesignSystem.swift
│       └── ChipDetection.swift
├── SMC/
│   └── SMCBridge.swift               # IOKit SMC access
├── Modules/Sensors/
│   ├── SensorKeys.swift              # Per-chip sensor mappings
│   └── SensorReader.swift
└── Helper/
    └── HelperTool.swift              # Privileged helper (SMJobBless)
```

### 4.3 Key Implementation Details

#### Menu Bar Integration
```swift
@main
struct OptaNativeApp: App {
    @State private var telemetry = TelemetryViewModel()

    var body: some Scene {
        WindowGroup {
            MainWindowView()
                .environment(telemetry)
        }
        .windowStyle(.hiddenTitleBar)

        MenuBarExtra {
            PopoverView()
                .environment(telemetry)
        } label: {
            MenuBarIconView(cpuUsage: telemetry.cpuUsage, ...)
        }
        .menuBarExtraStyle(.window)
    }
}
```

#### Glass Effects (Native)
```swift
// Using NSVisualEffectView for true vibrancy
struct GlassBackground: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .hudWindow  // Strongest glass effect
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }
}
```

#### Hardware Telemetry
```swift
// Direct SMC access via IOKit for Apple Silicon
actor TelemetryService {
    private let sensorReader = SensorReader()

    func getCPUTemperature() async -> Double {
        // Uses per-chip sensor key mappings (M1/M2/M3/M4 differ)
        return sensorReader.read(key: chipMapping.cpuDieTemp)
    }
}
```

---

## 5. Design System Implementation

### 5.1 Color Palette (OLED Optimized)

```css
:root {
  /* The Void (Backgrounds) - OLED Optimized */
  --background: 240 6% 4%;        /* #09090b - NOT true black */
  --foreground: 0 0% 98%;         /* #fafafa */

  /* Obsidian Surfaces */
  --card: 240 6% 6%;              /* #0c0c12 */

  /* The Energy (Primary Brand) */
  --primary: 265 90% 65%;         /* Electric Violet */
  --secondary: 265 50% 20%;       /* Dormant Violet */

  /* Neon Accents (Active States Only) */
  --neon-purple: 139 92 246;      /* #8b5cf6 */
  --neon-blue: 59 130 246;        /* #3b82f6 */
  --neon-green: 34 197 94;        /* #22c55e */
}
```

**Critical Decision: No True Black (#000000)**
- OLED displays cause "black smear" when pixels turn fully off/on
- Base background uses #09090b (deep grey-purple) to keep pixels active
- This prevents scrolling artifacts while maintaining dark aesthetic

### 5.2 Glass Effect System

The design system defines 3 glass depth levels:

| Level | Class | Blur | Use Case |
|-------|-------|------|----------|
| Background | `.glass-subtle` | 8px | Cards, secondary containers |
| Content | `.glass` | 12px | Primary containers, modals |
| Overlay | `.glass-strong` | 20px | Hero elements, overlays |

**Glass Layers (4-Layer Optical Simulation):**
1. **Backdrop** - Content behind the glass
2. **Blur Pass** - Gaussian blur (8-20px)
3. **Noise Overlay** - Grain texture (Soft Light blend, 2-4%)
4. **Specular Highlight** - Top edge light reflection

### 5.3 Typography

```css
font-family: 'Sora', system-ui, -apple-system, sans-serif;
```

| Element | Size | Weight | Tracking |
|---------|------|--------|----------|
| Display | 3rem+ | 700 | -0.02em |
| H1 | 2.25rem | 600 | -0.01em |
| Body | 0.875rem | 400 | 0 |

**Moonlight Gradient (Headings):**
```css
.text-moonlight {
  background: linear-gradient(to bottom-right, white, white, hsl(var(--primary) / 0.5));
  -webkit-background-clip: text;
  color: transparent;
}
```

---

## 6. Premium Visual Effects Stack

### 6.1 The Opta Ring (3D Torus)

**Implementation**: Three.js via @react-three/fiber

```typescript
// OptaRing3D.tsx - Core implementation
<Canvas
  camera={{ fov: 38, position: [0, 0, 5.2] }}
  dpr={[1, 2]}  // Capped DPR for performance
  gl={{ alpha: true, antialias: true }}
>
  {/* 3-Point Lighting */}
  <ambientLight intensity={0.2} />
  <directionalLight position={[5, 5, 5]} intensity={1.2} />  {/* Key */}
  <directionalLight position={[-3, -2, 2]} intensity={0.4} color="#E9D5FF" />  {/* Fill */}
  <pointLight position={[0, 0, -3]} intensity={0.8} color="#9333EA" />  {/* Rim */}

  <RingMesh state={state} energyLevel={energyLevel} />
</Canvas>
```

**Ring State Machine (7 States):**

| State | Tilt | Spin Speed | Energy | Visual |
|-------|------|------------|--------|--------|
| dormant | 15° | 0.1 rad/s | 0-0.2 | Dark obsidian glass |
| waking | 15°→0° | 0.1→0.3 | 0.2-0.5 | Spring transition |
| active | 0° | 0.3 rad/s | 0.5-0.7 | Facing camera, glowing |
| sleeping | 0°→15° | 0.3→0.1 | 0.5-0.2 | Ease-out to dormant |
| processing | 0° | 0.5 rad/s | 0.6-0.9 | Pulsing glow |
| exploding | 0° | 0.6 rad/s | 0.9-1.0 | Particle burst |
| recovering | 0° | 0.24 rad/s | 0.5-0.7 | Cooldown |

### 6.2 Custom GLSL Shaders

Located in `/src/lib/shaders/`:

| Shader | Purpose | File |
|--------|---------|------|
| GlassShader | Glassmorphism material with fresnel | `GlassShader.ts` |
| ChromaticShader | RGB channel separation for loading | `ChromaticShader.ts` |
| NeonBorderShader | Traveling light border effect | `NeonBorderShader.ts` |
| OLEDDitheringShader | Sub-pixel dithering for gradients | `OLEDDitheringShader.ts` |

**Plasma Core Shader (v5.1 Enhancement):**
- Animated noise/plasma texture inside the glass
- Uses Simplex noise with fractal Brownian motion (fbm)
- Energy level controls plasma intensity and color temperature

### 6.3 Particle System

**Implementation**: @tsparticles/react

```typescript
// Particle types and their behaviors
const particleConfig = {
  ambientDust: { count: 75, size: "1-3px", opacity: "10-20%" },
  energySparks: { count: 30, size: "2-4px", opacity: "30-50%" },
  dataBurst: { count: 50, size: "1-2px", opacity: "40-60%" },
};
```

**Ring Attraction**: Particles flow toward the ring during processing state.

### 6.4 Atmospheric Fog

**Implementation**: CSS radial gradients + Framer Motion

| Ring State | Fog Color | Opacity | Animation |
|------------|-----------|---------|-----------|
| dormant | #1a0a2e | 5-15% | 4s breathing |
| waking | #2d1b4e | 10-20% | 3s breathing |
| active | #3B1D5A | 15-25% | 3s breathing |
| processing | #9333EA | 20-30% | 2s + pulse |
| exploding | #c084fc | 50-80% | Flash + fade |

---

## 7. Animation Architecture

### 7.1 Core Library: Framer Motion

**Philosophy**: All animations use **physics-based springs**, never duration-based timing for interactive elements.

### 7.2 Spring Presets

```typescript
// /src/lib/animations.ts
export const transitions = {
  spring: { type: "spring", stiffness: 400, damping: 30 },
  springGentle: { type: "spring", stiffness: 200, damping: 25 },
  springPage: { type: "spring", stiffness: 100, damping: 20 },
  springHeavy: { type: "spring", stiffness: 150, damping: 20 },
};
```

### 7.3 Easing Curves (for CSS)

```typescript
export const smoothOut = [0.22, 1, 0.36, 1];   // Default UI
export const heavy = [0.16, 1, 0.3, 1];        // Ring movements
export const snappy = [0.34, 1.56, 0.64, 1];   // Hover states
export const cinematic = [0.77, 0, 0.175, 1];  // Page transitions
```

### 7.4 The Ignition Pattern

Elements "wake from darkness" rather than simply fading in:

```typescript
export const ignition: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    filter: "brightness(0.5) blur(4px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "brightness(1) blur(0px)",
    transition: { duration: 0.8, ease: smoothOut },
  },
};
```

### 7.5 Page Transition Choreography

```typescript
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20, filter: "brightness(0.8)" },
  animate: {
    opacity: 1, y: 0, filter: "brightness(1)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      staggerChildren: 0.05,
    },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};
```

### 7.6 Reduced Motion Support

```typescript
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Conditional transition
const transition = prefersReducedMotion
  ? { duration: 0 }
  : transitions.spring;
```

---

## 8. Typography and Styling

### 8.1 Icon System

**Library**: Lucide React (exclusively)

```tsx
// CORRECT
import { Settings } from 'lucide-react';
<Settings className="w-5 h-5 text-primary" strokeWidth={1.75} />

// WRONG - Never use inline SVGs
<svg viewBox="0 0 24 24">...</svg>
```

**Icon Sizing Standards:**

| Context | Size | strokeWidth |
|---------|------|-------------|
| Page header | w-5 h-5 | 1.75 |
| Card/section | w-4 h-4 | 1.75 |
| Inline text | w-3.5 h-3.5 | 1.5 |
| Large decorative | w-7 h-7 | 1.5 |

### 8.2 Utility Pattern: cn()

```typescript
// /src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage:**
```tsx
<div className={cn(
  "glass rounded-xl border border-border/30",
  isActive && "border-primary/50",
  className
)} />
```

---

## 9. Performance Optimization

### 9.1 WebGL Performance

| Optimization | Implementation |
|--------------|----------------|
| DPR Capping | Maximum 2x device pixel ratio |
| WebGL Tier Detection | Dynamic quality based on GPU |
| Reduced Motion Fallback | Static images for accessibility |
| Canvas vs SVG Decision | Canvas for >5000 nodes |

### 9.2 React Optimization

| Technique | Application |
|-----------|-------------|
| React.memo | ProcessRow, GameCard, TelemetryCard |
| useMemo/useCallback | Heavy computations, event handlers |
| LazyMotion | domAnimation feature set only |
| Lazy loading | Pages via React.lazy() |
| Code splitting | Vendor chunks (react, motion, radix) |

### 9.3 Bundle Optimization

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        motion: ['framer-motion'],
        three: ['three', '@react-three/fiber'],
      }
    }
  }
}
```

### 9.4 Target Performance Metrics

| Metric | Target | Current Approach |
|--------|--------|------------------|
| Typing Latency | <16ms | Direct state updates, no bridge overhead |
| Scroll FPS | 120fps | FlashList patterns, virtualization |
| App Startup | <1.5s | Code splitting, lazy loading |
| Animation Drops | 0 frames | UI thread animations via Framer Motion |

---

## 10. Comparison with Gemini Research Recommendations

### 10.1 Alignment Assessment

| Research Recommendation | Opta Implementation | Status |
|-------------------------|---------------------|--------|
| React Native Skia for rendering | Three.js + CSS glassmorphism | Different approach |
| Skia runtime shaders | GLSL shaders via Three.js | Aligned (different tech) |
| Reanimated for springs | Framer Motion for springs | Aligned (different tech) |
| JSI for performance | Tauri native bridge | Aligned (different tech) |
| Tree-sitter for syntax | Not applicable (not a code editor) | N/A |
| FlashList virtualization | React patterns + lazy loading | Aligned |
| JetBrains Mono typography | Sora (custom choice) | Different (intentional) |
| Haptic feedback design | Basic haptic implementation | Partially implemented |

### 10.2 Key Differences from Research

1. **Rendering Engine**: Uses Three.js WebGL instead of Skia
   - Three.js chosen for 3D capability (Opta Ring torus)
   - CSS glassmorphism for 2D panels (simpler, well-supported)

2. **Animation Engine**: Uses Framer Motion instead of Reanimated
   - Framer Motion is web-native (works with React DOM)
   - Same spring physics concepts apply

3. **Typography**: Uses Sora instead of JetBrains Mono
   - Opta is not primarily a code editor
   - Sora provides premium, modern aesthetic

4. **Native Bridge**: Uses Tauri (Rust) instead of JSI
   - Tauri provides cross-platform desktop support
   - Lower memory footprint than Electron

### 10.3 Opportunities for Enhancement

Based on the Gemini research, these areas could be improved:

1. **Mobile React Native Port**: If mobile development proceeds, adopt:
   - React Native Skia for the Opta Ring
   - Reanimated for animations
   - JSI/Nitro for native performance

2. **Traveling Neon Border**: Currently CSS-based; could benefit from:
   - SweepGradient shader for animated light
   - GPU-accelerated border effects

3. **Haptic Synchronization**: Current implementation is basic:
   - Add haptic sync with spring animation endpoints
   - Implement "thud" on drawer close at velocity = 0

4. **Sound Design Integration**: Phase 37 implemented; could enhance:
   - Sync audio with ring state transitions
   - Add Web Audio API spatial positioning

---

## 11. Audit Focus Areas

### 11.1 Priority 1: Premium Visual Quality

**Questions for Gemini:**
- Does the current glass effect implementation achieve the "Deep Glass" quality described in the research?
- Is the Opta Ring 3D shader achieving sufficient "Luminal Glassmorphism" quality?
- Are the page transitions achieving "Apple-level polish"?

**Files to Review:**
- `src/components/OptaRing3D/RingMesh.tsx`
- `src/lib/shaders/GlassShader.ts`
- `src/lib/animations.ts`
- `src/index.css` (glass classes)

### 11.2 Priority 2: Animation Timing

**Questions for Gemini:**
- Are the spring physics configurations optimal for the "premium" feel?
- Should any animations use different easing curves?
- Is the ignition pattern achieving the "wake from darkness" effect?

**Files to Review:**
- `src/lib/animations.ts` (all presets)
- `src/lib/animation/transitions.ts`

### 11.3 Priority 3: Performance Optimization

**Questions for Gemini:**
- Is the WebGL setup optimally configured for the target hardware?
- Are there memory leak risks in the Three.js implementation?
- Should additional code splitting be implemented?

**Files to Review:**
- `src/components/OptaRing3D/OptaRing3D.tsx`
- `vite.config.ts`
- `src/lib/performance.ts`

### 11.4 Priority 4: Mobile Readiness

**Questions for Gemini:**
- If we port to React Native, which components need complete rewrites?
- What is the recommended architecture for mobile glass effects?
- Should we adopt Skia for mobile or stick with platform-native?

### 11.5 Priority 5: Accessibility

**Questions for Gemini:**
- Does the current reduced-motion implementation meet WCAG standards?
- Are the color contrast ratios sufficient for the neon-on-dark palette?
- Is the current accessibility labeling complete?

---

## Appendix A: File Index

### Core Configuration Files
- `package.json` - npm dependencies and scripts
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/tauri.conf.json` - Tauri configuration
- `DESIGN_SYSTEM.md` - Design system documentation
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind configuration

### Key Implementation Files
- `src/lib/animations.ts` - Animation presets
- `src/lib/shaders/*.ts` - GLSL shaders
- `src/components/OptaRing3D/*.tsx` - 3D ring implementation
- `src/components/effects/*.tsx` - Visual effects components
- `src/index.css` - Global styles and CSS variables

### Native macOS Files
- `OptaNative/OptaNative/App.swift` - Entry point
- `OptaNative/OptaNative/Utilities/DesignSystem.swift` - Native design tokens
- `OptaNative/OptaNative/Views/Components/GlassBackground.swift` - Native glass

---

## Appendix B: Decision Log

Key architectural decisions made during development:

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Tauri over Electron | Smaller, faster, Rust-based | 1 |
| Three.js over Skia | 3D torus requires real 3D rendering | 24 |
| Framer Motion over CSS | Spring physics, interruptible animations | 3.1 |
| #09090b over #000000 | OLED black smear prevention | 20 |
| 3-level glass system | Clear depth hierarchy | 33 |
| 7-state ring machine | Comprehensive state coverage | 28 |
| Sora over JetBrains Mono | Premium aesthetic over code focus | 3.1 |

---

*Document Version: 1.0*
*Last Updated: 2026-01-20*
*For: Gemini Deep Research Audit*
