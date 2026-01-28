/**
 * LODConfig - Level of Detail Configuration
 *
 * Defines LOD (Level of Detail) variants for various assets based on
 * hardware tier and quality level. Enables graceful degradation of
 * visual complexity while maintaining app functionality.
 *
 * LOD Tiers:
 * - High: Full detail (128 ring segments, 200 particles, full textures)
 * - Medium: Reduced detail (64 segments, 100 particles, half textures)
 * - Low: Minimal detail (32 segments, 50 particles, quarter textures)
 *
 * @see DESIGN_SYSTEM.md - Performance Guidelines
 */

import type { HardwareTier } from './CapabilityDetector';
import type { QualityLevel } from './QualityManager';

// =============================================================================
// TYPES
// =============================================================================

export type LODLevel = 'high' | 'medium' | 'low';

export interface RingLOD {
  /** Geometry segments for the ring torus */
  segments: number;
  /** Radial segments for smoothness */
  radialSegments: number;
  /** Use WebGL shader effects */
  useWebGL: boolean;
  /** Animation frame rate target */
  animationFPS: number;
  /** Enable glow effect */
  glowEnabled: boolean;
  /** Glow blur radius in pixels */
  glowRadius: number;
  /** Enable plasma effect inside ring */
  plasmaEnabled: boolean;
  /** Plasma animation complexity */
  plasmaComplexity: number;
}

export interface ParticleLOD {
  /** Maximum particle count */
  count: number;
  /** Particle size range [min, max] */
  sizeRange: [number, number];
  /** Use Canvas2D or WebGL */
  renderer: 'canvas2d' | 'webgl' | 'css';
  /** Enable particle trails */
  trailsEnabled: boolean;
  /** Trail length (frames) */
  trailLength: number;
  /** Enable glow on particles */
  glowEnabled: boolean;
  /** Update frequency (1 = every frame, 2 = every other frame) */
  updateFrequency: number;
}

export interface FogLOD {
  /** Number of fog layers */
  layers: number;
  /** Use WebGL or CSS */
  renderer: 'webgl' | 'css';
  /** Noise texture resolution */
  noiseResolution: number;
  /** Animation enabled */
  animated: boolean;
  /** Animation speed multiplier */
  speed: number;
  /** Volumetric effect enabled */
  volumetric: boolean;
}

export interface GlassLOD {
  /** Blur amount in pixels */
  blurAmount: number;
  /** Noise grain intensity */
  noiseIntensity: number;
  /** Use WebGL or CSS backdrop-filter */
  renderer: 'webgl' | 'css';
  /** Specular highlight enabled */
  specularEnabled: boolean;
  /** Animate specular position */
  animateSpecular: boolean;
  /** Refraction effect enabled */
  refractionEnabled: boolean;
}

export interface TextureLOD {
  /** Resolution multiplier (1 = full, 0.5 = half, etc.) */
  resolution: number;
  /** Enable mipmapping */
  mipmaps: boolean;
  /** Anisotropic filtering level */
  anisotropy: number;
  /** Compression enabled */
  compression: 'none' | 'low' | 'high';
}

export interface ShadowLOD {
  /** Shadow enabled */
  enabled: boolean;
  /** Shadow map resolution */
  mapSize: number;
  /** Shadow blur amount */
  blur: number;
  /** Use PCF soft shadows */
  softShadows: boolean;
  /** Number of shadow samples */
  samples: number;
}

export interface AnimationLOD {
  /** Physics spring stiffness */
  springStiffness: number;
  /** Physics spring damping */
  springDamping: number;
  /** Skip frames for complex animations */
  frameSkip: number;
  /** Use CSS transforms instead of JS */
  preferCSS: boolean;
  /** Enable parallax effects */
  parallaxEnabled: boolean;
  /** Stagger delay for list animations (ms) */
  staggerDelay: number;
}

export interface LODConfiguration {
  ring: RingLOD;
  particles: ParticleLOD;
  fog: FogLOD;
  glass: GlassLOD;
  textures: TextureLOD;
  shadows: ShadowLOD;
  animations: AnimationLOD;
}

// =============================================================================
// LOD PRESETS
// =============================================================================

