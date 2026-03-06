# Opta Text Logo — Gemini Design Context

Drop this file into your Gemini session when designing anything that involves the Opta Text Logo. This is the complete, exact specification — Gemini should follow it precisely and not improvise the typography system.

---

## The Logo System

The Opta Text Logo consists of two parts:
1. **The OPTA lettermark** — four animated letters using Press Start 2P (pixel font)
2. **The Studio sub-label** — a smaller line beneath that names the Studio (e.g. SETTINGS, BROWSER, MODELS)

These two parts are the **identity system for every Opta Studio overlay**. The lettermark is always identical across all Studios. Only the sub-label text and accent colour change per Studio.

---

## Font

```
Font family: 'Press Start 2P', monospace
Source:      Google Fonts (https://fonts.google.com/specimen/Press+Start+2P)
Font weight: 400 (the only available weight)

Font smoothing: DISABLED on all logo text
  -webkit-font-smoothing: none
  -moz-osx-font-smoothing: auto
  font-smooth: never

Reason: The pixel art aesthetic requires crisp, aliased rendering.
        Smoothing destroys the intentional pixelated look.
```

---

## Lettermark Sizes

```
Large state (Studio open at L1 idle):
  font-size: 2.2rem per letter

Minimized state (Studio at L2/L3):
  font-size: 1.2rem per letter

Sub-label:
  font-size: 1.1rem (in full Studio shell)
  font-size: 0.72rem (in compact/demo context)
  letter-spacing: 0.18em
  text-transform: uppercase
```

---

## Shadow Recipe

The text-shadow is a 7-layer stack. The pattern alternates void black and accent colour, creating a "raised pixel" 3D effect.

```css
text-shadow:
  2px 2px 0 #09090b,              /* void depth edge, layer 1 */
  3px 3px 0 #09090b,              /* void depth edge, layer 2 */
  4px 4px 0 [ACCENT],             /* colour fill, layer 1 */
  5px 5px 0 [ACCENT],             /* colour fill, layer 2 */
  7px 7px 0 #09090b,              /* void cap, layer 1 */
  8px 8px 0 #09090b,              /* void cap, layer 2 */
  9px 9px 0 [ACCENT];             /* accent continuation */
```

`[ACCENT]` = the Studio's accent colour (see Accent Colours below).
`#09090b` = Opta void black — always this exact value, never pure black.

### Sub-label shadow (reduced, 3 layers):
```css
text-shadow:
  1px 1px 0 #09090b,
  2px 2px 0 #09090b,
  3px 3px 0 [ACCENT];
```

---

## Ambient Glow Filter

Applied to each letter via `filter: drop-shadow()`:
```css
/* Large state */
filter: drop-shadow(0 0 20px [ACCENT at 32% opacity]);

/* Sub-label */
filter: drop-shadow(0 0 14px [ACCENT at 24% opacity]);
```

---

## Animation

### Letter stagger (CSS transitions):
Each letter transitions independently with a stagger delay of 26ms per letter.

```css
/* Transitions applied to: transform, filter, text-shadow, font-size */
transition-duration: 340ms;
transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);

letter-1 transition-delay: 0ms;
letter-2 transition-delay: 26ms;
letter-3 transition-delay: 52ms;
letter-4 transition-delay: 78ms;
```

### Sub-label appearance (max-height animation):
The sub-label container uses `max-height` + `opacity` to animate in/out:
```css
/* Hidden state */
max-height: 0;
opacity: 0;
overflow: hidden;

/* Visible state */
max-height: 2.5rem;
opacity: 1;

/* Transition (same duration/ease as letters) */
transition: max-height 340ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity    340ms cubic-bezier(0.22, 1, 0.36, 1);
```

---

## Accent Colours per Studio

| Studio   | Keybind  | Accent Hex | Use for |
|----------|----------|------------|---------|
| Settings | Ctrl + , | `#a855f7`  | violet — matches --opta-primary-glow |
| Browser  | Ctrl + B | `#22d3ee`  | cyan |
| Models   | Ctrl + M | `#a78bfa`  | soft violet |
| Atpo     | Ctrl + A | `#f472b6`  | pink |

---

## HTML Structure

```html
<div class="opta-logo-wrap">
  <div class="opta-logo-letters">
    <span class="opta-letter">O</span>
    <span class="opta-letter">P</span>
    <span class="opta-letter">T</span>
    <span class="opta-letter">A</span>
  </div>
  <div class="opta-logo-reserve [visible]">
    <span class="opta-logo-sub">SETTINGS</span>  <!-- or BROWSER, MODELS, ATPO -->
  </div>
</div>
```

Add class `visible` to `.opta-logo-reserve` to show the sub-label.

---

## What Gemini Can Adapt

- Sub-label text (must be SHORT — max 8 characters — to fit in the reserved space)
- Accent colour (must be from the Studio table above, or a new colour for a new Studio)
- The background context around the logo (the glass shell, backdrop)

## What Gemini Must NOT Change

- The font: always Press Start 2P
- The shadow recipe structure (7 layers, alternating void/accent)
- The void black value: always #09090b
- The ease curve: always cubic-bezier(0.22, 1, 0.36, 1)
- The letter stagger increment: always 26ms
- The font smoothing: always disabled
