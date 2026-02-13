# Opta Performance Requirements v5.0

Performance benchmarks and requirements for the Premium Visual Experience.

---

## Table of Contents

1. [Hardware Requirements](#hardware-requirements)
2. [Performance Tiers](#performance-tiers)
3. [Target Metrics](#target-metrics)
4. [Memory Usage Guidelines](#memory-usage-guidelines)
5. [GPU Requirements](#gpu-requirements)
6. [Fallback Behavior](#fallback-behavior)
7. [Performance Testing](#performance-testing)

---

## Hardware Requirements

### Minimum Requirements

| Component | Minimum | Notes |
|-----------|---------|-------|
| **CPU** | 4 cores, 2.0 GHz | Any x64 or ARM64 |
| **RAM** | 4 GB | 8 GB recommended |
| **GPU** | Integrated graphics | WebGL 2.0 required |
| **Storage** | 200 MB | Application only |
| **Display** | 1280x720 | 60Hz minimum |

### Recommended Requirements

| Component | Recommended | Notes |
|-----------|-------------|-------|
| **CPU** | 8 cores, 3.0 GHz | Apple M1+ or Intel i5+/AMD Ryzen 5+ |
| **RAM** | 8 GB | 16 GB for development |
| **GPU** | Dedicated GPU | 2 GB VRAM |
| **Storage** | SSD | For fast app launch |
| **Display** | 1920x1080 | 120Hz for smooth animations |

### Target Hardware

Opta v5.0 is optimized for:

| Platform | Target Device |
|----------|---------------|
| **macOS** | MacBook Pro M1/M2/M3, Mac Studio |
| **Windows** | Gaming desktop with RTX 3060+ |
| **Linux** | Ubuntu 22.04+ with modern GPU drivers |

---

## Performance Tiers

Opta automatically detects hardware capability and adjusts visual quality.

### Tier 1: High-End

**Detection**: Dedicated GPU with 4+ GB VRAM, 16+ GB RAM

| Feature | Setting |
|---------|---------|
| Particle count | 100 |
| Ring geometry segments | 128 |
| WebGL effects | All enabled |
| Blur quality | Full |
| Fog layers | 3 |
| Deep glow | WebGL shader |
| Target FPS | 120 |

### Tier 2: Standard

**Detection**: Dedicated GPU with 2+ GB VRAM, 8+ GB RAM

| Feature | Setting |
|---------|---------|
| Particle count | 75 |
| Ring geometry segments | 64 |
| WebGL effects | Most enabled |
| Blur quality | Full |
| Fog layers | 2 |
| Deep glow | WebGL shader |
| Target FPS | 60 |

### Tier 3: Integrated

**Detection**: Integrated GPU, 4+ GB RAM

| Feature | Setting |
|---------|---------|
| Particle count | 50 |
| Ring geometry segments | 32 |
| WebGL effects | Limited |
| Blur quality | Reduced |
| Fog layers | 1 |
| Deep glow | CSS fallback |
| Target FPS | 60 |

### Tier 4: Fallback

**Detection**: No WebGL, <4 GB RAM, or reduced motion preference

| Feature | Setting |
|---------|---------|
| Particle count | 0 (static dots) |
| Ring geometry | CSS-only |
| WebGL effects | Disabled |
| Blur quality | Minimal |
| Fog layers | 0 |
| Deep glow | CSS box-shadow |
| Target FPS | 60 |

---

## Target Metrics

### Frame Rate Targets

| Context | Target | Minimum | Notes |
|---------|--------|---------|-------|
| **Idle UI** | 60 fps | 30 fps | Low GPU usage |
| **Scrolling** | 60 fps | 45 fps | Smooth scroll |
| **Animations** | 60 fps | 45 fps | Spring physics |
| **Ring active** | 60 fps | 30 fps | 3D rendering |
| **Page transition** | 60 fps | 30 fps | Complex choreography |
| **Explosion effect** | 60 fps | 24 fps | Brief, high intensity |

### Performance Budgets

| Metric | Budget | Max |
|--------|--------|-----|
| **Main thread** | 8ms/frame | 16ms |
| **Layout** | 2ms/frame | 4ms |
| **Paint** | 4ms/frame | 8ms |
| **Composite** | 2ms/frame | 4ms |
| **WebGL draw** | 4ms/frame | 8ms |

### Bundle Size

| Asset Type | Budget | Notes |
|------------|--------|-------|
| **Initial JS** | 250 KB | Gzipped |
| **Total JS** | 1.5 MB | All chunks |
| **CSS** | 50 KB | Gzipped |
| **Fonts** | 100 KB | Sora only |
| **WebGL shaders** | 20 KB | Minified |

---

## Memory Usage Guidelines

### JavaScript Heap

| Context | Target | Warning | Critical |
|---------|--------|---------|----------|
| **Idle** | 50 MB | 100 MB | 200 MB |
| **Active** | 100 MB | 200 MB | 400 MB |
| **Peak** | 200 MB | 400 MB | 800 MB |

### WebGL Resources

| Resource | Budget |
|----------|--------|
| **Textures** | 50 MB |
| **Geometry** | 10 MB |
| **Shaders** | 2 MB |
| **Frame buffers** | 20 MB |

### Cleanup Requirements

- Dispose Three.js geometries on unmount
- Clear WebGL textures when not in use
- Cancel animation frames on component unmount
- Use weak references for caches

```tsx
// Example: Proper Three.js cleanup
useEffect(() => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();

  return () => {
    geometry.dispose();
    material.dispose();
  };
}, []);
```

---

## GPU Requirements

### WebGL Capabilities

| Feature | Required | Fallback |
|---------|----------|----------|
| **WebGL 2.0** | Preferred | WebGL 1.0 |
| **Float textures** | Yes | - |
| **Instanced rendering** | Yes | Individual draws |
| **MRT** | Nice-to-have | Single pass |
| **MSAA** | Nice-to-have | FXAA post-process |

### Shader Complexity

| Shader | Instruction Limit |
|--------|-------------------|
| **Glass** | 100 ALU |
| **Glow** | 50 ALU |
| **Chromatic** | 30 ALU |
| **Fog** | 20 ALU |

### Device Pixel Ratio

| DPR | Action |
|-----|--------|
| 1x | Render at native |
| 2x | Render at 2x (Retina) |
| 3x+ | Cap at 2x for performance |

```tsx
// Example: DPR capping
const dpr = Math.min(window.devicePixelRatio || 1, 2);
```

---

## Fallback Behavior

### WebGL Unavailable

When WebGL is not available:

1. **Detection**: Check `isWebGLAvailable()` on mount
2. **Glass panels**: Use CSS `backdrop-filter` blur
3. **Deep glow**: Use CSS `box-shadow` with multiple layers
4. **Particles**: Render static dots with CSS
5. **Ring**: Use CSS-only animation
6. **Fog**: Use CSS radial gradients without animation

### Example Fallback Pattern

```tsx
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

### Reduced Motion

When `prefers-reduced-motion: reduce`:

1. **Springs**: Replace with instant transitions
2. **Stagger**: All items appear simultaneously
3. **Particles**: Static dots instead of animated
4. **Fog**: Static gradient, no breathing
5. **Ring**: No spin, static glow
6. **Page transitions**: Simple fade

### Low Memory Mode

When memory pressure detected:

1. **Reduce particle count** to 50
2. **Simplify ring geometry** (32 segments)
3. **Disable fog animation**
4. **Use single-layer glow**
5. **Reduce texture resolution** (0.5x)

---

## Performance Testing

### Benchmarks to Run

#### 1. Initial Load

```bash
# Measure time to interactive
lighthouse --only-categories=performance --output=json

# Target: TTI < 2s, FCP < 1s
```

#### 2. Animation FPS

```javascript
// In browser DevTools console
const frameTimes = [];
let lastTime = performance.now();

function measureFrame() {
  const now = performance.now();
  frameTimes.push(now - lastTime);
  lastTime = now;
  requestAnimationFrame(measureFrame);
}

requestAnimationFrame(measureFrame);

// After 10 seconds:
const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
console.log(`Average FPS: ${1000 / avgFrameTime}`);
```

#### 3. Memory Leak Detection

```javascript
// Run in DevTools Performance tab
// 1. Take heap snapshot
// 2. Trigger component mount/unmount cycle 10 times
// 3. Take heap snapshot
// 4. Compare - no retained objects from unmounted components
```

#### 4. GPU Profiling

```javascript
// Using WebGL Inspector or Spector.js
// Check for:
// - Draw call count (<100 per frame)
// - Texture bindings (<20 per frame)
// - Shader switches (<10 per frame)
```

### Continuous Monitoring

Enable performance monitoring in development:

```tsx
// In App.tsx
if (import.meta.env.DEV) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 16) {
        console.warn(`Long task: ${entry.duration}ms`, entry);
      }
    }
  });
  observer.observe({ entryTypes: ['longtask'] });
}
```

### Test Matrix

| Device | OS | Browser | Status |
|--------|-----|---------|--------|
| MacBook Pro M3 | macOS 15 | Safari | Primary |
| MacBook Pro M3 | macOS 15 | Chrome | Primary |
| Mac Studio M2 | macOS 14 | Safari | Primary |
| Gaming PC (RTX 3080) | Windows 11 | Chrome | Primary |
| Gaming PC (RTX 3080) | Windows 11 | Edge | Secondary |
| Ubuntu Desktop | Ubuntu 24.04 | Firefox | Secondary |
| MacBook Air M1 | macOS 14 | Safari | Integration |
| Mac Mini (Intel) | macOS 13 | Safari | Fallback |

---

## Performance Checklist

### Before Release

- [ ] Lighthouse performance score > 90
- [ ] First Contentful Paint < 1s
- [ ] Time to Interactive < 2s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Animation FPS > 55 on target hardware
- [ ] No memory leaks detected
- [ ] WebGL fallback tested
- [ ] Reduced motion tested
- [ ] All performance tiers tested

### Monitoring

- [ ] Performance budgets in CI
- [ ] Real User Monitoring (RUM) enabled
- [ ] Error tracking for WebGL failures
- [ ] Memory usage alerts configured

---

*Version: 5.0*
*Last Updated: Phase 40 - Documentation & Launch*
