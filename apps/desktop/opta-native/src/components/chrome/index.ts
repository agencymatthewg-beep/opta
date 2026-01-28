/**
 * Chrome Components Index
 *
 * GPU-rendered UI chrome system for premium glass effects.
 *
 * @example
 * ```tsx
 * import { ChromeCanvas, ChromePanel, useChromePanel } from '@/components/chrome';
 *
 * // In Layout.tsx - render the WebGL layer
 * <ChromeCanvas />
 *
 * // In components - register panels
 * const ref = useChromePanel({ id: 'my-card', glowBorders: true });
 * <Card ref={ref}>Content</Card>
 * ```
 */

// Canvas and rendering
export { ChromeCanvas } from './ChromeCanvas';
export type { ChromeCanvasProps } from './ChromeCanvas';

// Panel component wrapper
export { ChromePanel } from './ChromePanel';
export type { ChromePanelProps } from './ChromePanel';

// Border component
export { ChromeBorder } from './ChromeBorder';
export type { ChromeBorderProps } from './ChromeBorder';

// Energy reactor
export { EnergyReactor } from './EnergyReactor';
export type { EnergyReactorProps } from './EnergyReactor';

// Atmospheric fog (WebGL)
export { AtmosphericFogWebGL } from './AtmosphericFogWebGL';
export type { AtmosphericFogWebGLProps } from './AtmosphericFogWebGL';

// Post-processing
export { ChromePostProcessing } from './ChromePostProcessing';
export type { ChromePostProcessingProps } from './ChromePostProcessing';

// Portal (dynamic content support)
export { ChromePortal, useChromePortal } from './ChromePortal';
export type { ChromePortalProps, ChromeAnimationPreset, ChromeLifecycleCallbacks } from './ChromePortal';

// Fallback chain (performance optimization)
export {
  ChromeFallbackProvider,
  useChromeFallback,
  useChromeFallbackOptional,
  ChromeFallbackGlass,
  ChromeQualityIndicator,
} from './ChromeFallback';
export type {
  ChromeRenderMode,
  ChromeQualitySettings,
  ChromeFallbackContextValue,
  ChromeFallbackProviderProps,
  ChromeFallbackGlassProps,
  ChromeQualityIndicatorProps,
} from './ChromeFallback';

// Registry types and utilities
export {
  ChromePanelRegistry,
  createChromePanelRegistry,
  normalizeBounds,
  getBoundsFromElement,
  getPanelCenter,
  isPointInPanel,
} from './ChromeRegistry';

export type {
  ChromeEnergyState,
  ChromePanelConfig,
  ChromePanelBounds,
  ChromePanelNormalizedBounds,
  ChromePanelRegistration,
  ChromeRegistryState,
} from './ChromeRegistry';
