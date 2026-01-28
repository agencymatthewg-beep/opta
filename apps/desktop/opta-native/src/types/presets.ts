/**
 * Optimization Preset Types
 *
 * Defines the structure for user-configurable optimization presets
 * like "Max FPS", "Stream-friendly", "Quiet Mode", etc.
 */

export interface OptimizationPriorities {
  fps: number;        // 0-100 - Frame rate priority
  quality: number;    // 0-100 - Visual quality priority
  thermals: number;   // 0-100 - Temperature management priority
  noise: number;      // 0-100 - Fan noise reduction priority
  latency: number;    // 0-100 - Input latency reduction priority
}

export interface PresetSettings {
  autoApplyStealthMode: boolean;    // Automatically apply stealth mode with this preset
  aggressiveOptimization: boolean;  // Use more aggressive optimization strategies
  preserveVisualQuality: boolean;   // Prioritize visual fidelity when optimizing
}

export interface OptimizationPreset {
  id: string;
  name: string;
  icon: string;           // Lucide icon name
  description: string;
  isBuiltIn: boolean;     // Built-in presets cannot be deleted
  priorities: OptimizationPriorities;
  settings: PresetSettings;
}

export type PresetId = string;
