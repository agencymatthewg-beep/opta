# Opta Ring / Opta O — Complete Design Specification

> **Purpose**: This document is the authoritative reference for designing and implementing the Opta Ring. It contains all proportions, visual properties, animations, and behavioral specifications needed to create the ring across any platform or technology.

---

## 1. Core Identity

### 1.1 What the Opta Ring Represents

The Opta Ring is the **soul of the application** — a living artifact that embodies the AI's presence and attention. It is not merely decorative; it communicates the system's state to the user through visual metaphor.

| Metaphor | Ring Behavior |
|----------|---------------|
| AI is idle/waiting | Ring is dormant, tilted away, barely glowing |
| AI notices user | Ring wakes up, rotates to face user, energizes |
| AI is engaged | Ring is active, plasma swirling, bright rim glow |
| Celebration/success | Ring explodes with particles, shockwave, bloom |

**Key Principle**: The ring wakes from darkness — it does not simply fade in. The transition should feel like the AI is becoming attentive, acknowledging the user's presence.

### 1.2 Design Philosophy

- **Material**: Obsidian Glassmorphism — premium volcanic glass, NOT transparent
- **Aesthetic**: Sci-Fi HUD + Apple Refinement + Linear Sophistication
- **Feel**: Neon Luminal Glassmorphism — futuristic, liquid, premium but not gaudy
- **Behavior**: Organic, breathing, responsive — never mechanical or robotic
- **Typography**: See `OPTA_TYPOGRAPHY_SPECIFICATION.md` for the official Opta font styling

### 1.3 CRITICAL: Transparent Center (The Ring as 3D Overlay)

```
╔══════════════════════════════════════════════════════════════════════╗
║                         FUNDAMENTAL RULE                              ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║   The ring's CENTER HOLE must be 100% TRANSPARENT.                   ║
║                                                                       ║
║   All visual elements (glass, plasma, glow, reflections) are         ║
║   contained WITHIN THE TORUS WALL ONLY.                              ║
║                                                                       ║
║   The ring floats like a 3D PNG — the background shows through.      ║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝

                    ┌─────────────────────────────────────┐
                    │         OUTER EDGE                   │
                    │    ╭─────────────────────────╮       │
                    │    │                         │       │
                    │    │   TORUS WALL            │       │
                    │    │   (All effects here)    │       │
                    │    │   ┌─────────────────┐   │       │
                    │    │   │                 │   │       │
                    │    │   │   TRANSPARENT   │   │       │
                    │    │   │      HOLE       │   │       │
                    │    │   │   (Background   │   │       │
                    │    │   │    visible)     │   │       │
                    │    │   │                 │   │       │
                    │    │   └─────────────────┘   │       │
                    │    │   INNER EDGE            │       │
                    │    ╰─────────────────────────╯       │
                    └─────────────────────────────────────┘
```

**Why This Matters:**

- The ring can be placed over ANY content (dashboards, images, videos)
- The center acts as a window/cutout to the background
- The ring maintains its identity as a floating 3D object
- Enables the ring to move freely without obscuring content

**Implementation Rules:**

| DO | DON'T |
|----|-------|
| Use `background: transparent` for center | Use radial gradients that fill center |
| Clip/mask all glow to torus wall | Let inset shadows bleed into center |
| Build ring as a stroke/border | Build as filled circle with hole mask |
| Keep ambient glow BEHIND ring in z-order | Let ambient fill the ring's interior |

---

## 2. Geometry & Proportions

### 2.1 Torus Dimensions

```
┌─────────────────────────────────────────┐
│                                         │
│    ┌───────────────────────────┐        │
│    │                           │        │
│    │   ┌───────────────────┐   │        │
│    │   │                   │   │        │
│    │   │    VOID CENTER    │   │        │
│    │   │                   │   │        │
│    │   └───────────────────┘   │        │
│    │         TUBE              │        │
│    └───────────────────────────┘        │
│              MAJOR RADIUS               │
└─────────────────────────────────────────┘
```

