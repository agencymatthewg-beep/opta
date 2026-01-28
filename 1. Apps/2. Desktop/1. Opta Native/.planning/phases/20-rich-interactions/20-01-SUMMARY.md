# Plan 20-01 Summary: Premium Animation System

**Status:** Completed
**Date:** 2026-01-17
**Duration:** Single session

---

## What Was Built

A comprehensive physics-based animation system providing premium, Apple-level motion design for the Opta application. The system includes spring presets, shared element transitions, blur-back effects, staggered entry animations, micro-interactions, haptic synchronization, and chromatic loading integration.

---

## Files Created

### Animation Library (`src/lib/animation/`)

| File | Purpose |
|------|---------|
| `springs.ts` | Physics-based spring presets (snappy, bouncy, smooth, gentle, context-specific) |
| `stagger.ts` | Staggered entry animation configurations and item variants |
| `transitions.ts` | Shared element transition registry and transform utilities |
| `haptics.ts` | Animation-synchronized haptic feedback utilities |
| `index.ts` | Barrel exports with comprehensive documentation |

### Hooks (`src/hooks/`)

| File | Purpose |
|------|---------|
| `useSharedElement.ts` | Hook for morphing animations between element positions |
| `useMicroInteraction.ts` | Hook for subtle hover position/tilt/magnetic effects |
| `useChromaticLoading.ts` | Hook for coordinating chromatic aberration with loading states |

### Effect Components (`src/components/effects/`)

| File | Purpose |
|------|---------|
| `BlurBack.tsx` | Background blur + scale effect for modal overlays |
| `StaggeredList.tsx` | Animated list component with cascading entry |
| `MicroInteraction.tsx` | Wrapper components for micro-interaction effects |
| `index.ts` | Updated barrel exports with new components |

---

## Key Features

### 1. Physics-Based Springs

```typescript
import { springs, getSpring } from '@/lib/animation';

// Core presets
springs.snappy   // Buttons, toggles (stiffness: 500)
springs.bouncy   // Modals, celebrations (stiffness: 300)
springs.smooth   // Content transitions (stiffness: 200)
springs.gentle   // Hover states (stiffness: 150)

// Context-specific
springs.button   // Optimized for button press
springs.modal    // Heavier for modal reveal
springs.rubberBand // Overscroll effect
```

### 2. Blur-Back Effect

```tsx
import { BlurBackProvider, BlurBackContent, useBlurBack } from '@/components/effects';

// Wrap app content
<BlurBackProvider>
  <BlurBackContent>
    <MainContent />
  </BlurBackContent>
  <Modal />
</BlurBackProvider>

// In modal - content scales to 0.95 and blurs
function Modal({ open }) {
  const { setBlurBack } = useBlurBack();
  useEffect(() => {
    setBlurBack(open, 12); // 12px blur when open
    return () => setBlurBack(false);
  }, [open]);
}
```

### 3. Staggered List Animation

```tsx
import { StaggeredList, StaggeredGrid } from '@/components/effects';

// Items cascade in with configurable delay
<StaggeredList
  items={users}
  renderItem={(user) => <UserCard user={user} />}
  keyExtractor={(user) => user.id}
  stagger="fast"     // 20ms between items
  variant="ignition" // Obsidian-style emerge from darkness
/>
```

### 4. Micro-Interactions

```tsx
import { MicroInteraction, TiltCard, MagneticButton } from '@/components/effects';

// Subtle position shift toward cursor (max 3px)
<MicroInteraction intensity={3}>
  <Card>Content</Card>
</MicroInteraction>

// 3D tilt effect
<TiltCard maxTilt={8} hoverScale={1.02}>
  <Image />
</TiltCard>

// Magnetic attraction to cursor
<MagneticButton strength={0.2}>
  Click me
</MagneticButton>
```

### 5. Chromatic Loading

```tsx
import { useChromaticLoading } from '@/hooks/useChromaticLoading';
import { ChromaticLoader } from '@/components/effects';

function DataFetcher() {
  const { isLoading, withChromatic } = useChromaticLoading();

  const fetchData = async () => {
    const result = await withChromatic(async () => {
      return await api.getData();
    });
  };

  return (
    <ChromaticLoader isLoading={isLoading}>
      <DataTable />
    </ChromaticLoader>
  );
}
```

### 6. Haptic Synchronization

```tsx
import { useHapticOnSettle, useHapticSpring } from '@/lib/animation';

// Fire haptic when spring settles
function DraggableItem() {
  const x = useSpring(0);
  useHapticOnSettle(x, 'selection'); // "thud" when velocity = 0

  return <motion.div style={{ x }} drag="x" />;
}

// Or use pre-integrated spring
const x = useHapticSpring(0, 'smooth', 'selection');
```

---

## Design Principles Applied

From Gemini Premium App UI/UX Research:

| Principle | Implementation |
|-----------|----------------|
| Linear = robotic, Spring = premium | All presets use spring physics |
| Elements have "weight" | Mass, stiffness, damping tuned per context |
| Subtle overshoot | Underdamped springs for iOS-like bounce |
| Blur-Back depth | Scale 0.95 + blur creates spatial hierarchy |
| Staggered Entry | 10-40ms delays create reveal effect |
| Haptic sync | Fire "thud" when velocity approaches zero |
| Interruptible | Springs retarget from current velocity |

---

## Reduced Motion Support

All utilities respect `prefers-reduced-motion`:

```tsx
// Automatic fallback
const prefersReducedMotion = useReducedMotion();
<motion.div transition={getSpringOrInstant('snappy', prefersReducedMotion)} />

// Components disable effects automatically
<MicroInteraction disabled={prefersReducedMotion}>
  <Card />
</MicroInteraction>
```

---

## Build Status

All new files compile without TypeScript errors. Pre-existing errors in unrelated files remain but do not affect the animation system.

---

## Usage Notes

1. **Import from barrel exports** for clean imports:
   ```tsx
   import { springs, staggerConfig } from '@/lib/animation';
   import { BlurBackProvider, StaggeredList } from '@/components/effects';
   ```

2. **Choose springs by context**, not by feel:
   - Button -> `springs.button`
   - Modal -> `springs.modal`
   - List -> `springs.list`

3. **Blur-back requires provider** at app root:
   ```tsx
   <BlurBackProvider>
     <BlurBackContent>...</BlurBackContent>
   </BlurBackProvider>
   ```

4. **Stagger timing**:
   - `fast` (20ms) - Small lists, quick reveals
   - `normal` (40ms) - Standard cascades
   - `slow` (80ms) - Dramatic hero sections

---

## Next Steps

- **Plan 20-02**: Gesture-driven page navigation (swipe, pinch)
- **Plan 20-03**: Advanced drag interactions
- **Plan 20-04**: Full haptic feedback integration with Tauri

---

*Completed: 2026-01-17*
