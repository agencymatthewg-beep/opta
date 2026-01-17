# Phase 28: Ring State Machine & Context - Summary

**Status**: Completed
**Date**: 2025-01-17

## Overview

Phase 28 implements a comprehensive state machine and global context for the Opta Ring protagonist, enabling consistent state management, activity-based wake/sleep transitions, and energy level tracking across the entire application.

## Completed Plans

### 28-01: Extended RingState Type
**File**: `src/components/OptaRing3D/types.ts`

Created a comprehensive 7-state type system for the ring:

| State | Visual Description | Energy Level | Duration |
|-------|-------------------|--------------|----------|
| `dormant` | Tilted 15 deg, slow spin (0.1 rad/s), low energy | 0 - 0.2 | Default resting state |
| `waking` | Transitioning to active, tilt reducing | 0.2 - 0.5 | 800ms spring |
| `active` | Facing camera, faster spin (0.3 rad/s), medium energy | 0.5 - 0.7 | While engaged |
| `sleeping` | Transitioning to dormant, tilt increasing | 0.2 - 0.5 | 800ms ease-out |
| `processing` | Active + pulsing glow, high energy | 0.6 - 0.9 | During async operations |
| `exploding` | Particle burst, max energy, celebration | 0.9 - 1.0 | 800ms |
| `recovering` | Post-explosion cooldown | 0.5 - 0.7 | 500ms |

Also includes:
- Energy level ranges per state (`ENERGY_LEVELS`)
- Transition timing configuration (`STATE_TRANSITIONS`)
- Visual properties getter (`getVisualProperties`)
- State transition validation (`isValidTransition`, `VALID_TRANSITIONS`)

### 28-02: useOptaWakeUp Hook
**File**: `src/hooks/useOptaWakeUp.ts`

Enhanced activity detection hook with:

**Activity Detection**:
- Mouse movement (within element or global)
- Keyboard input (keydown)
- Scroll events
- Click/touch events

**Features**:
- Throttled detection (100ms default) for performance
- Auto-wake on any activity
- Auto-sleep after 3s inactivity
- SSR-safe implementation

**Return Values**:
```typescript
interface WakeUpState & WakeUpActions {
  isEngaged: boolean;           // Active engagement state
  energyLevel: number;          // 0-0.5 animated energy
  phase: RingState;             // Current state machine phase
  lastActivity: number;         // Timestamp of last activity
  engagementDuration: number;   // Duration of current session
  wake: () => void;             // Manual wake trigger
  sleep: () => void;            // Manual sleep trigger
  reset: () => void;            // Reset activity tracking
}
```

### 28-03: OptaRingContext Provider
**File**: `src/contexts/OptaRingContext.tsx`

Global state management with:

**State**:
- Current ring state (RingState)
- Energy level (0-1) with smooth transitions
- Position (center/sidebar/hidden/custom)
- Size (xs/sm/md/lg/xl/hero)
- Transition flags

**Actions**:
```typescript
interface OptaRingContextValue {
  // Celebration
  triggerExplosion: () => void;

  // Async operations
  setProcessing: (processing: boolean) => void;

  // State transitions
  ignite: () => Promise<void>;   // dormant -> waking -> active
  sleep: () => Promise<void>;    // active -> sleeping -> dormant
  setState: (state: RingState) => void;  // Validates transition
  forceState: (state: RingState) => void; // Skip validation

  // Position/size
  moveTo: (position: RingPosition) => Promise<void>;
  setShowFloating: (show: boolean) => void;
  setSize: (size: RingSize) => void;

  // Special sequences
  triggerPageTransition: () => Promise<void>;
  flash: () => Promise<void>;
}
```

### 28-04: State Transition Timing
**File**: `src/components/OptaRing3D/types.ts`

Defined transition rules with proper timing:

| Transition | Duration | Easing |
|------------|----------|--------|
| dormant -> waking | 0ms (immediate) | linear |
| waking -> active | 800ms | spring (300, 25) |
| active -> sleeping | 0ms (immediate) | linear |
| sleeping -> dormant | 800ms | ease-out |
| active -> processing | 0ms (immediate) | linear |
| processing -> active | 200ms | ease-out |
| active/processing -> exploding | 0ms (immediate) | linear |
| exploding -> recovering | 800ms | ease-in-out |
| recovering -> active | 500ms | spring (250, 20) |
| recovering -> dormant | 500ms | ease-out |

## Files Changed

### New Files
- `src/components/OptaRing3D/types.ts` - Ring state machine types and utilities

### Modified Files
- `src/components/OptaRing3D/index.tsx` - Updated exports for new types
- `src/components/OptaRing3D/OptaRing3D.tsx` - Uses new types and getDefaultEnergy
- `src/components/OptaRing3D/RingMesh.tsx` - Uses new getVisualProperties
- `src/hooks/useOptaWakeUp.ts` - Enhanced with activity detection and timing
- `src/contexts/OptaRingContext.tsx` - Complete rewrite with state machine
- `src/components/OptaRing.tsx` - Updated to use shared RingState type
- `src/components/effects/AtmosphericFog.tsx` - Added sleeping/recovering colors

## Integration Points

### Using the Context
```tsx
import { OptaRingProvider, useOptaRing } from '@/contexts/OptaRingContext';

// Wrap app
<OptaRingProvider>
  <App />
</OptaRingProvider>

// Use in components
function MyComponent() {
  const { state, energyLevel, triggerExplosion, setProcessing } = useOptaRing();

  const handleSuccess = () => triggerExplosion();
  const handleAsyncOp = async () => {
    setProcessing(true);
    await someAsyncWork();
    setProcessing(false);
    triggerExplosion();
  };
}
```

### Using Activity Detection
```tsx
import { useOptaWakeUp } from '@/hooks/useOptaWakeUp';

function MyComponent() {
  const ref = useRef<HTMLDivElement>(null);
  const { isEngaged, phase, energyLevel } = useOptaWakeUp({
    elementRef: ref,
    trackGlobal: true,
    sleepDelay: 3000,
  });

  return (
    <div ref={ref}>
      <OptaRing3D state={phase} energyLevel={energyLevel} />
    </div>
  );
}
```

## Design System Compliance

- All animations use Framer Motion or requestAnimationFrame
- Spring physics from `src/lib/animation/springs.ts`
- Colors from `RING_COLORS` in types.ts match design system
- SSR-safe with window checks
- Proper cleanup with useEffect

## Performance Considerations

- Activity detection throttled to 100ms
- Energy animations use requestAnimationFrame
- Context value memoized with useMemo
- Separate hooks for selective state access (`useRingState`, `useRingEnergy`)

## Future Enhancements

- Particle system integration for explosion state
- Sound effects coordination
- Haptic feedback integration
- Reduced motion support

## Related Documentation

- `/DESIGN_SYSTEM.md` - Part 9: The Opta Ring
- `/.claude/skills/opta-ring-animation.md` - Animation specifications
- `/.planning/phases/20-rich-interactions/ring-animation/` - Full animation spec