| Property | Value | Description |
|----------|-------|-------------|
| **Major Radius** | 1.0 unit | Distance from center to tube center |
| **Tube Radius** | 0.35 units | Radius of the tube cross-section |
| **Aspect Ratio** | 1:0.35 | Premium proportions (not too thin, not too thick) |
| **Radial Segments** | 96 | Segments around the major circumference |
| **Tubular Segments** | 64 | Segments around the tube cross-section |

### 2.2 SwiftUI/Native Frame Sizing

When rendering in SwiftUI or similar frameworks:

| Context | Frame Size | Notes |
|---------|------------|-------|
| Hero/Center | 300-320pt | Main display size |
| Radial Menu Center | 320pt | With 25° X-axis 3D tilt |
| Menu Bar Icon | 22pt | Simplified/flattened |
| Loading Indicator | 40-60pt | Inline usage |

### 2.3 3D Orientation

| State | X-Axis Rotation | Description |
|-------|-----------------|-------------|
| Dormant | 15° (0.262 rad) | Tilted away, showing top surface |
| Active | 0° | Facing camera directly |
| 3D Hero Display | 25° | Perspective tilt for depth |

---

## 3. Material Properties

### 3.1 Dark Metallic Glassmorphism

The ring surface is a hybrid material combining **Dark Gunmetal Titanium** with **Frosted Glass** transparency:

| Property | Value | Description |
|----------|-------|-------------|
| Material | Hybrid Titanium/Glass | Dark metallic frame with frosted glass windows |
| Base Color | `#1c1c22` to `#2e2e38` | Gunmetal grey with violet undertones |
| Reflectivity | Satin Metallic | Soft, anodized metal sheen |
| Roughness | Medium (~0.4) | Frosted/Brushed texture |
| Transparency | Semi-Transparent | Internal plasma visible through frosted glass |

### 3.2 Fresnel Rim Lighting

The fresnel effect creates the signature rim glow — brighter at glancing angles, darker when viewed head-on.

```
fresnel = pow(1.0 - dot(normal, viewDirection), fresnelPower)
rimColor = rimBaseColor * fresnel * rimIntensity
```

| State | Fresnel Power | Rim Intensity | Visual Effect |
|-------|---------------|---------------|---------------|
| Dormant | 8.0 | 0.15 | Tight, barely visible edge |
| Active | 1.5 | 2.5 | Wide, dramatic glowing rim |
| Exploding | 0.8 | 4.0 | Extremely bright, blown out |

### 3.3 Inner Light / Subsurface Scattering (Fake)

Creates the illusion of light passing through the glass:

```
sss = (backLight * 0.6 + viewTransmission * 0.4) * innerGlow
sss *= (0.3 + thickness * 0.7)
```

- Light appears to scatter inside the obsidian
- Plasma glow contributes to inner illumination
- Edges appear thinner/more translucent

---

## 4. Visual Layer Stack

The ring is composed of multiple overlapping visual layers, rendered back-to-front:

### Layer 0: Ambient Glow (Backlight)

```
- Shape: Circle, larger than ring (1.15-1.2x scale)
- Color: Deep purple #581C87
- Opacity: 50-60%
- Blur: 40-60px
- Purpose: Creates atmospheric halo behind ring
```

### Layer 1: Obsidian Body (Main Ring)

```
- Shape: Circle stroke (or torus in 3D)
- Stroke Width: 48-50pt (SwiftUI) or tube radius (3D)
- Gradient: Linear, top-left to bottom-right
  - Start: #2a2a35 (light catch)
  - Middle: #000000 (deep black)
  - End: #050505 (dark shadow)
- Shadow: Black, 15-20px radius, Y offset 10-15px
```

### Layer 2: Energy Equator (3D Plasma Core)

