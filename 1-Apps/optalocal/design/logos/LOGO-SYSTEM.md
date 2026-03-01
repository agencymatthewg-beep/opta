# Opta Local — Logo System

> Established: 2026-03-01. All app logos in the Opta Local ecosystem share a single canonical template. Only two elements vary per app.

---

## ✅ The Canonical Logo (Template Source)

**File:** `/design/logos/opta-logo-template.html`
**Rendered reference:** `/design/logos/Opta-Learn/opta-learn-logo.png` (Opta Learn — first full-quality render)

---

## What Every App Logo Shares (Locked — Do Not Change)

### 1. General Aesthetic, Style & Colouring
- Void black background: radial gradient `#0d0c14` (centre) → `#09090b` (edge)
- Gravitational particle field: 120 violet/white particles biased toward the ring, density falling off with distance (inverse-square distribution)
- 30 bright inner sparks concentrated at the ring radius
- Two-layer violet ambient glow (tight core bloom + wide soft halo)

### 2. The Outer Ring
- 3-layer depth system:
  - Outermost halo: `stroke="#a855f7"` `stroke-width="6"` `stroke-opacity="0.06"`
  - Mid soft ring: `stroke="#a855f7"` `stroke-width="3"` `stroke-opacity="0.10"`
  - Main ring: `stroke="url(#ringHighlight)"` `stroke-width="1.6"` — gradient arc from `#c084fc` (top-left) to `#4c1d95` (bottom-right) with feGaussianBlur glow filter
  - Inner edge trace: `stroke="#a855f7"` `stroke-width="0.6"` `stroke-opacity="0.12"`
- Deep void fill inside the ring: radial gradient `#100e18` → `#09090b`

### 3. The Orbit Ellipse
- Gradient stroke `#c084fc` → `#7c3aed` with glow filter
- Sharp edge overlay for crispness
- Two orbit node dots: periapsis (brighter, `#c084fc`) + apoapsis (dimmer, `#a855f7`)

### 4. The Centre Point
- Layered: large soft radial bloom → inner glow filter → crisp core dot (`#f5d0fe`) → bright specular flare offset top-left (`#ffffff`)

### 5. Typography (Wordmark)
- Font: **Sora SemiBold 600**, tracking `0.22em`, uppercase
- "opta local" — colour `#71717a` (muted grey)
- Vertical divider — `rgba(113,113,122,0.35)`
- App name — colour **`#a855f7`** (Electric Violet, purple glow highlighted)

---

## What Changes Per App (The Only Two Variables)

| Variable | Description |
|----------|-------------|
| **App name text** | The word after the divider (e.g. `learn`, `help`, `lmx`, `accounts`, `status`) |
| **Inner mark** | The unique symbol/glyph inside the large outer circle (currently: orbit ellipse + node dots = Opta Learn's mark) |

All other elements — ring, background, particles, glow, typography style, colour palette — are **identical across all apps**.

---

## App Logo Status

| App | App Name Text | Inner Mark | Logo Status |
|-----|--------------|------------|-------------|
| **Opta Learn** | `learn` (violet) | Orbit ellipse + 2 nodes | ✅ Canonical (template source) |
| **Opta Help** | `help` (violet) | TBD | ⬜ Not yet rendered |
| **Opta Local** (dashboard) | `local` (violet) | TBD | ⬜ Not yet rendered |
| **Opta Status** | `status` (violet) | TBD | ⬜ Not yet rendered |
| **Opta Accounts** | `accounts` (violet) | TBD | ⬜ Not yet rendered |
| **Opta LMX** | `lmx` (violet) | TBD | ⬜ Not yet rendered |

---

## Rendering Instructions

1. Open `opta-logo-template.html`
2. Change the wordmark app name text (single word after the divider)
3. Replace the inner SVG mark within the outer ring with the app-specific glyph
4. Render at `device_scale_factor=4.0`, `600×600` viewport using the Chromium headless shell
5. Save to `/design/logos/<App-Name>/<app-slug>-logo.png`
