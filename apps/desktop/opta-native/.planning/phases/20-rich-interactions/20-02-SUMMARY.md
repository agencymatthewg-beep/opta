# Plan 20-02 Summary: Design System Evolution

**Status:** Completed
**Date:** 2026-01-17
**Phase:** 20 - Rich Interactions

---

## Overview

Updated `DESIGN_SYSTEM.md` and core CSS with premium patterns from Gemini research. Implemented OLED-optimized background color, neon accent tokens, 4-layer glass effects with noise texture, and comprehensive documentation for WebGL components and animation presets.

---

## Changes Made

### 1. Base Background Color Updated (`src/index.css`)

**Before:**
```css
--background: 270 50% 3%;  /* Deep void black with purple hint */
```

**After:**
```css
--background: 240 6% 4%;   /* #09090b - deep grey-purple, avoids OLED black smear */
```

**Why:** True black (#000000) causes "black smear" on OLED displays during scroll. The new #09090b keeps pixels subtly active while maintaining deep darkness.

### 2. Neon Accent Color Tokens

**Added to `src/index.css`:**
```css
--neon-purple: 139 92 246;   /* #8b5cf6 - primary neon */
--neon-blue: 59 130 246;     /* #3b82f6 - secondary neon */
--neon-green: 34 197 94;     /* #22c55e - success neon */
--neon-amber: 245 158 11;    /* #f59e0b - warning neon */
--neon-red: 239 68 68;       /* #ef4444 - danger neon */
--neon-cyan: 6 182 212;      /* #06b6d4 - info/cool neon */

/* Neon glow intensities */
--neon-glow-sm: 0 0 10px;
--neon-glow-md: 0 0 20px;
--neon-glow-lg: 0 0 30px;
--neon-glow-xl: 0 0 50px;
```

**Added to `tailwind.config.js`:**
```javascript
neon: {
  purple: "rgb(var(--neon-purple) / <alpha-value>)",
  blue: "rgb(var(--neon-blue) / <alpha-value>)",
  green: "rgb(var(--neon-green) / <alpha-value>)",
  amber: "rgb(var(--neon-amber) / <alpha-value>)",
  red: "rgb(var(--neon-red) / <alpha-value>)",
  cyan: "rgb(var(--neon-cyan) / <alpha-value>)",
}
```

### 3. Enhanced Glass Effects (4-Layer System)

**New `.glass`, `.glass-subtle`, `.glass-strong` implementations:**

1. **Backdrop** - Content visible behind glass
2. **Blur Pass** - Gaussian blur (8px/12px/20px)
3. **Noise Overlay** - SVG noise texture prevents OLED color banding
4. **Specular Highlight** - Top edge light reflection via `inset` box-shadow

**Key Features:**
- Linear gradient backgrounds for depth
- Saturation boost (150-180%)
- SVG-based noise texture data URI
- Specular top-edge highlight

### 4. Neon Utility Classes

**New component classes:**
- `.neon-glow` - Text glow with neon-purple
- `.neon-glow-strong` - Stronger text glow
- `.neon-glow-border` - Box shadow glow
- `.neon-active` - Active state with border + glow
- `.neon-glow-blue/green/amber/red/cyan` - Color variants
- `.momentum-border` - CSS traveling light effect (static approximation)

### 5. RGB Variables for Alpha Manipulation

**New variables:**
```css
--card-rgb: 12 12 18;       /* For gradient overlays with alpha */
--background-rgb: 9 9 11;   /* For backdrop effects with alpha */
```

These enable glass effects to use `rgb(var(--card-rgb) / 0.5)` syntax for clean alpha transparency.

### 6. DESIGN_SYSTEM.md Major Update (v2.0)

**New/Enhanced Sections:**
- **Part 3:** OLED optimization explanation
- **Part 4:** 4-layer glass effect documentation with examples
- **Part 5:** Animation presets (spring configs, ignition pattern)
- **Part 6:** WebGL effects (when to use CSS vs WebGL, performance guidelines)
- **Part 7:** Z-layering composition strategy
- **Part 12:** Momentum Border documentation
- **Changelog:** Version history

**Table of Contents:** Now includes links to all 13 parts

**Enforcement Rules:** Updated to include:
- No true black (#000000) for backgrounds
- No neon colors for non-active states

---

## Files Modified

| File | Changes |
|------|---------|
| `src/index.css` | Background color, RGB variables, neon tokens, glass effects, neon utilities, momentum border |
| `tailwind.config.js` | Neon color palette added |
| `DESIGN_SYSTEM.md` | Complete v2.0 rewrite with premium patterns |

---

## Verification

### CSS Compilation
```bash
npx tailwindcss -i src/index.css -o /tmp/test-output.css --minify
# Result: Done in 476ms (success)
```

### Vite Build
```bash
npx vite build --mode development
# Result: built in 3.25s (success)
```

**Note:** TypeScript errors exist in unrelated files (pre-existing issues). The CSS and design system changes compile and build correctly.

---

## Design System Highlights

### Neon Usage Guidelines (Per Gemini Research)

| Scenario | Use Neon? |
|----------|-----------|
| Button hover | No - use subtle opacity |
| Active/selected item | Yes |
| Current focus indicator | Yes |
| Static text | No |
| Every card border | No - too distracting |

### Glass Variants

| Class | Blur | Border | Use Case |
|-------|------|--------|----------|
| `.glass-subtle` | 8px | 10% white | Secondary containers |
| `.glass` | 12px | 15% white | Primary containers |
| `.glass-strong` | 20px | 20% white | Overlays, hero elements |

### Z-Layering Constants

```typescript
Z_LAYERS = {
  BACKGROUND: -10,
  GLASS_PANEL: -5,
  NEON_GLOW: -1,
  CONTENT: 0,
  OVERLAY: 10,
  TOOLTIP: 20,
  LOADING: 30,
  TOAST: 40,
  MAX: 50,
}
```

---

## Dependencies on Other Plans

- **20-00 (WebGL Foundation):** GlassPanel, NeonBorder components referenced
- **20-01 (Animation System):** Spring presets documented, animation lib referenced

---

## Next Steps

- Plan 20-03 can now use neon utilities for active states
- Plan 20-04 can leverage Z_LAYERS for composition
- All future UI work should follow v2.0 design system

---

*Completed: 2026-01-17*
*Author: Claude Opus 4.5*