```
CONCEPT: The "Energy Equator" is a living plasma glow that runs through
the CENTER of the torus tube — equidistant from both the inner and outer
walls. This creates the illusion of energy trapped within a glass vessel.

┌─────────────────────────────────────────────────────────────┐
│                     CROSS-SECTION VIEW                       │
│                                                              │
│                    ┌───────────────────┐                     │
│                    │   OUTER WALL      │                     │
│                    │  ╭─────────────╮  │                     │
│                    │  │             │  │                     │
│                    │  │  ≋≋≋≋≋≋≋≋≋  │  │  ← ENERGY EQUATOR  │
│                    │  │  ≋PLASMA≋≋  │  │    (Centered in    │
│                    │  │  ≋≋≋≋≋≋≋≋≋  │  │     tube cavity)   │
│                    │  │             │  │                     │
│                    │  ╰─────────────╯  │                     │
│                    │   INNER WALL      │                     │
│                    └───────────────────┘                     │
│                                                              │
│  The plasma floats in the CENTER of the glass tube,          │
│  NOT on the surface. Equal distance from all walls.          │
└─────────────────────────────────────────────────────────────┘

POSITIONING:
- The glow exists within the HOLLOW center of the torus tube
- Equidistant from inner wall and outer wall
- Follows the toroidal path around the ring's circumference
- Creates true 3D depth — the glass contains the energy

APPEARANCE (Abstract Variable Plasma):
- NOT a solid line or predictable gradient
- Organic, churning, alive — like contained lightning or nebula gas
- Variable intensity along the circumference
- Noise-driven turbulence creates randomized bright spots
- Some areas glow intensely, others dim — constantly shifting
- Feels like a living entity, not a mechanical effect

VISUAL PROPERTIES:
- Base Color: Electric Violet #A855F7
- Hot Spots: White #FFFFFF (randomly distributed)
- Cool Zones: Deep Purple #581C87 (variable opacity)
- Blur: 3-6px (softer = more depth)
- Blend Mode: Screen or Additive
- Noise: 3D Simplex with high turbulence (see Section 7.2)

ANIMATION:
- Primary Flow: 8s base rotation (but NOT uniform)
- Turbulence: Noise-driven position jitter (organic movement)
- Intensity Pulse: Random bright flares (2-4s intervals)
- No predictable pattern — the plasma "breathes" chaotically
```

### Layer 3: Glass Shell (Top Reflection)

```
- Shape: Circle stroke, same position as body
- Stroke Width: Same as body (48-50pt)
- Gradient: Linear, top to bottom
  - Top: White 30% opacity
  - Middle: White 5% opacity
  - Bottom: Transparent
- Purpose: Simulates overhead light reflection on glass
```

### Layer 4: Rim Light (HD Edge Definition)

```
- Shape: Circle stroke, outer edge of ring
- Stroke Width: 1-2pt
- Gradient: Angular
  - Stops: White 80% at 0.1 → Clear at 0.25 → Clear at 0.75 → White 50% at 0.9
- Position: Slightly outside body (-1pt padding)
- Purpose: Sharp edge definition, "HD" look
```

### Layer 5: Specular Highlight (Wet Look)

```
- Shape: Circle stroke, positioned on body
- Stroke Width: 2-4pt
- Gradient: Angular, single bright spot
  - White 100% at location 0.13
  - Clear at location 0.18
- Rotation: -45° (top-left quadrant)
- Blur: 0.5-2px (very sharp)
- Blend Mode: Overlay or Screen
- Purpose: "Wet" polished glass appearance
```

---

## 5. Color System

### 5.1 State-Based Colors

