/**
 * Explanation utilities for expertise-adaptive content.
 *
 * Provides explanation text for various optimization types,
 * adapting complexity based on user's expertise level.
 * Includes game-specific context where applicable.
 */

import type { ExpertiseLevel } from '@/types/expertise';
import type { DetectedGame } from '@/types/games';

/**
 * Explanation content for each expertise level.
 */
export interface ExplanationContent {
  /** Plain language for beginners */
  simple: string;
  /** Balanced for regular users */
  standard: string;
  /** Full technical details for power users */
  power: string;
  /** Optional technical deep-dive (for power users) */
  technical?: string;
}

/**
 * Complete explanation with all levels.
 */
export interface OptimizationExplanation {
  text: string;
  technical?: string;
}

/**
 * All optimization explanation definitions.
 */
const OPTIMIZATION_EXPLANATIONS: Record<string, {
  simple: (game?: DetectedGame) => string;
  standard: (game?: DetectedGame) => string;
  power: (game?: DetectedGame) => string;
  technical?: (game?: DetectedGame) => string;
}> = {
  resolution_reduction: {
    simple: (game) =>
      `Makes your screen look a bit different to make ${game?.name || 'your game'} run faster.`,
    standard: (game) =>
      `Reduces resolution to boost FPS. Expect ~15% more frames in ${game?.name || 'your game'}.`,
    power: () =>
      'Drops render resolution while maintaining UI scale. GPU renders fewer pixels per frame.',
    technical: () =>
      'Native 1440p to 1080p reduces pixel count by 44% (2560x1440=3.7M to 1920x1080=2.1M). Linear correlation with fill-rate bound scenarios.',
  },
  texture_quality: {
    simple: () => 'Makes surfaces in the game simpler to help it run better.',
    standard: () => 'Lowers texture detail to reduce VRAM usage and improve stability.',
    power: () => 'Reduces texture mipmap levels, freeing VRAM for frame buffer headroom.',
    technical: () =>
      'High to Medium typically halves VRAM footprint per texture asset. Critical for GPUs with <6GB VRAM.',
  },
  shadow_quality: {
    simple: () => 'Makes shadows simpler so your computer can work faster.',
    standard: () => 'Reduces shadow complexity for better performance. Minimal visual impact.',
    power: () =>
      'Lowers shadow map resolution and cascade count, reducing GPU draw calls and fill rate.',
    technical: () =>
      'Shadow maps at 1024x1024 vs 4096x4096 reduce memory bandwidth by 16x. Cascade shadow maps from 4 to 2 halves shadow render passes.',
  },
  anti_aliasing: {
    simple: () => 'Makes edges look a bit different to help your game run smoother.',
    standard: () =>
      'Changes anti-aliasing method. FXAA is fast, TAA is balanced, MSAA is expensive.',
    power: () =>
      'Post-process AA (FXAA) has negligible cost vs geometry-based (MSAA) which scales with polygon count.',
    technical: () =>
      'FXAA: single fullscreen pass. MSAA 4x: 4x geometry processing + resolve pass. TAA: temporal accumulation with motion vectors.',
  },
  vsync: {
    simple: () =>
      "Controls if your game waits for your monitor. Turning it off can make controls feel snappier.",
    standard: () =>
      'V-Sync caps FPS to monitor refresh rate. Disabling reduces input lag but may cause tearing.',
    power: () =>
      'V-Sync introduces up to one frame of input latency (~16.6ms at 60Hz). Consider frame limiters instead.',
    technical: () =>
      'Double buffering V-Sync adds 16.6-33.3ms latency at 60Hz. Triple buffering reduces tearing but increases VRAM usage by 33%.',
  },
  resolution_scale: {
    simple: (game) =>
      `Makes ${game?.name || 'the game'} render at a lower quality then stretches it. Big performance boost!`,
    standard: () => 'Renders at lower resolution then upscales. Massive FPS gain with some blur.',
    power: () =>
      'Dynamic resolution scaling reduces render target size. Use FSR/DLSS if available for better quality.',
    technical: () =>
      '75% scale = 56% pixel count. Combined with temporal upscaling (FSR 2/DLSS) can approach native quality while maintaining 30-50% FPS gain.',
  },
  launch_options: {
    simple: () => 'Special startup settings that can make games run better.',
    standard: () =>
      'Command-line flags that modify game behavior. Can unlock hidden performance settings.',
    power: () =>
      'Engine-specific launch parameters that bypass default initialization or force specific rendering paths.',
    technical: () =>
      'Common flags: -dx11/-dx12 (force API), -novid (skip videos), -high (process priority). Game-specific CVars may require -console.',
  },
  priority: {
    simple: () =>
      'Tells your computer to focus more on your game instead of other programs.',
    standard: () =>
      'Higher CPU priority means the game gets more processing time over background apps.',
    power: () =>
      'Elevates process scheduling priority in the OS scheduler. High priority is safe for single games.',
    technical: () =>
      "Windows: ABOVE_NORMAL vs NORMAL affects quantum allocation. macOS: nice value adjustment. Don't use REALTIME - can freeze system.",
  },
  fullscreen_mode: {
    simple: () =>
      'How your game fills the screen. True fullscreen is fastest but harder to switch away from.',
    standard: () =>
      'Exclusive fullscreen gives direct GPU access. Borderless adds compositor overhead.',
    power: () =>
      'Exclusive fullscreen bypasses DWM, reducing latency. Borderless keeps compositor active but allows alt-tab.',
    technical: () =>
      'Windows DWM adds 8-16ms latency in windowed modes. Fullscreen optimizations (FSO) in Windows 10+ reduce this but exclusive remains fastest.',
  },
  effects_quality: {
    simple: () => 'Controls explosions, sparks, and other visual effects. Lower = faster.',
    standard: () =>
      'Particle effects and post-processing. Lowering reduces GPU load significantly.',
    power: () =>
      'Particle systems and screen-space effects (bloom, DoF, motion blur) consume fill rate and compute.',
    technical: () =>
      'Particle overdraw can consume 30%+ fill rate in explosion-heavy scenes. Screen-space reflections add 2-5ms per frame.',
  },
  draw_distance: {
    simple: () => 'How far you can see in the game. Closer = faster.',
    standard: () =>
      'Reduces how far objects are rendered. Good FPS gain in open world games.',
    power: () =>
      'LOD distance and object culling threshold. Primarily affects CPU-bound draw call scenarios.',
    technical: () =>
      'Each visible object = draw call. Reducing from 100m to 50m can halve draw calls in dense environments. GPU instancing mitigates this.',
  },
  ambient_occlusion: {
    simple: () =>
      'Adds soft shadows in corners and edges. Turning it off helps performance.',
    standard: () =>
      'Simulates how light is blocked in corners. SSAO is cheaper than HBAO+.',
    power: () =>
      'Screen-space ambient occlusion methods vary in cost: SSAO < HBAO < HBAO+ < RTAO.',
    technical: () =>
      'SSAO: 0.5-1ms. HBAO+: 2-3ms. Ray-traced AO: 3-8ms depending on ray count. Quality impact scales with scene complexity.',
  },
};

