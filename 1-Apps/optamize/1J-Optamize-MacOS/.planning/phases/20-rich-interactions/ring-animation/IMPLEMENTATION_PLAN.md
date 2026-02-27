# Implementation Plan: Opta 3D Ring

> **Estimated Duration**: 6 development sessions
> **Dependencies**: Three.js, @react-three/fiber (already installed)
> **Related Phase**: 20-rich-interactions

---

## Pre-Implementation Checklist

- [ ] Review `/DESIGN_SYSTEM.md` completely
- [ ] Review `/src/components/OptaRing.tsx` current implementation
- [ ] Review `/src/contexts/OptaRingContext.tsx` state management
- [ ] Confirm Three.js/R3F dependencies installed
- [ ] Run `npm run build` to verify current state

---

## Phase 1: Foundation (Session 1)

### Goals
- Create 3D canvas that renders in place of current OptaRing
- Basic spinning torus visible

### Tasks

1. **Create component structure**
```bash
mkdir -p src/components/OptaRing3D/shaders
```

2. **Create OptaRing3D.tsx**
```tsx
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { RingMesh } from './RingMesh';

export function OptaRing3D({ state, size }) {
  return (
    <div className={sizeClasses[size]}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <RingMesh state={state} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

3. **Create RingMesh.tsx**
```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function RingMesh({ state }) {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current && state === 'dormant') {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1, 0.4, 64, 128]} />
      <meshStandardMaterial color="#5B21B6" />
    </mesh>
  );
}
```

### Deliverable
- [ ] Basic spinning torus renders
- [ ] Canvas properly sized
- [ ] No console errors

---

## Phase 2: Glassmorphism Material (Session 2)

### Goals
- Custom shader with fresnel edge glow
- Energy level controls brightness

### Tasks

1. **Create vertex shader** (`shaders/glassmorphism.vert`)
2. **Create fragment shader** (`shaders/glassmorphism.frag`)
3. **Create RingMaterial.tsx** with shaderMaterial
4. **Test energy level animation**

### Deliverable
- [ ] Torus has glass-like appearance
- [ ] Fresnel effect on edges
- [ ] Energy level animates smoothly

---

## Phase 3: Wake-Up Animation (Session 3)

### Goals
- Ring rotates to face camera on engagement
- Energy glows up during wake-up

### Tasks

1. **Add @react-spring/three for animations**
2. **Implement rotation spring**
```tsx
const { rotationX } = useSpring({
  rotationX: state === 'dormant' ? Math.PI * 0.08 : 0,
  config: { stiffness: 150, damping: 20 },
});
```

3. **Create useOptaWakeUp hook**
4. **Add to App.tsx as global listener**

### Deliverable
- [ ] Ring rotates to face camera on hover
- [ ] Ring rotates to face camera on keypress
- [ ] Energy glows during transition
- [ ] Ring returns to dormant after 3s inactivity

---

## Phase 4: Explosion Effect (Session 4)

### Goals
- Click triggers purple burst
- Particles fly outward

### Tasks

1. **Create ExplosionEffect.tsx**
2. **Add shockwave ring geometry**
3. **Add particle system (8 particles)**
4. **Integrate with ring click handler**

### Deliverable
- [ ] Click triggers explosion
- [ ] Shockwave expands outward
- [ ] Particles burst radially
- [ ] Returns to active state

---

## Phase 5: Polish & Integration (Session 5)

### Goals
- Connect with AtmosphericFog
- Handle reduced motion
- Performance optimization

### Tasks

1. **Fog intensity varies with state**
2. **Add useReducedMotion fallback**
3. **Limit frame rate when idle**
4. **Test on integrated graphics**

### Deliverable
- [ ] Fog responds to ring state
- [ ] Reduced motion users get PNG fallback
- [ ] 60fps maintained
- [ ] Memory under 50MB

---

## Phase 6: Testing & Documentation (Session 6)

### Goals
- Comprehensive testing
- Update DESIGN_SYSTEM.md

### Tasks

1. **Create Storybook stories**
2. **Test all platforms**
3. **Update documentation**
4. **Final review**

### Deliverable
- [ ] All states work correctly
- [ ] Cross-platform verified
- [ ] Documentation updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WebGL unavailable | Keep current PNG fallback |
| Performance issues | Cap DPR, reduce geometry detail |
| Animation too subtle | Increase glow intensity |
| Animation too jarring | Adjust spring damping |

---

## Success Criteria

| Criteria | Measurement |
|----------|-------------|
| Wake-up triggers | On hover AND keypress |
| Wake-up duration | 800ms ± 100ms |
| Return to dormant | After 3s inactivity |
| Explosion duration | 800ms ± 100ms |
| Frame rate | 60fps minimum |
| Memory usage | <50MB GPU |

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/components/OptaRing3D/*` | New |
| `src/contexts/OptaRingContext.tsx` | Modified |
| `src/hooks/useOptaWakeUp.ts` | New |
| `src/App.tsx` | Modified (add listener) |
| `DESIGN_SYSTEM.md` | Modified (add docs) |
