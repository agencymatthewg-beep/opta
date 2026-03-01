# Opta Local Ecosystem Aesthetics

This document outlines how the core **Opta Local Design System** (defined in `OPTA-AESTHETIC-CONTEXT.md`) adapts to individual apps within the ecosystem. While all apps share the same DNA, specific contexts require different variations of the aesthetic.

## 1. Shared Foundation
All Opta Local applications share the following baseline aesthetic:
*   **Void-native Backgrounds:** Pure `#09090b` for the main background. Never lighter.
*   **Typography:** `Sora` for UI elements and prose, `JetBrains Mono` for all data, code, statistics, and terminal output.
*   **Glass Elements:** Consistent `rgba(12,12,18,0.6)` cards with `rgba(255,255,255,0.15)` borders.
*   **Tone:** Precision engineering, calm authority, data as texture.

## 2. App-Specific Accent Colors
Apps use specific accent colors for key states, badges, and primary actions.

| Application | Accent Color | Hex Code | Use Case |
| :--- | :--- | :--- | :--- |
| **Opta LMX** | Electric Violet | `#a855f7` | Inference engine, core identity |
| **Opta CLI** | Neon Green | `#22c55e` | Command line, local status |
| **Opta Accounts** | Identity Blue | `#3b82f6` | Authentication and user data |
| **Opta Init** | Neon Amber | `#f59e0b` | Onboarding and conditional flows |
| **Opta Status** | Status-dependent | (Dynamic) | System health and monitoring |
| **Global/Shared** | Muted Grey | `#a1a1aa` | Cross-app content and navigation |

## 3. Contextual Variations

### Marketing & Portals (Home, Learn)
*   **Apps:** Opta-Home (`optalocal.com`), Opta-Learn (`learn.optalocal.com`)
*   **Aesthetic Priority:** Visual impact, animated components (0.5-0.7s spring easing).
*   **Key UI Elements:** `.text-moonlight` gradient text, `.bg-dot-subtle` and `.bg-grid-subtle` backgrounds, obsidian bento cards.

### Productivity & Tools (Desktop, CLI, Local)
*   **Apps:** Opta-Code-Desktop, Opta-CLI, Opta-Local
*   **Aesthetic Priority:** Density, contrast, and raw data visibility.
*   **Key UI Elements:** Heavy use of `JetBrains Mono`, inline code highlights (`#06b6d4`), solid void backgrounds (minimal background textures to reduce visual noise).

### Documentation & Reference (Help)
*   **Apps:** Opta-Help (`help.optalocal.com`)
*   **Aesthetic Priority:** Readability, structure, and low-distraction.
*   **Key UI Elements:** 3-column layout, left sidebars, `.prose-opta` text styling, color-coded callout boxes (amber/green/red), extensive dark-mode code blocks.

### System & Infrastructure (LMX, Accounts, Init)
*   **Apps:** Opta-LMX, Opta-Init, Opta-Accounts
*   **Aesthetic Priority:** Trust, clarity, and state communication.
*   **Key UI Elements:** Animated status badges/pills, clear error states (`#ef4444`), identity glow accents.
