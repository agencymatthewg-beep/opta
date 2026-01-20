# Opta Animation Specification v5.0

Complete animation documentation for Opta's premium visual experience.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Spring Configurations](#spring-configurations)
3. [Timing Constants](#timing-constants)
4. [Ring Animation States](#ring-animation-states)
5. [Page Transition Choreography](#page-transition-choreography)
6. [Stagger Configurations](#stagger-configurations)
7. [Particle System Parameters](#particle-system-parameters)
8. [Fog Animation](#fog-animation)
9. [Micro-Interactions](#micro-interactions)
10. [Reduced Motion Support](#reduced-motion-support)

---

## Core Principles

### Physics-Based Motion

All animations use **spring physics** instead of duration-based timing. This creates:

- Natural, interruptible motion
- Consistent feel across different distances
- Retargetable animations mid-flight

Per Gemini research:
> "Configure mass, stiffness, damping instead of duration-based animations. Elements have 'weight' - flick and bounce with momentum."

### Never Use

- `transition-duration` for interactive elements
- Linear easing curves
- CSS `@keyframes` for complex motion (use Framer Motion)
- Fixed durations for variable-distance animations

---

## Spring Configurations

### Core Presets

| Preset | Stiffness | Damping | Mass | Use Case |
|--------|-----------|---------|------|----------|
| `snappy` | 500 | 30 | 1 | Buttons, toggles, small elements |
| `bouncy` | 300 | 20 | 1 | Big reveals, celebrations |
| `smooth` | 200 | 25 | 1 | Content transitions |
| `gentle` | 150 | 20 | 0.8 | Hover states, micro-interactions |

### Context-Specific Presets

| Preset | Stiffness | Damping | Mass | Use Case |
|--------|-----------|---------|------|----------|
| `button` | 600 | 35 | 0.8 | Button press feedback |
| `modal` | 400 | 30 | 1.2 | Modal open/close |
| `content` | 250 | 30 | 1 | Content area transitions |
| `sidebar` | 350 | 35 | 1 | Sidebar slide |
| `tooltip` | 500 | 25 | 0.5 | Tooltip appear |
| `drawer` | 300 | 30 | 1.1 | Drawer slide |
| `card` | 350 | 28 | 0.9 | Card interactions |
| `list` | 280 | 26 | 1 | List item animations |
| `rubberBand` | 800 | 40 | 0.5 | Overscroll, drag limits |
| `settle` | 200 | 15 | 1 | For haptic sync |

### Code Example

```tsx
import { springs, getSpring, createCustomSpring } from '@/lib/animation';

// Use preset
<motion.div transition={springs.snappy} />

// Get spring by name
<motion.div transition={getSpring('bouncy')} />

// Create custom spring
const heavyBouncy = createCustomSpring('bouncy', { mass: 1.5 });
```

### Critical Damping Ratio

The damping ratio determines bounce behavior:

```
ratio = damping / (2 * sqrt(stiffness * mass))
```

| Ratio | Behavior |
|-------|----------|
| < 1 | Underdamped (bouncy) |
| = 1 | Critically damped (fastest settle, no bounce) |
| > 1 | Overdamped (sluggish) |

---

## Timing Constants

### Duration Reference (for non-spring animations)

| Constant | Value | Use Case |
|----------|-------|----------|
| `INSTANT` | 0ms | Reduced motion, immediate |
| `FAST` | 150ms | Hover feedback, tooltips |
| `NORMAL` | 300ms | Standard transitions |
| `SLOW` | 500ms | Page transitions |
| `DRAMATIC` | 800ms | Hero animations |

### Delay Constants

| Constant | Value | Use Case |
|----------|-------|----------|
| `STAGGER_FAST` | 20ms | Quick list cascade |
| `STAGGER_NORMAL` | 40ms | Standard cascade |
| `STAGGER_SLOW` | 80ms | Dramatic cascade |
| `INITIAL_DELAY` | 50ms | Before stagger starts |

---

## Ring Animation States

### State Machine Diagram

```
                    ┌─────────────┐
                    │   dormant   │ ◄─── Initial state
                    └──────┬──────┘
                           │ hover/type
                           ▼
                    ┌─────────────┐
                    │   waking    │ (800ms spring)
                    └──────┬──────┘
                           │
                           ▼
    ┌─────────────────────────────────────────┐
    │                 active                   │
    └────────┬────────────────────────┬───────┘
             │ long operation         │ click/success
             ▼                        ▼
    ┌─────────────┐          ┌─────────────┐
    │ processing  │          │  exploding  │
    └─────────────┘          └──────┬──────┘
                                    │ 1200ms
                                    ▼
                            ┌─────────────┐
                            │ recovering  │ (500ms)
                            └──────┬──────┘
                                   │
                                   └───► active
```

### State Parameters

#### dormant
```tsx
{
  rotation: { x: 0, y: 0, z: Math.PI * 0.083 },  // 15° tilt
  spinSpeed: 0.1,  // rad/s
  glowIntensity: 0.2,
  color: '#1a0a2e',  // Deep purple
}
```

#### waking
```tsx
{
  rotation: { x: 0, y: 0, z: 0 },  // Faces camera
  spinSpeed: 0.3,
  glowIntensity: 0.5,
  transition: { type: 'spring', stiffness: 300, damping: 25, duration: 800 },
}
```

#### active
```tsx
{
  rotation: { x: 0, y: 0, z: 0 },
  spinSpeed: 0.3,
  glowIntensity: 0.7,
  plasmaActive: true,
  color: '#8b5cf6',  // Neon purple
}
```

#### processing
```tsx
{
  glowIntensity: 1.0,
  pulseFrequency: 1,  // Hz
  particleAttraction: true,
  color: '#9333EA',
}
```

#### exploding
```tsx
{
  particleCount: 200,
  particleVelocity: { min: 5, max: 15 },
  shockwaveRadius: 2,
  bloomIntensity: 1.5,
  cameraShake: { intensity: 0.02, duration: 50 },
  duration: 1200,
}
```

#### recovering
```tsx
{
  fadeInDuration: 500,
  targetState: 'active',
}
```

### Ring Transitions

| From | To | Trigger | Duration | Easing |
|------|-----|---------|----------|--------|
| dormant | waking | hover/type | 800ms | spring(300, 25) |
| waking | active | completion | - | - |
| active | dormant | 3s inactivity | 1000ms | ease-out |
| active | processing | long op start | 300ms | spring(200, 20) |
| processing | active | long op end | 300ms | spring(200, 20) |
| active | exploding | click/success | instant | - |
| exploding | recovering | animation end | 1200ms | linear |
| recovering | active | completion | 500ms | ease-out |

---

## Page Transition Choreography

### Enter Transition

```tsx
const pageEnterVariants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: 'blur(8px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],  // smoothOut
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: {
      duration: 0.3,
    },
  },
};
```

### Ring Choreography During Transition

1. **Page Exit**: Ring pulses, scales down slightly (0.95)
2. **Transition**: Ring moves to center, intensifies glow
3. **Page Enter**: Ring returns to position as content fades in

### Stagger Order

Content enters in this order:
1. Background elements (fog, particles)
2. Navigation (already visible)
3. Hero/title area
4. Main content cards (staggered)
5. Secondary elements

---

## Stagger Configurations

### Presets

| Preset | staggerChildren | delayChildren | Use Case |
|--------|-----------------|---------------|----------|
| `fast` | 20ms | 0ms | Small lists (5-10 items) |
| `normal` | 40ms | 50ms | Medium lists (10-20 items) |
| `slow` | 80ms | 100ms | Hero sections |
| `dramatic` | 60ms | 150ms | Special reveals |
| `instant` | 0ms | 0ms | Reduced motion |

### Item Variants

#### Standard (fade + slide up)
```tsx
{
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
}
```

#### Ignition (Obsidian style)
```tsx
{
  hidden: {
    opacity: 0,
    scale: 0.95,
    filter: 'brightness(0.5) blur(4px)'
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'brightness(1) blur(0px)'
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    filter: 'brightness(0.8) blur(2px)'
  },
}
```

#### Pop (scale emphasis)
```tsx
{
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
}
```

### Usage Example

```tsx
import {
  createContainerVariants,
  itemVariants
} from '@/lib/animation';

<motion.ul
  variants={createContainerVariants('fast')}
  initial="hidden"
  animate="visible"
>
  {items.map(item => (
    <motion.li key={item.id} variants={itemVariants}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

---

## Particle System Parameters

### Ambient Dust Motes

```tsx
{
  count: 75,           // 50-100 range
  size: [1, 3],        // px
  color: 'rgba(255, 255, 255, 0.15)',
  secondaryColor: 'rgba(139, 92, 246, 0.12)',
  baseSpeed: 0.15,
  driftVariation: 0.05,
  depth: [0.3, 1.0],   // For parallax
}
```

### Energy Sparks

```tsx
{
  count: 20,
  size: [2, 4],
  color: 'rgba(139, 92, 246, 0.4)',
  speed: 0.3,
  lifetime: 2000,      // ms
  trigger: 'near_active_element',
}
```

### Data Burst

```tsx
{
  count: 30,
  size: [1, 2],
  color: 'primary',    // Uses design system color
  speed: 0.5,
  direction: 'radial', // or 'upward'
  trigger: 'telemetry_update',
}
```

### Ring Attraction (Processing State)

```tsx
{
  attractionForce: 0.01,
  attractionRadius: Infinity,
  minDistance: 50,     // Don't attract when within 50px
  particleAffected: 'all',
}
```

---

## Fog Animation

### Breathing Animation

```css
@keyframes fog-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.02); }
}
```

| State | Cycle Duration |
|-------|----------------|
| dormant | 4s |
| active | 3s |
| processing | 2s |

### Opacity Animation

```css
@keyframes fog-opacity-micro {
  0%, 100% { opacity: var(--fog-base-opacity); }
  50% { opacity: calc(var(--fog-base-opacity) + 0.02); }
}
```

### Processing Pulse

```css
@keyframes fog-processing-pulse {
  0%, 100% { --fog-color: var(--fog-color-primary); }
  50% { --fog-color: var(--fog-color-secondary); }
}
```

---

## Micro-Interactions

### Tilt Card

```tsx
<TiltCard
  maxTilt={10}        // degrees
  scale={1.02}
  perspective={1000}
  transitionSpeed={300}
>
  <Card />
</TiltCard>
```

### Magnetic Button

```tsx
<MagneticButton
  strength={0.3}       // Pull strength
  radius={100}         // Effect radius
  easing="smooth"
>
  <Button />
</MagneticButton>
```

### Hover Shift

```tsx
<HoverShift
  direction="up"       // 'up' | 'down' | 'left' | 'right'
  distance={4}         // px
  spring={springs.gentle}
>
  <ListItem />
</HoverShift>
```

### Deep Glow

```tsx
<DeepGlow
  intensity={0.5}      // 0-1, auto from telemetry if not set
  color="primary"      // Auto from intensity if not set
  pulseSpeed={1}
>
  <Component />
</DeepGlow>
```

Intensity color thresholds:
- `< 0.3`: Purple (idle)
- `0.3-0.6`: Cyan (active)
- `0.6-0.85`: Yellow/orange (warning)
- `> 0.85`: Pulsing red (critical)

---

## Reduced Motion Support

### Detection

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';

const prefersReducedMotion = useReducedMotion();
```

### Fallback Patterns

#### Springs → Instant

```tsx
import { getSpringOrInstant } from '@/lib/animation';

const transition = getSpringOrInstant('snappy', prefersReducedMotion);
// Returns { type: 'tween', duration: 0 } if reduced motion
```

#### Stagger → Simultaneous

```tsx
import { getStaggerVariants } from '@/lib/animation';

const { container, item } = getStaggerVariants(prefersReducedMotion);
// Returns instant variants if reduced motion
```

#### Particles → Static Dots

```tsx
<ParticleField />
// Automatically renders StaticDots component when reduced motion
```

#### Fog → No Animation

```tsx
<AtmosphericFogAuto />
// Uses CSS media query to disable animations
```

### CSS Media Query

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Quick Reference

### Animation Selection Guide

| Scenario | Recommended |
|----------|-------------|
| Button press | `springs.button` or `springs.snappy` |
| Modal open | `springs.modal` or `springs.bouncy` |
| Content transition | `springs.content` or `springs.smooth` |
| Hover effect | `springs.gentle` |
| Drag overscroll | `springs.rubberBand` |
| List cascade | `staggerConfig.normal` + `itemVariants` |
| Ring wake-up | `spring(300, 25)` 800ms |
| Ring explosion | 1200ms linear |
| Page enter | 500ms smoothOut |
| Page exit | 300ms ease-out |

### Performance Budget

| Metric | Target | Max |
|--------|--------|-----|
| Animation FPS | 60fps | 120fps |
| Concurrent springs | 10 | 20 |
| Particle count | 75 | 100 |
| WebGL effects | 2 | 3 per view |

---

*Version: 5.0*
*Last Updated: Phase 40 - Documentation & Launch*
