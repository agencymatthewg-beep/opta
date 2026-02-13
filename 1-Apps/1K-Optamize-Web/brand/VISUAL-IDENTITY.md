# Optamize Visual Identity Notes

## Color System

### Primary: Electric Violet `#8b5cf6`

**Why purple works for Optamize:**
- **Ambition without aggression.** Blue says "trust me" (boring). Red says "BUY NOW" (desperate). Purple says "I'm doing something different."
- **Youth + craft.** Purple skews younger than navy or charcoal. It signals creativity without being as chaotic as orange or pink.
- **Premium without pretension.** Purple has luxury associations (royalty, rare dyes) but Electric Violet specifically feels energetic, not stuffy.
- **Differentiation.** CleanMyMac = teal. Raycast = orange. Arc = blue. Linear = purple-blue but muted. Optamize's violet is bolder — own it.

### Extended Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Primary | Electric Violet | `#8b5cf6` | CTAs, highlights, brand marks |
| Primary Light | Soft Lavender | `#c4b5fd` | Hover states, secondary elements |
| Primary Dark | Deep Violet | `#6d28d9` | Pressed states, dark accents |
| Background | Near Black | `#0a0a0f` | App backgrounds, hero sections |
| Surface | Charcoal Glass | `#1a1a2e` | Cards, modals, elevated surfaces |
| Text Primary | Off-White | `#f0f0f5` | Body text on dark |
| Text Secondary | Muted Lavender | `#a0a0b8` | Captions, metadata |
| Success | Mint | `#34d399` | Completions, positive states |
| Warning | Amber | `#fbbf24` | Caution states |
| Error | Coral | `#f87171` | Error states |
| Accent (sparingly) | Hot Pink | `#ec4899` | Special highlights, badges |

### Color Rules
- Purple is the **hero**. It should appear in every screen but never overwhelm — use it for the 1-2 most important elements.
- Dark backgrounds are non-negotiable. This is a nighttime brand. Light mode is secondary.
- Gradients: violet → deep violet (subtle), or violet → hot pink (for energy). Never violet → blue (looks like every other tech brand).

---

## Typography

### Current: Sora
Sora is solid — geometric, modern, good weight range. Keep it as the **body font**.

### Recommended Additions

| Role | Font | Why |
|---|---|---|
| Display / Hero | **Satoshi** | Geometric like Sora but with more character in the curves. Feels designed, not default. Free on Fontshare. |
| Accent / Taglines | **Cabinet Grotesk** | Bolder, more expressive. Great for punchy one-liners. Free on Fontshare. |
| Monospace (code/stats) | **JetBrains Mono** | Clean, purposeful. For scan results, system stats, anything technical. |
| Alternative Display | **General Sans** | If Satoshi feels too similar to Sora, this has slightly more warmth. |

### Typography Rules
- **Headlines:** Satoshi Bold or Cabinet Grotesk Bold. Tight tracking (-0.02em).
- **Body:** Sora Regular/Medium. Comfortable line-height (1.6).
- **Stats/Data:** JetBrains Mono. Makes numbers feel precise and trustworthy.
- **Never:** Rounded/bubbly fonts (too playful), serif fonts (too editorial), handwritten fonts (too craft-market).

---

## Textures & Patterns

### What gives Optamize a handcrafted feel:

1. **Film grain overlay** — Subtle, 2-4% opacity. Makes flat gradients feel analog. Apply to hero sections and backgrounds.

