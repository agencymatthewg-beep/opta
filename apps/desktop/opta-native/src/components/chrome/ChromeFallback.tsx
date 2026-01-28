/**
 * ChromeFallback - Performance Fallback Chain
 *
 * Provides graceful degradation when WebGL chrome isn't available or
 * performance requirements aren't met.
 *
 * Fallback Chain:
 * ```
 * High    → Full chrome + post-processing + particles
 * Medium  → Chrome only, no post-processing, reduced particles
 * Low     → Simplified shaders, no particles, no post-processing
 * Fallback→ Pure CSS glass (current AtmosphericFog + .glass classes)
 * ```
 *
 * @see ChromeCanvas.tsx - Main chrome renderer
 * @see PerformanceContext.tsx - Performance tier detection
 */

import { type ReactNode, useMemo, useEffect, useState, createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePerformance } from '@/contexts/PerformanceContext';
import { type HardwareTier } from '@/lib/performance/CapabilityDetector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isWebGLAvailable } from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

/** Chrome render mode */
export type ChromeRenderMode = 'full' | 'reduced' | 'minimal' | 'css';

/** Chrome quality settings per mode */
export interface ChromeQualitySettings {
  /** Render mode */
  mode: ChromeRenderMode;
  /** Max particles for energy reactor */
  maxParticles: number;
  /** Enable fog layers */
  fogLayers: number;
  /** Enable post-processing */
  enablePostProcessing: boolean;
  /** Enable bloom effect */
  enableBloom: boolean;
  /** Enable chromatic aberration */
  enableChromatic: boolean;
  /** Enable energy reactor */
  enableEnergyReactor: boolean;
  /** Enable WebGL fog */
  enableWebGLFog: boolean;
  /** Canvas DPR multiplier */
  dprMultiplier: number;
  /** Enable anti-aliasing */
  enableAntialias: boolean;
}

export interface ChromeFallbackContextValue {
  /** Current render mode */
  mode: ChromeRenderMode;
  /** Current quality settings */
  settings: ChromeQualitySettings;
  /** Force a specific mode (overrides auto detection) */
  forceMode: (mode: ChromeRenderMode | null) => void;
  /** Check if WebGL is available */
  webGLAvailable: boolean;
  /** Check if reduced motion is preferred */
  reducedMotion: boolean;
  /** Current performance tier */
  tier: HardwareTier;
}

