# Opta Design System: The Obsidian Standard

> **CORE DIRECTIVE**: The UI is a "Living Artifact." It defaults to a dark, glossy Obsidian state (0%) and reacts to user interaction with Bioluminescent Energy (50%).

---

## Part 1: Brand Identity & Core Values (NON-NEGOTIABLE)

### Core Values

| Value | Definition | Manifestation |
|-------|------------|---------------|
| **Transparency** | Users see exactly what Opta does | Progressive disclosure: simple default, full details on demand, real-time process visualization |
| **Privacy & Security** | Data protection is foundational | Layered approach: subtle by default, prominent when relevant, deep verification available |
| **Universal Accessibility** | Works for everyone | Novice-Expert, Casual-Power, Skeptical-Trusting - all spectrums equally served |
| **Trustworthiness** | Reliable, non-controversial, honest | No fear-mongering, no hype, no data monetization - ever. Objective competitor coexistence. |
| **Helpfulness** | Appreciative, efficient, educational | Celebrate milestones, thank users, recognize contributions - never excessively |

### Brand Personality: "The Friendly Expert"

Opta is **approachable but deeply competent**. It explains complex things simply, never talks down, and respects user intelligence while being warm and helpful.

**Voice Characteristics:**
- Calm and confident, never urgent or alarming
- Factual but warm, never cold or robotic
- Educational when helpful, never patronizing
- Appreciative and respectful of user's time and trust

### BANNED Language (Strictly Enforced)

| Category | Never Use |
|----------|-----------|
| **Fear-based** | "risk", "danger", "threat", "vulnerable", "at risk", "warning" (unless genuinely critical) |
| **Hype** | "revolutionary", "game-changing", "best ever", "unbelievable", "amazing" |
| **Pushy** | "you need", "you must", "don't miss", "act now", "limited time" |
| **Manipulative** | Any dark patterns, guilt-tripping, FOMO tactics |

### Error Message Philosophy

Errors are: **Honest + Solution-focused + Educational**

```
BAD:  "Error: Operation failed"
BAD:  "Something went wrong! Please try again."
GOOD: "This optimization couldn't complete because [specific reason].
       Here's what that means and what you can try: [options]"
```

---

## Part 2: Visual Identity - The Living Artifact

### The "0% to 50%" Concept

The UI mimics the Opta Ring's dual-state nature:

| State | Ring Visual | UI Behavior | Fog |
|-------|-------------|-------------|-----|
| **0% (Dormant)** | Dark obsidian glass, reflective | Resting UI - clean, minimal | Gentle drift, 15% opacity |
| **Emerging** | Rising through mist | App launch, awakening | Dense, mystical, swirling |
| **50% (Active)** | Internal plasma ignites | Interactive, alive | Intensified, billowing |

### The Obsidian Aesthetic - Layered Meaning

| Visual Element | Trust Meaning |
|----------------|---------------|
| **Premium Quality** | High-end visuals signal serious, professional tool |
| **Dark Theme** | Signals data protection, "working in shadows for you" |
| **0% to 50% Glow** | Transparency - illumination shows inner workings |
| **Fog/Atmosphere** | Depth and mystery, clearing as things become understood |

---

## Part 3: Color Palette & Lighting (MANDATORY)

We use *light intensities*, not flat colors.

### CSS Variables