/**
 * High LOD - Full visual fidelity
 * Used on high-end dedicated GPUs
 */
const HIGH_LOD: LODConfiguration = {
  ring: {
    segments: 128,
    radialSegments: 48,
    useWebGL: true,
    animationFPS: 60,
    glowEnabled: true,
    glowRadius: 40,
    plasmaEnabled: true,
    plasmaComplexity: 8,
  },
  particles: {
    count: 200,
    sizeRange: [1, 4],
    renderer: 'webgl',
    trailsEnabled: true,
    trailLength: 10,
    glowEnabled: true,
    updateFrequency: 1,
  },
  fog: {
    layers: 4,
    renderer: 'webgl',
    noiseResolution: 512,
    animated: true,
    speed: 1.0,
    volumetric: true,
  },
  glass: {
    blurAmount: 20,
    noiseIntensity: 0.04,
    renderer: 'webgl',
    specularEnabled: true,
    animateSpecular: true,
    refractionEnabled: true,
  },
  textures: {
    resolution: 1,
    mipmaps: true,
    anisotropy: 16,
    compression: 'none',
  },
  shadows: {
    enabled: true,
    mapSize: 2048,
    blur: 8,
    softShadows: true,
    samples: 16,
  },
  animations: {
    springStiffness: 400,
    springDamping: 30,
    frameSkip: 0,
    preferCSS: false,
    parallaxEnabled: true,
    staggerDelay: 50,
  },
};

/**
 * Medium LOD - Balanced quality and performance
 * Used on integrated GPUs and mid-range devices
 */
const MEDIUM_LOD: LODConfiguration = {
  ring: {
    segments: 64,
    radialSegments: 24,
    useWebGL: true,
    animationFPS: 60,
    glowEnabled: true,
    glowRadius: 25,
    plasmaEnabled: true,
    plasmaComplexity: 4,
  },
  particles: {
    count: 100,
    sizeRange: [1, 3],
    renderer: 'canvas2d',
    trailsEnabled: true,
    trailLength: 5,
    glowEnabled: false,
    updateFrequency: 1,
  },
  fog: {
    layers: 2,
    renderer: 'css',
    noiseResolution: 256,
    animated: true,
    speed: 0.8,
    volumetric: false,
  },
  glass: {
    blurAmount: 12,
    noiseIntensity: 0.03,
    renderer: 'css',
    specularEnabled: true,
    animateSpecular: false,
    refractionEnabled: false,
  },
  textures: {
    resolution: 0.75,
    mipmaps: true,
    anisotropy: 8,
    compression: 'low',
  },
  shadows: {
    enabled: true,
    mapSize: 1024,
    blur: 4,
    softShadows: false,
    samples: 8,
  },
  animations: {
    springStiffness: 350,
    springDamping: 28,
    frameSkip: 0,
    preferCSS: false,
    parallaxEnabled: true,
    staggerDelay: 40,
  },
};

/**
 * Low LOD - Performance focused
 * Used on old hardware and mobile devices
 */
const LOW_LOD: LODConfiguration = {
  ring: {
    segments: 32,
    radialSegments: 12,
    useWebGL: false,
    animationFPS: 30,
    glowEnabled: true,
    glowRadius: 15,
    plasmaEnabled: false,
    plasmaComplexity: 0,
  },
  particles: {
    count: 50,
    sizeRange: [1, 2],
    renderer: 'canvas2d',
    trailsEnabled: false,
    trailLength: 0,
    glowEnabled: false,
    updateFrequency: 2,
  },
  fog: {
    layers: 1,
    renderer: 'css',
    noiseResolution: 128,
    animated: true,
    speed: 0.5,
    volumetric: false,
  },
  glass: {
    blurAmount: 8,
    noiseIntensity: 0.02,
    renderer: 'css',
    specularEnabled: false,
    animateSpecular: false,
    refractionEnabled: false,
  },
  textures: {
    resolution: 0.5,
    mipmaps: false,
    anisotropy: 4,
    compression: 'high',
  },
  shadows: {
    enabled: false,
    mapSize: 512,
    blur: 2,
    softShadows: false,
    samples: 4,
  },
  animations: {
    springStiffness: 300,
    springDamping: 25,
    frameSkip: 1,
    preferCSS: true,
    parallaxEnabled: false,
    staggerDelay: 30,
  },
};

