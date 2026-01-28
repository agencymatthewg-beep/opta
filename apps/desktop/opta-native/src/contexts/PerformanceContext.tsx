/**
 * PerformanceContext - Global Performance State Provider
 *
 * Provides application-wide access to performance capabilities, quality settings,
 * and LOD configurations. Integrates all performance systems:
 * - CapabilityDetector (hardware tier)
 * - QualityManager (dynamic FPS-based scaling)
 * - LODConfig (level of detail)
 * - Reduced motion support
 *
 * Usage:
 * 1. Wrap app with PerformanceProvider
 * 2. Use usePerformance() hook to access performance state
 * 3. Components check tier/quality before rendering heavy effects
 *
 * @see DESIGN_SYSTEM.md - Performance Guidelines
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import {
  detectCapabilities,
  type HardwareTier,
  type CapabilityReport,
  type WebGLCapabilities,
  getTierDisplayName,
  getTierDescription,
} from '@/lib/performance/CapabilityDetector';

import {
  QualityManager,
  createQualityManager,
  type QualityLevel,
  type QualitySettings,
  type FPSMetrics,
  getQualityPreset,
  getQualityDisplayName,
} from '@/lib/performance/QualityManager';

import {
  getCombinedLOD,
  getReducedMotionLOD,
  type LODConfiguration,
  type RingLOD,
  type ParticleLOD,
  type GlassLOD,
  type AnimationLOD,
} from '@/lib/performance/LODConfig';

import { useReducedMotionFull, type ReducedMotionSettings } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface PerformanceState {
  /** Whether initial detection is complete */
  isReady: boolean;
  /** Hardware capability tier */
  tier: HardwareTier;
  /** Full capability report */
  capabilities: WebGLCapabilities | null;
  /** Current quality level */
  qualityLevel: QualityLevel;
  /** Current quality settings */
  qualitySettings: QualitySettings;
  /** Current LOD configuration */
  lod: LODConfiguration;
  /** Current FPS metrics */
  fps: FPSMetrics;
  /** Whether WebGL is supported */
  webglSupported: boolean;
  /** Whether reduced motion is preferred */
  reducedMotion: boolean;
  /** Reduced motion settings */
  reducedMotionSettings: ReducedMotionSettings;
  /** Device info */
  device: {
    isMobile: boolean;
    isTouch: boolean;
    onBattery: boolean | null;
    devicePixelRatio: number;
  };
}

export interface PerformanceActions {
  /** Manually set quality level */
  setQualityLevel: (level: QualityLevel) => void;
  /** Enable/disable auto quality scaling */
  setAutoScale: (enabled: boolean) => void;
  /** Force reduce quality (for battery saving) */
  forceReduceQuality: () => void;
  /** Refresh capability detection */
  refreshCapabilities: () => Promise<void>;
  /** Set reduced motion preference */
  setReducedMotion: (enabled: boolean) => void;
  /** Clear reduced motion override */
  clearReducedMotionOverride: () => void;
}

export interface PerformanceHelpers {
  /** Check if WebGL effects should be used */
  shouldUseWebGL: () => boolean;
  /** Check if particles should be rendered */
  shouldRenderParticles: () => boolean;
  /** Check if complex animations are allowed */
  shouldAnimateComplex: () => boolean;
  /** Get ring LOD settings */
  getRingLOD: () => RingLOD;
  /** Get particle LOD settings */
  getParticleLOD: () => ParticleLOD;
  /** Get glass LOD settings */
  getGlassLOD: () => GlassLOD;
  /** Get animation LOD settings */
  getAnimationLOD: () => AnimationLOD;
  /** Get tier display info */
  getTierInfo: () => { name: string; description: string };
  /** Get quality display info */
  getQualityInfo: () => { name: string; level: QualityLevel };
  /** Get current FPS metrics (non-reactive, call when needed) */
  getFPSMetrics: () => FPSMetrics;
}

export interface PerformanceContextValue {
  state: PerformanceState;
  actions: PerformanceActions;
  helpers: PerformanceHelpers;
}

// =============================================================================
// CONTEXT
// =============================================================================

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_QUALITY_SETTINGS = getQualityPreset('medium');

const DEFAULT_FPS_METRICS: FPSMetrics = {
  current: 60,
  average: 60,
  min: 60,
  max: 60,
  variance: 0,
  droppedFrames: 0,
};

const DEFAULT_DEVICE: PerformanceState['device'] = {
  isMobile: false,
  isTouch: false,
  onBattery: null,
  devicePixelRatio: 1,
};

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export interface PerformanceProviderProps {
  children: ReactNode;
  /** Initial quality level override */
  initialQuality?: QualityLevel;
  /** Disable auto quality scaling */
  disableAutoScale?: boolean;
  /** Force a specific tier (for testing) */
  forceTier?: HardwareTier;
}