```css
:root {
  /* The Void (Backgrounds) */
  --background: 270 50% 3%;       /* Deep void black with purple hint */
  --foreground: 270 10% 98%;      /* Stark white for contrast */

  /* Obsidian Surfaces (Cards/Panels) */
  --card: 270 30% 5%;             /* Slightly lighter, glossy */
  --card-foreground: 270 10% 90%;
  --popover: 270 30% 5%;
  --popover-foreground: 270 10% 90%;

  /* The Energy (Primary Brand) - Matches "50% Opta" Glow */
  --primary: 265 90% 65%;         /* Electric Violet - The Core Glow */
  --primary-foreground: 0 0% 100%;
  --secondary: 265 50% 20%;       /* Dormant Violet - The 0% State */
  --secondary-foreground: 270 10% 90%;

  /* Functional States */
  --success: 160 70% 45%;         /* Green for positive */
  --success-foreground: 0 0% 100%;
  --warning: 45 90% 55%;          /* Amber for caution */
  --warning-foreground: 270 50% 3%;
  --danger: 0 75% 55%;            /* Red for errors */
  --danger-foreground: 0 0% 100%;
  --destructive: 0 75% 55%;
  --destructive-foreground: 0 0% 100%;

  /* Muted */
  --muted: 270 20% 10%;
  --muted-foreground: 270 10% 50%;
  --accent: 265 80% 60%;
  --accent-foreground: 0 0% 100%;

  /* Borders */
  --border: 270 30% 15%;
  --input: 270 30% 15%;
  --ring: 265 90% 65%;

  /* Radius */
  --radius: 0.75rem;

  /* Glow Radiance */
  --glow-strong: 0 0 30px -5px rgba(168, 85, 247, 0.6);
  --glow-subtle: 0 0 15px -3px rgba(168, 85, 247, 0.2);
  --glow-intense: 0 0 40px -10px rgba(168, 85, 247, 0.5);
  --glow-beam: 0 0 80px -20px rgba(168, 85, 247, 0.3);
}
```

---

## Part 4: The Obsidian Glass Material System

### Base Classes

```css
/* Base Surface - The "0% State" */
.obsidian {
  @apply bg-[#05030a]/80 backdrop-blur-xl border border-white/5 shadow-xl;
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05); /* Top lip reflection */
}

/* Interactive Surface - Triggers 0% to 50% on hover */
.obsidian-interactive {
  @apply transition-all duration-500 ease-out cursor-pointer;
}

.obsidian-interactive:hover {
  @apply border-primary/40 bg-[#0a0514]/90;
  box-shadow:
    inset 0 0 20px rgba(168, 85, 247, 0.1), /* Internal Glow */
    0 0 15px rgba(168, 85, 247, 0.3);       /* External Spill */
}

/* Active/Selected State - Sustained 50% */
.obsidian-active {
  @apply border-primary/50 bg-[#0a0514]/95;
  box-shadow:
    inset 0 0 30px rgba(168, 85, 247, 0.15),
    0 0 25px rgba(168, 85, 247, 0.4);
}

/* Subtle variant for nested elements */
.obsidian-subtle {
  @apply bg-[#05030a]/50 backdrop-blur-lg border border-white/[0.03];
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.02);
}

/* Strong variant for modals/overlays */
.obsidian-strong {
  @apply bg-[#05030a]/95 backdrop-blur-2xl border border-white/10;
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08);
}
```

### Button Energy System

```css
/* Primary Action - "The Core" */
.btn-energy {
  @apply relative overflow-hidden rounded-xl bg-primary text-white font-semibold;
  @apply transition-all duration-300;
  box-shadow: 0 0 20px -5px hsl(var(--primary));
}

.btn-energy:hover {
  box-shadow: 0 0 40px -10px hsl(var(--primary));
  transform: scale(1.02);
}

.btn-energy:active {
  transform: scale(0.98);
}
```

---

## Part 5: Typography (Sora)

### Font Family

```css
font-family: 'Sora', system-ui, -apple-system, sans-serif;
```

### Type Scale

| Element | Size | Weight | Tracking | Usage |
|---------|------|--------|----------|-------|
| **Display** | 3rem+ | 700 | -0.02em | Hero text, large counters |
| **H1** | 2.25rem | 600 | -0.01em | Page Titles |
| **H2** | 1.5rem | 600 | -0.01em | Section Headers |
| **H3** | 1.125rem | 600 | 0 | Card Titles |
| **Body** | 0.875rem | 400 | 0 | Standard text |
| **Small** | 0.75rem | 400 | 0 | Captions |
| **Label** | 0.75rem | 500 | 0.05em | Metadata, uppercase |

### Moonlight Gradient (Headings)

```tsx
<h1 className="bg-gradient-to-br from-white via-white to-primary/50 bg-clip-text text-transparent">
  Page Title
</h1>
```

---

## Part 6: Animation Standards (NON-NEGOTIABLE)

### Core Principles

| Quality | Requirement |
|---------|-------------|
| **Reactivity** | Animations respond to user input, not just play loops |
| **Physics** | Objects have mass, momentum, realistic weight |
| **Fluidity** | Motion flows like liquid or smoke |
| **Premium** | Refractive glass, chromatic aberration, volumetric lighting |

### The "Ignition" Effect

