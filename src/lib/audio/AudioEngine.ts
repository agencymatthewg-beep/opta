/**
 * AudioEngine - Singleton audio manager for Opta
 *
 * Core audio system using Web Audio API. All sounds are synthesized
 * programmatically using oscillators and effects - no external audio files.
 *
 * Key features:
 * - Muted by default (user must enable)
 * - Preferences persisted to localStorage
 * - Lazy initialization (only on user interaction)
 * - Graceful fallback if Web Audio unavailable
 * - Category-based volume control (ring, ui, ambient)
 *
 * @see DESIGN_SYSTEM.md Part 11: Audio Design
 */

import { AudioSynthesizer } from './synthesizer';
import {
  type SoundName,
  type SoundCategory,
  type AudioPreferences,
  DEFAULT_AUDIO_PREFERENCES,
  SOUND_DEFINITIONS,
  AUDIO_PREFERENCES_KEY,
} from './types';

/**
 * Check if Web Audio API is available
 */
export function isWebAudioAvailable(): boolean {
  return typeof window !== 'undefined' && 'AudioContext' in window;
}

/**
 * Active looping sound handle
 */
interface LoopHandle {
  source: OscillatorNode;
  gainNode: GainNode;
}

/**
 * AudioEngine class - singleton pattern
 */
class AudioEngineImpl {
  private static instance: AudioEngineImpl | null = null;

  private audioContext: AudioContext | null = null;
  private synthesizer: AudioSynthesizer | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  private preferences: AudioPreferences;
  private loopingSounds: Map<SoundName, LoopHandle> = new Map();