export interface ChromeFallbackProviderProps {
  children: ReactNode;
  /** Force a specific mode */
  defaultMode?: ChromeRenderMode;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Quality settings per render mode */
const MODE_SETTINGS: Record<ChromeRenderMode, Omit<ChromeQualitySettings, 'mode'>> = {
  full: {
    maxParticles: 100,
    fogLayers: 3,
    enablePostProcessing: true,
    enableBloom: true,
    enableChromatic: true,
    enableEnergyReactor: true,
    enableWebGLFog: true,
    dprMultiplier: 1,
    enableAntialias: true,
  },
  reduced: {
    maxParticles: 50,
    fogLayers: 2,
    enablePostProcessing: true,
    enableBloom: true,
    enableChromatic: false,
    enableEnergyReactor: true,
    enableWebGLFog: true,
    dprMultiplier: 0.75,
    enableAntialias: true,
  },
  minimal: {
    maxParticles: 20,
    fogLayers: 1,
    enablePostProcessing: false,
    enableBloom: false,
    enableChromatic: false,
    enableEnergyReactor: false,
    enableWebGLFog: false,
    dprMultiplier: 0.5,
    enableAntialias: false,
  },
  css: {
    maxParticles: 0,
    fogLayers: 0,
    enablePostProcessing: false,
    enableBloom: false,
    enableChromatic: false,
    enableEnergyReactor: false,
    enableWebGLFog: false,
    dprMultiplier: 1,
    enableAntialias: false,
  },
};

/** Performance tier to render mode mapping */
const TIER_TO_MODE: Record<HardwareTier, ChromeRenderMode> = {
  high: 'full',
  medium: 'reduced',
  low: 'minimal',
  fallback: 'css',
};

// =============================================================================
// CONTEXT
// =============================================================================

const ChromeFallbackContext = createContext<ChromeFallbackContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * ChromeFallbackProvider - Manages chrome quality and fallback chain
 *
 * Automatically selects the best render mode based on:
 * - Performance tier
 * - WebGL availability
 * - Reduced motion preference
 * - User override
 *
 * @example
 * ```tsx
 * <ChromeFallbackProvider>
 *   <ChromeCanvas {...fallbackSettings} />
 * </ChromeFallbackProvider>
 * ```
 */
export function ChromeFallbackProvider({
  children,
  defaultMode,
  debug = false,
}: ChromeFallbackProviderProps) {
  const { state: perfState } = usePerformance();
  const prefersReducedMotion = useReducedMotion();
  const [forcedMode, setForcedMode] = useState<ChromeRenderMode | null>(defaultMode || null);
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Check WebGL availability on mount
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Determine render mode
  const mode = useMemo((): ChromeRenderMode => {
    // User override takes precedence
    if (forcedMode) return forcedMode;

    // WebGL unavailable = CSS fallback
    if (!webGLAvailable) return 'css';

    // Reduced motion = minimal mode
    if (prefersReducedMotion) return 'minimal';

    // Map performance tier to render mode
    return TIER_TO_MODE[perfState.tier] || 'css';
  }, [forcedMode, webGLAvailable, prefersReducedMotion, perfState.tier]);

  // Get settings for current mode
  const settings: ChromeQualitySettings = useMemo(() => {
    return {
      mode,
      ...MODE_SETTINGS[mode],
    };
  }, [mode]);

  // Debug logging
  useEffect(() => {
    if (debug) {
      console.log('[ChromeFallback] Mode:', mode, {
        tier: perfState.tier,
        webGL: webGLAvailable,
        reducedMotion: prefersReducedMotion,
        forced: forcedMode,
        settings,
      });
    }
  }, [debug, mode, perfState.tier, webGLAvailable, prefersReducedMotion, forcedMode, settings]);

  const forceMode = (newMode: ChromeRenderMode | null) => {
    setForcedMode(newMode);
  };

  const value: ChromeFallbackContextValue = {
    mode,
    settings,
    forceMode,
    webGLAvailable,
    reducedMotion: prefersReducedMotion ?? false,
    tier: perfState.tier,
  };

  return (
    <ChromeFallbackContext.Provider value={value}>
      {children}
    </ChromeFallbackContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access chrome fallback context
 */
export function useChromeFallback(): ChromeFallbackContextValue {
  const context = useContext(ChromeFallbackContext);
  if (!context) {
    throw new Error(
      'useChromeFallback must be used within a ChromeFallbackProvider. ' +
        'Wrap your app with <ChromeFallbackProvider>.'
    );
  }
  return context;
}

/**
 * Hook for optional fallback context (returns defaults if no provider)
 */
export function useChromeFallbackOptional(): ChromeFallbackContextValue {
  const context = useContext(ChromeFallbackContext);

  // Return defaults if no provider
  if (!context) {
    return {
      mode: 'full',
      settings: { mode: 'full', ...MODE_SETTINGS.full },
      forceMode: () => {},
      webGLAvailable: true,
      reducedMotion: false,
      tier: 'high',
    };
  }

  return context;
}

// =============================================================================
// COMPONENTS
// =============================================================================

export interface ChromeFallbackGlassProps {
  /** Children to render */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Whether to show glow border */
  glowBorder?: boolean;
  /** Intensity of glass effect */
  intensity?: 'subtle' | 'normal' | 'strong';
}

/**
 * ChromeFallbackGlass - CSS glass effect fallback
 *
 * Pure CSS glassmorphism that's used when WebGL isn't available.
 * Matches the visual style of the WebGL chrome as closely as possible.
 *
 * @example
 * ```tsx
 * <ChromeFallbackGlass intensity="strong" glowBorder>
 *   <CardContent>...</CardContent>
 * </ChromeFallbackGlass>
 * ```
 */
export function ChromeFallbackGlass({
  children,
  className,
  borderRadius = 12,
  glowBorder = false,
  intensity = 'normal',
}: ChromeFallbackGlassProps) {
  const intensityClasses = {
    subtle: 'glass-subtle',
    normal: 'glass',
    strong: 'glass-strong',
  };

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden',
        intensityClasses[intensity],
        glowBorder && 'ring-1 ring-primary/30',
        className
      )}
      style={{ borderRadius }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Inner glow effect */}
      {glowBorder && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
            borderRadius: borderRadius - 1,
          }}
        />
      )}
      {children}
    </motion.div>
  );
}

export interface ChromeQualityIndicatorProps {
  /** Show indicator (default: only in development) */
  show?: boolean;
  /** Position on screen */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * ChromeQualityIndicator - Debug indicator showing current render mode
 *
 * Useful for development to see which quality tier is active.
 */
export function ChromeQualityIndicator({
  show = import.meta.env.DEV,
  position = 'bottom-right',
}: ChromeQualityIndicatorProps) {
  const { mode, tier, webGLAvailable, reducedMotion } = useChromeFallbackOptional();

  if (!show) return null;

  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  const modeColors: Record<ChromeRenderMode, string> = {
    full: 'bg-green-500',
    reduced: 'bg-yellow-500',
    minimal: 'bg-orange-500',
    css: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'fixed z-[9999] px-2 py-1 rounded text-xs font-mono bg-black/80 text-white space-y-0.5',
        positionClasses[position]
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', modeColors[mode])} />
        <span>Chrome: {mode}</span>
      </div>
      <div className="text-white/60 text-[10px]">
        Tier: {tier} | WebGL: {webGLAvailable ? '✓' : '✗'} | RM: {reducedMotion ? '✓' : '✗'}
      </div>
    </div>
  );
}

export default ChromeFallbackProvider;
