/**
 * Audio System Types
 *
 * Type definitions for the Opta audio system.
 * Follows DESIGN_SYSTEM.md Part 11: Audio Design guidelines.
 */

/**
 * Ring state sounds - tied to OptaRing state transitions
 */
export type RingSoundName =
  | 'ring-wake'      // Soft whoosh rising tone (300ms)
  | 'ring-hum'       // Very subtle looped hum for active idle
  | 'ring-processing' // Pulsing tone synced with animation
  | 'ring-explosion' // Satisfying boom with reverb tail (500ms)
  | 'ring-sleep';    // Descending tone fade (400ms)

/**
 * UI interaction sounds - subtle feedback for user actions
 */
export type UISoundName =
  | 'ui-click'       // Soft tick (50ms)
  | 'ui-hover'       // Very subtle blip (30ms)
  | 'ui-success'     // Ascending chime (200ms)
  | 'ui-error'       // Low tone (150ms)
  | 'ui-toggle';     // Mechanical click (40ms)

/**
 * Ambient sounds - background atmosphere
 */
export type AmbientSoundName =
  | 'ambient-hum';   // Sci-fi computer hum (looped)

/**
 * All available sound names
 */
export type SoundName = RingSoundName | UISoundName | AmbientSoundName;

/**
 * Sound categories for volume control
 */
export type SoundCategory = 'ring' | 'ui' | 'ambient';

/**
 * Audio preferences stored in localStorage
 */
export interface AudioPreferences {
  /** Master mute state */
  muted: boolean;
  /** Master volume (0-1) */
  masterVolume: number;
  /** UI sounds enabled */
  uiSoundsEnabled: boolean;
  /** Ring sounds enabled */
  ringSoundsEnabled: boolean;
  /** Ambient sounds enabled (disabled by default) */
  ambientEnabled: boolean;
  /** Ambient volume (0-1, typically very low) */
  ambientVolume: number;
}

/**
 * Default audio preferences
 */
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  muted: true, // Muted by default - user must enable
  masterVolume: 0.7,
  uiSoundsEnabled: true,
  ringSoundsEnabled: true,
  ambientEnabled: false, // Disabled by default
  ambientVolume: 0.08, // Very low (5-10% as per spec)
};

/**
 * Sound definition for the audio engine
 */
export interface SoundDefinition {
  /** Sound name identifier */
  name: SoundName;
  /** Category for volume control */
  category: SoundCategory;
  /** Whether this sound loops */
  loop?: boolean;
  /** Base volume (0-1) */
  baseVolume?: number;
  /** Duration hint for synthesized sounds (ms) */
  duration?: number;
}

/**
 * All sound definitions
 */
export const SOUND_DEFINITIONS: Record<SoundName, SoundDefinition> = {
  // Ring sounds
  'ring-wake': {
    name: 'ring-wake',
    category: 'ring',
    duration: 300,
    baseVolume: 0.6,
  },
  'ring-hum': {
    name: 'ring-hum',
    category: 'ring',
    loop: true,
    baseVolume: 0.15,
  },
  'ring-processing': {
    name: 'ring-processing',
    category: 'ring',
    loop: true,
    baseVolume: 0.3,
  },
  'ring-explosion': {
    name: 'ring-explosion',
    category: 'ring',
    duration: 500,
    baseVolume: 0.7,
  },
  'ring-sleep': {
    name: 'ring-sleep',
    category: 'ring',
    duration: 400,
    baseVolume: 0.5,
  },

  // UI sounds
  'ui-click': {
    name: 'ui-click',
    category: 'ui',
    duration: 50,
    baseVolume: 0.4,
  },
  'ui-hover': {
    name: 'ui-hover',
    category: 'ui',
    duration: 30,
    baseVolume: 0.2,
  },
  'ui-success': {
    name: 'ui-success',
    category: 'ui',
    duration: 200,
    baseVolume: 0.5,
  },
  'ui-error': {
    name: 'ui-error',
    category: 'ui',
    duration: 150,
    baseVolume: 0.45,
  },
  'ui-toggle': {
    name: 'ui-toggle',
    category: 'ui',
    duration: 40,
    baseVolume: 0.35,
  },

  // Ambient sounds
  'ambient-hum': {
    name: 'ambient-hum',
    category: 'ambient',
    loop: true,
    baseVolume: 0.08,
  },
};

/**
 * Local storage key for audio preferences
 */
export const AUDIO_PREFERENCES_KEY = 'opta-audio-preferences';
