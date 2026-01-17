/**
 * Opta Audio System
 *
 * Premium sound design integration following DESIGN_SYSTEM.md Part 11.
 * "Crystalline + Spatial" audio aesthetic with glass-like chimes,
 * resonant tones, and echoing void-like acoustic space.
 *
 * Key features:
 * - Muted by default (user must enable)
 * - Web Audio API synthesized sounds (no external files)
 * - Category-based volume control (ring, ui, ambient)
 * - Graceful fallback if Web Audio unavailable
 *
 * @example
 * ```tsx
 * import { playSound, initAudio } from '@/lib/audio';
 *
 * // Initialize on user interaction
 * const handleClick = async () => {
 *   await initAudio();
 *   playSound('ui-click');
 * };
 * ```
 */

export {
  AudioEngine,
  playSound,
  startLoop,
  stopLoop,
  toggleAudioMute,
  setAudioMuted,
  setMasterVolume,
  getAudioPreferences,
  setAudioPreferences,
  initAudio,
  isWebAudioAvailable,
} from './AudioEngine';

export type {
  SoundName,
  RingSoundName,
  UISoundName,
  AmbientSoundName,
  SoundCategory,
  AudioPreferences,
} from './types';

export {
  DEFAULT_AUDIO_PREFERENCES,
  SOUND_DEFINITIONS,
  AUDIO_PREFERENCES_KEY,
} from './types';
