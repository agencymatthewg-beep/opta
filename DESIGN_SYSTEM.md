# Opta Design System v5.0

**Premium Visual Experience** - Sci-Fi HUD + Apple Refinement + Linear Sophistication

> **CORE DIRECTIVE**: The UI is a "Living Artifact." The Opta Ring is the soul of the app - it breathes, wakes, and responds to user interaction. Surrounded by glass depth, neon energy trails, and particle systems that make users feel excitement and energy.

---

## What's New in v5.0

- **3D Opta Ring** - Three.js powered glassmorphism ring with wake-up and explosion animations
- **Glass Depth System** - 3-level translucent panel hierarchy with dynamic blur
- **Particle Environment** - Ambient floating particles with ring attraction
- **Atmospheric Fog** - Dynamic radial fog that breathes with ring state
- **Neon Glow Trails** - Energy lines flowing through UI elements
- **Premium Loading States** - Chromatic aberration, scan lines, holographic effects
- **Deep Glow Effects** - Multi-layer corona responding to system metrics
- **Sound Design Integration** - Sci-fi audio feedback (optional)
- **Page Transition Choreography** - Spring-physics based Apple-level polish

### Previous Updates (v2.0)

- **#09090b base background** - OLED optimized (prevents black smear)
- **4-layer glass effect system** - Backdrop, Blur, Noise, Specular
- **Physics-based animation presets** - Spring-based motion
- **WebGL shader components** - Premium visual effects
- **Neon accent guidelines** - Active states only
- **Z-layering composition strategy** - Consistent depth management
- **Momentum Border** - Traveling light effect

---

## Table of Contents

