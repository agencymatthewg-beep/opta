# Opta Studio System — Gemini Design Context

Drop this file into your Gemini session when designing any new Studio overlay or adapting an existing one. It contains the complete, exact specification for the Opta Studio visual system.

---

## What a Studio Is

A Studio is a fullscreen-capable glass overlay panel that opens from the Opta Code Desktop app via keyboard shortcut. Currently there is one Studio (Settings, Ctrl+,). We are building more:

| Studio   | Keybind  | Purpose |
|----------|----------|---------|
| Settings | Ctrl + , | App configuration (17 categories) |
| Browser  | Ctrl + B | Browser sessions + localhost management |
| Models   | Ctrl + M | LMX model lifecycle + inference routing |
| Atpo     | Ctrl + A | App/module management |

Every Studio is identical in chrome (glass shell, backdrop, logo, fullscreen, layer nav). Only the content differs.

---

## Foundation Colours (Non-negotiable)

```css
/* Background — NEVER use pure black */
--void: #09090b;      /* main app background */

/* Studio atmosphere palette (deep space blue) */
--studio-atmo-0: #040b18;   /* deepest — backdrop base */
--studio-atmo-1: #091327;
--studio-atmo-2: #10203b;
--studio-atmo-3: #1a2d4f;   /* lightest surface */

/* Foundation colours */
--opta-primary:      #8b5cf6;   /* Electric Violet — primary brand */
--opta-primary-glow: #a855f7;   /* lighter violet for glows */
```

---

## Studio Token Set

```css
:root {
  /* Overlay tints */
  --studio-ice:   rgba(197, 223, 255, 0.38);
  --studio-lilac: rgba(171, 126, 255, 0.42);
  --studio-cyan:  rgba(102, 226, 255, 0.46);

  /* Surfaces */
  --studio-surface: linear-gradient(140deg,
    rgba(18, 34, 60, 0.72) 0%,
    rgba(12, 24, 43, 0.56) 45%,
    rgba(8, 16, 30, 0.64) 100%);

  /* Borders */
  --studio-border:        rgba(167, 204, 255, 0.24);
  --studio-border-strong: rgba(203, 226, 255, 0.34);
  --studio-border-accent: rgba(167, 124, 255, 0.45);

  /* Text */
  --studio-text:       #eef4ff;
  --studio-text-soft:  #b5c6e7;
  --studio-text-muted: #8b9bbc;

  /* Radius */
  --studio-radius-xs: 8px;
  --studio-radius-sm: 12px;
  --studio-radius-md: 18px;
  --studio-radius-lg: 24px;  /* shell corners */

  /* Blur */
  --studio-blur-sm: blur(10px) saturate(140%);   /* backdrop */
  --studio-blur-md: blur(18px) saturate(155%);   /* shell */
  --studio-blur-lg: blur(28px) saturate(165%);   /* elevated panels */

  /* Shadows */
  --studio-shadow-sm: 0 8px 22px rgba(3, 7, 19, 0.45);
  --studio-shadow-md: 0 18px 48px rgba(3, 8, 22, 0.52);
  --studio-shadow-lg: 0 26px 80px rgba(2, 6, 18, 0.58);

  /* The ONE ease curve used for everything */
  --studio-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## Transition Timing System

All motion uses the same ease curve. Only duration varies by element type.

```css
/* Logo letters (OPTA) — slowest, most dramatic */
--opta-transition-logo-duration: 340ms;
--opta-transition-logo-ease:     cubic-bezier(0.22, 1, 0.36, 1);

/* Studio overlay entering/exiting screen */
--opta-transition-overlay-duration: 320ms;
--opta-transition-overlay-ease:     cubic-bezier(0.22, 1, 0.36, 1);

