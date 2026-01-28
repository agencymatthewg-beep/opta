/**
 * Effects Components - Barrel Exports
 *
 * Premium WebGL-based visual effect components for Opta.
 * All components gracefully fallback to CSS when WebGL is unavailable.
 *
 * @example
 * ```tsx
 * import {
 *   GlassPanel,
 *   NeonBorder,
 *   ChromaticLoader,
 *   WebGLBackground,
 *   BlurBackProvider,
 *   BlurBackContent,
 *   StaggeredList,
 *   MicroInteraction,
 *   Z_LAYERS
 * } from '@/components/effects';
 *
 * // Glass panel with blur
 * <GlassPanel blurAmount={16}>
 *   <p>Content with glass background</p>
 * </GlassPanel>
 *
 * // Neon border with traveling light
 * <NeonBorder color="#8b5cf6" active={isHovered}>
 *   <button>Hover me</button>
 * </NeonBorder>
 *
 * // Loading state with chromatic aberration
 * <ChromaticLoader isLoading={isLoading}>
 *   <DataTable />
 * </ChromaticLoader>
 *
 * // Blur-back effect for modals
 * <BlurBackProvider>
 *   <BlurBackContent>
 *     <MainContent />
 *   </BlurBackContent>
 *   <Modal />
 * </BlurBackProvider>
 *
 * // Staggered list animation
 * <StaggeredList
 *   items={users}
 *   renderItem={(user) => <UserCard user={user} />}
 *   keyExtractor={(user) => user.id}
 * />
 *
 * // Micro-interaction hover effect
 * <MicroInteraction variant="tilt">
 *   <Card>Content</Card>
 * </MicroInteraction>
 * ```
 */

// =============================================================================
// GLASS PANEL
// =============================================================================

export { GlassPanel } from './GlassPanel';
export type { GlassPanelProps } from './GlassPanel';

// =============================================================================
// GLASS LAYER (Phase 33 - Glass Depth System)
// =============================================================================

export {
  GlassLayer,
  GlassBackground,
  GlassContent,
  GlassOverlay,
  GLASS_Z_LAYERS,
} from './GlassLayer';
export type {
  GlassLayerProps,
  GlassDepth,
  GlassZLayer,
} from './GlassLayer';

// =============================================================================
// NEON BORDER
// =============================================================================

export { NeonBorder } from './NeonBorder';
export type { NeonBorderProps } from './NeonBorder';

// =============================================================================
// CHROMATIC LOADER
// =============================================================================

export { ChromaticLoader } from './ChromaticLoader';
export type { ChromaticLoaderProps } from './ChromaticLoader';

// =============================================================================
// WEBGL BACKGROUND
// =============================================================================

export { WebGLBackground, Z_LAYERS } from './WebGLBackground';
export type { WebGLBackgroundProps, ZLayer } from './WebGLBackground';

// =============================================================================
// BLUR BACK EFFECT
// =============================================================================

export {
  BlurBackProvider,
  BlurBackContent,
  useBlurBack,
  useBlurBackEffect,
  blurPresets,
} from './BlurBack';
export type { BlurBackContextValue, BlurBackProviderProps, BlurBackContentProps, BlurPreset } from './BlurBack';

// =============================================================================
// STAGGERED LIST
// =============================================================================

export { StaggeredList, StaggeredGrid, StaggeredChildren } from './StaggeredList';
export type { StaggeredListProps, StaggeredGridProps, StaggeredChildrenProps } from './StaggeredList';

// =============================================================================
// MICRO INTERACTION
// =============================================================================

export {
  MicroInteraction,
  TiltCard,
  MagneticButton,
  HoverShift,
} from './MicroInteraction';
export type { MicroInteractionProps, TiltCardProps, MagneticButtonProps, HoverShiftProps } from './MicroInteraction';

// =============================================================================
// DEEP GLOW
// =============================================================================

export { DeepGlow } from './DeepGlow';
export type { DeepGlowProps } from './DeepGlow';

// =============================================================================
// PULSE RING
// =============================================================================

export {
  PulseRing,
  SuccessPulseRing,
  WarningPulseRing,
  DangerPulseRing,
  PrimaryPulseRing,
} from './PulseRing';
export type { PulseRingProps } from './PulseRing';

// =============================================================================
// DATA PARTICLES
// =============================================================================

export {
  DataParticles,
  UploadParticles,
  DownloadParticles,
  ProcessingParticles,
  IdleParticles,
} from './DataParticles';
export type { DataParticlesProps } from './DataParticles';

// =============================================================================
// ATMOSPHERIC FOG - Phase 30
// =============================================================================

