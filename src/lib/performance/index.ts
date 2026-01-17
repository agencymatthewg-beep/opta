/**
 * Performance Library - Barrel Exports
 *
 * High-end performance optimization system for Opta.
 * Provides hardware detection, quality scaling, and LOD management.
 *
 * @example
 * ```tsx
 * import {
 *   detectCapabilities,
 *   createQualityManager,
 *   getLODForTier,
 *   usePerformance,
 * } from '@/lib/performance';
 *
 * // Detect hardware capabilities
 * const report = await detectCapabilities();
 * console.log(`Tier: ${report.tier}, GPU: ${report.capabilities.renderer}`);
 *
 * // Create quality manager
 * const manager = createQualityManager(report.tier);
 * manager.start();
 *
 * // Get LOD configuration
 * const lod = getLODForTier(report.tier);
 * console.log(`Particles: ${lod.particles.count}`);
 * ```
 */

// =============================================================================
// CAPABILITY DETECTOR
// =============================================================================

export {
  detectCapabilities,
  isWebGLSupported,
  isWebGL2Supported,
  getTierDisplayName,
  getTierDescription,
} from './CapabilityDetector';

export type {
  HardwareTier,
  WebGLCapabilities,
  CapabilityReport,
} from './CapabilityDetector';

// =============================================================================
// QUALITY MANAGER
// =============================================================================

export {
  QualityManager,
  createQualityManager,
  getQualityPreset,
  getInitialQualityLevel,
  getTierQualityConfig,
  getQualityDisplayName,
} from './QualityManager';

export type {
  QualityLevel,
  QualitySettings,
  QualityConfig,
  FPSMetrics,
  QualityState,
} from './QualityManager';

// =============================================================================
// LOD CONFIGURATION
// =============================================================================

export {
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
} from './LODConfig';

export type {
  LODLevel,
  LODConfiguration,
  RingLOD,
  ParticleLOD,
  FogLOD,
  GlassLOD,
  TextureLOD,
  ShadowLOD,
  AnimationLOD,
} from './LODConfig';

// =============================================================================
// RE-EXPORT CONTEXT (for convenience)
// =============================================================================

export {
  PerformanceProvider,
  usePerformance,
  usePerformanceOptional,
  useHardwareTier,
  useQualityLevel,
  useShouldUseWebGL,
  useLOD,
  useFPSMetrics,
} from '@/contexts/PerformanceContext';

export type {
  PerformanceState,
  PerformanceActions,
  PerformanceHelpers,
  PerformanceContextValue,
  PerformanceProviderProps,
} from '@/contexts/PerformanceContext';

// =============================================================================
// RE-EXPORT REDUCED MOTION
// =============================================================================

export {
  useReducedMotion,
  useReducedMotionFull,
  checkReducedMotion,
  getInstantTransition,
  getMotionSafeTransition,
} from '@/hooks/useReducedMotion';

export type {
  ReducedMotionSettings,
  ReducedMotionTransitions,
  UseReducedMotionReturn,
} from '@/hooks/useReducedMotion';
