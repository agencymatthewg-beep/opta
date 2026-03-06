# Opta Studio Design Library

The canonical reference for all reusable design primitives of the Opta Studio overlay system. Every Studio (Settings, Browser, Models, Atpo, and any future) is built from these primitives.

## What a Studio Is

A Studio is a glass overlay panel that opens from the Opta Code Desktop via keyboard shortcut. All Studios share identical chrome — only the content, sub-label, and accent colour differ.

| Studio   | Keybind  | Accent     | Purpose |
|----------|----------|------------|---------|
| Settings | Ctrl + , | `#a855f7`  | App configuration |
| Browser  | Ctrl + B | `#22d3ee`  | Browser & localhost management |
| Models   | Ctrl + M | `#a78bfa`  | Model lifecycle + inference routing |
| Atpo     | Ctrl + A | `#f472b6`  | App/module management |

---

## Directory Map

```
design/studio-system/
├── STUDIO-SYSTEM.md              ← this file (master reference)
│
├── tokens/
│   ├── studio-tokens.css         ← all --studio-* CSS custom properties
│   └── transition-tokens.css     ← all --opta-transition-* CSS custom properties
│
├── motion/
│   ├── logo-animation.css        ← Opta Text Logo complete CSS + stagger system
│   └── layer-variants.ts         ← Framer Motion variants for layer transitions
│
├── components/
│   ├── opta-text-logo.html       ← LIVE DEMO: all 4 Studio logo variants (open in browser)
│   ├── glass-shell.html          ← LIVE DEMO: glass shell with all layers
│   └── layer-transition-demo.html ← LIVE DEMO: CSS-only 3-layer depth animation
│
├── studio-template/
│   ├── StudioOverlay.tsx         ← base component (copy → rename → new Studio)
│   ├── studioConfig.ts           ← config template (fill in categories + accent)
│   └── studio-accent.css         ← accent override block (change 1 colour)
│
└── gemini/
    ├── GEMINI-CONTEXT-STUDIO.md  ← full system spec for Gemini design sessions
    └── GEMINI-CONTEXT-LOGO.md    ← Opta Text Logo spec for Gemini
```

---

## Creating a New Studio (Step-by-Step)

1. **Copy `studio-template/` to a new directory**
   ```
   cp -r design/studio-system/studio-template/ src/components/[name]-studio/
   ```

2. **Edit `studioConfig.ts`** — fill in:
   - Studio name + ID type
   - Category list (id, title, desc, icon from Lucide, accentColor)
   - Your Studio's primary accent hex

3. **Edit `studio-accent.css`** — change one line:
   ```css
   --studio-accent: #22d3ee;  /* replace with your accent */
   ```

4. **In `StudioOverlay.tsx`** — change the sub-label text:
   ```tsx
   <span className="opta-studio-logo-sub opta-studio-logo-browser">BROWSER</span>
   ```
   Add the corresponding CSS class to `motion/logo-animation.css` if it's a brand new Studio.

5. **Add keybinding in `App.tsx`** — 3 lines:
   ```tsx
   if (e.ctrlKey && key === 'b') {
     setBrowserStudioOpen(true);
     return;
   }
   ```

6. **Add lazy wrapper in `lazyAppModules.tsx`**
   ```tsx
   export const LazyBrowserStudio = React.lazy(() => import('./browser-studio/BrowserStudio'));
   ```

7. **Add E2E smoke test** — see `tests/e2e/settings-studio-keyboard.spec.ts` as the template.

---

## Key Design Rules

### What is locked (never change)
- Glass shell formula: background gradient, blur levels, border values
- Ease curve: always `cubic-bezier(0.22, 1, 0.36, 1)` for every transition
- Void black: always `#09090b`
- Font stack: Sora (UI) + JetBrains Mono (data/code) + Press Start 2P (logo only)
- Logo shadow recipe: 7-layer alternating void/accent stack
- Logo font smoothing: always disabled (`-webkit-font-smoothing: none`)
- Letter stagger: always 26ms increments
- Layer count: always three (L1 idle, L2 grid, L3 deep)
- Keyboard bindings: always the same nav keys (arrows, tab, esc, space, shift+space)

### What changes per Studio
- Sub-label text (SETTINGS / BROWSER / MODELS / ATPO / ...)
- Accent colour (one hex, applied to logo, borders, highlights)
- Category content (L2 grid items)
- L3 page content and layout
- Backdrop radial gradient tints (can shift hue toward the Studio's accent)

---

## Working with Gemini

1. Open Gemini
2. Paste `gemini/GEMINI-CONTEXT-STUDIO.md` into the prompt (or `GEMINI-CONTEXT-LOGO.md` for logo-only work)
3. Give your design brief — e.g. "Design the L2 category grid for the Browser Studio"
4. Gemini generates HTML using the Studio token system
5. Save the Gemini output as `components/[name]-gemini-mockup.html`
6. Bring the approved design to Claude for implementation

---

## Source References

These primitives are extracted from:
- `1P-Opta-Code-Universal/src/settings.css` — all tokens and logo CSS
- `1P-Opta-Code-Universal/src/App.tsx` — layer variants, keyboard system
- `1P-Opta-Code-Universal/src/components/SettingsModal.tsx` — logo HTML structure
- `1P-Opta-Code-Universal/src/components/settingsStudioConfig.ts` — config pattern
