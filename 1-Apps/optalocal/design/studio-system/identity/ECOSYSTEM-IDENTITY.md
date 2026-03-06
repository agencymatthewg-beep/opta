# Opta Feature Identity System

This is the canonical colour and identity spec for the three cross-cutting Opta features.
Every surface in the optalocal ecosystem — CLI TUI, desktop overlays, web apps, Opta Learn guides — must use these exact identities.

---

## The Three Feature Identities

### BROWSER — Cyan
```
Hex:          #22d3ee
RGB:          34, 211, 238
Name:         Neon Cyan / Browser Cyan
Usage:        Everything related to browser automation, localhost management,
              live previews, and web session control
```

### MODELS — Soft Violet
```
Hex:          #a78bfa
RGB:          167, 139, 250
Name:         Soft Violet / Models Violet
Usage:        Everything related to LMX model management, inference routing,
              model loading/unloading, quantization, benchmarks
```

### ATPO — Pink
```
Hex:          #f472b6
RGB:          244, 114, 182
Name:         Hot Pink / Atpo Pink
Usage:        Everything related to Atpo — app/module management, fleet,
              install/update/uninstall, app permissions
```

---

## Surface Sync Matrix

| Surface | Browser `#22d3ee` | Models `#a78bfa` | Atpo `#f472b6` |
|---------|-------------------|------------------|----------------|
| **Desktop Settings Studio** | `browser-research` category accent | `lmx-models` category accent | N/A (no Atpo category yet) |
| **Browser Studio (Ctrl+B)** | Shell accent, sub-label, borders | — | — |
| **Models Studio (Ctrl+M)** | — | Shell accent, sub-label, borders | — |
| **Atpo Studio (Ctrl+A)** | — | — | Shell accent, sub-label, borders |
| **CLI SettingsOverlay PAGES** | `advanced` → should become `browser` | `models` (✓ already correct) | `atpo` (currently wrong: `#c084fc` → fix to `#f472b6`) |
| **CLI TUI_COLORS palette.ts** | `browser: '#22d3ee'` | `models: '#a78bfa'` | `atpo: '#f472b6'` |
| **CLI OptaMenuOverlay** | Browser item accent | Models item accent | Atpo item accent |
| **optalocal.com (1T-Opta-Home)** | Browser feature highlight | Models feature highlight | Atpo feature highlight |
| **Opta Learn (1V)** | Browser guide card accent | Models guide card accent | Atpo guide card accent |
| **Opta LMX Dashboard (1L)** | — | Models section accent | — |
| **Opta Help docs (1U)** | Browser section callout | Models section callout | Atpo section callout |
| **Gemini context files** | `--studio-accent: #22d3ee` | `--studio-accent: #a78bfa` | `--studio-accent: #f472b6` |

---

## CSS Custom Properties (Web Surfaces)

Add to `:root` in any optalocal web app to get the feature identity system:

```css
/* Opta Feature Identity Tokens */
--opta-feature-browser:       #22d3ee;
--opta-feature-browser-glow:  rgba(34, 211, 238, 0.35);
--opta-feature-browser-soft:  rgba(34, 211, 238, 0.12);
--opta-feature-browser-border: rgba(34, 211, 238, 0.28);

--opta-feature-models:        #a78bfa;
--opta-feature-models-glow:   rgba(167, 139, 250, 0.35);
--opta-feature-models-soft:   rgba(167, 139, 250, 0.12);
--opta-feature-models-border: rgba(167, 139, 250, 0.28);

--opta-feature-atpo:          #f472b6;
--opta-feature-atpo-glow:     rgba(244, 114, 182, 0.35);
--opta-feature-atpo-soft:     rgba(244, 114, 182, 0.12);
--opta-feature-atpo-border:   rgba(244, 114, 182, 0.28);
```

Full file: `identity/ecosystem-identity-tokens.css`

---

## CLI TUI Colour Additions (palette.ts)

Add these to `TUI_COLORS` in `1D-Opta-CLI-TS/src/tui/palette.ts`:

```typescript
// Feature identity colours — synced with web and desktop
browser: '#22d3ee',   // Opta Browser — cyan
models:  '#a78bfa',   // Opta Models — soft violet
atpo:    '#f472b6',   // Opta Atpo — pink
```

Full file: `identity/cli-identity-tokens.ts`

---

## CLI Settings Pages — Required Fix

The `PAGES` array in `SettingsOverlay.tsx` currently has a colour mismatch.

**Current (wrong):**
```typescript
{ id: 'atpo',     label: 'Atpo',     color: '#c084fc' },  // ← should be pink
{ id: 'advanced', label: 'Advanced', color: '#22d3ee' },  // ← cyan should belong to browser
```

**Correct (canonical):**
```typescript
{ id: 'models',   label: 'Models',   color: '#a78bfa' },  // ✓ already correct
{ id: 'atpo',     label: 'Atpo',     color: '#f472b6' },  // fix: c084fc → f472b6
{ id: 'advanced', label: 'Advanced', color: '#94a3b8' },  // fix: cyan freed from advanced
// When browser-specific settings page is added:
{ id: 'browser',  label: 'Browser',  color: '#22d3ee' },  // reserve cyan for this
```

---

## Opta Learn Guide Accent Classes

In `1V-Opta-Learn`, guide cards referencing these features should use:

```tsx
// Guide card with feature accent
<div className="guide-card" data-feature="browser">  // applies cyan accent
<div className="guide-card" data-feature="models">   // applies violet accent
<div className="guide-card" data-feature="atpo">     // applies pink accent
```

Or in inline styles:
```tsx
style={{ borderColor: 'var(--opta-feature-browser)' }}
style={{ borderColor: 'var(--opta-feature-models)' }}
style={{ borderColor: 'var(--opta-feature-atpo)' }}
```

---

## Relationship to Global Opta Brand

These feature colours sit ABOVE the global Opta brand tokens in the hierarchy:

```
Global: --opta-primary #8b5cf6 (Electric Violet — the Opta brand)
         ↓
Studio:  --studio-* (deep space blue atmosphere)
         ↓
Feature: --opta-feature-browser / --opta-feature-models / --opta-feature-atpo
         (the three cross-cutting product areas)
```

The global violet (`#8b5cf6`) is reserved for Opta the brand — buttons, CTAs, active states.
The feature colours are used specifically to identify and colour-code the three product areas.

---

## What NOT to Confuse

| Colour | What It Is | What It's NOT |
|--------|-----------|---------------|
| `#8b5cf6` | Opta brand primary | Not Browser, not Models, not Atpo |
| `#a855f7` | Opta brand glow / Settings Studio | Not Models (Models = `#a78bfa`) |
| `#a78bfa` | Models feature identity | Not the Opta brand (close but distinct) |
| `#22d3ee` | Browser feature identity | Not a general "info" colour in Studios |
| `#f472b6` | Atpo feature identity | Not Atpo → `#c084fc` (that was wrong) |
| `#c084fc` | Available for general use | Not Atpo identity (corrected away) |