| State | Primary Color | Hex | RGB | Description |
|-------|---------------|-----|-----|-------------|
| Dormant | Near-black Obsidian | `#1A0D28` | (26, 13, 40) | Desaturated, cold |
| Active | Electric Violet | `#A855F7` | (168, 85, 247) | Vibrant, warm |
| Explode Core | White Hot | `#FFFFFF` | (255, 255, 255) | Peak intensity |
| Rim Glow | Bright Purple | `#C084FC` | (192, 132, 252) | Rim lighting |
| Shockwave | Electric Violet | `#9333EA` | (147, 51, 234) | Expanding ring |
| Particle Start | Electric Violet | `#9333EA` | (147, 51, 234) | Initial burst |
| Particle Peak | White | `#FFFFFF` | (255, 255, 255) | 30% through life |
| Particle Fade | Light Purple | `#E9D5FF` | (233, 213, 255) | Decay color |
| Ambient Fog | Deep Purple | `#581C87` | (88, 28, 135) | Background atmosphere |

### 5.2 Color Temperature Shift

As the ring transitions from dormant to active:

| Property | Dormant (0%) | Active (100%) |
|----------|--------------|---------------|
| Saturation | 0 (grayscale) | 1 (full vibrant) |
| Warmth | 0 (cold/neutral) | 1 (warm/vibrant) |
| Hue Shift | Toward gray | Toward magenta |

### 5.3 Plasma Color Gradient (Energy-Driven)

```
// Interpolate based on energy level (0.0 to 1.0)
dormantColor = vec3(0.02, 0.015, 0.03)  // Near-black
activeColor  = vec3(0.50, 0.10, 0.85)   // Magenta-violet
maxColor     = vec3(0.90, 0.60, 1.00)   // Bright magenta-white

plasmaColor = mix(dormantColor, activeColor, energy)
```

---

## 6. Animation States & Behaviors

### 6.1 State Machine

```
┌─────────────┐
│   DORMANT   │◄────────────────────────────┐
│   (0%)      │                             │
└──────┬──────┘                             │
       │ User interaction detected          │
       │ (mouse enter, click, typing)       │
       ▼                                    │
┌─────────────┐                             │
│   WAKING    │                             │
│  (0%→50%)   │                             │
└──────┬──────┘                             │
       │ 800ms spring animation             │
       ▼                                    │
┌─────────────┐     Click on ring     ┌─────────────┐
│   ACTIVE    │─────────────────────► │  EXPLODING  │
│   (50%)     │                       │  (100%)     │
└──────┬──────┘◄──────────────────────└─────────────┘
       │                                    │
       │ 3 seconds inactivity               │
       ▼                                    │
┌─────────────┐                             │
│  SLEEPING   │─────────────────────────────┘
│  (50%→0%)   │
└─────────────┘
```

### 6.2 DORMANT State (0% Energy)

**Visual Characteristics:**

- Tilted 15° away from camera (X-axis)
- Deep obsidian color, nearly black
- Minimal internal glow (energy = 0.03, never fully off)
- Very tight rim lighting (fresnel power 8.0, intensity 0.15)
- Slow plasma movement (flow speed 0.015)
- Gentle bob animation (breathing)
- Slow Y-axis spin (0.1 rad/sec)

**Bob Animation (Breathing):**

```
amplitude = 0.02 units
frequency = 0.5 Hz
yOffset = amplitude * sin(time * frequency * 2π)
```

**Behavior:** Patient, waiting, observing. Plasma churns slowly like a lava lamp.

### 6.3 WAKING State (0% → 50% Transition)

**Duration:** 800ms

**Triggers:**

- Mouse enters app window
- User starts typing
- User clicks anywhere in app

**Animation Sequence:**

| Time | Action |
|------|--------|
| 0-200ms | Ring begins rotation from tilted position |
| 200-500ms | Ring rotates on X-axis: 15° → 0° (faces camera) |
| 300-600ms | Internal energy glows: 0% → 50% |
| 500-800ms | Atmospheric fog intensifies |

**Spring Physics:**

```
stiffness: 150
damping: 20
mass: 1
```

Feel: Bouncy, energetic with slight overshoot then settle

**Interpolated Properties:**