/**
 * Fallback LOD - Maximum compatibility
 * Used when WebGL is not available
 */
const FALLBACK_LOD: LODConfiguration = {
  ring: {
    segments: 0, // Use PNG image
    radialSegments: 0,
    useWebGL: false,
    animationFPS: 30,
    glowEnabled: true,
    glowRadius: 10,
    plasmaEnabled: false,
    plasmaComplexity: 0,
  },
  particles: {
    count: 20,
    sizeRange: [1, 2],
    renderer: 'css', // CSS positioned dots
    trailsEnabled: false,
    trailLength: 0,
    glowEnabled: false,
    updateFrequency: 3,
  },
  fog: {
    layers: 1,
    renderer: 'css',
    noiseResolution: 64,
    animated: false, // Static fog
    speed: 0,
    volumetric: false,
  },
  glass: {
    blurAmount: 8,
    noiseIntensity: 0,
    renderer: 'css',
    specularEnabled: false,
    animateSpecular: false,
    refractionEnabled: false,
  },
  textures: {
    resolution: 0.25,
    mipmaps: false,
    anisotropy: 1,
    compression: 'high',
  },
  shadows: {
    enabled: false,
    mapSize: 0,
    blur: 0,
    softShadows: false,
    samples: 0,
  },
  animations: {
    springStiffness: 200,
    springDamping: 20,
    frameSkip: 2,
    preferCSS: true,
    parallaxEnabled: false,
    staggerDelay: 20,
  },
};

/**
 * LOD presets by level
 */
const LOD_PRESETS: Record<LODLevel | 'fallback', LODConfiguration> = {
  high: HIGH_LOD,
  medium: MEDIUM_LOD,
  low: LOW_LOD,
  fallback: FALLBACK_LOD,
};

// =============================================================================
// LOD SELECTION
// =============================================================================

/**
 * Map hardware tier to LOD level
 */
function tierToLODLevel(tier: HardwareTier): LODLevel | 'fallback' {
  switch (tier) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    case 'fallback':
      return 'fallback';
  }
}

/**
 * Map quality level to LOD level
 */
function qualityToLODLevel(quality: QualityLevel): LODLevel {
  switch (quality) {
    case 'ultra':
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
  }
}

/**
 * Get LOD configuration for hardware tier
 *
 * @param tier - Hardware tier from CapabilityDetector
 * @returns Full LOD configuration for the tier
 */
export function getLODForTier(tier: HardwareTier): LODConfiguration {
  const level = tierToLODLevel(tier);
  return { ...LOD_PRESETS[level] };
}

/**
 * Get LOD configuration for quality level
 *
 * @param quality - Quality level from QualityManager
 * @returns Full LOD configuration for the quality level
 */
export function getLODForQuality(quality: QualityLevel): LODConfiguration {
  const level = qualityToLODLevel(quality);
  return { ...LOD_PRESETS[level] };
}

/**
 * Get combined LOD (respects both tier limits and current quality)
 *
 * @param tier - Hardware tier from CapabilityDetector
 * @param quality - Quality level from QualityManager
 * @returns LOD configuration limited by tier and set by quality
 */
export function getCombinedLOD(tier: HardwareTier, quality: QualityLevel): LODConfiguration {
  const tierLevel = tierToLODLevel(tier);
  const qualityLevel = qualityToLODLevel(quality);

  // If tier is fallback, always use fallback LOD
  if (tierLevel === 'fallback') {
    return { ...LOD_PRESETS.fallback };
  }

  // Otherwise, use the lower of the two levels
  const LOD_ORDER: (LODLevel | 'fallback')[] = ['fallback', 'low', 'medium', 'high'];
  const tierIndex = LOD_ORDER.indexOf(tierLevel);
  const qualityIndex = LOD_ORDER.indexOf(qualityLevel);

  const effectiveLevel = LOD_ORDER[Math.min(tierIndex, qualityIndex)];
  return { ...LOD_PRESETS[effectiveLevel as LODLevel] };
}

