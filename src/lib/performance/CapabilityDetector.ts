/**
 * CapabilityDetector - WebGL Capability Detection and Hardware Tier System
 *
 * Detects WebGL version, GPU capabilities, and classifies hardware into tiers
 * to enable dynamic quality scaling across the Opta application.
 *
 * Tiers:
 * - High: WebGL2, dedicated GPU, >4GB VRAM (estimated)
 * - Medium: WebGL2, integrated GPU
 * - Low: WebGL1 or old hardware
 * - Fallback: No WebGL support
 *
 * @see DESIGN_SYSTEM.md - Performance Guidelines
 */

// =============================================================================
// TYPES
// =============================================================================

export type HardwareTier = 'high' | 'medium' | 'low' | 'fallback';

export interface WebGLCapabilities {
  /** WebGL version (0 = none, 1, 2) */
  version: 0 | 1 | 2;
  /** Maximum texture size in pixels */
  maxTextureSize: number;
  /** GPU vendor string */
  vendor: string;
  /** GPU renderer string */
  renderer: string;
  /** Whether using a dedicated GPU */
  isDedicatedGPU: boolean;
  /** Estimated VRAM in GB (heuristic) */
  estimatedVRAM: number;
  /** Maximum render buffer size */
  maxRenderBufferSize: number;
  /** Maximum vertex uniform vectors */
  maxVertexUniforms: number;
  /** Maximum fragment uniform vectors */
  maxFragmentUniforms: number;
  /** Maximum varying vectors */
  maxVaryings: number;
  /** WebGL extensions available */
  extensions: string[];
  /** Support for floating point textures */
  floatTextureSupport: boolean;
  /** Support for instanced rendering */
  instancedRenderingSupport: boolean;
  /** Support for anisotropic filtering */
  anisotropicFilteringSupport: boolean;
  /** Maximum anisotropy level */
  maxAnisotropy: number;
}

export interface CapabilityReport {
  /** Hardware tier classification */
  tier: HardwareTier;
  /** Detailed WebGL capabilities */
  capabilities: WebGLCapabilities;
  /** Timestamp of detection */
  timestamp: number;
  /** User agent for debugging */
  userAgent: string;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
  /** Whether this is a mobile device */
  isMobile: boolean;
  /** Whether this is a touch device */
  isTouch: boolean;
  /** Battery API available and on battery */
  onBattery: boolean | null;
}

// =============================================================================
// KNOWN GPU PATTERNS
// =============================================================================

/**
 * Patterns to identify dedicated GPUs from renderer string
 */
const DEDICATED_GPU_PATTERNS = [
  // NVIDIA
  /nvidia/i,
  /geforce/i,
  /quadro/i,
  /rtx/i,
  /gtx/i,
  // AMD
  /radeon rx/i,
  /radeon pro/i,
  /radeon vii/i,
  /vega/i,
  // Apple Silicon (dedicated GPU portion)
  /apple m\d+ (pro|max|ultra)/i,
];

/**
 * Patterns to identify integrated GPUs
 * Exported for use in VRAM estimation and GPU classification
 */
export const INTEGRATED_GPU_PATTERNS = [
  /intel/i,
  /intel.*uhd/i,
  /intel.*iris/i,
  /adreno/i,
  /mali/i,
  /powervr/i,
  /apple m\d+$/i, // Base M1/M2 (still good, but shared memory)
];

/**
 * Patterns indicating low-end or old hardware
 */
const LOW_END_PATTERNS = [
  /intel.*hd graphics/i,
  /intel.*hd 4000/i,
  /intel.*hd 3000/i,
  /intel.*hd 2000/i,
  /mali-4/i,
  /mali-t/i,
  /adreno 3/i,
  /adreno 4/i,
  /powervr sgx/i,
  /angle.*direct3d9/i,
];

/**
 * VRAM estimation heuristics based on GPU model
 */
const VRAM_ESTIMATES: Record<string, number> = {
  // NVIDIA RTX 40 Series
  'rtx 4090': 24,
  'rtx 4080': 16,
  'rtx 4070': 12,
  'rtx 4060': 8,
  // NVIDIA RTX 30 Series
  'rtx 3090': 24,
  'rtx 3080': 10,
  'rtx 3070': 8,
  'rtx 3060': 12,
  // Apple Silicon
  'm3 ultra': 192, // Unified memory
  'm3 max': 96,
  'm3 pro': 36,
  'm2 ultra': 192,
  'm2 max': 96,
  'm2 pro': 32,
  'm1 ultra': 128,
  'm1 max': 64,
  'm1 pro': 32,
  // Default estimates
  'default_dedicated': 6,
  'default_integrated': 2,
  'default_mobile': 1,
};

