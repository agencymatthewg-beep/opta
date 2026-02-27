# Opta Ring Animation Specification

> **Context**: This document defines the enhanced 3D Opta Ring with wake-up animation, explosion effects, and glassmorphism materials. Based on video reference materials analyzed on 2026-01-17.

---

## Overview

The Opta "O" logo is not just a static image—it's a **living entity** that responds to user presence. This specification details how to evolve the current PNG-based `OptaRing.tsx` into a full 3D WebGL implementation.

### Current State
- `src/components/OptaRing.tsx` - Uses static PNG crossfade between 0% and 50% states
- `src/assets/branding/opta-0-percent.png` - Dormant state image
- `src/assets/branding/opta-50-percent.png` - Active state image

### Target State
- 3D WebGL torus with glassmorphism shader
- Wake-up animation (rotates to face camera on engagement)
- Explosion effect on click
- Dynamic energy glow based on state

---

## Ring States

```
DORMANT ──(hover/type)──→ WAKING ──(complete)──→ ACTIVE
   ↑                                                │
   └──────────────(3s inactivity)───────────────────┘

ACTIVE ──(click)──→ EXPLODING ──(complete)──→ ACTIVE
```

### State Definitions

| State | Rotation | Energy | Behavior |
|-------|----------|--------|----------|
| **Dormant** | X: 15°, slow Y spin | 0% (dark obsidian) | Tilted away, gently spinning |
| **Waking** | Animating X: 15° → 0° | 0% → 50% | Rotating to face camera |
| **Active** | X: 0° (facing) | 50% (glowing) | Facing user, internal energy visible |
| **Exploding** | X: 0°, scale 1.15x | 100% (white-hot) | Purple burst, particles |

---

## Wake-Up Animation (The Key Feature)

### Trigger Conditions
- Mouse enters app window
- User starts typing in any input field
- User clicks anywhere in the app

### Animation Sequence (800ms)

| Time | Action |
|------|--------|
| 0-200ms | Ring begins rotation from tilted position |
| 200-500ms | Ring rotates on X-axis to face camera |
| 300-600ms | Internal energy begins to glow (0% → 50%) |
| 500-800ms | Purple atmospheric fog intensifies |

### Key Values
```tsx
// Dormant (tilted, not facing user)
const dormantRotation = { x: Math.PI * 0.08, y: 0, z: 0 }; // ~15°

// Active (facing camera directly)
const activeRotation = { x: 0, y: 0, z: 0 };

// Idle spin speed (when dormant)
const idleRotationSpeed = 0.1; // radians per second on Y axis
```

### Spring Configuration
```tsx
const wakeUpSpring = {
  stiffness: 150,
  damping: 20,
  mass: 1,
};
```

---

## Explosion Effect (Click Feedback)

### Trigger
User clicks directly on the Opta ring

### Animation Sequence (800ms)

| Time | Element | Action |
|------|---------|--------|
| 0-100ms | Ring | Scale to 1.15x |
| 100-300ms | Core | Blaze white-hot |
| 200-400ms | Shockwave | Purple ring expands outward |
| 300-500ms | Bloom | Purple fog floods background |
| 400-600ms | Particles | 8 energy particles burst radially |
| 500-800ms | All | Settle back to active state |

### Explosion Colors
```tsx
const explosionPalette = {
  coreFlash: '#FFFFFF',
  coreFade: '#E9D5FF',
  shockwave: '#9333EA',
  bloom: 'rgba(147, 51, 234, 0.6)',
  particles: '#E9D5FF',
};
```

### Spring Configuration
```tsx
const explosionSpring = {
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};
```

---

## Technical Implementation

### Dependencies (Already in package.json)
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Useful helpers
- `three` - 3D library
- `framer-motion` - Animation (for non-3D elements)
- `@react-spring/three` - Animation for 3D elements

### File Structure
```
src/components/OptaRing3D/
├── index.tsx              # Main export
├── OptaRing3D.tsx         # Canvas wrapper
├── RingMesh.tsx           # 3D torus geometry
├── RingMaterial.tsx       # Custom glassmorphism shader
├── ExplosionEffect.tsx    # Particle burst
├── EnergyCore.tsx         # Inner glowing center
└── shaders/
    ├── glassmorphism.vert
    └── glassmorphism.frag
```

### Glassmorphism Shader Uniforms
```glsl
uniform float uTime;           // Animation time
uniform float uEnergyLevel;    // 0.0 = dormant, 1.0 = full active
uniform vec3 uPrimaryColor;    // Electric violet
uniform vec3 uSecondaryColor;  // Dormant violet
uniform float uFresnelPower;   // Edge glow intensity (2.0 default)
```

---

## Integration Points

### 1. OptaRingContext (Existing)
Update `src/contexts/OptaRingContext.tsx` to support new states:

```tsx
type RingState = 'dormant' | 'waking' | 'active' | 'processing' | 'exploding';

interface OptaRingContextValue {
  state: RingState;
  setState: (state: RingState) => void;
  triggerWakeUp: () => void;
  triggerExplosion: () => void;
  energyLevel: number; // 0-1
}
```

### 2. Global Wake-Up Hook
Create `src/hooks/useOptaWakeUp.ts`:

```tsx
export function useOptaWakeUp() {
  const { state, triggerWakeUp, triggerSleep } = useOptaRing();

  useEffect(() => {
    let sleepTimeout: NodeJS.Timeout;

    const handleActivity = () => {
      if (state === 'dormant') triggerWakeUp();
      clearTimeout(sleepTimeout);
      sleepTimeout = setTimeout(triggerSleep, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    // ... cleanup
  }, [state]);
}
```

### 3. AtmosphericFog Integration
Connect with existing `src/components/AtmosphericFog.tsx`:

```tsx
// Intensify fog during explosion
useEffect(() => {
  if (state === 'exploding') setFogIntensity(0.8);
  else if (state === 'active') setFogIntensity(0.5);
  else setFogIntensity(0.15);
}, [state]);
```

---

## Fallback Strategy

WebGL may not be available. Implement graceful degradation:

```tsx
import { isWebGLAvailable } from '@/lib/webgl';

function OptaRingUniversal(props) {
  const [useWebGL, setUseWebGL] = useState(true);

  useEffect(() => {
    setUseWebGL(isWebGLAvailable());
  }, []);

  return useWebGL
    ? <OptaRing3D {...props} />
    : <OptaRing {...props} />; // Current PNG fallback
}
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Frame Rate | 60fps minimum |
| GPU Memory | <50MB |
| Initial Load | <500ms |
| DPR Cap | 2x maximum |

---

## Visual Reference

Reference frames are located in:
- `/Opta Vision/animation-frames/spinning/` - Idle rotation
- `/Opta Vision/animation-frames/glassmorphism/` - Material quality
- `/Opta Vision/animation-frames/explosion/` - Click feedback
- `/Opta Vision/animation-frames/wake-up/` - Camera facing animation

---

## Related Documents

- `/DESIGN_SYSTEM.md` - Complete style guide
- `/.planning/AESTHETIC_PREFERENCES.md` - User-validated preferences
- `/.planning/phases/20-rich-interactions/` - Phase planning
- `/src/components/OptaRing.tsx` - Current implementation