export function PerformanceProvider({
  children,
  initialQuality,
  disableAutoScale = false,
  forceTier,
}: PerformanceProviderProps) {
  // Reduced motion hook
  const {
    prefersReducedMotion,
    settings: reducedMotionSettings,
    setReducedMotion,
    clearOverride: clearReducedMotionOverride,
  } = useReducedMotionFull();

  // State
  const [isReady, setIsReady] = useState(false);
  const [tier, setTier] = useState<HardwareTier>(forceTier || 'medium');
  const [capabilities, setCapabilities] = useState<WebGLCapabilities | null>(null);
  const [qualityLevel, setQualityLevelState] = useState<QualityLevel>(
    initialQuality || 'medium'
  );
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(
    initialQuality ? getQualityPreset(initialQuality) : DEFAULT_QUALITY_SETTINGS
  );
  const [device, setDevice] = useState<PerformanceState['device']>(DEFAULT_DEVICE);

  // Quality manager ref
  const qualityManagerRef = useRef<QualityManager | null>(null);

  // FPS metrics stored in ref to avoid re-renders (read via getFPSMetrics)
  const fpsRef = useRef<FPSMetrics>(DEFAULT_FPS_METRICS);

  // Compute LOD based on current state
  const lod = useMemo(() => {
    if (prefersReducedMotion) {
      return getReducedMotionLOD();
    }
    return getCombinedLOD(tier, qualityLevel);
  }, [tier, qualityLevel, prefersReducedMotion]);

  // WebGL support check
  const webglSupported = useMemo(() => {
    return capabilities?.version !== 0;
  }, [capabilities]);

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Detect capabilities
        const report: CapabilityReport = await detectCapabilities();

        if (!mounted) return;

        // Set tier (respect forced tier for testing)
        const effectiveTier = forceTier || report.tier;
        setTier(effectiveTier);
        setCapabilities(report.capabilities);
        setDevice({
          isMobile: report.isMobile,
          isTouch: report.isTouch,
          onBattery: report.onBattery,
          devicePixelRatio: report.devicePixelRatio,
        });

        // Initialize quality manager
        const manager = createQualityManager(effectiveTier);
        qualityManagerRef.current = manager;

        // Set initial quality if provided, otherwise use tier's max
        if (initialQuality) {
          manager.setQualityLevel(initialQuality);
        }

        // Subscribe to quality changes
        manager.onQualityChange((settings) => {
          if (!mounted) return;
          setQualitySettings(settings);
          setQualityLevelState(settings.level);
        });

        // Update FPS ref (no state = no re-renders)
        const fpsInterval = setInterval(() => {
          if (!mounted || !qualityManagerRef.current) return;
          fpsRef.current = qualityManagerRef.current.getFPS();
        }, 1000);

        // Start monitoring if auto-scale is enabled
        if (!disableAutoScale) {
          manager.start();
        }

        setIsReady(true);

        // Log in development
        if (import.meta.env.DEV) {
          console.log('[Performance] Initialized:', {
            tier: effectiveTier,
            webgl: report.capabilities.version,
            gpu: report.capabilities.renderer,
            quality: manager.getSettings().level,
          });
        }

        return () => {
          clearInterval(fpsInterval);
        };
      } catch (error) {
        console.error('[Performance] Initialization failed:', error);

        // Fall back to safe defaults
        setTier('fallback');
        setCapabilities(null);
        setIsReady(true);
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (qualityManagerRef.current) {
        qualityManagerRef.current.stop();
      }
    };
  }, [forceTier, initialQuality, disableAutoScale]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const setQualityLevel = useCallback((level: QualityLevel) => {
    if (qualityManagerRef.current) {
      qualityManagerRef.current.setQualityLevel(level);
      setQualityLevelState(level);
      setQualitySettings(qualityManagerRef.current.getSettings());
    }
  }, []);

  const setAutoScale = useCallback((enabled: boolean) => {
    if (qualityManagerRef.current) {
      qualityManagerRef.current.setAutoScale(enabled);
      if (enabled) {
        qualityManagerRef.current.start();
      } else {
        qualityManagerRef.current.stop();
      }
    }
  }, []);

  const forceReduceQuality = useCallback(() => {
    if (qualityManagerRef.current) {
      qualityManagerRef.current.forceReduceQuality();
      setQualitySettings(qualityManagerRef.current.getSettings());
      setQualityLevelState(qualityManagerRef.current.getSettings().level);
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    const report = await detectCapabilities();
    setTier(forceTier || report.tier);
    setCapabilities(report.capabilities);
    setDevice({
      isMobile: report.isMobile,
      isTouch: report.isTouch,
      onBattery: report.onBattery,
      devicePixelRatio: report.devicePixelRatio,
    });

    // Update quality manager tier
    if (qualityManagerRef.current) {
      qualityManagerRef.current.updateTier(forceTier || report.tier);
    }
  }, [forceTier]);

  const actions: PerformanceActions = useMemo(
    () => ({
      setQualityLevel,
      setAutoScale,
      forceReduceQuality,
      refreshCapabilities,
      setReducedMotion,
      clearReducedMotionOverride,
    }),
    [
      setQualityLevel,
      setAutoScale,
      forceReduceQuality,
      refreshCapabilities,
      setReducedMotion,
      clearReducedMotionOverride,
    ]
  );

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const helpers: PerformanceHelpers = useMemo(
    () => ({
      shouldUseWebGL: () => {
        if (prefersReducedMotion) return false;
        if (tier === 'fallback') return false;
        if (!webglSupported) return false;
        return qualitySettings.webglEnabled;
      },

      shouldRenderParticles: () => {
        if (prefersReducedMotion) return false;
        if (tier === 'fallback') return false;
        return lod.particles.count > 0;
      },

      shouldAnimateComplex: () => {
        if (prefersReducedMotion) return false;
        return qualitySettings.animationComplexity === 'full';
      },

      getRingLOD: () => lod.ring,
      getParticleLOD: () => lod.particles,
      getGlassLOD: () => lod.glass,
      getAnimationLOD: () => lod.animations,

      getTierInfo: () => ({
        name: getTierDisplayName(tier),
        description: getTierDescription(tier),
      }),

      getQualityInfo: () => ({
        name: getQualityDisplayName(qualityLevel),
        level: qualityLevel,
      }),

      getFPSMetrics: () => fpsRef.current,
    }),
    [tier, qualityLevel, qualitySettings, lod, prefersReducedMotion, webglSupported]
  );

  // ==========================================================================
  // STATE
  // ==========================================================================

  const state: PerformanceState = useMemo(
    () => ({
      isReady,
      tier,
      capabilities,
      qualityLevel,
      qualitySettings,
      lod,
      fps: fpsRef.current, // Non-reactive snapshot; use helpers.getFPSMetrics() for current value
      webglSupported,
      reducedMotion: prefersReducedMotion,
      reducedMotionSettings,
      device,
    }),
    [
      isReady,
      tier,
      capabilities,
      qualityLevel,
      qualitySettings,
      lod,
      webglSupported,
      prefersReducedMotion,
      reducedMotionSettings,
      device,
    ]
  );

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: PerformanceContextValue = useMemo(
    () => ({ state, actions, helpers }),
    [state, actions, helpers]
  );

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access performance context
 *
 * @throws Error if used outside PerformanceProvider
 *
 * @example
 * ```tsx
 * const { state, helpers } = usePerformance();
 *
 * // Check if WebGL should be used
 * if (helpers.shouldUseWebGL()) {
 *   return <WebGLComponent />;
 * }
 * return <CSSFallback />;
 * ```
 */
export function usePerformance(): PerformanceContextValue {
  const context = useContext(PerformanceContext);

  if (!context) {
    throw new Error(
      'usePerformance must be used within a PerformanceProvider. ' +
        'Wrap your app with <PerformanceProvider>.'
    );
  }

  return context;
}

/**
 * Optional hook that returns null if outside provider
 * Useful for components that can work without performance context
 */
export function usePerformanceOptional(): PerformanceContextValue | null {
  return useContext(PerformanceContext);
}

/**
 * Hook to get just the hardware tier
 */
export function useHardwareTier(): HardwareTier {
  const context = usePerformance();
  return context.state.tier;
}

/**
 * Hook to get just the quality level
 */
export function useQualityLevel(): QualityLevel {
  const context = usePerformance();
  return context.state.qualityLevel;
}

/**
 * Hook to check if WebGL should be used
 */
export function useShouldUseWebGL(): boolean {
  const context = usePerformance();
  return context.helpers.shouldUseWebGL();
}

/**
 * Hook to get LOD configuration
 */
export function useLOD(): LODConfiguration {
  const context = usePerformance();
  return context.state.lod;
}

/**
 * Hook to get FPS metrics
 * Note: Returns current snapshot; for reactive updates, set up your own interval
 */
export function useFPSMetrics(): FPSMetrics {
  const context = usePerformance();
  return context.helpers.getFPSMetrics();
}

export default PerformanceContext;