  private constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AudioEngineImpl {
    if (!AudioEngineImpl.instance) {
      AudioEngineImpl.instance = new AudioEngineImpl();
    }
    return AudioEngineImpl.instance;
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): AudioPreferences {
    try {
      const stored = localStorage.getItem(AUDIO_PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AudioPreferences>;
        return { ...DEFAULT_AUDIO_PREFERENCES, ...parsed };
      }
    } catch {
      // Fall through to defaults
    }
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(this.preferences));
    } catch {
      console.debug('[AudioEngine] Could not save preferences to localStorage');
    }
  }

  /**
   * Initialize the audio context (requires user interaction)
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    if (!isWebAudioAvailable()) {
      console.debug('[AudioEngine] Web Audio API not available');
      return false;
    }

    try {
      this.audioContext = new AudioContext();
      this.synthesizer = new AudioSynthesizer(this.audioContext);

      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.updateMasterVolume();

      // Initialize reverb (needs to be done after context creation)
      await this.synthesizer.initReverb();

      this.initialized = true;
      console.debug('[AudioEngine] Initialized successfully');
      return true;
    } catch (error) {
      console.debug('[AudioEngine] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Resume audio context if suspended (browser autoplay policy)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Check if audio engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if audio is currently muted
   */
  isMuted(): boolean {
    return this.preferences.muted;
  }

  /**
   * Set mute state
   */
  setMuted(muted: boolean): void {
    this.preferences.muted = muted;
    this.updateMasterVolume();
    this.savePreferences();

    // Stop all looping sounds when muted
    if (muted) {
      this.stopAllLoops();
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.setMuted(!this.preferences.muted);
    return this.preferences.muted;
  }

  /**
   * Get master volume (0-1)
   */
  getMasterVolume(): number {
    return this.preferences.masterVolume;
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    this.preferences.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateMasterVolume();
    this.savePreferences();
  }

  /**
   * Update master gain node based on preferences
   */
  private updateMasterVolume(): void {
    if (this.masterGain) {
      const targetVolume = this.preferences.muted ? 0 : this.preferences.masterVolume;
      this.masterGain.gain.setValueAtTime(targetVolume, this.audioContext?.currentTime ?? 0);
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): AudioPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  setPreferences(prefs: Partial<AudioPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
    this.updateMasterVolume();
    this.savePreferences();

    // Handle ambient state changes
    if ('ambientEnabled' in prefs && !prefs.ambientEnabled) {
      this.stopLoop('ambient-hum');
    }
  }

  /**
   * Check if a category is enabled
   */
  private isCategoryEnabled(category: SoundCategory): boolean {
    switch (category) {
      case 'ui':
        return this.preferences.uiSoundsEnabled;
      case 'ring':
        return this.preferences.ringSoundsEnabled;
      case 'ambient':
        return this.preferences.ambientEnabled;
      default:
        return true;
    }
  }

  /**
   * Get volume for a category
   */
  private getCategoryVolume(category: SoundCategory): number {
    if (category === 'ambient') {
      return this.preferences.ambientVolume;
    }
    return 1;
  }

  /**
   * Play a sound
   */
  play(name: SoundName): void {
    // Check if initialized and not muted
    if (!this.initialized || !this.audioContext || !this.synthesizer || !this.masterGain) {
      return;
    }

    if (this.preferences.muted) {
      return;
    }

    // Get sound definition
    const definition = SOUND_DEFINITIONS[name];
    if (!definition) {
      console.warn(`[AudioEngine] Unknown sound: ${name}`);
      return;
    }

    // Check category enabled
    if (!this.isCategoryEnabled(definition.category)) {
      return;
    }

    // Skip looping sounds (use startLoop instead)
    if (definition.loop) {
      console.debug(`[AudioEngine] Use startLoop() for looping sound: ${name}`);
      return;
    }

    // Resume context if needed
    void this.resume();

    // Calculate volume
    const volume = (definition.baseVolume ?? 0.5) * this.getCategoryVolume(definition.category);

    // Synthesize the sound
    this.synthesizer.synthesize(name, this.masterGain, volume);
  }

  /**
   * Start a looping sound
   */
  startLoop(name: SoundName): void {
    // Check if already playing
    if (this.loopingSounds.has(name)) {
      return;
    }

    // Check if initialized and not muted
    if (!this.initialized || !this.audioContext || !this.synthesizer || !this.masterGain) {
      return;
    }

    if (this.preferences.muted) {
      return;
    }

    // Get sound definition
    const definition = SOUND_DEFINITIONS[name];
    if (!definition || !definition.loop) {
      console.warn(`[AudioEngine] Not a looping sound: ${name}`);
      return;
    }

    // Check category enabled
    if (!this.isCategoryEnabled(definition.category)) {
      return;
    }

    // Resume context if needed
    void this.resume();

    // Calculate volume
    const volume = (definition.baseVolume ?? 0.5) * this.getCategoryVolume(definition.category);

    // Create gain node for this loop
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(this.masterGain);

    // Create the appropriate looping source
    let source: OscillatorNode;

    switch (name) {
      case 'ring-hum':
        source = this.synthesizer.createRingHumSource(gainNode, volume);
        break;
      case 'ring-processing':
        source = this.synthesizer.createProcessingSource(gainNode, volume);
        break;
      case 'ambient-hum':
        source = this.synthesizer.createAmbientHumSource(gainNode, volume);
        break;
      default:
        console.warn(`[AudioEngine] Unknown looping sound: ${name}`);
        return;
    }

    this.loopingSounds.set(name, { source, gainNode });
  }

  /**
   * Stop a looping sound
   */
  stopLoop(name: SoundName): void {
    const handle = this.loopingSounds.get(name);
    if (!handle) return;

    try {
      // Fade out before stopping
      const ctx = this.audioContext;
      if (ctx) {
        handle.gainNode.gain.setValueAtTime(handle.gainNode.gain.value, ctx.currentTime);
        handle.gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        setTimeout(() => {
          try {
            handle.source.stop();
            handle.source.disconnect();
            handle.gainNode.disconnect();
          } catch {
            // Already stopped
          }
        }, 150);
      } else {
        handle.source.stop();
        handle.source.disconnect();
        handle.gainNode.disconnect();
      }
    } catch {
      // Already stopped
    }

    this.loopingSounds.delete(name);
  }

  /**
   * Stop all looping sounds
   */
  stopAllLoops(): void {
    for (const name of this.loopingSounds.keys()) {
      this.stopLoop(name);
    }
  }

  /**
   * Check if a loop is playing
   */
  isLoopPlaying(name: SoundName): boolean {
    return this.loopingSounds.has(name);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAllLoops();

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.synthesizer = null;
    this.masterGain = null;
    this.initialized = false;
  }
}

// Export singleton accessor
export const AudioEngine = AudioEngineImpl.getInstance();

// Export convenience functions
export function playSound(name: SoundName): void {
  AudioEngine.play(name);
}

export function startLoop(name: SoundName): void {
  AudioEngine.startLoop(name);
}

export function stopLoop(name: SoundName): void {
  AudioEngine.stopLoop(name);
}

export function toggleAudioMute(): boolean {
  return AudioEngine.toggleMute();
}

export function setAudioMuted(muted: boolean): void {
  AudioEngine.setMuted(muted);
}

export function setMasterVolume(volume: number): void {
  AudioEngine.setMasterVolume(volume);
}

export function getAudioPreferences(): AudioPreferences {
  return AudioEngine.getPreferences();
}

export function setAudioPreferences(prefs: Partial<AudioPreferences>): void {
  AudioEngine.setPreferences(prefs);
}

export async function initAudio(): Promise<boolean> {
  return AudioEngine.init();
}