// =============================================================================
// LOD COMPONENT GETTERS
// =============================================================================

/**
 * Get ring LOD configuration
 */
export function getRingLOD(tier: HardwareTier, quality?: QualityLevel): RingLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.ring };
}

/**
 * Get particle LOD configuration
 */
export function getParticleLOD(tier: HardwareTier, quality?: QualityLevel): ParticleLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.particles };
}

/**
 * Get fog LOD configuration
 */
export function getFogLOD(tier: HardwareTier, quality?: QualityLevel): FogLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.fog };
}

/**
 * Get glass LOD configuration
 */
export function getGlassLOD(tier: HardwareTier, quality?: QualityLevel): GlassLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.glass };
}

/**
 * Get texture LOD configuration
 */
export function getTextureLOD(tier: HardwareTier, quality?: QualityLevel): TextureLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.textures };
}

/**
 * Get shadow LOD configuration
 */
export function getShadowLOD(tier: HardwareTier, quality?: QualityLevel): ShadowLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.shadows };
}

/**
 * Get animation LOD configuration
 */
export function getAnimationLOD(tier: HardwareTier, quality?: QualityLevel): AnimationLOD {
  const config = quality ? getCombinedLOD(tier, quality) : getLODForTier(tier);
  return { ...config.animations };
}

// =============================================================================
// REDUCED MOTION OVERRIDE
// =============================================================================

/**
 * Get LOD configuration for reduced motion preference
 * Disables all animations and complex effects
 */