export {
  AtmosphericFog,
  AtmosphericFogStatic,
  AtmosphericFogAuto,
} from './AtmosphericFog';
export type { AtmosphericFogProps } from './AtmosphericFog';

export { AtmosphericFogConnected } from './AtmosphericFogConnected';
export type { AtmosphericFogConnectedProps } from './AtmosphericFogConnected';

// =============================================================================
// NEON TRAILS - Phase 31
// =============================================================================

export {
  NeonTrails,
  ConnectedNeonTrails,
  useConnectionPoints,
  useTrailTriggers,
} from './NeonTrails';
export type {
  NeonTrailsProps,
  ConnectedNeonTrailsProps,
  TrailPoint,
  Trail,
  TrailTrigger,
  ConnectionPoint,
} from './NeonTrails';

// =============================================================================
// RIPPLE EFFECT - Phase 35
// =============================================================================

export {
  Ripple,
  RippleButton,
  RippleCard,
  RipplePrimary,
} from './Ripple';
export type { RippleProps, RippleButtonProps, RippleCardProps } from './Ripple';

// =============================================================================
// PARTICLE FIELD - Phase 32 (Ambient Dust Motes)
// =============================================================================

export { ParticleField } from './ParticleField';
export type { ParticleFieldProps } from './ParticleField';

// =============================================================================
// ENERGY SPARKS - Phase 32 (Active Element Feedback)
// =============================================================================

export { EnergySparks, SparkBurst, useEnergySparks } from './EnergySparks';
export type {
  EnergySparkProps,
  SparkBurstProps,
  UseEnergySparkOptions,
} from './EnergySparks';

// =============================================================================
// TELEMETRY BURST - Phase 32 (Data Change Visualization)
// =============================================================================

export { TelemetryBurst, DataBurst, useTelemetryBurst } from './TelemetryBurst';
export type {
  TelemetryBurstProps,
  DataBurstProps,
  BurstParticle,
  UseTelemetryBurstOptions,
  UseTelemetryBurstReturn,
} from './TelemetryBurst';

// =============================================================================
// RING ATTRACTOR - Phase 32 (Processing State Particle Flow)
// =============================================================================

export { RingAttractor, useRingAttraction } from './RingAttractor';
export type { RingAttractorProps, UseRingAttractionReturn } from './RingAttractor';

// =============================================================================
// CHROMATIC LOADING (Phase 34 - Premium Loading States)
// =============================================================================

export {
  ChromaticLoading,
  SubtleChromaticLoading,
  IntenseChromaticLoading,
  FastChromaticLoading,
} from './ChromaticLoading';
export type { ChromaticLoadingProps } from './ChromaticLoading';

// =============================================================================
// SCAN LINES (Phase 34 - Premium Loading States)
// =============================================================================

export {
  ScanLines,
  HeavyScanLines,
  SubtleScanLines,
  FastScanLines,
  PurpleScanLines,
  ScanLineBackground,
} from './ScanLines';
export type { ScanLinesProps, ScanLineBackgroundProps } from './ScanLines';

// =============================================================================
// HOLOGRAPHIC SHIMMER (Phase 34 - Premium Loading States)
// =============================================================================

export {
  HoloShimmer,
  SubtleHoloShimmer,
  IntenseHoloShimmer,
  FastHoloShimmer,
  PurpleShimmer,
  SkeletonShimmer,
} from './HoloShimmer';
export type { HoloShimmerProps, SkeletonShimmerProps } from './HoloShimmer';

// =============================================================================
// DATA STREAM (Phase 34 - Premium Loading States)
// =============================================================================

export {
  DataStream,
  DenseDataStream,
  SparseDataStream,
  FastDataStream,
  BinaryDataStream,
  BlueDataStream,
  CyanDataStream,
  DataStreamBackground,
} from './DataStream';
export type { DataStreamProps, DataStreamBackgroundProps } from './DataStream';

// =============================================================================
// LOADING OVERLAY (Phase 34 - Premium Loading States)
// =============================================================================

export {
  LoadingOverlay,
  MinimalLoadingOverlay,
  CinematicLoadingOverlay,
  MatrixLoadingOverlay,
  RetroLoadingOverlay,
  HolographicLoadingOverlay,
  CompactLoading,
} from './LoadingOverlay';
export type { LoadingOverlayProps, CompactLoadingProps, LoadingPreset, LoadingSize } from './LoadingOverlay';

// =============================================================================
// LOADING RING (Phase 34 - Premium Loading States)
// =============================================================================

export {
  LoadingRing,
  SmallLoadingRing,
  LargeLoadingRing,
  HeroLoadingRing,
  FastLoadingRing,
} from './LoadingRing';
export type { LoadingRingProps } from './LoadingRing';
