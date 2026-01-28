/**
 * Default Optimization Presets
 *
 * Built-in presets that ship with Opta. These cannot be deleted
 * but can be selected as active presets.
 */

import type { OptimizationPreset } from '@/types/presets';

export const DEFAULT_PRESETS: OptimizationPreset[] = [
  {
    id: 'max-fps',
    name: 'Maximum FPS',
    icon: 'Zap',
    description: 'Prioritize frame rate above all else',
    isBuiltIn: true,
    priorities: {
      fps: 100,
      quality: 30,
      thermals: 40,
      noise: 20,
      latency: 80,
    },
    settings: {
      autoApplyStealthMode: true,
      aggressiveOptimization: true,
      preserveVisualQuality: false,
    },
  },
  {
    id: 'stream-friendly',
    name: 'Stream-Friendly',
    icon: 'Video',
    description: 'Balance game performance with encoding overhead',
    isBuiltIn: true,
    priorities: {
      fps: 70,
      quality: 60,
      thermals: 50,
      noise: 40,
      latency: 60,
    },
    settings: {
      autoApplyStealthMode: true,
      aggressiveOptimization: false,
      preserveVisualQuality: true,
    },
  },
  {
    id: 'quiet-mode',
    name: 'Quiet Mode',
    icon: 'Volume2',
    description: 'Minimize fan noise and heat',
    isBuiltIn: true,
    priorities: {
      fps: 50,
      quality: 60,
      thermals: 90,
      noise: 100,
      latency: 40,
    },
    settings: {
      autoApplyStealthMode: false,
      aggressiveOptimization: false,
      preserveVisualQuality: true,
    },
  },
  {
    id: 'competitive',
    name: 'Competitive',
    icon: 'Target',
    description: 'Minimum input lag for esports',
    isBuiltIn: true,
    priorities: {
      fps: 90,
      quality: 20,
      thermals: 30,
      noise: 10,
      latency: 100,
    },
    settings: {
      autoApplyStealthMode: true,
      aggressiveOptimization: true,
      preserveVisualQuality: false,
    },
  },
];
