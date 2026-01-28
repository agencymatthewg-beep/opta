# /gu - Visual Guide Generator

Generate a comprehensive, branded HTML visual guide for any topic using Opta's obsidian glass aesthetic.

## Instructions

When this command is invoked with a topic:

1. **Gather content** - Read relevant files, design docs, or use conversation context
2. **Generate a rich HTML document** that presents the information using Opta's visual language:
   - Obsidian glass panels (backdrop-blur, border-white/10, #09090b base)
   - Electric Violet accents (#8B5CF6) for active/important elements
   - Sora font for headings, system fonts for body
   - Neon glow effects on section headers
   - Particle-style decorative elements (CSS)
   - Spring-physics-inspired CSS transitions
   - 3-level glass depth hierarchy (subtle, content, overlay)
   - Moonlight gradient for primary headings

3. **Write the HTML file** to the project root as `gu-{topic}.html`
4. **Open it** in the default browser via `open gu-{topic}.html`

## Visual Requirements

The HTML MUST embody the Opta atmosphere:
- Background: `#09090b` (never true black)
- Surfaces: Glass panels with `backdrop-filter: blur()` and noise overlay
- Accents: Electric Violet `#8B5CF6` for borders, glows, highlights
- Text: White `#fafafa` primary, `#a1a1aa` secondary, `#52525b` muted
- Headers: Moonlight gradient (white to purple/indigo)
- Borders: `rgba(255,255,255,0.1)` with gradient from top-left to bottom-right
- Shadows: Large, soft, dark (`rgba(0,0,0,0.3)` radius 20-40px)
- Animations: Smooth CSS transitions, subtle breathing glows
- Section dividers: Thin neon lines with glow
- Cards: Rounded 16px corners, glass blur, specular top-edge highlight

## Color Tokens (CSS)

```css
--void: #09090b;
--surface: #18181b;
--elevated: #27272a;
--border: #3f3f46;
--text-primary: #fafafa;
--text-secondary: #a1a1aa;
--text-muted: #52525b;
--primary: #8b5cf6;
--primary-glow: #a855f7;
--neon-blue: #3b82f6;
--neon-green: #22c55e;
--neon-amber: #f59e0b;
--neon-red: #ef4444;
```

## Usage

```
/gu brand-atmosphere
/gu phase-79-summary
/gu architecture-overview
```

Argument specifies the topic. If no argument, use conversation context.