export function getReducedMotionLOD(): LODConfiguration {
  return {
    ring: {
      segments: 32,
      radialSegments: 12,
      useWebGL: false,
      animationFPS: 0, // No animation
      glowEnabled: true,
      glowRadius: 15,
      plasmaEnabled: false,
      plasmaComplexity: 0,
    },
    particles: {
      count: 0, // No particles
      sizeRange: [0, 0],
      renderer: 'css',
      trailsEnabled: false,
      trailLength: 0,
      glowEnabled: false,
      updateFrequency: 0,
    },
    fog: {
      layers: 1,
      renderer: 'css',
      noiseResolution: 64,
      animated: false, // Static
      speed: 0,
      volumetric: false,
    },
    glass: {
      blurAmount: 8,
      noiseIntensity: 0.02,
      renderer: 'css',
      specularEnabled: false,
      animateSpecular: false,
      refractionEnabled: false,
    },
    textures: {
      resolution: 0.5,
      mipmaps: false,
      anisotropy: 1,
      compression: 'high',
    },
    shadows: {
      enabled: false,
      mapSize: 0,
      blur: 0,
      softShadows: false,
      samples: 0,
    },
    animations: {
      springStiffness: 0, // Instant transitions
      springDamping: 0,
      frameSkip: 0,
      preferCSS: true,
      parallaxEnabled: false,
      staggerDelay: 0, // No stagger
    },
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Interpolate between two LOD configurations
 * Useful for smooth quality transitions
 *
 * @param from - Starting LOD configuration
 * @param to - Target LOD configuration
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated LOD configuration
 */
export function interpolateLOD(
  from: LODConfiguration,
  to: LODConfiguration,
  t: number
): LODConfiguration {
  const lerp = (a: number, b: number) => a + (b - a) * t;

  return {
    ring: {
      segments: Math.round(lerp(from.ring.segments, to.ring.segments)),
      radialSegments: Math.round(lerp(from.ring.radialSegments, to.ring.radialSegments)),
      useWebGL: t > 0.5 ? to.ring.useWebGL : from.ring.useWebGL,
      animationFPS: Math.round(lerp(from.ring.animationFPS, to.ring.animationFPS)),
      glowEnabled: t > 0.5 ? to.ring.glowEnabled : from.ring.glowEnabled,
      glowRadius: lerp(from.ring.glowRadius, to.ring.glowRadius),
      plasmaEnabled: t > 0.5 ? to.ring.plasmaEnabled : from.ring.plasmaEnabled,
      plasmaComplexity: Math.round(lerp(from.ring.plasmaComplexity, to.ring.plasmaComplexity)),
    },
    particles: {
      count: Math.round(lerp(from.particles.count, to.particles.count)),
      sizeRange: [
        lerp(from.particles.sizeRange[0], to.particles.sizeRange[0]),
        lerp(from.particles.sizeRange[1], to.particles.sizeRange[1]),
      ],
      renderer: t > 0.5 ? to.particles.renderer : from.particles.renderer,
      trailsEnabled: t > 0.5 ? to.particles.trailsEnabled : from.particles.trailsEnabled,
      trailLength: Math.round(lerp(from.particles.trailLength, to.particles.trailLength)),
      glowEnabled: t > 0.5 ? to.particles.glowEnabled : from.particles.glowEnabled,
      updateFrequency: Math.round(lerp(from.particles.updateFrequency, to.particles.updateFrequency)),
    },
    fog: {
      layers: Math.round(lerp(from.fog.layers, to.fog.layers)),
      renderer: t > 0.5 ? to.fog.renderer : from.fog.renderer,
      noiseResolution: Math.round(lerp(from.fog.noiseResolution, to.fog.noiseResolution)),
      animated: t > 0.5 ? to.fog.animated : from.fog.animated,
      speed: lerp(from.fog.speed, to.fog.speed),
      volumetric: t > 0.5 ? to.fog.volumetric : from.fog.volumetric,
    },
    glass: {
      blurAmount: lerp(from.glass.blurAmount, to.glass.blurAmount),
      noiseIntensity: lerp(from.glass.noiseIntensity, to.glass.noiseIntensity),
      renderer: t > 0.5 ? to.glass.renderer : from.glass.renderer,
      specularEnabled: t > 0.5 ? to.glass.specularEnabled : from.glass.specularEnabled,
      animateSpecular: t > 0.5 ? to.glass.animateSpecular : from.glass.animateSpecular,
      refractionEnabled: t > 0.5 ? to.glass.refractionEnabled : from.glass.refractionEnabled,
    },
    textures: {
      resolution: lerp(from.textures.resolution, to.textures.resolution),
      mipmaps: t > 0.5 ? to.textures.mipmaps : from.textures.mipmaps,
      anisotropy: Math.round(lerp(from.textures.anisotropy, to.textures.anisotropy)),
      compression: t > 0.5 ? to.textures.compression : from.textures.compression,
    },
    shadows: {
      enabled: t > 0.5 ? to.shadows.enabled : from.shadows.enabled,
      mapSize: Math.round(lerp(from.shadows.mapSize, to.shadows.mapSize)),
      blur: lerp(from.shadows.blur, to.shadows.blur),
      softShadows: t > 0.5 ? to.shadows.softShadows : from.shadows.softShadows,
      samples: Math.round(lerp(from.shadows.samples, to.shadows.samples)),
    },
    animations: {
      springStiffness: lerp(from.animations.springStiffness, to.animations.springStiffness),
      springDamping: lerp(from.animations.springDamping, to.animations.springDamping),
      frameSkip: Math.round(lerp(from.animations.frameSkip, to.animations.frameSkip)),
      preferCSS: t > 0.5 ? to.animations.preferCSS : from.animations.preferCSS,
      parallaxEnabled: t > 0.5 ? to.animations.parallaxEnabled : from.animations.parallaxEnabled,
      staggerDelay: lerp(from.animations.staggerDelay, to.animations.staggerDelay),
    },
  };
}

/**
 * Get LOD level display name
 */
export function getLODDisplayName(level: LODLevel | 'fallback'): string {
  switch (level) {
    case 'high':
      return 'High Detail';
    case 'medium':
      return 'Medium Detail';
    case 'low':
      return 'Low Detail';
    case 'fallback':
      return 'Compatibility Mode';
  }
}

export default {
  getLODForTier,
  getLODForQuality,
  getCombinedLOD,
  getRingLOD,
  getParticleLOD,
  getFogLOD,
  getGlassLOD,
  getTextureLOD,
  getShadowLOD,
  getAnimationLOD,
  getReducedMotionLOD,
  interpolateLOD,
  getLODDisplayName,
};
