# Phase 26: Ring Wake-Up Animation - COMPLETE

## Overview

Phase 26 implements the ring wake-up animation system, enabling the Opta Ring to transition smoothly between dormant (0% energy) and active (50% energy) states based on user engagement. This creates the "Living Artifact" behavior described in the Design System.

## Completed Plans

### 26-01: Dormant State Configuration
**Status: COMPLETE**

- **Dormant rotation**: X = Math.PI * 0.083 (~15 degrees tilted)
- **Idle Y rotation**: 0.1 rad/s (6 RPM)
- **Subtle bob animation**: Sine wave on Y position (amplitude: 0.02, frequency: 0.5Hz)
- Bob fades as energy level increases

### 26-02: Wake Trigger Hook
**Status: COMPLETE**

Created `src/hooks/useOptaWakeUp.ts`:
- Tracks mouse hover over element via `elementRef`
- Tracks global keyboard activity via `trackGlobal`
- Tracks scroll and click events
- Debounce: 100ms throttle on activity detection
- Returns `isEngaged`, `energyLevel`, `phase`, `lastActivity`, `engagementDuration`
- Provides `wake()`, `sleep()`, `reset()` manual control functions

### 26-03: Active State with Spring Physics
**Status: COMPLETE**

- **Active rotation**: X = 0 (facing camera directly)
- **Active Y rotation**: 0.3 rad/s (faster, more energetic)
- **Spring physics config**:
  ```typescript
  {
    mass: 1,
    tension: 150,  // stiffness
    friction: 20,  // damping
  }
  ```
- Uses `@react-spring/three` for smooth interpolation
- `animated.mesh` wrapper for spring-animated rotation

### 26-04: Sleep Transition
**Status: COMPLETE**

- **Sleep delay**: 3000ms (3s) after last interaction
- **Ease-out config**:
  ```typescript
  {
    mass: 1,
    tension: 120,
    friction: 26,  // Higher friction = less oscillation
  }
  ```
- Energy decreases: 0.5 -> 0 over 800ms
- Smooth transition back to dormant tilt

## New Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useOptaWakeUp.ts` | Hook for tracking user engagement and controlling wake/sleep state |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/OptaRing3D/RingMesh.tsx` | Added spring physics, bob animation, sleeping state support |
| `src/components/OptaRing3D/OptaRing3D.tsx` | Added `springEnabled` prop passthrough |
| `src/components/OptaRing3D/types.ts` | Added `sleeping` state to RingState enum |
| `package.json` | Added `@react-spring/three` dependency |

## State Machine Update

Added `sleeping` state to the ring state machine:

```
dormant -> waking -> active -> sleeping -> dormant
                  -> processing -> exploding -> recovering -> active
                                            -> dormant
```

Valid transitions from `sleeping`:
- `sleeping -> dormant` (animation complete)
- `sleeping -> waking` (interrupted by new activity)

## Dependencies Added

```json
{
  "@react-spring/three": "^9.x"
}
```

## Usage Example

```tsx
import { useRef } from 'react';
import { OptaRing3D } from '@/components/OptaRing3D';
import { useOptaWakeUp } from '@/hooks/useOptaWakeUp';

function RingDemo() {
  const ringRef = useRef<HTMLDivElement>(null);
  const { phase, energyLevel } = useOptaWakeUp({
    elementRef: ringRef,
    trackGlobal: true,
  });

  return (
    <div ref={ringRef}>
      <OptaRing3D
        state={phase}
        energyLevel={energyLevel}
        size="hero"
      />
    </div>
  );
}
```

## Animation Constants Reference

| Constant | Value | Purpose |
|----------|-------|---------|
| `DORMANT_TILT` | `Math.PI * 0.083` | 15 degree tilt away from camera |
| `ACTIVE_TILT` | `0` | Facing camera directly |
| `DORMANT_Y_SPEED` | `0.1 rad/s` | Slow idle spin (6 RPM) |
| `ACTIVE_Y_SPEED` | `0.3 rad/s` | Faster engaged spin |
| `BOB_AMPLITUDE` | `0.02` | Subtle vertical oscillation |
| `BOB_FREQUENCY` | `0.5 Hz` | Bob cycle timing |
| `WAKE_SPRING` | `{tension: 150, friction: 20}` | Bouncy wake-up feel |
| `SLEEP_SPRING` | `{tension: 120, friction: 26}` | Smooth ease-out sleep |

## Design System Compliance

- Uses physics-based springs per Design System Part 5
- Respects `prefers-reduced-motion` via `springEnabled` prop
- Ring states follow 0% to 50% energy concept
- Premium feel with spring overshoot on wake

## Testing Notes

1. **Wake-up test**: Hover over ring or type on keyboard
   - Ring should tilt to face camera within ~800ms
   - Spin speed should increase noticeably
   - Bob animation should fade out

2. **Sleep test**: Stop interaction for 3+ seconds
   - Ring should ease back to tilted position
   - Spin should slow down
   - Bob animation should resume

3. **Interrupt test**: Start sleeping, then interact
   - Should immediately interrupt sleep and wake back up

## Known Limitations

- Global keyboard tracking is always-on when `trackGlobal` is true
- No touch gesture support beyond basic tap (future enhancement)
- Bob animation is Y-axis only (no X/Z subtle movements yet)

## Next Phase

Phase 27: Explosion Effect - Particle burst celebration on achievement/success states.