/* Layer navigation (L1→L2→L3) — fastest, snappy */
--opta-transition-layer-duration: 220ms;
--opta-transition-layer-ease:     cubic-bezier(0.22, 1, 0.36, 1);
```

---

## Glass Shell Structure

The main overlay panel has this exact visual recipe:

```css
.opta-studio-shell {
  width:  min(940px, 95vw);
  height: min(730px, 92vh);

  background: var(--studio-surface);
  backdrop-filter: blur(18px) saturate(155%);
  border: 1px solid var(--studio-border);
  border-radius: var(--studio-radius-lg);  /* 24px */

  box-shadow:
    var(--studio-shadow-lg),                           /* main depth */
    inset 0 1px 0 rgba(255, 255, 255, 0.24),           /* top specular edge */
    inset 0 -1px 0 rgba(130, 169, 255, 0.22);          /* bottom blue tint edge */
}
```

The shell has two pseudo-elements:
- `::before` — two radial gradient light sources (top-left violet, bottom-right cyan)
- `::after`  — dot-grid noise texture (28px grid, soft-light blend, 0.18 opacity)

---

## Backdrop

The screen-covering overlay behind the shell:

```css
.opta-studio-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background:
    radial-gradient(1200px 700px at 82% 14%, rgba(136, 88, 255, 0.23), transparent 62%),
    radial-gradient(900px 620px at 12% 78%, rgba(55, 179, 255, 0.16), transparent 58%),
    linear-gradient(155deg, rgba(6, 12, 24, 0.84), rgba(6, 10, 18, 0.75));

  backdrop-filter: blur(10px) saturate(140%);
}
```

---

## Layer Navigation System

Every Studio has three layers:

| Layer | Name | Content |
|-------|------|---------|
| L1 | App Idle | Studio is not yet open |
| L2 | Category Grid | Grid of categories (like a menu of sub-sections) |
| L3 | Deep Page | The actual content for a selected category |

**Navigation is keyboard-driven:**
- `Arrow keys` — move selection in L2 grid
- `Tab / Enter` — descend to L3
- `Escape / Space / Backspace` — ascend back
- `Shift + Space` — toggle fullscreen (available in any layer)

The depth transition uses scale + translate + blur to simulate 3D:
- Going deeper (L2→L3): current shrinks/blurs backward, new emerges from front
- Going shallower: current expands/sharpens forward, previous returns

---

## Opta Text Logo

See `GEMINI-CONTEXT-LOGO.md` for the complete logo specification.

**Quick reference:**
- Font: Press Start 2P (Google Fonts)
- Letters: OPTA, 2.2rem, staggered 26ms delays
- Sub-label: Studio name in the same font, smaller, same ease, max-height animation
- Shadow: 7-layer alternating void/accent stack
- Accent: changes per Studio (see table below)

---

## Studio Accent Colours

| Studio   | Accent Hex | RGB |
|----------|------------|-----|
| Settings | `#a855f7`  | 168, 85, 247 |
| Browser  | `#22d3ee`  | 34, 211, 238 |
| Models   | `#a78bfa`  | 167, 139, 250 |
| Atpo     | `#f472b6`  | 244, 114, 182 |

The accent colour is used for:
- Logo sub-label colour
- Grid category card hover/active border
- Grid category card accent strip
- Active highlight ring in L2/L3

---

## Typography System

```
UI text:   Sora (Google Fonts) — weights 300, 400, 500, 600, 700
Code/data: JetBrains Mono (Google Fonts) — weights 400, 500, 600
Logo:      Press Start 2P (Google Fonts) — weight 400 only

Font size scale:
  Hero/logo:    2.2rem (large) → 1.2rem (minimized)
  Section:      1.1rem
  Body:         0.9rem, 0.88rem
  Small/label:  0.82rem, 0.78rem
  Micro/tag:    0.72rem, 0.7rem
  Mono/code:    0.8rem, 0.76rem
```

---

## What Gemini Can Freely Design

- L2 category grid layout and category names
- L3 page content and layout for specific categories
- Icon choices (must be from Lucide React icon set)
- Category descriptions (short, functional)
- Additional radial gradient accents in the backdrop (following the existing pattern)

## What Gemini Must NOT Change

- Glass shell formula (background gradient, blur levels, border values)
- Transition ease curve: always `cubic-bezier(0.22, 1, 0.36, 1)`
- Void black: always `#09090b`
- Font stack (Sora / JetBrains Mono / Press Start 2P)
- Logo system (see GEMINI-CONTEXT-LOGO.md)
- The three-layer navigation concept (L1/L2/L3)
- Keyboard navigation bindings