// =============================================================================
// CAPABILITY DETECTION FUNCTIONS
// =============================================================================

/**
 * Get WebGL rendering context with version detection
 */
function getWebGLContext(): {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  version: 0 | 1 | 2;
} {
  const canvas = document.createElement('canvas');

  // Try WebGL2 first
  const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  if (gl2) {
    return { gl: gl2, version: 2 };
  }

  // Fall back to WebGL1
  const gl1 = canvas.getContext('webgl') as WebGLRenderingContext | null;
  if (gl1) {
    return { gl: gl1, version: 1 };
  }

  return { gl: null, version: 0 };
}

/**
 * Get GPU vendor and renderer info via WEBGL_debug_renderer_info extension
 */
function getGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): {
  vendor: string;
  renderer: string;
} {
  // Try to get unmasked info from debug extension
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

  if (debugInfo) {
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown',
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown',
    };
  }

  // Fallback to masked values
  return {
    vendor: gl.getParameter(gl.VENDOR) || 'Unknown',
    renderer: gl.getParameter(gl.RENDERER) || 'Unknown',
  };
}

/**
 * Check if GPU appears to be a dedicated graphics card
 */
function isDedicatedGPU(renderer: string): boolean {
  const rendererLower = renderer.toLowerCase();

  // Check for low-end patterns first (takes precedence)
  for (const pattern of LOW_END_PATTERNS) {
    if (pattern.test(rendererLower)) {
      return false;
    }
  }

  // Check for dedicated GPU patterns
  for (const pattern of DEDICATED_GPU_PATTERNS) {
    if (pattern.test(rendererLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Estimate VRAM based on GPU renderer string
 */
function estimateVRAM(renderer: string, isDedicated: boolean, isMobile: boolean): number {
  const rendererLower = renderer.toLowerCase();

  // Check for known GPU models
  for (const [model, vram] of Object.entries(VRAM_ESTIMATES)) {
    if (rendererLower.includes(model)) {
      return vram;
    }
  }

  // Default estimates based on GPU type
  if (isDedicated) {
    return VRAM_ESTIMATES['default_dedicated'];
  }
  if (isMobile) {
    return VRAM_ESTIMATES['default_mobile'];
  }
  return VRAM_ESTIMATES['default_integrated'];
}

/**
 * Get all available WebGL extensions
 */
function getExtensions(gl: WebGLRenderingContext | WebGL2RenderingContext): string[] {
  return gl.getSupportedExtensions() || [];
}

/**
 * Check for floating point texture support
 */
function hasFloatTextureSupport(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  extensions: string[]
): boolean {
  // WebGL2 has built-in float texture support
  if (gl instanceof WebGL2RenderingContext) {
    return true;
  }

  // WebGL1 needs extensions
  return (
    extensions.includes('OES_texture_float') ||
    extensions.includes('OES_texture_half_float')
  );
}

/**
 * Check for instanced rendering support
 */
function hasInstancedRenderingSupport(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  extensions: string[]
): boolean {
  // WebGL2 has built-in instanced rendering
  if (gl instanceof WebGL2RenderingContext) {
    return true;
  }

  // WebGL1 needs extension
  return extensions.includes('ANGLE_instanced_arrays');
}

/**
 * Get anisotropic filtering info
 */
function getAnisotropicInfo(
  gl: WebGLRenderingContext | WebGL2RenderingContext
): { supported: boolean; maxAnisotropy: number } {
  const ext =
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
    gl.getExtension('MOZ_EXT_texture_filter_anisotropic');

  if (ext) {
    return {
      supported: true,
      maxAnisotropy: gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1,
    };
  }

  return { supported: false, maxAnisotropy: 1 };
}

/**
 * Detect if running on a mobile device
 */
function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  return (
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
    (navigator.maxTouchPoints > 0 && /mac/i.test(userAgent))
  );
}

/**
 * Detect if device is touch-capable
 */
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

/**
 * Check battery status (if API available)
 */
async function getBatteryStatus(): Promise<boolean | null> {
  if (typeof navigator === 'undefined') return null;

  // Battery API may not be available in all browsers
  if ('getBattery' in navigator) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const battery = await (navigator as any).getBattery();
      return !battery.charging && battery.level < 0.99;
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// TIER CLASSIFICATION
// =============================================================================

/**
 * Classify hardware into performance tiers based on capabilities
 */
function classifyTier(capabilities: WebGLCapabilities, isMobile: boolean): HardwareTier {
  // No WebGL = Fallback tier
  if (capabilities.version === 0) {
    return 'fallback';
  }

  // Check for low-end patterns
  const rendererLower = capabilities.renderer.toLowerCase();
  for (const pattern of LOW_END_PATTERNS) {
    if (pattern.test(rendererLower)) {
      return 'low';
    }
  }

  // WebGL1-only devices are generally lower-end
  if (capabilities.version === 1) {
    return 'low';
  }

  // High tier: WebGL2 + dedicated GPU + estimated >4GB VRAM
  if (
    capabilities.version === 2 &&
    capabilities.isDedicatedGPU &&
    capabilities.estimatedVRAM >= 4 &&
    capabilities.maxTextureSize >= 8192
  ) {
    return 'high';
  }

  // Medium tier: WebGL2 with decent capabilities
  if (
    capabilities.version === 2 &&
    capabilities.maxTextureSize >= 4096 &&
    capabilities.instancedRenderingSupport
  ) {
    // Downgrade mobile devices to medium even with good GPUs
    if (isMobile && capabilities.isDedicatedGPU) {
      return 'medium';
    }
    // Non-dedicated but still capable
    return capabilities.isDedicatedGPU ? 'high' : 'medium';
  }

  // Default to low if nothing else matches
  return 'low';
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect all WebGL capabilities and classify hardware tier
 *
 * @returns Complete capability report with tier classification
 *
 * @example
 * ```tsx
 * const report = await detectCapabilities();
 * console.log(`Hardware tier: ${report.tier}`);
 * console.log(`GPU: ${report.capabilities.renderer}`);
 * ```
 */
export async function detectCapabilities(): Promise<CapabilityReport> {
  const isMobile = detectMobile();
  const isTouch = detectTouch();
  const onBattery = await getBatteryStatus();
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { gl, version } = getWebGLContext();

  // No WebGL support
  if (!gl) {
    const nullCapabilities: WebGLCapabilities = {
      version: 0,
      maxTextureSize: 0,
      vendor: 'Unknown',
      renderer: 'Unknown',
      isDedicatedGPU: false,
      estimatedVRAM: 0,
      maxRenderBufferSize: 0,
      maxVertexUniforms: 0,
      maxFragmentUniforms: 0,
      maxVaryings: 0,
      extensions: [],
      floatTextureSupport: false,
      instancedRenderingSupport: false,
      anisotropicFilteringSupport: false,
      maxAnisotropy: 1,
    };

    return {
      tier: 'fallback',
      capabilities: nullCapabilities,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      prefersReducedMotion,
      isMobile,
      isTouch,
      onBattery,
    };
  }

  // Gather capabilities
  const { vendor, renderer } = getGPUInfo(gl);
  const extensions = getExtensions(gl);
  const isDedicated = isDedicatedGPU(renderer);
  const estimatedVRAM = estimateVRAM(renderer, isDedicated, isMobile);
  const anisotropic = getAnisotropicInfo(gl);

  const capabilities: WebGLCapabilities = {
    version,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    vendor,
    renderer,
    isDedicatedGPU: isDedicated,
    estimatedVRAM,
    maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS),
    extensions,
    floatTextureSupport: hasFloatTextureSupport(gl, extensions),
    instancedRenderingSupport: hasInstancedRenderingSupport(gl, extensions),
    anisotropicFilteringSupport: anisotropic.supported,
    maxAnisotropy: anisotropic.maxAnisotropy,
  };

  // Classify tier
  const tier = classifyTier(capabilities, isMobile);

  return {
    tier,
    capabilities,
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    prefersReducedMotion,
    isMobile,
    isTouch,
    onBattery,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if WebGL is available at all
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') || canvas.getContext('webgl')
    );
  } catch {
    return false;
  }
}

/**
 * Check if WebGL2 is available
 */
export function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * Get tier display name for UI
 */
export function getTierDisplayName(tier: HardwareTier): string {
  switch (tier) {
    case 'high':
      return 'High Performance';
    case 'medium':
      return 'Balanced';
    case 'low':
      return 'Power Saver';
    case 'fallback':
      return 'Compatibility';
  }
}

/**
 * Get tier description for UI
 */
export function getTierDescription(tier: HardwareTier): string {
  switch (tier) {
    case 'high':
      return 'Full visual effects enabled for premium hardware';
    case 'medium':
      return 'Optimized effects for integrated graphics';
    case 'low':
      return 'Essential effects for older hardware';
    case 'fallback':
      return 'CSS-only effects for maximum compatibility';
  }
}

export default detectCapabilities;
