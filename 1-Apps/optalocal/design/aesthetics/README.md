# Opta Ecosystem Aesthetics

This document outlines how the core **Opta Design System** (defined in `OPTA-AESTHETIC-CONTEXT.md`) adapts to individual apps within the business, specifically focusing on the **Opta Local** sub-ecosystem and its supporting management websites.

## 1. Shared Foundation (Opta / Opta AI)
All Opta applications (including the Opta Local sub-ecosystem and other optimization apps like Life Manager) share the following baseline aesthetic:
*   **Void-native Backgrounds:** Pure `#09090b` for the main background. Never lighter.
*   **Typography:** `Sora` for UI elements and prose, `JetBrains Mono` for all data, code, statistics, and terminal output.
*   **Glass Elements:** Consistent `rgba(12,12,18,0.6)` cards with `rgba(255,255,255,0.15)` borders.
*   **Tone:** Precision engineering, calm authority, data as texture.

## 2. Opta Local: Main Local Apps
These are the core products within the Opta Local sub-ecosystem. They are the actual applications that help a user run and use Local LLMs. They prioritize density, contrast, and raw data visibility.

| Application | Accent Color | Hex Code | Aesthetic Focus |
| :--- | :--- | :--- | :--- |
| **Opta LMX** | Electric Violet | `#a855f7` | Inference engine. Core identity, trust, and clear state communication. |
| **Opta Local** | Electric Violet | `#a855f7` | LMX management dashboard. Heavy data visibility, terminal-like density. |
| **Opta CLI** | Neon Green | `#22c55e` | Command line tool. High contrast, pure utility, fast workflows. |
| **Opta Code Desktop**| Electric Violet / Green| Mixed | AI-assisted coding. Code highlights (`#06b6d4`), solid void backgrounds, minimal visual noise. |

## 3. Opta Management Websites
These web properties are the management websites that assist the main apps, handling discovery, onboarding, identity, documentation, and overall status. They prioritize trust, clarity, and structural readability.

| Website / Service | Accent Color | Hex Code | Aesthetic Focus |
| :--- | :--- | :--- | :--- |
| **Opta Accounts** | Identity Blue | `#3b82f6` | Authentication. Animated status badges, trust, clear error states (`#ef4444`). |
| **Opta Status** | Dynamic | Dynamic | System health. Color directly reflects live status (Green/Amber/Red). |
| **Opta Home (optalocal.com)**| Muted Grey/Mixed| `#a1a1aa` | Marketing portal. `.text-moonlight` gradients, obsidian bento cards, animated components. |
| **Opta Help** | Muted Grey | `#a1a1aa` | Documentation. 3-column layout, `.prose-opta`, color-coded callouts, high readability. |
| **Opta Learn** | Mixed (Per App)| Mixed | Discovery portal. `.bg-dot-subtle`, glass search bars, interactive guide cards. |
| **Opta Init** | Neon Amber | `#f59e0b` | Onboarding flows. Conditional states, clear step-by-step progress. |

---

## 4. App Logo System (Canonical Template)

All Opta Local app logos — across both Main Local Apps and Management Websites — share a **single locked template**. Only two elements vary per app.

> Full spec: `/design/logos/LOGO-SYSTEM.md`
> Template source: `/design/logos/opta-logo-template.html`

### Shared Across Every Logo (Locked)
1. **Aesthetic / colouring:** Void black radial background, gravitational violet/white particle field, inverse-square density distribution
2. **Outer ring:** 3-layer depth system — outermost halo → mid soft ring → main gradient arc (`#c084fc` top-left → `#4c1d95` bottom-right) with glow filter + inner edge trace
3. **Orbit elements:** Gradient ellipse with node dots + centre layered bloom
4. **Typography:** Sora SemiBold 600 · `0.22em` tracking · `"opta local"` in `#71717a` · divider · app name in **`#a855f7` (Electric Violet)**

### What Changes Per App (Only Two Variables)
| Variable | Example |
|----------|---------|
| App name text | `learn` / `help` / `lmx` / `accounts` / `status` |
| Inner mark (inside the ring) | Orbit ellipse (Learn) · unique glyph per app |

### Current Status
| App | Status |
|-----|--------|
| Opta Learn | ✅ Canonical (template source) — `/design/logos/Opta-Learn/opta-learn-logo.png` |
| Opta Help | ⬜ Pending inner mark design |
| Opta Local (dashboard) | ⬜ Pending inner mark design |
| Opta Status | ⬜ Pending inner mark design |
| Opta Accounts | ⬜ Pending inner mark design |
| Opta LMX | ⬜ Pending inner mark design |
