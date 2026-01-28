# Opta Ring Animation Skill

> **Purpose**: Guide Claude Code in implementing the enhanced 3D Opta Ring with wake-up animation and explosion effects.

---

## Quick Context

The Opta "O" logo should behave as a **living entity**:
- **Dormant**: Tilted away, slowly spinning (user not engaged)
- **Waking**: Rotates to face camera when user hovers/types
- **Active**: Facing user, internal energy glowing
- **Exploding**: Purple neon burst on click

This is the **signature interaction** of the Opta app—the AI "waking up" when the user engages.

---

## When to Use This Skill

Activate this skill when working on:
- `OptaRing.tsx` or `OptaRing3D/` components
- `OptaRingContext.tsx` state management
- Ring-related animations
- Any task mentioning "ring wake-up", "O animation", or "explosion effect"

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `.planning/phases/20-rich-interactions/ring-animation/OPTA_RING_ANIMATION_SPEC.md` | **Full technical specification** |
| `.planning/phases/20-rich-interactions/ring-animation/IMPLEMENTATION_PLAN.md` | Step-by-step implementation guide |
| `../Opta MacOS/Opta Vision/animation-frames/` | Visual reference frames |
| `/src/components/OptaRing.tsx` | Current 2D implementation |
| `/src/contexts/OptaRingContext.tsx` | Ring state management |
| `/DESIGN_SYSTEM.md` | Style guide compliance |

---

## Critical Requirements

### 1. State Machine
```
DORMANT → WAKING → ACTIVE ↔ EXPLODING
   ↑__________________________|  (after 3s inactivity)
```

### 2. Wake-Up Triggers
- Mouse enters app window
- User starts typing
- User clicks anywhere

### 3. Animation Timing
| Animation | Duration |
|-----------|----------|
| Wake-up | 800ms |
| Return to dormant | After 3s inactivity |
| Explosion | 800ms |

### 4. Colors (From Design System)
```tsx
const ringColors = {
  dormant: 'hsl(265 50% 20%)',    // Dark violet
  active: 'hsl(265 90% 65%)',     // Electric violet
  explosionCore: '#FFFFFF',       // White flash
  explosionBloom: '#9333EA',      // Bright purple
};
```

### 5. Spring Physics
```tsx
const wakeUpSpring = { stiffness: 150, damping: 20, mass: 1 };
const explosionSpring = { stiffness: 400, damping: 30, mass: 0.8 };
```

---

## Implementation Approach

### Option A: Enhance Current Implementation (Simpler)
Keep PNG-based approach but add:
1. CSS 3D transforms for rotation
2. Framer Motion for spring animations
3. Scale pulse on explosion

**Pros**: Faster, lighter, wider compatibility
**Cons**: Less premium feel, limited depth

### Option B: Full 3D WebGL (Premium)
Replace with Three.js implementation:
1. Real 3D torus geometry
2. Custom glassmorphism shader
3. True 3D rotation and lighting

**Pros**: Matches video reference exactly, premium feel
**Cons**: More complex, requires WebGL fallback

**Recommendation**: Start with Option A for immediate improvement, then evolve to Option B in Phase 20.

---

## Quick Implementation (Option A)

### Step 1: Update OptaRingContext
```tsx
// Add new states
type RingState = 'dormant' | 'waking' | 'active' | 'exploding';

// Add new methods
triggerWakeUp: () => void;
triggerExplosion: () => void;
```

### Step 2: Add Wake-Up Hook
```tsx
// src/hooks/useOptaWakeUp.ts
export function useOptaWakeUp() {
  const { state, triggerWakeUp } = useOptaRing();

  useEffect(() => {
    const handleActivity = () => {
      if (state === 'dormant') triggerWakeUp();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => { /* cleanup */ };
  }, [state]);
}
```

### Step 3: Update OptaRing.tsx
```tsx
<motion.div
  animate={{
    rotateX: state === 'dormant' ? 15 : 0,
    scale: state === 'exploding' ? 1.15 : 1,
  }}
  transition={{ type: 'spring', ...wakeUpSpring }}
>
  {/* existing ring content */}
</motion.div>
```

---

## Visual Reference Guide

When implementing, reference these frame sequences in `../Opta MacOS/Opta Vision/animation-frames/`:

| Sequence | Frames | What to Match |
|----------|--------|---------------|
| `spinning/` | 01-06 | Idle rotation speed and angle |
| `wake-up/` | 01-16 | Rotation to face camera |
| `glassmorphism/` | 01-06 | Material quality (specular, glow) |
| `explosion/` | 01-16 | Burst timing and particle behavior |

---

## Testing Checklist

Before marking ring animation work complete:
- [ ] Ring tilts away when user is inactive (3s)
- [ ] Ring rotates to face camera on mouse enter
- [ ] Ring rotates to face camera on keypress
- [ ] Energy glow animates with rotation
- [ ] Click triggers explosion effect
- [ ] Explosion returns to active state
- [ ] 60fps maintained
- [ ] Reduced motion preference respected

---

## Common Mistakes to Avoid

1. **Using CSS transitions** - Always use Framer Motion springs
2. **Forgetting inactivity timeout** - Ring must return to dormant
3. **Explosion without return** - Must settle back to active
4. **Ignoring reduced motion** - Provide fallback for accessibility
5. **Breaking fog integration** - Ring state should affect AtmosphericFog

---

## Related Context

- **Agent Personality**: The ring waking up represents Opta becoming "attentive" - this should feel like the AI acknowledging the user
- **Sound Design**: Future audio should include crystalline "ignition" sound on wake-up
- **Fog System**: `AtmosphericFog.tsx` should intensify when ring is active/exploding