2. **Noise gradients** — Instead of smooth CSS gradients, use grainy/dithered gradients. Tools: [grainy-gradients.vercel.app](https://grainy-gradients.vercel.app). This is the single biggest anti-AI-look move.

3. **Mesh gradients** — Organic, blobby gradients (not linear/radial). 2-3 color stops with purple + dark blue + black. Think aurora, not rainbow.

4. **Subtle grid patterns** — Fine dotted or lined grids at 3-5% opacity on surfaces. Suggests precision without being loud.

5. **Glassmorphism (refined)** — Keep the glass/blur effects but add:
   - Thin 1px borders with 10% white opacity
   - Slight inner shadow
   - Noise texture on the glass surface (this makes it feel physical)

### Texture Anti-Patterns (Avoid)
- Clean, perfectly smooth gradients with no texture (screams "Figma default")
- Excessive blur/glow (looks like a Midjourney prompt)
- Chrome/metallic text effects
- Perfectly symmetrical abstract shapes

---

## Icon Style Guide

### Style: Outlined, Geometric, Slightly Rounded

- **Stroke weight:** 1.5px at 24px size (scales proportionally)
- **Corner radius:** 2px (not fully rounded — that's too friendly/generic)
- **Grid:** Design on 24x24 grid, 2px padding
- **Fill:** Outline only by default. Filled variant for active/selected states.
- **Color:** Single color (white on dark, violet for emphasis). Never multicolor.

### Icon Personality
- Icons should feel **precise**, like tools in a workshop
- Avoid cute/playful metaphors (no smileys, no cartoon animals)
- Prefer literal metaphors: a gauge for performance, a magnifying glass for scan, a list for tasks
- **Unique touch:** Incorporate a subtle diagonal cut or chamfer in one corner of key icons — creates a recognizable "Opta cut" motif

### App Icons
- Unified shape: Rounded square (follows Apple HIG)
- Each app gets a unique gradient within the violet family
- Opta: violet → deep violet (core, authoritative)
- Opta Scan: violet → hot pink (scanning energy)
- Opta Life: violet → mint (life, growth)
- AICompare: violet → amber (analysis, comparison)

---

## Photography & Illustration Direction

### Photography (for marketing, website)
- **Style:** Real setups, real desks, real screens. Slightly moody lighting (not overexposed stock photos).
- **Color grading:** Cool shadows, slightly lifted blacks, violet tint in highlights.
- **Subjects:** Actual MacBooks, iPhones. Close-up details (keyboard corners, screen reflections, cable textures).
- **Never:** Stock photos of people pointing at screens. Diverse-team-around-a-whiteboard. Handshake photos.

### Illustration
- **Style:** Minimal, geometric, monoline or duotone.
- **Use for:** Explaining concepts (how scans work, what gets cleaned), empty states, onboarding.
- **Palette:** Violet + off-white only. Occasionally mint for positive states.
- **Never:** 3D rendered blobs. Isometric office scenes. Cartoon characters.

---

## Anti-AI-Generated Checklist

Things that make visuals look AI-generated (avoid all):

1. ❌ **Perfect symmetry everywhere** — Introduce intentional asymmetry in layouts
2. ❌ **Overly smooth gradients** — Add grain, noise, dithering
3. ❌ **Generic abstract hero images** — Use real product screenshots or specific illustrations
4. ❌ **"Glowing orb" backgrounds** — If you must glow, make it subtle and off-center
5. ❌ **Too many colors** — Constrain to the palette. AI loves rainbows.
6. ❌ **Meaningless geometric patterns** — Every visual element should have a reason
7. ❌ **Perfectly centered everything** — Use deliberate off-grid placement occasionally
8. ❌ **Stock illustration style** (Humaaans, undraw knockoffs) — Commission or create custom
9. ❌ **Glossy 3D text** — Flat or subtly extruded, never glossy
10. ❌ **"Dark mode but make it neon"** — Violet is the accent, not a blacklight

### What DOES feel human:
- Slightly imperfect alignment that's clearly intentional (magazine layout influence)
- Textures that reference physical materials (paper grain, screen noise, film dust)
- Photography with actual depth of field and lighting imperfections
- Copy that sounds like a person wrote it (see BRAND-VOICE.md)
- Whitespace used generously and confidently
- Details that reward close looking (micro-interactions, easter eggs, hover states)
