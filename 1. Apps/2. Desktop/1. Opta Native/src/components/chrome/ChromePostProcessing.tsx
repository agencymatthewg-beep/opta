/**
 * ChromePostProcessing - GPU Post-Processing Pipeline
 *
 * Adds premium visual effects to the chrome layer:
 * - Bloom: Soft glow on bright areas (panels, borders, energy)
 * - FXAA: Anti-aliasing for smooth edges
 * - Chromatic aberration: Subtle color fringing for sci-fi look
 *
 * Performance Tiers:
 * | Tier    | Bloom | FXAA | Chromatic |
 * |---------|-------|------|-----------|
 * | high    | Full  | On   | Subtle    |
 * | medium  | Half  | On   | Off       |
 * | low     | Off   | On   | Off       |
 * | fallback| Off   | Off  | Off       |
 *
 * @see ChromeCanvas.tsx - Main chrome renderer
 * @see PerformanceContext.tsx - Performance tier detection
 */

import { useMemo, memo, type JSX } from 'react';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { Vector2 } from 'three';
import { usePerformance } from '@/contexts/PerformanceContext';
import { useChromeOptional } from '@/contexts/ChromeContext';
import type { ChromeEnergyState } from './ChromeRegistry';

// =============================================================================
// TYPES
// =============================================================================

export interface ChromePostProcessingProps {
  /** Force enable/disable bloom */
  enableBloom?: boolean;
  /** Force enable/disable chromatic aberration */
  enableChromatic?: boolean;
  /** Force enable/disable vignette */
  enableVignette?: boolean;
  /** Bloom intensity multiplier */
  bloomIntensity?: number;
  /** Chromatic aberration offset */
  chromaticOffset?: number;
  /** Whether to sync effects with energy state */
  syncWithEnergy?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Bloom settings per performance tier */
const BLOOM_CONFIG = {
  high: {
    intensity: 1.0,
    luminanceThreshold: 0.2,
    luminanceSmoothing: 0.9,
    kernelSize: KernelSize.LARGE,
    mipmapBlur: true,
  },
  medium: {
    intensity: 0.7,
    luminanceThreshold: 0.3,
    luminanceSmoothing: 0.8,
    kernelSize: KernelSize.MEDIUM,
    mipmapBlur: true,
  },
  low: {
    intensity: 0.4,
    luminanceThreshold: 0.4,
    luminanceSmoothing: 0.7,
    kernelSize: KernelSize.SMALL,
    mipmapBlur: false,
  },
  fallback: null,
};

/** Chromatic aberration settings per energy state */
const CHROMATIC_CONFIG: Record<ChromeEnergyState, { offset: number }> = {
  dormant: { offset: 0.0002 },
  active: { offset: 0.0005 },
  pulse: { offset: 0.001 },
  storm: { offset: 0.002 },
};

/** Vignette settings per energy state */
const VIGNETTE_CONFIG: Record<ChromeEnergyState, { darkness: number; offset: number }> = {
  dormant: { darkness: 0.3, offset: 0.3 },
  active: { darkness: 0.35, offset: 0.25 },
  pulse: { darkness: 0.4, offset: 0.2 },
  storm: { darkness: 0.5, offset: 0.15 },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ChromePostProcessing - Post-processing effects for the chrome layer
 *
 * Place inside ChromeCanvas's <Suspense> after all scene elements.
 *
 * @example
 * ```tsx
 * <ChromeCanvas>
 *   <Suspense fallback={null}>
 *     <ChromeScene />
 *     <EnergyReactor />
 *     <ChromePostProcessing />
 *   </Suspense>
 * </ChromeCanvas>
 * ```
 */
export const ChromePostProcessing = memo(function ChromePostProcessing({
  enableBloom: forceBloom,
  enableChromatic: forceChromatic,
  enableVignette: forceVignette,
  bloomIntensity: intensityMultiplier = 1,
  chromaticOffset: offsetMultiplier = 1,
  syncWithEnergy = true,
}: ChromePostProcessingProps) {
  const { state: perfState } = usePerformance();
  const chromeContext = useChromeOptional();

  // Get current energy state
  const energyState = chromeContext?.state.globalEnergyState ?? 'dormant';

  // Determine which effects to enable based on performance tier
  const tier = perfState.tier as 'high' | 'medium' | 'low' | 'fallback';

  // Feature flags
  const showBloom = forceBloom ?? (tier !== 'fallback' && tier !== 'low');
  const showChromatic = forceChromatic ?? tier === 'high';
  const showVignette = forceVignette ?? tier !== 'fallback';

  // Bloom configuration
  const bloomConfig = useMemo(() => {
    const config = BLOOM_CONFIG[tier];
    if (!config) return null;

    // Adjust intensity based on energy state
    let energyMultiplier = 1;
    if (syncWithEnergy) {
      switch (energyState) {
        case 'dormant':
          energyMultiplier = 0.6;
          break;
        case 'active':
          energyMultiplier = 0.8;
          break;
        case 'pulse':
          energyMultiplier = 1.2;
          break;
        case 'storm':
          energyMultiplier = 1.5;
          break;
      }
    }

    return {
      ...config,
      intensity: config.intensity * intensityMultiplier * energyMultiplier,
    };
  }, [tier, energyState, syncWithEnergy, intensityMultiplier]);

  // Chromatic aberration configuration
  const chromaticConfig = useMemo(() => {
    const baseOffset = syncWithEnergy
      ? CHROMATIC_CONFIG[energyState].offset
      : CHROMATIC_CONFIG.dormant.offset;

    return {
      offset: new Vector2(baseOffset * offsetMultiplier, baseOffset * offsetMultiplier),
    };
  }, [energyState, syncWithEnergy, offsetMultiplier]);

  // Vignette configuration
  const vignetteConfig = useMemo(() => {
    return syncWithEnergy
      ? VIGNETTE_CONFIG[energyState]
      : VIGNETTE_CONFIG.dormant;
  }, [energyState, syncWithEnergy]);

  // Don't render anything in fallback mode
  if (tier === 'fallback' && !forceBloom && !forceChromatic && !forceVignette) {
    return null;
  }

  // Don't render if chrome is disabled
  if (chromeContext && !chromeContext.state.isEnabled) {
    return null;
  }

  // Don't render if no effects enabled
  if (!showBloom && !showChromatic && !showVignette) {
    return null;
  }

  // Build effects array based on what's enabled
  const effects: JSX.Element[] = [];

  if (showBloom && bloomConfig) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={bloomConfig.intensity}
        luminanceThreshold={bloomConfig.luminanceThreshold}
        luminanceSmoothing={bloomConfig.luminanceSmoothing}
        kernelSize={bloomConfig.kernelSize}
        mipmapBlur={bloomConfig.mipmapBlur}
        blendFunction={BlendFunction.ADD}
      />
    );
  }

  if (showChromatic) {
    effects.push(
      <ChromaticAberration
        key="chromatic"
        offset={chromaticConfig.offset}
        radialModulation={false}
        modulationOffset={0}
      />
    );
  }

  if (showVignette) {
    effects.push(
      <Vignette
        key="vignette"
        darkness={vignetteConfig.darkness}
        offset={vignetteConfig.offset}
        blendFunction={BlendFunction.NORMAL}
      />
    );
  }

  return (
    <EffectComposer
      multisampling={tier === 'high' ? 4 : tier === 'medium' ? 2 : 0}
      frameBufferType={undefined}
    >
      {effects}
    </EffectComposer>
  );
});

export default ChromePostProcessing;