1. [Brand Identity](#part-1-brand-identity--core-values-non-negotiable)
2. [Visual Identity](#part-2-visual-identity---the-living-artifact)
3. [Colors](#part-3-color-palette--lighting-mandatory)
4. [Glass Depth System](#part-4-glass-depth-system) ← Enhanced v5.0
5. [Animation](#part-5-animation-presets)
6. [WebGL Effects](#part-6-webgl-effects)
7. [Z-Layering](#part-7-z-layering-composition)
8. [Typography](#part-8-typography-sora)
9. [The Opta Ring](#part-9-the-opta-ring-brand-integration) ← Enhanced v5.0
10. [Icons](#part-10-icons-lucide-react)
11. [Audio Design](#part-11-audio-design) ← Enhanced v5.0
12. [Momentum Border](#part-12-momentum-border)
13. [Particle System](#part-13-particle-system) ← New v5.0
14. [Atmospheric Fog](#part-14-atmospheric-fog) ← New v5.0
15. [Loading States](#part-15-loading-states) ← New v5.0
16. [Implementation Checklist](#part-16-implementation-checklist)

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

We use *light intensities*, not flat colors. **OLED Optimized** - no true black (#000000).

### Why Not True Black?

True black (#000000) causes **OLED "black smear"** on scroll. Pixels turning completely off and on creates visible trailing artifacts. Our base background #09090b keeps pixels subtly active while maintaining deep darkness.

### CSS Variables

```css
:root {
  /* The Void (Backgrounds) - OLED Optimized */
  --background: 240 6% 4%;        /* #09090b - deep grey-purple, avoids black smear */
  --foreground: 0 0% 98%;         /* #fafafa - stark white for contrast */

  /* Obsidian Surfaces (Cards/Panels) */
  --card: 240 6% 6%;              /* #0c0c12 - subtle elevation from background */
  --card-foreground: 0 0% 95%;
  --popover: 240 6% 6%;
  --popover-foreground: 0 0% 95%;

  /* RGB format for glass effects */
  --card-rgb: 12 12 18;           /* For gradient overlays with alpha */
  --background-rgb: 9 9 11;       /* For backdrop effects with alpha */

  /* The Energy (Primary Brand) - Matches "50% Opta" Glow */
  --primary: 265 90% 65%;         /* Electric Violet - The Core Glow */
  --primary-foreground: 0 0% 100%;
  --secondary: 265 50% 20%;       /* Dormant Violet - The 0% State */
  --secondary-foreground: 0 0% 90%;

  /* Functional States */
  --success: 160 70% 45%;         /* Green for positive */
  --warning: 45 90% 55%;          /* Amber for caution */
  --danger: 0 75% 55%;            /* Red for errors */

  /* Neon Accents - USE SPARINGLY (active states only) */
  --neon-purple: 139 92 246;      /* #8b5cf6 */
  --neon-blue: 59 130 246;        /* #3b82f6 */
  --neon-green: 34 197 94;        /* #22c55e */
  --neon-amber: 245 158 11;       /* #f59e0b */
  --neon-red: 239 68 68;          /* #ef4444 */
  --neon-cyan: 6 182 212;         /* #06b6d4 */
}
```

### Neon Usage Guidelines

> **Per Gemini Research:** "Neon for active states only - cursor, current line, active borders"

| Scenario | Use Neon? | Example |
|----------|-----------|---------|
| Button hover | No | Use subtle opacity change |
| Active/selected item | Yes | `.neon-active` class |
| Current focus indicator | Yes | Neon ring around element |
| Static text | No | Use standard foreground colors |
| Error states | Sparingly | Neon-red for critical errors only |

```tsx
// CORRECT - Neon for active state
<div className={cn(
  "border border-white/10",
  isActive && "neon-active"
)}>

// WRONG - Neon everywhere
<div className="border-neon-purple text-neon-blue bg-neon-green/10">
```

---

## Part 4: Glass Depth System

Opta uses a **3-level glass depth hierarchy** with the 4-layer optical simulation.

### Glass Depth Levels

| Level | Class | Use Case | Blur | Z-Index Range | Description |
|-------|-------|----------|------|---------------|-------------|
| **Background** | `.glass-subtle` | Cards, secondary containers | 8px | -5 to 0 | Subtle depth, content base |
| **Content** | `.glass` | Primary containers, modals | 12px | 0 to 10 | Main interaction layer |
| **Overlay** | `.glass-strong` | Hero elements, overlays | 20px | 10+ | High prominence, draws attention |

### Glass Layers (Bottom to Top)

1. **Backdrop** - Content visible behind the glass element
2. **Blur Pass** - Gaussian blur (8-20px depending on variant)
3. **Noise Overlay** - Subtle grain prevents color banding on OLED (Soft Light blend)
4. **Specular Highlight** - Simulated light reflection (top edge highlight)

### CSS Glass Classes

| Class | Use Case | Blur | Border | Noise |
|-------|----------|------|--------|-------|
| `.glass-subtle` | Cards, secondary containers | 8px | 10% white | 2% |
| `.glass` | Primary containers, modals | 12px | 15% white | 3% |
| `.glass-strong` | Hero elements, overlays | 20px | 20% white | 4% |

### Depth Hierarchy Rules

1. **Never stack same-level glass** - Avoid `.glass` inside `.glass`
2. **Deeper content = less blur** - Background elements are more transparent
3. **Overlays require backdrop** - `.glass-strong` needs content behind it to shine
4. **Animate blur on focus** - Increase blur when element becomes active

### Usage Examples

```tsx
// Standard glass panel
<div className="glass rounded-xl p-6">
  <h2>Glass Panel</h2>
  <p>Content with blur backdrop</p>
</div>

// Subtle glass for nested elements
<div className="glass-subtle rounded-lg p-4">
  <span>Secondary content</span>
</div>

// Strong glass for overlays
<div className="glass-strong rounded-2xl p-8">
  <h1>Hero Content</h1>
</div>
```

### WebGL Glass (Premium)

For full optical simulation with animated specular highlights, use the `<GlassPanel>` component:

```tsx
import { GlassPanel } from '@/components/effects';

<GlassPanel
  blurAmount={12}
  noiseIntensity={0.03}
  specularEnabled
  animateSpecular
>
  <YourContent />
</GlassPanel>
```

### The Obsidian System

The `.obsidian` class family provides the "Living Artifact" behavior:

```css
/* Base Surface - The "0% State" */
.obsidian {
  @apply bg-[#05030a]/80 backdrop-blur-xl border border-white/5;
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}

/* Interactive - Triggers 0% to 50% on hover */
.obsidian-interactive:hover {
  @apply border-primary/40 bg-[#0a0514]/90;
  box-shadow:
    inset 0 0 20px rgba(168, 85, 247, 0.1),
    0 0 15px rgba(168, 85, 247, 0.3);
}

/* Active/Selected - Sustained 50% */
.obsidian-active {
  @apply border-primary/50 bg-[#0a0514]/95;
  box-shadow:
    inset 0 0 30px rgba(168, 85, 247, 0.15),
    0 0 25px rgba(168, 85, 247, 0.4);
}
```

---

## Part 5: Animation Presets

All animations use **physics-based springs**. Never use duration-based timing for interactive elements.

### Spring Presets

| Preset | Stiffness | Damping | Use Case |
|--------|-----------|---------|----------|
| `spring` | 400 | 30 | Buttons, toggles, small elements |
| `springGentle` | 200 | 25 | Modals, content updates |
| `springPage` | 100 | 20 | Page transitions |
| `springHeavy` | 150 | 20 | Ring movements, weighty objects |

### Usage with Framer Motion

```tsx
import { transitions } from '@/lib/animations';

// Spring animation
<motion.div
  animate={{ scale: 1 }}
  transition={transitions.spring}
/>

// Gentle spring for larger movements
<motion.div
  animate={{ x: 0 }}
  transition={transitions.springGentle}
/>
```

### Animation Patterns

| Pattern | Implementation | Notes |
|---------|---------------|-------|
| **Ignition** | `ignition` variant | Elements wake from darkness |
| **Staggered Entry** | `staggerContainerVariants` | 50ms delay between items |
| **Glow Pulse** | `glowPulse` variant | Rhythmic glow for loading |
| **Card Lift** | `cardLiftVariants` | Subtle Y translation on hover |

### The Ignition Effect

Elements wake up from darkness, not just fade in:

```tsx
import { ignition, transitions } from '@/lib/animations';

<motion.div
  variants={ignition}
  initial="hidden"
  animate="visible"
>
  Content emerges from the void
</motion.div>
```

### Easing Curves (for CSS animations)

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

### Reduced Motion Support

**ALWAYS** respect `prefers-reduced-motion`:

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';

const prefersReducedMotion = useReducedMotion();
const transition = prefersReducedMotion
  ? { duration: 0 }
  : transitions.spring;
```

---

## Part 6: WebGL Effects

Premium visual effects use WebGL shaders via Three.js / react-three-fiber.

### When to Use WebGL vs CSS

| Effect | CSS | WebGL | Reason |
|--------|-----|-------|--------|
| Simple blur | Use CSS | - | `backdrop-filter` sufficient |
| Animated specular | - | Use WebGL | Rotating light source needs shader |
| Static border | Use CSS | - | CSS border works fine |
| Traveling neon border | - | Use WebGL | SweepGradient needs shader |
| Basic glow | Use CSS | - | `box-shadow` sufficient |
| Halation (exponential glow) | - | Use WebGL | Requires distance field shader |
| Chromatic aberration | - | Use WebGL | Color channel separation |
| OLED dithering | - | Use WebGL | Sub-pixel manipulation |

### Available WebGL Components

| Component | Purpose | Import |
|-----------|---------|--------|
| `<GlassPanel>` | Full optical glass simulation | `@/components/effects` |
| `<NeonBorder>` | Traveling light border effect | `@/components/effects` |
| `<ChromaticLoader>` | Loading with chromatic aberration | `@/components/effects` |
| `<WebGLBackground>` | Full-screen shader background | `@/components/effects` |

### Performance Guidelines

1. **Limit WebGL usage** - One or two WebGL elements per view maximum
2. **Test on integrated graphics** - Must maintain 60fps minimum
3. **Provide CSS fallback** - Detect WebGL failure, fall back to CSS glass
4. **Monitor memory** - WebGL textures can leak, test on unmount
5. **Limit DPR** - Cap at 2x device pixel ratio for performance

### Fallback Pattern

```tsx
import { GlassPanel } from '@/components/effects';
import { isWebGLAvailable } from '@/lib/shaders';

function PremiumCard({ children }) {
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);

  return webglSupported
    ? <GlassPanel>{children}</GlassPanel>
    : <div className="glass">{children}</div>;
}
```

---

## Part 7: Z-Layering Composition

Consistent z-index management prevents stacking context issues.

### Z-Layer Constants

```tsx
import { Z_LAYERS } from '@/components/effects';

// Z_LAYERS = {
//   BACKGROUND: -10,    // Fog, ambient visuals
//   GLASS_PANEL: -5,    // Glass panels and cards
//   NEON_GLOW: -1,      // Neon borders and glows
//   CONTENT: 0,         // Main content
//   OVERLAY: 10,        // Modals, drawers
//   TOOLTIP: 20,        // Tooltips, popovers
//   LOADING: 30,        // Loading indicators
//   TOAST: 40,          // Toast notifications
//   MAX: 50,            // Dev tools
// }
```

### Usage

```tsx
// Background effect
<WebGLBackground zIndex={Z_LAYERS.BACKGROUND}>
  <FogShader />
</WebGLBackground>

// Modal overlay
<motion.div style={{ zIndex: Z_LAYERS.OVERLAY }}>
  <Modal />
</motion.div>

// Toast notification
<Toaster style={{ zIndex: Z_LAYERS.TOAST }} />
```

### Layering Rules

1. **Background effects** should never capture pointer events
2. **Glass panels** render behind their content
3. **Neon glows** render behind the element they surround
4. **Overlays** capture clicks to dismiss
5. **Tooltips** always render above everything except toasts

---

## Part 8: Typography (Sora)

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

// Or use the utility class
<h1 className="text-moonlight">Page Title</h1>
```

---

## Part 9: The Opta Ring (Brand Integration)

The Opta Ring is the **soul of the application** - a 3D glassmorphism torus that responds to user interaction.

### Ring States

| State | Visual | Trigger | Duration |
|-------|--------|---------|----------|
| **dormant** | Dark glass, 15° tilt, slow Y-axis spin (0.1 rad/s) | Default/resting | - |
| **waking** | Spring transition to face camera, faster spin | Hover/type | 800ms |
| **active** | Internal plasma swirls, casts purple light | Sustained engagement | - |
| **processing** | Intense glow, particles attracted | Long operations | Until complete |
| **exploding** | Particle burst, shockwave ring, bloom | Click/success | 1200ms |
| **recovering** | Fade back to active state | After explosion | 500ms |

### Ring Animation Behaviors

```tsx
// Wake-up animation (26-01 to 26-04)
<OptaRing
  state="waking"
  rotation={{ x: 0, y: 0, z: 0 }}  // Faces camera
  spinSpeed={0.3}                    // Faster than dormant
  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
/>

// Explosion effect (27-01 to 27-05)
<OptaRing
  state="exploding"
  particleCount={200}
  shockwaveSize={2}
  bloomIntensity={1.5}
  cameraShake={true}
/>
```

### Ring Position Strategies

| Strategy | Use Case | Behavior |
|----------|----------|----------|
| **Corner** | Ambient presence | Small ring in corner, always visible |
| **Floating** | Focus indicator | Follows cursor/focus loosely |
| **Center** | Loading/transitions | Full prominence, hero position |
| **Integrated** | In components | Inline with content |

### Usage Rules

1. **Loading States**: Never use standard spinners. Always OptaRing pulsing.
2. **Page Transitions**: Ring moves to center, ignites 0% to 50%, dissolves as content appears.
3. **Empty States**: Use dormant ring, slightly desaturated.
4. **Success States**: Use exploding state with particle burst.
5. **Error States**: Use danger color glow, no explosion.
6. **Persistent Ring**: Ring follows user across all pages (Phase 29).

---

## Part 10: Icons (Lucide React)

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

### Never Use Inline SVGs

```tsx
// WRONG
<svg viewBox="0 0 24 24">...</svg>

// CORRECT
import { Settings } from 'lucide-react';
<Settings className="w-5 h-5 text-primary" strokeWidth={1.75} />
```

---

## Part 11: Audio Design

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

## Part 12: Momentum Border

The Momentum Border is a traveling light effect that highlights active/focused elements.

### CSS Approximation

```css
.momentum-border {
  position: relative;
  overflow: hidden;
}

.momentum-border::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    var(--momentum-angle, 90deg),
    transparent 0%,
    rgb(var(--neon-purple)) 50%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

### WebGL Momentum Border

For animated traveling light, use the `<NeonBorder>` component:

```tsx
import { NeonBorder } from '@/components/effects';

<NeonBorder
  color="#8b5cf6"
  active={isHovered}
  speed={1.5}
  width={2}
>
  <button>Hover me</button>
</NeonBorder>
```

### Usage Guidelines

| Scenario | Use Momentum Border? |
|----------|---------------------|
| Active nav item | Yes - CSS version |
| Focused input | Yes - CSS version |
| Hero card on hover | Yes - WebGL version |
| Every card border | No - too distracting |
| Loading state | No - use pulse instead |

---

## Part 13: Particle System

Ambient floating particles create a living, breathing environment.

### Particle Types

| Type | Count | Size | Opacity | Behavior |
|------|-------|------|---------|----------|
| **Ambient Dust** | 50-100 | 1-3px | 10-20% | Slow drift, parallax depth |
| **Energy Sparks** | 10-30 | 2-4px | 30-50% | Near active elements, brighter |
| **Data Burst** | 20-50 | 1-2px | 40-60% | On telemetry updates, directional |
| **Ring Attraction** | All | - | - | During processing, particles flow to ring |

### Particle Configuration

```tsx
import { ParticleField } from '@/components/effects';

// Ambient background particles
<ParticleField
  particleCount={75}
  color="rgba(255, 255, 255, 0.15)"
  secondaryColor="rgba(139, 92, 246, 0.12)"  // Neon purple
  speedMultiplier={1}
  connectToRing={true}
  zIndex={-1}
/>

// Data particles for telemetry
<DataParticles
  variant="upload"    // 'upload' | 'download' | 'processing' | 'idle'
  intensity={0.5}     // 0-1, controls particle count
  color="primary"
/>
```

### Performance Notes

- Canvas 2D for simple particles (lighter than WebGL)
- Max 100 ambient particles for 60fps
- Reduced motion fallback: static dots

---

## Part 14: Atmospheric Fog

Dynamic radial fog that breathes with ring state, creating sci-fi depth.

### Fog Parameters

| Ring State | Primary Color | Secondary Color | Opacity | Animation |
|------------|--------------|-----------------|---------|-----------|
| **dormant** | `#1a0a2e` | `#0d0518` | 5-15% | 4s breathing |
| **waking** | `#2d1b4e` | `#1a0f2e` | 10-20% | 3s breathing |
| **active** | `#3B1D5A` | `#2d1b4e` | 15-25% | 3s breathing |
| **processing** | `#3B1D5A` | `#9333EA` | 20-30% | 2s + 1s pulse |
| **exploding** | `#9333EA` | `#c084fc` | 50-80% | Flash + fade |

### Fog Implementation

```tsx
import { AtmosphericFog, AtmosphericFogAuto } from '@/components/effects';

// Manual control
<AtmosphericFog
  ringState="active"
  energyLevel={0.5}      // 0-1, controls opacity
  centerX="50%"          // Fog center X
  centerY="50%"          // Fog center Y
/>

// Auto-respects reduced motion
<AtmosphericFogAuto ringState={ringContext.state} />
```

### Fog Layers

1. **Primary Layer** - 200vmax, main radial gradient
2. **Secondary Layer** - 250vmax, deeper/slower breathing
3. **Inner Glow** - 150vmax, close to ring center

---

## Part 15: Loading States

Premium loading states use chromatic aberration, scan lines, and holographic effects.

### Loading State Types

| Type | Component | Use Case | Effect |
|------|-----------|----------|--------|
| **Ring Pulse** | `<OptaRing state="processing" />` | Default loading | Pulsing ring glow |
| **Chromatic** | `<ChromaticLoader />` | Data loading | RGB channel separation |
| **Scan Lines** | `<ScanLineLoader />` | System operations | TRON-style horizontal lines |
| **Holographic** | `<HolographicShimmer />` | Card loading | Iridescent shimmer |
| **Data Stream** | `<DataStreamLoader />` | Network activity | Matrix-style characters |

### Loading State Rules

1. **Never use standard spinners** - Always use branded loading states
2. **Ring-synchronized pulse** - Loading states pulse in sync with ring
3. **Progress indication** - Show progress when known, pulse when unknown
4. **Graceful degradation** - CSS fallback for non-WebGL browsers

### Example Usage

```tsx
import { ChromaticLoader } from '@/components/effects';

<ChromaticLoader
  isLoading={isLoading}
  intensity={0.5}        // Aberration strength
  animationSpeed={1}     // Pulse speed
>
  <DataTable data={data} />
</ChromaticLoader>
```

---

## Part 16: Implementation Checklist

### Visual Identity
- [ ] Background is #09090b (not true black #000000)
- [ ] Cards use glass depth system (3 levels)
- [ ] Atmospheric fog drifts behind content
- [ ] Typography uses Sora with Moonlight gradients
- [ ] Particle field creates ambient depth

### The Opta Ring (v5.0)
- [ ] Ring displays dormant state when idle (15° tilt, slow spin)
- [ ] Ring wakes on hover/type (800ms spring transition)
- [ ] Ring explodes on click/success (particles + shockwave)
- [ ] Ring present in ALL loading states (NO spinners)
- [ ] Page transitions include ring choreography
- [ ] Ring persists across all pages

### Animations (v5.0)
- [ ] All animations use spring physics (no linear easing)
- [ ] Entry animations use staggered ignition pattern
- [ ] Hover states trigger deep glow effects
- [ ] Motion feels fluid/smokey, not mechanical
- [ ] Reduced motion preference is respected
- [ ] Page transitions choreographed with ring

### Glass & Effects
- [ ] Glass panels use 3-level depth hierarchy
- [ ] Glass panels have noise texture overlay
- [ ] Glass panels have specular highlight
- [ ] Neon trails flow through UI elements
- [ ] WebGL has CSS fallback

### Particles & Fog
- [ ] Ambient particles float at all times
- [ ] Particles attract to ring during processing
- [ ] Fog breathes with ring state
- [ ] Fog color shifts with activity level
- [ ] Reduced motion shows static dots

### Loading States
- [ ] Chromatic aberration for data loading
- [ ] Ring-synchronized pulse
- [ ] No standard spinners anywhere
- [ ] Progress indication when known

### Brand Voice
- [ ] No banned language (fear, hype, pushy)
- [ ] Error messages are helpful + educational
- [ ] Tone is friendly expert throughout

---

## Required Dependencies

```json
{
  "framer-motion": "^11.x",
  "@fontsource/sora": "^5.x",
  "lucide-react": "^0.x",
  "class-variance-authority": "^0.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x",
  "@react-three/fiber": "^8.x",
  "three": "^0.x"
}
```

---

## Enforcement

This design system is **NON-NEGOTIABLE**. Any code that:

1. Uses true black (#000000) for backgrounds
2. Uses solid backgrounds instead of glass
3. Uses standard spinners instead of OptaRing
4. Uses banned language
5. Uses CSS transitions for complex animations (use Framer Motion)
6. Introduces non-Lucide icons or non-Sora fonts
7. Uses neon colors for non-active states

**MUST be rejected and revised.**

---

## Changelog

### v5.0 - Premium Visual Experience (Phase 40)
- **3D Opta Ring**: Three.js powered glassmorphism torus with 6-state machine
- **Ring Wake-Up Animation**: Spring-physics 800ms transition from dormant to active
- **Ring Explosion Effect**: 200+ particle burst with shockwave and bloom
- **Glass Depth System**: 3-level hierarchy (background, content, overlay)
- **Particle Environment**: Ambient dust motes with ring attraction during processing
- **Atmospheric Fog**: Dynamic radial fog breathing with ring state
- **Neon Glow Trails**: Energy lines flowing through UI elements
- **Deep Glow Effects**: Multi-layer corona responding to system metrics
- **Premium Loading States**: Chromatic aberration, scan lines, holographic
- **Sound Design**: Optional sci-fi audio feedback
- **Page Transition Choreography**: Spring-physics Apple-level polish
- **Performance Tiers**: Dynamic quality scaling for 60fps target

### v2.0 - Premium Enhancement (Phase 20)
- Changed base background from `270 50% 3%` to `240 6% 4%` (#09090b) for OLED optimization
- Added neon accent color tokens (purple, blue, green, amber, red, cyan)
- Enhanced glass classes with 4-layer system (backdrop, blur, noise, specular)
- Added `--card-rgb` and `--background-rgb` variables for alpha manipulation
- Added momentum border CSS class
- Documented WebGL components and fallback patterns
- Added Z-layering composition strategy
- Added spring preset documentation

### v1.0 - The Obsidian Standard (Phase 17)
- Initial design system
- Obsidian glass material system
- 0% to 50% energy concept
- Brand voice guidelines

---

*Version: 5.0 - Premium Visual Experience*
*Last Updated: Phase 40 - Documentation & Launch*
*Design Pillars: Sci-Fi HUD + Apple Refinement + Linear Sophistication*