| Property | Start | End |
|----------|-------|-----|
| X Rotation | 15° | 0° |
| Energy | 0.0 | 0.5 |
| Fresnel Power | 8.0 | 1.5 |
| Rim Intensity | 0.15 | 2.5 |
| Plasma Flow | 0.015 | 0.03 |
| Color Saturation | 0 | 1 |

### 6.4 ACTIVE State (50% Energy)

**Visual Characteristics:**

- Facing camera directly (0° tilt)
- Vibrant electric violet (#A855F7)
- Internal plasma swirls visibly
- Bright rim lighting (fresnel power 1.5, intensity 2.5)
- Medium energy glow (0.5-0.7)
- Faster Y-axis spin (0.3 rad/sec)
- Subtle pulsing on user input

**Duration:** Continues while user is engaged

**Timeout:** After 3 seconds of inactivity → transitions to SLEEPING

### 6.5 EXPLODING State (Celebration)

**Duration:** 800ms total

**Triggers:**

- Direct click on ring
- Major success/completion event

**Multi-Element Animation Timeline:**

| Time | Element | Action |
|------|---------|--------|
| 0-100ms | Ring | Scale 1.0 → 1.15x |
| 100-300ms | Core | Blaze white-hot (#FFFFFF) |
| 200-400ms | Shockwave | Purple ring expands (radius 1.0 → 3.0) |
| 300-500ms | Bloom | Purple fog (#9333EA) floods background |
| 400-600ms | Particles | 200-300 particles burst radially |
| 500-800ms | All | Settle back to active state |

**Shockwave Properties:**

```
startRadius: 1.0 (matches ring)
endRadius: 3.0 (3x expansion)
thickness: 0.2 → 0.05 (thins as expands)
opacity: 0.8 → 0 (ease-out)
duration: 600ms
blendMode: Additive
color: #9333EA
```

**Particle Properties:**

```
count: 200-300
initialColor: #9333EA (electric violet)
peakColor: #FFFFFF (white hot) at 30% lifetime
fadeColor: #E9D5FF (light purple)
opacity: 1.0 → 0 over 800ms (ease decay)
size: 0.02-0.05 units
direction: Radial outward with random spread (±30°)
velocity: 2-4 units/sec initial, decelerating
```

**Bloom Post-Processing:**

```
intensity: 0 → 2 → 0
peak: 20% of duration (160ms)
luminanceThreshold: 0.8
```

**Camera Shake (Optional):**

```
offset: ±0.02 units (X and Y)
duration: 50-100ms
frequency: 60Hz (high-frequency)
damping: Exponential decay
```

**Spring Physics (Recovery):**

```
stiffness: 400
damping: 30
mass: 0.8
```

### 6.6 SLEEPING State (50% → 0% Transition)

**Duration:** 800ms

**Trigger:** 3 seconds of user inactivity

**Animation:**

- Ring tilts back: 0° → 15° (away from camera)
- Energy fades: 0.5 → 0.03
- Plasma slows: normal → 0.015
- Color desaturates toward obsidian
- Fresnel power increases: 1.5 → 8.0
- Rim intensity decreases: 2.5 → 0.15

**Easing:** ease-out (non-bouncy, graceful power-down)

**Spring Physics:**

```
stiffness: 120
damping: 26
mass: 1
```

---

## 7. Plasma Core System (Energy Equator)

The plasma is NOT a simple rotating gradient — it is **abstract, variable, and alive**.
The goal is to create the feeling of contained cosmic energy, like a nebula trapped
within volcanic glass.

### 7.1 Core Philosophy: Alive, Not Mechanical

```
╔══════════════════════════════════════════════════════════════╗
║   WRONG: Predictable rotating gradient (feels mechanical)    ║
║   ────────────────────────────────────────────────────────   ║
║   ░░░░░█████████░░░░░░░░░░░░░░░░░░ → Uniform rotation        ║
║                                                              ║
║   RIGHT: Abstract variable plasma (feels alive)              ║
║   ────────────────────────────────────────────────────────   ║
║   ░▓██░▓░██▓░░▓██░▓▓░█░░▓██░▓░░░ → Chaotic, breathing       ║
╚══════════════════════════════════════════════════════════════╝
```

The plasma should evoke:

- Contained lightning seeking escape
- Nebula gas churning in a glass sphere
- A living entity, not a screensaver effect
- Power that could explode at any moment

### 7.2 Noise Generation (High Turbulence)

The plasma effect uses 3D Simplex noise with aggressive Fractal Brownian Motion:

```glsl
// Fractal Brownian Motion parameters (higher turbulence than typical)
octaves: 6              // More layers = more detail
lacunarity: 2.2         // Higher = more high-frequency detail
gain: 0.55              // Slightly higher persistence

// Domain warping for organic movement (aggressive)
warpStrength: 0.5 (dormant) → 0.9 (active)  // Stronger distortion
flowSpeed: 0.02 (dormant) → 0.05+ (active)  // Faster base flow

// Turbulence multiplier (creates unpredictable hot spots)
turbulenceScale: 3.0    // Larger = bigger turbulent structures
turbulenceSpeed: 0.8    // How fast the chaos evolves

// Random intensity variation
intensityNoise: separate noise layer for brightness variation
hotSpotProbability: 0.15  // 15% chance of intense flare per frame
hotSpotDecay: 0.92        // How quickly hot spots fade
```

### 7.3 Abstract Plasma Properties

```glsl
// Base plasma calculation
basePlasma = fbm(position * scale + time * flowSpeed)

// Add turbulent distortion
turbulence = fbm(position * turbulenceScale + time * turbulenceSpeed)
distortedPosition = position + turbulence * warpStrength

// Calculate final plasma with random intensity
finalPlasma = fbm(distortedPosition)
intensityVariation = noise(position * 0.5 + time * 0.3)

// Create hot spots (randomly distributed bright areas)
hotSpotNoise = noise(position * 2.0 + time * 0.1)
isHotSpot = hotSpotNoise > (1.0 - hotSpotProbability)
plasmaIntensity = mix(finalPlasma, 1.0, isHotSpot * hotSpotIntensity)
```

### 7.4 Energy Equator Positioning

The plasma exists in TRUE 3D space within the torus tube:

```glsl
// Position plasma in center of tube cavity
tubeRadius = 0.35       // Radius of the tube cross-section
plasmaRadius = 0.0      // Plasma runs through CENTER (equator)
plasmaThickness = 0.15  // How thick the plasma band appears

// Distance from tube center determines plasma visibility
distanceFromEquator = abs(localTubePosition - plasmaRadius)
equatorFalloff = smoothstep(plasmaThickness, 0.0, distanceFromEquator)

// Plasma is brightest at the equator, fades toward walls
finalPlasmaColor = plasmaColor * equatorFalloff * plasmaIntensity
```

### 7.5 Plasma Visibility Through Glass

The plasma is visible through the obsidian surface with depth-based effects:

```glsl
// Plasma appears stronger when viewed face-on
plasmaDepth = 1.0 - fresnel

// Glass attenuation (plasma dims slightly through thick glass)
glassAttenuation = 0.85

// Never fully off - always a hint of internal life
minPlasmaIntensity = 0.05  // Slightly higher minimum for variable plasma

// Final visibility
visiblePlasma = plasmaIntensity * plasmaDepth * glassAttenuation
visiblePlasma = max(visiblePlasma, minPlasmaIntensity)
```

### 7.6 Plasma Animation Behaviors

```
STATE-BASED PLASMA BEHAVIOR
════════════════════════════════════════════════════════════════

DORMANT:
- Slow, lazy churning (like cooling lava)
- Mostly dark with occasional dim flickers
- Hot spots are rare and subtle
- Movement feels heavy, sluggish

WAKING:
- Turbulence increases dramatically
- Hot spots become more frequent
- Colors shift from cold purple to warm violet
- Feels like power building up

ACTIVE:
- Full chaotic movement
- Multiple hot spots visible at any time
- Constant intensity variation
- Feels alive and attentive

EXPLODING:
- All plasma reaches maximum intensity
- Hot spots merge into solid white core
- Turbulence peaks then releases
- Shockwave emanates from the energy equator
```

### 7.7 Color Gradient Along Intensity

```glsl
// Plasma color shifts with intensity (energy-driven)
lowIntensity   = vec3(0.02, 0.01, 0.04)   // Near-black purple
midIntensity   = vec3(0.66, 0.33, 0.97)   // Electric violet #A855F7
highIntensity  = vec3(0.90, 0.70, 1.00)   // Bright magenta-white
peakIntensity  = vec3(1.00, 1.00, 1.00)   // Pure white (hot spots)

plasmaColor = mix(lowIntensity, midIntensity, intensity)
plasmaColor = mix(plasmaColor, highIntensity, intensity * intensity)
plasmaColor = mix(plasmaColor, peakIntensity, isHotSpot)
```

---

## 8. Atmospheric Integration

### 8.1 Background Fog

The ring affects its environment through atmospheric fog layers:

| State | Primary Color | Secondary Color | Opacity | Breathing |
|-------|---------------|-----------------|---------|-----------|
| Dormant | `#1a0a2e` | `#0d0518` | 5-15% | 4s cycle |
| Waking | `#2d1b4e` | `#1a0f2e` | 10-20% | 3s cycle |
| Active | `#3B1D5A` | `#2d1b4e` | 15-25% | 3s cycle |
| Processing | `#3B1D5A` | `#9333EA` | 20-30% | 2s + 1s pulse |
| Exploding | `#9333EA` | `#c084fc` | 50-80% | Flash + fade |

### 8.2 Fog Layers

```
Layer 1 (Primary): 200vmax radial gradient
Layer 2 (Secondary): 250vmax, deeper, slower breathing
Layer 3 (Inner Glow): 150vmax, close to ring center
```

### 8.3 Ambient Particles

| State | Count | Opacity | Behavior |
|-------|-------|---------|----------|
| Idle | 50-100 | 10-20% | Dust motes, random drift |
| Processing | 50-100 | 20-30% | Flow toward ring |
| Data Burst | +20-50 | 40-60% | Spawn from data sources |

---

## 9. Performance Specifications

### 9.1 Target Metrics

| Metric | Target | Maximum |
|--------|--------|---------|
| Frame Rate | 60fps | 120fps |
| GPU Memory | <30MB | 50MB |
| Initial Load | <300ms | 500ms |
| Device Pixel Ratio | 2x | 2x cap |

### 9.2 Quality Levels

| Level | Radial Segments | Tubular Segments | Particles | Use Case |
|-------|-----------------|------------------|-----------|----------|
| Low | 32 | 16 | 50 | Older devices, battery saver |
| Medium | 64 | 32 | 150 | Standard usage |
| High | 96 | 64 | 250 | Modern devices |
| Ultra | 128 | 96 | 400 | Desktop, high-end |

### 9.3 Adaptive Quality

```
frameTimeBudget: 8.33ms (for 120Hz)
hysteresis: 30 frames to downgrade, 60 to upgrade
thermalAwareness: Reduce quality on thermal throttle
cooldownBetweenChanges: 2 seconds
```

### 9.4 Reduced Motion Support

When user prefers reduced motion:

- Use static PNG fallback
- Instant transitions (no animation)
- No particles or shockwave
- Simple opacity fade for state changes

---

## 10. Reference Images

### Available in this folder

| File | Description | Use For |
|------|-------------|---------|
| `0%Opta.png` | Dormant state reference | Dark obsidian, minimal glow |
| `0%OptaWithReduced...png` | Dormant with focused lighting | Alternative dormant style |
| `50%Opta.png` | Active state reference | Vibrant purple, bright plasma |
| `Opta3DDiagonal.png` | 3D perspective view | Understanding tilt/depth |
| `BlackdiamondMinimilisticInspo.png` | Material inspiration | Obsidian glass quality |
| `animation-frames/` | Frame-by-frame references | Animation keyframes |

---

## 11. Implementation Checklist

When implementing the Opta Ring, ensure:

- [ ] **CRITICAL: Center hole is 100% transparent** (no fills, no gradients)
- [ ] **All effects contained in torus wall** (plasma, glow, reflections)
- [ ] **Ring works on any background** (acts like a 3D PNG overlay)
- [ ] **Geometry** matches torus proportions (1.0 major, 0.35 tube radius)
- [ ] **Obsidian material** is dark, reflective, NOT transparent
- [ ] **Fresnel rim** responds to view angle with correct power/intensity
- [ ] **Energy Equator** plasma is centered in tube, abstract/variable, alive-feeling
- [ ] **Plasma** is NOT a predictable gradient — uses high-turbulence noise
- [ ] **Hot spots** randomly appear and fade (organic, not mechanical)
- [ ] **States** transition smoothly with spring physics
- [ ] **Dormant** is tilted 15°, barely glowing, slow plasma
- [ ] **Active** faces camera, bright rim, fast plasma
- [ ] **Explosion** has all elements: scale, blaze, shockwave, particles, bloom
- [ ] **Colors** match specification (dormant #1A0D28, active #A855F7)
- [ ] **Performance** maintains 60fps minimum
- [ ] **Accessibility** provides reduced motion alternative

---

## 12. Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║                    OPTA RING QUICK REFERENCE                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  GEOMETRY                                                    ║
║  ─────────                                                   ║
║  Major Radius: 1.0    Tube Radius: 0.35    Frame: 300-320pt  ║
║                                                              ║
║  COLORS                                                      ║
║  ──────                                                      ║
║  Dormant: #1A0D28    Active: #A855F7    Explode: #FFFFFF     ║
║  Rim: #C084FC        Ambient: #581C87   Shockwave: #9333EA   ║
║                                                              ║
║  STATES                                                      ║
║  ──────                                                      ║
║  Dormant → 15° tilt, fresnel 8.0, rim 0.15, flow 0.015       ║
║  Active  → 0° tilt, fresnel 1.5, rim 2.5, flow 0.03          ║
║                                                              ║
║  SPRINGS                                                     ║
║  ───────                                                     ║
║  Wake:   { stiffness: 150, damping: 20, mass: 1 }            ║
║  Sleep:  { stiffness: 120, damping: 26, mass: 1 }            ║
║  Explode:{ stiffness: 400, damping: 30, mass: 0.8 }          ║
║                                                              ║
║  TRANSITIONS                                                 ║
║  ───────────                                                 ║
║  Wake: 800ms    Sleep: 800ms    Explode: 800ms               ║
║  Inactivity timeout: 3 seconds                               ║
║                                                              ║
║  LAYERS (back to front)                                      ║
║  ──────                                                      ║
║  0: Ambient Glow    3: Glass Shell                           ║
║  1: Obsidian Body   4: Rim Light                             ║
║  2: ENERGY EQUATOR  5: Specular Highlight                    ║
║     (3D plasma in tube center, abstract/variable/alive)      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

*Document Version: 2.1*
*Last Updated: January 2026*
*For use with: Gemini, Claude, and all UI/UX development*

**v2.0 Changes:**

- Introduced "Energy Equator" concept — plasma is centered within the torus tube
- Plasma is now abstract, variable, and alive-feeling (not a predictable gradient)
- Added high-turbulence noise parameters for organic movement
- Added hot spot system for random intensity flares

**v2.1 Changes:**

- Added Section 1.3: CRITICAL transparent center rule
- Ring center must be 100% transparent (like a 3D PNG)
- All effects contained within torus wall only
- Ring floats as overlay on any background