Elements wake up from darkness, not just fade in:

```tsx
const ignition = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    filter: "brightness(0) blur(10px)"
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "brightness(1) blur(0px)",
    transition: { duration: 0.8, ease: "circOut" }
  }
}
```

### Easing Curves

```javascript
// Smooth deceleration (default UI)
const smoothOut = [0.22, 1, 0.36, 1];

// Heavy/weighty (ring movements)
const heavy = [0.16, 1, 0.3, 1];

// Snappy (hover states)
const snappy = [0.34, 1.56, 0.64, 1];

// Cinematic (page entrances)
const cinematic = [0.77, 0, 0.175, 1];
```

### Staggered Lists

```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    variants={ignition}
    initial="hidden"
    animate="visible"
    transition={{ delay: index * 0.05 }}
  />
))}
```

---

## Part 7: The Opta Ring (Brand Integration)

### Ring States

| State | Visual | Trigger |
|-------|--------|---------|
| **0% Idle** | Dark glass, faint dormant glow | Default/resting |
| **50% Active** | Internal plasma swirls, casts purple light | Hover/engagement |
| **Atmospheric** | Surrounded by volumetric fog | Cinematic sections |

### Usage Rules

1. **Loading States**: Never use standard spinners. Always OptaRing pulsing.
2. **Page Transitions**: Ring moves to center, ignites 0% to 50%, dissolves as content appears.
3. **Empty States**: Use 0% ring, slightly desaturated.
4. **Success States**: Use 50% ring with particle burst.

---

## Part 8: Icons (Lucide React)

### Standard Sizing

| Context | Size | strokeWidth |
|---------|------|-------------|
| Page header | `w-5 h-5` | 1.75 |
| Card/section | `w-4 h-4` | 1.75 |
| Inline text | `w-3.5 h-3.5` | 1.5 |
| Large decorative | `w-7 h-7` | 1.5 |

### Icon Glow (Active State)

```tsx
<Icon className="text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
```

---

## Part 9: Audio Design

### Philosophy

- Deep, subtle, background presence
- Smooth and replayable (never annoying)
- Contextually appropriate

### Audio Vibe: "Crystalline + Spatial"

- Glass-like chimes and resonant tones
- Echoing, void-like acoustic space
- Beautiful tones floating in infinite dark

### Sound Moments

| Moment | Character |
|--------|-----------|
| Ring ignition | Deep hum building to crystalline chime |
| Page transition | Soft whoosh with spatial reverb |
| Button click | Subtle glass tap |
| Success | Ascending crystalline tones |
| Error (gentle) | Low soft tone, not alarming |

### Default: Smart Detection

- Headphones detected: audio on
- Laptop speakers: audio off or reduced
- Always easy to toggle

---

## Part 10: Required Dependencies

```json
{
  "framer-motion": "^11.x",
  "@fontsource/sora": "^5.x",
  "lucide-react": "^0.x",
  "class-variance-authority": "^0.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```

---

## Part 11: Implementation Checklist

### Visual Identity
- [ ] Background is "The Void" (deep purple-black, NO grid)
- [ ] Cards use "Obsidian Glass" (glossy, dark, inner glow)
- [ ] Fog is subtly drifting in idle state
- [ ] Typography uses Sora with Moonlight gradients

### The Opta Ring
- [ ] Ring displays 0% state when idle
- [ ] Ring transitions to 50% on interactions
- [ ] Ring present in ALL loading states (NO spinners)
- [ ] Page transitions show ring ignition sequence

### Animations
- [ ] Entry animations use "ignition" pattern
- [ ] Hover states trigger 0% to 50% glow
- [ ] Motion feels fluid/smokey, not mechanical

### Brand Voice
- [ ] No banned language (fear, hype, pushy)
- [ ] Error messages are helpful + educational
- [ ] Tone is friendly expert throughout

---

## Enforcement

This design system is **NON-NEGOTIABLE**. Any code that:

1. Uses solid backgrounds instead of obsidian glass
2. Uses standard spinners instead of OptaRing
3. Uses banned language
4. Uses CSS transitions for complex animations (use Framer Motion)
5. Introduces non-Lucide icons or non-Sora fonts

**MUST be rejected and revised.**

---

*Version: 2.0 - The Obsidian Standard*
*Last Updated: Phase 17 - UI Redesign*