/**
 * Get optimization explanation adapted to expertise level.
 *
 * @param type - The optimization type key (e.g., "resolution_reduction")
 * @param game - Optional game context for personalized messages
 * @param expertiseLevel - User's expertise level
 * @returns Explanation text and optional technical details
 */
export function getOptimizationExplanation(
  type: string,
  game?: DetectedGame,
  expertiseLevel: ExpertiseLevel = 'standard'
): OptimizationExplanation {
  const explanations = OPTIMIZATION_EXPLANATIONS[type];

  if (!explanations) {
    // Fallback for unknown optimization types
    return {
      text:
        expertiseLevel === 'simple'
          ? 'This setting helps your game run better.'
          : expertiseLevel === 'standard'
            ? 'This optimization improves performance.'
            : 'Optimization applied based on system analysis.',
    };
  }

  // Get text for the current expertise level
  const textFn = explanations[expertiseLevel];
  const text = textFn ? textFn(game) : explanations.standard(game);

  // Get technical details for power users
  const technical =
    expertiseLevel === 'power' && explanations.technical
      ? explanations.technical(game)
      : undefined;

  return { text, technical };
}

/**
 * Get all explanation levels for a given optimization type.
 *
 * @param type - The optimization type key
 * @param game - Optional game context
 * @returns All explanation content for all expertise levels
 */
export function getAllExplanationLevels(
  type: string,
  game?: DetectedGame
): ExplanationContent {
  const explanations = OPTIMIZATION_EXPLANATIONS[type];

  if (!explanations) {
    return {
      simple: 'This setting helps your game run better.',
      standard: 'This optimization improves performance.',
      power: 'Optimization applied based on system analysis.',
    };
  }

  return {
    simple: explanations.simple(game),
    standard: explanations.standard(game),
    power: explanations.power(game),
    technical: explanations.technical?.(game),
  };
}

/**
 * List of all supported optimization types.
 */
export const OPTIMIZATION_TYPES = Object.keys(OPTIMIZATION_EXPLANATIONS);
