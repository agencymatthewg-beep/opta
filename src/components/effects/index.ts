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
